<?php

use App\Models\Payment;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (!function_exists('mr_payment_cancel_status_value')) {
    function mr_payment_cancel_status_value(Payment $payment): string
    {
        $referenceDate = null;

        if (Schema::hasColumn('payments', 'payment_deadline') && !empty($payment->payment_deadline)) {
            $referenceDate = $payment->payment_deadline;
        } elseif (!empty($payment->notes) && preg_match('/نهاية\s+مهلة\s+السداد\s*:?\s*(\d{4}-\d{2}-\d{2})/u', (string) $payment->notes, $matches)) {
            $referenceDate = $matches[1];
        } elseif (!empty($payment->due_date)) {
            $referenceDate = $payment->due_date;
        }

        if ($referenceDate) {
            try {
                return Carbon::parse($referenceDate)->startOfDay()->lt(Carbon::today()) ? 'overdue' : 'due';
            } catch (Throwable $e) {
                return 'due';
            }
        }

        return 'due';
    }
}

if (!function_exists('mr_payment_cancel_instead_of_delete_response')) {
    function mr_payment_cancel_instead_of_delete_response(Request $request, int $id)
    {
        $user = function_exists('my_rentals_ed_current_user') ? my_rentals_ed_current_user($request) : $request->user();
        $query = Payment::query();

        if (function_exists('my_rentals_ed_apply_scope') && function_exists('my_rentals_ed_is_admin')) {
            $query = my_rentals_ed_apply_scope($query, 'payments', [
                'table' => 'payments',
                'scope' => 'payment',
            ], $user);
        }

        $payment = $query->where('id', $id)->first();

        if (!$payment) {
            return response()->json(['message' => 'الدفعة غير موجودة أو خارج صلاحياتك.'], 404);
        }

        if (empty($payment->paid_date) && (string) $payment->status !== 'paid') {
            return response()->json([
                'status' => 'error',
                'message' => 'لا يتم حذف القسط. هذه الدفعة غير مسددة أصلًا، ويمكن تعديل تاريخها أو مبلغها فقط.',
                'payment' => $payment->fresh(['contract.tenant', 'contract.unit.property.owner']),
            ], 422);
        }

        $before = $payment->toArray();
        $baseAmount = is_numeric($payment->amount ?? null) ? (float) $payment->amount : (float) str_replace(',', '', (string) ($payment->amount ?? 0));

        $updates = [
            'paid_date' => null,
            'status' => mr_payment_cancel_status_value($payment),
            'notes' => trim(((string) ($payment->notes ?? '')) . ' | تم إلغاء تسجيل السداد وإبقاء القسط بدون حذف'),
        ];

        if (Schema::hasColumn('payments', 'paid_amount')) {
            $updates['paid_amount'] = 0;
        }

        if (Schema::hasColumn('payments', 'remaining_amount')) {
            $updates['remaining_amount'] = $baseAmount;
        }

        if (Schema::hasColumn('payments', 'updated_at')) {
            $updates['updated_at'] = now();
        }

        DB::table('payments')->where('id', $payment->id)->update($updates);
        $fresh = Payment::find($payment->id);

        if (function_exists('mrpay_sync_contract')) {
            mrpay_sync_contract((int) ($fresh?->contract_id ?? $payment->contract_id ?? 0));
            $fresh = Payment::find($payment->id);
        }

        if (function_exists('my_rentals_ed_save_activity')) {
            my_rentals_ed_save_activity($user, 'cancel_payment', 'payments', $id, $before, $fresh?->toArray() ?? []);
        }

        return response()->json([
            'status' => 'ok',
            'message' => 'تم إلغاء تسجيل السداد فقط، ولم يتم حذف القسط.',
            'payment' => $fresh?->load(['contract.tenant', 'contract.unit.property.owner']),
        ]);
    }
}

// يجب أن تسبق هذه المسارات مسار الحذف العام حتى لا يتم حذف القسط فعليًا.
Route::post('/edit-delete-center/payments/{id}/delete', fn (Request $request, $id) => mr_payment_cancel_instead_of_delete_response($request, (int) $id));
Route::delete('/edit-delete-center/payments/{id}/delete', fn (Request $request, $id) => mr_payment_cancel_instead_of_delete_response($request, (int) $id));
Route::post('/my/edit-delete-center/payments/{id}/delete', fn (Request $request, $id) => mr_payment_cancel_instead_of_delete_response($request, (int) $id));
Route::delete('/my/edit-delete-center/payments/{id}/delete', fn (Request $request, $id) => mr_payment_cancel_instead_of_delete_response($request, (int) $id));

// مسار واضح يمكن استخدامه من الواجهة بدل زر الحذف.
Route::post('/payments/{payment}/cancel-paid', function (Payment $payment) {
    if (empty($payment->paid_date) && (string) $payment->status !== 'paid') {
        return response()->json([
            'status' => 'error',
            'message' => 'هذه الدفعة غير مسددة أصلًا.',
            'payment' => $payment->fresh(['contract.tenant', 'contract.unit.property.owner']),
        ], 422);
    }

    $baseAmount = is_numeric($payment->amount ?? null) ? (float) $payment->amount : (float) str_replace(',', '', (string) ($payment->amount ?? 0));

    $payment->paid_date = null;
    $payment->status = mr_payment_cancel_status_value($payment);
    $payment->notes = trim(((string) ($payment->notes ?? '')) . ' | تم إلغاء تسجيل السداد وإبقاء القسط بدون حذف');

    if (Schema::hasColumn('payments', 'paid_amount')) {
        $payment->paid_amount = 0;
    }

    if (Schema::hasColumn('payments', 'remaining_amount')) {
        $payment->remaining_amount = $baseAmount;
    }

    $payment->save();

    if (function_exists('mrpay_sync_contract')) {
        mrpay_sync_contract((int) ($payment->contract_id ?? 0));
    }

    return response()->json([
        'status' => 'ok',
        'message' => 'تم إلغاء تسجيل السداد فقط، ولم يتم حذف القسط.',
        'payment' => $payment->fresh(['contract.tenant', 'contract.unit.property.owner']),
    ]);
});
