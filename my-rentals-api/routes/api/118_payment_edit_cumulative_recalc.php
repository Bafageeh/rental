<?php

use App\Models\Payment;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (!function_exists('mrpec_num')) {
    function mrpec_num($value): float
    {
        if ($value === null || $value === '') return 0.0;
        return is_numeric($value) ? (float) $value : (float) str_replace(',', '', (string) $value);
    }
}

if (!function_exists('mrpec_amount')) {
    function mrpec_amount($payment): float
    {
        return mrpec_num($payment->amount ?? 0);
    }
}

if (!function_exists('mrpec_paid_amount')) {
    function mrpec_paid_amount($payment): float
    {
        // المدفوع الفعلي فقط: ما تم حفظه من البطاقة أو زر دفع.
        // لا نعتمد status=paid وحدها؛ لأنها قد تكون نتيجة عرض حسابي فقط.
        return max(0.0, mrpec_num($payment->paid_amount ?? 0));
    }
}

if (!function_exists('mrpec_due_date')) {
    function mrpec_due_date($payment): string
    {
        return substr((string) ($payment->due_date ?? ''), 0, 10);
    }
}

if (!function_exists('mrpec_sync_contract')) {
    function mrpec_sync_contract(?int $contractId): void
    {
        if (!$contractId || !Schema::hasTable('payments')) return;

        $payments = DB::table('payments')
            ->where('contract_id', $contractId)
            ->orderBy('due_date')
            ->orderBy('id')
            ->get();

        if ($payments->isEmpty()) return;

        $today = now()->toDateString();
        $dueTotal = $payments
            ->filter(fn ($p) => preg_match('/^\d{4}-\d{2}-\d{2}$/', mrpec_due_date($p)) && mrpec_due_date($p) <= $today)
            ->sum(fn ($p) => mrpec_amount($p));
        $paidTotal = $payments->sum(fn ($p) => mrpec_paid_amount($p));
        $lateAmount = max(0.0, $dueTotal - $paidTotal);
        $paymentValue = 0.0;

        foreach ($payments as $payment) {
            $amount = mrpec_amount($payment);
            if ($amount > 0) {
                $paymentValue = $amount;
                break;
            }
        }

        $lateCount = ($lateAmount > 0 && $paymentValue > 0) ? (int) ceil($lateAmount / $paymentValue) : 0;
        $remainingPaidForDisplay = $paidTotal;
        $remainingLateForDisplay = $lateAmount;
        $markedLate = 0;

        foreach ($payments as $payment) {
            $amount = mrpec_amount($payment);
            $dueDate = mrpec_due_date($payment);
            $isDue = preg_match('/^\d{4}-\d{2}-\d{2}$/', $dueDate) && $dueDate <= $today;
            $updates = [];

            if ($amount > 0 && $remainingPaidForDisplay >= $amount) {
                // هذه حالة عرض فقط: القسط مغطى من إجمالي المدفوعات.
                // لا نكتب paid_amount جديد ولا paid_date جديد هنا.
                if (Schema::hasColumn('payments', 'status')) $updates['status'] = 'paid';
                if (Schema::hasColumn('payments', 'remaining_amount')) $updates['remaining_amount'] = 0;
                $remainingPaidForDisplay -= $amount;
            } elseif ($isDue && $markedLate < $lateCount && $remainingLateForDisplay > 0) {
                $remaining = min($amount > 0 ? $amount : $remainingLateForDisplay, $remainingLateForDisplay);
                if (Schema::hasColumn('payments', 'status')) $updates['status'] = 'overdue';
                if (Schema::hasColumn('payments', 'remaining_amount')) $updates['remaining_amount'] = $remaining;
                $remainingPaidForDisplay = 0;
                $remainingLateForDisplay -= $remaining;
                $markedLate++;
            } else {
                if (Schema::hasColumn('payments', 'status')) $updates['status'] = 'due';
                if (Schema::hasColumn('payments', 'remaining_amount')) $updates['remaining_amount'] = $amount;
            }

            if (Schema::hasColumn('payments', 'updated_at')) $updates['updated_at'] = now();
            if (!empty($updates)) DB::table('payments')->where('id', $payment->id)->update($updates);
        }
    }
}

