<?php

use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (!function_exists('mrpay_num')) {
    function mrpay_num($value): float
    {
        if ($value === null || $value === '') return 0.0;
        return is_numeric($value) ? (float) $value : (float) str_replace(',', '', (string) $value);
    }
}

if (!function_exists('mrpay_status')) {
    function mrpay_status($value): string
    {
        return trim(mb_strtolower((string) ($value ?? '')));
    }
}

if (!function_exists('mrpay_amount')) {
    function mrpay_amount($payment): float
    {
        return mrpay_num($payment->amount ?? 0);
    }
}

if (!function_exists('mrpay_paid_amount')) {
    function mrpay_paid_amount($payment): float
    {
        $paid = mrpay_num($payment->paid_amount ?? 0);
        if ($paid > 0) return $paid;

        if (!empty($payment->paid_date) && in_array(mrpay_status($payment->status ?? null), ['paid', 'مدفوع', 'مدفوعة', 'مسدد'], true)) {
            return mrpay_amount($payment);
        }

        return 0.0;
    }
}

if (!function_exists('mrpay_due_date')) {
    function mrpay_due_date($payment): string
    {
        return substr((string) ($payment->due_date ?? ''), 0, 10);
    }
}

if (!function_exists('mrpay_sync_contract')) {
    function mrpay_sync_contract(?int $contractId): void
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
            ->filter(fn ($p) => preg_match('/^\d{4}-\d{2}-\d{2}$/', mrpay_due_date($p)) && mrpay_due_date($p) <= $today)
            ->sum(fn ($p) => mrpay_amount($p));
        $paidTotal = $payments->sum(fn ($p) => mrpay_paid_amount($p));
        $lateAmount = max(0.0, $dueTotal - $paidTotal);
        $paymentValue = 0.0;

        foreach ($payments as $payment) {
            $amount = mrpay_amount($payment);
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
            $amount = mrpay_amount($payment);
            $dueDate = mrpay_due_date($payment);
            $isDue = preg_match('/^\d{4}-\d{2}-\d{2}$/', $dueDate) && $dueDate <= $today;
            $updates = [];

            if ($amount > 0 && $remainingPaidForDisplay >= $amount) {
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

if (!function_exists('mrpay_apply_payment')) {
    function mrpay_apply_payment(Request $request, int $id)
    {
        if (!Schema::hasTable('payments')) {
            return response()->json(['message' => 'جدول الدفعات غير موجود.'], 404);
        }

        $payment = Payment::query()->where('id', $id)->first();
        if (!$payment) {
            return response()->json(['message' => 'القسط غير موجود.'], 404);
        }

        $requested = $request->input('amount', $request->input('paid_amount', $request->input('fields.amount', null)));
        $amount = mrpay_num($requested);
        if ($amount <= 0) $amount = mrpay_num($payment->remaining_amount ?? 0);
        if ($amount <= 0) $amount = mrpay_num($payment->amount ?? 0);
        if ($amount <= 0) {
            return response()->json(['message' => 'لا توجد قيمة صالحة لاعتمادها كدفعة.'], 422);
        }

        $updates = [];
        if (Schema::hasColumn('payments', 'paid_amount')) $updates['paid_amount'] = $amount;
        if (Schema::hasColumn('payments', 'paid_date')) $updates['paid_date'] = now()->toDateString();
        if (Schema::hasColumn('payments', 'status')) $updates['status'] = 'paid';
        if (Schema::hasColumn('payments', 'remaining_amount')) $updates['remaining_amount'] = 0;
        if (Schema::hasColumn('payments', 'notes')) {
            $note = trim((string) $request->input('notes', $request->input('fields.notes', '')));
            if ($note !== '') $updates['notes'] = $note;
        }
        if (Schema::hasColumn('payments', 'updated_at')) $updates['updated_at'] = now();

        DB::table('payments')->where('id', $payment->id)->update($updates);
        $fresh = Payment::find($payment->id);
        mrpay_sync_contract((int) ($fresh?->contract_id ?? $payment->contract_id ?? 0));
        $fresh = Payment::find($payment->id);

        return response()->json([
            'message' => 'تم اعتماد الدفعة ضمن المدفوعات.',
            'item' => $fresh,
        ]);
    }
}

Route::post('/payments/{id}/pay', fn (Request $request, $id) => mrpay_apply_payment($request, (int) $id));
Route::post('/my/payments/{id}/pay', fn (Request $request, $id) => mrpay_apply_payment($request, (int) $id));
Route::post('/edit-delete-center/payments/{id}/pay', fn (Request $request, $id) => mrpay_apply_payment($request, (int) $id));
Route::post('/my/edit-delete-center/payments/{id}/pay', fn (Request $request, $id) => mrpay_apply_payment($request, (int) $id));
