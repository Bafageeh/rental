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
        // المسدد الحقيقي فقط من paid_amount
        // لا نأخذ amount كبديل حتى لا يتغير المسدد عند تعديل جدول الدفعات العام
        if (Schema::hasColumn('payments', 'paid_amount')) {
            return max(0.0, mrpay_num($payment->paid_amount ?? 0));
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

        foreach ($payments as $payment) {
            $amount = mrpay_amount($payment);        // المطلوب / المجدول
            $paid = mrpay_paid_amount($payment);     // المسدد الحقيقي
            $remaining = max(0.0, $amount - $paid);
            $dueDate = mrpay_due_date($payment);
            $isDue = preg_match('/^\d{4}-\d{2}-\d{2}$/', $dueDate) && $dueDate <= $today;

            $updates = [];

            if (Schema::hasColumn('payments', 'remaining_amount')) {
                $updates['remaining_amount'] = $remaining;
            }

            if (Schema::hasColumn('payments', 'status')) {
                if ($paid > 0 && $remaining <= 0.009) {
                    $updates['status'] = 'paid';
                } elseif ($isDue && $remaining > 0.009) {
                    $updates['status'] = 'overdue';
                } else {
                    $updates['status'] = 'due';
                }
            }

            if (Schema::hasColumn('payments', 'updated_at')) {
                $updates['updated_at'] = now();
            }

            if (!empty($updates)) {
                DB::table('payments')->where('id', $payment->id)->update($updates);
            }
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

        $scheduledAmount = mrpay_num($payment->amount ?? 0);
        $remaining = max(0.0, $scheduledAmount - $amount);
        $dueDate = mrpay_due_date($payment);
        $isDue = preg_match('/^\d{4}-\d{2}-\d{2}$/', $dueDate) && $dueDate <= now()->toDateString();

        $updates = [];
        if (Schema::hasColumn('payments', 'paid_amount')) $updates['paid_amount'] = $amount;
        if (Schema::hasColumn('payments', 'paid_date')) $updates['paid_date'] = now()->toDateString();
        if (Schema::hasColumn('payments', 'status')) {
            $updates['status'] = $remaining <= 0.009 ? 'paid' : ($isDue ? 'overdue' : 'due');
        }
        if (Schema::hasColumn('payments', 'remaining_amount')) $updates['remaining_amount'] = $remaining;
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