if (!function_exists('mrpec_cast_payment_value')) {
    function mrpec_cast_payment_value(string $field, mixed $value): mixed
    {
        if ($value === '') return null;
        if (in_array($field, ['due_date', 'paid_date', 'payment_deadline'], true)) {
            if ($value === null) return null;
            return Carbon::parse((string) $value)->toDateString();
        }
        if (in_array($field, ['amount', 'paid_amount'], true)) return $value === null ? null : (float) str_replace(',', '', (string) $value);
        if (in_array($field, ['contract_id', 'sequence', 'rental_period_days'], true)) return $value === null ? null : (int) $value;
        return $value;
    }
}

if (!function_exists('mrpec_update_payment')) {
    function mrpec_update_payment(int $id, Request $request, ?\App\Models\User $user)
    {
        try {
            if (!Schema::hasTable('payments')) return response()->json(['message' => 'جدول الدفعات غير موجود.'], 404);

            $editable = array_values(array_filter(['contract_id', 'sequence', 'amount', 'due_date', 'payment_deadline', 'due_date_hijri', 'payment_deadline_hijri', 'rental_period_days', 'paid_date', 'notes'], fn ($field) => Schema::hasColumn('payments', $field)));
            $query = Payment::query();
            if (function_exists('my_rentals_ed_apply_scope') && function_exists('my_rentals_ed_is_admin')) {
                $query = my_rentals_ed_apply_scope($query, 'payments', ['table' => 'payments', 'scope' => 'payment'], $user);
            }

            $payment = $query->where('id', $id)->first();
            if (!$payment) return response()->json(['message' => 'السجل غير موجود أو خارج صلاحياتك.'], 404);

            $payload = $request->input('fields', $request->all());
            unset($payload['_auth_user'], $payload['status']);
            $updates = [];
            $writtenPaidAmount = null;

            foreach ($editable as $field) {
                if (!array_key_exists($field, $payload)) continue;

                if ($field === 'amount') {
                    // في شاشة تفاصيل العقد: المبلغ المكتوب أو زر دفع يعتبر مبلغًا مدفوعًا فعليًا.
                    $writtenPaidAmount = mrpec_cast_payment_value('paid_amount', $payload[$field]);
                    continue;
                }

                $updates[$field] = mrpec_cast_payment_value($field, $payload[$field]);
            }

            if ($writtenPaidAmount !== null && $writtenPaidAmount > 0) {
                if (Schema::hasColumn('payments', 'paid_amount')) $updates['paid_amount'] = $writtenPaidAmount;
                if (Schema::hasColumn('payments', 'paid_date')) $updates['paid_date'] = now()->toDateString();
                if (Schema::hasColumn('payments', 'status')) $updates['status'] = 'paid';
            }

            if (!$updates) return response()->json(['message' => 'لا توجد حقول قابلة للتحديث.'], 422);
            if (Schema::hasColumn('payments', 'updated_at')) $updates['updated_at'] = now();

            DB::table('payments')->where('id', $payment->id)->update($updates);
            $fresh = Payment::find($payment->id);
            mrpec_sync_contract((int) ($fresh?->contract_id ?? $payment->contract_id ?? 0));
            $fresh = Payment::find($payment->id);

            return response()->json([
                'message' => 'تم اعتماد الدفعة الفعلية فقط وإعادة حساب المطلوب والمتأخر.',
                'item' => $fresh,
            ]);
        } catch (Throwable $e) {
            return response()->json(['message' => 'تعذر تحديث الدفعة. راجع القيم المدخلة ثم حاول مرة أخرى.'], 500);
        }
    }
}

Route::post('/edit-delete-center/payments/{id}/update', function (Request $request, $id) {
    $user = function_exists('my_rentals_ed_current_user') ? my_rentals_ed_current_user($request) : $request->user();
    return mrpec_update_payment((int) $id, $request, $user);
});

Route::post('/my/edit-delete-center/payments/{id}/update', function (Request $request, $id) {
    $user = function_exists('my_rentals_ed_current_user') ? my_rentals_ed_current_user($request) : $request->user();
    return mrpec_update_payment((int) $id, $request, $user);
});
