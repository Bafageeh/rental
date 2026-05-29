<?php

use App\Models\Payment;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (!function_exists('mr_payment_num')) {
    function mr_payment_num($value): float
    {
        if ($value === null || $value === '') return 0.0;
        return is_numeric($value) ? (float) $value : (float) str_replace(',', '', (string) $value);
    }
}

if (!function_exists('mr_payment_amount')) {
    function mr_payment_amount($payment): float
    {
        return mr_payment_num($payment->amount ?? 0);
    }
}

if (!function_exists('mr_payment_paid_amount')) {
    function mr_payment_paid_amount($payment): float
    {
        // المدفوع الفعلي فقط: paid_amount الذي تم تسجيله من زر دفع أو حفظ بطاقة القسط.
        return max(0.0, mr_payment_num($payment->paid_amount ?? 0));
    }
}

if (!function_exists('mr_payment_due_date')) {
    function mr_payment_due_date($payment): string
    {
        return substr((string) ($payment->due_date ?? ''), 0, 10);
    }
}

if (!function_exists('mr_payment_sync_contract_cumulative')) {
    function mr_payment_sync_contract_cumulative(?int $contractId): void
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
            ->filter(fn ($payment) => preg_match('/^\d{4}-\d{2}-\d{2}$/', mr_payment_due_date($payment)) && mr_payment_due_date($payment) <= $today)
            ->sum(fn ($payment) => mr_payment_amount($payment));
        $paidTotal = $payments->sum(fn ($payment) => mr_payment_paid_amount($payment));
        $lateAmount = max(0.0, $dueTotal - $paidTotal);
        $paymentValue = 0.0;

        foreach ($payments as $payment) {
            $amount = mr_payment_amount($payment);
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
            $amount = mr_payment_amount($payment);
            $dueDate = mr_payment_due_date($payment);
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

if (!function_exists('mr_payment_normalize_edit_value')) {
    function mr_payment_normalize_edit_value(string $field, mixed $value): mixed
    {
        if ($value === '') return null;

        if (in_array($field, ['due_date', 'paid_date', 'payment_deadline'], true)) {
            if ($value === null) return null;
            try {
                return Carbon::parse((string) $value)->toDateString();
            } catch (Throwable $e) {
                throw new InvalidArgumentException('صيغة التاريخ غير صحيحة في حقل ' . $field . '. استخدم yyyy-mm-dd');
            }
        }

        if (in_array($field, ['amount', 'paid_amount'], true)) {
            return $value === null ? null : (float) str_replace(',', '', (string) $value);
        }

        if (in_array($field, ['contract_id', 'sequence', 'rental_period_days'], true)) {
            return $value === null ? null : (int) $value;
        }

        if (function_exists('my_rentals_ed_cast_value')) {
            return my_rentals_ed_cast_value('payments', $field, $value);
        }

        return $value;
    }
}

if (!function_exists('mr_payment_edit_payload')) {
    function mr_payment_edit_payload($payment, array $editableFields): array
    {
        $fields = [];
        foreach ($editableFields as $field) {
            $fields[$field] = $payment->{$field} ?? null;
        }

        $titleParts = array_filter([
            $payment->amount !== null ? number_format((float) $payment->amount, 2, '.', '') : null,
            $payment->due_date,
            Schema::hasColumn('payments', 'payment_deadline') ? ($payment->payment_deadline ?? null) : null,
            $payment->status,
        ], fn ($value) => $value !== null && $value !== '');

        return [
            'id' => $payment->id,
            'resource' => 'payments',
            'resource_label' => 'الدفعات',
            'title' => implode(' - ', $titleParts) ?: ('دفعة #' . $payment->id),
            'fields' => $fields,
            'values' => $fields,
            'editable_fields' => $editableFields,
            'can_archive' => false,
        ];
    }
}

if (!function_exists('mr_payment_edit_config')) {
    function mr_payment_edit_config(): array
    {
        return [
            'label' => 'الدفعات',
            'model' => Payment::class,
            'table' => 'payments',
            'editable' => ['contract_id', 'sequence', 'amount', 'due_date', 'payment_deadline', 'due_date_hijri', 'payment_deadline_hijri', 'rental_period_days', 'paid_date', 'notes'],
            'scope' => 'payment',
        ];
    }
}

if (!function_exists('mr_payment_edit_list_response')) {
    function mr_payment_edit_list_response(Request $request, ?\App\Models\User $user)
    {
        if (!Schema::hasTable('payments')) return response()->json(['message' => 'جدول الدفعات غير موجود.'], 404);

        $config = mr_payment_edit_config();
        $editable = array_values(array_filter($config['editable'], fn ($field) => Schema::hasColumn('payments', $field)));
        $query = Payment::query();

        if (function_exists('my_rentals_ed_apply_scope') && function_exists('my_rentals_ed_is_admin')) {
            $query = my_rentals_ed_apply_scope($query, 'payments', $config, $user);
        }

        $id = $request->query('id');
        if ($id !== null && $id !== '') $query->where('id', (int) $id);

        $items = $query->orderByDesc('id')->limit($id ? 1 : 150)->get();

        return [
            'resource' => 'payments',
            'resource_label' => 'الدفعات',
            'editable_fields' => $editable,
            'items' => $items->map(fn ($payment) => mr_payment_edit_payload($payment, $editable))->values(),
        ];
    }
}

if (!function_exists('mr_payment_edit_update_response')) {
    function mr_payment_edit_update_response(int $id, Request $request, ?\App\Models\User $user)
    {
        try {
            if (!Schema::hasTable('payments')) return response()->json(['message' => 'جدول الدفعات غير موجود.'], 404);

            $isScheduleEdit = $request->boolean('_schedule_edit') || $request->boolean('schedule_edit') || (bool) $request->input('fields._schedule_edit');
            $config = mr_payment_edit_config();
            $editable = array_values(array_filter($config['editable'], fn ($field) => Schema::hasColumn('payments', $field)));
            $query = Payment::query();

            if (function_exists('my_rentals_ed_apply_scope') && function_exists('my_rentals_ed_is_admin')) {
                $query = my_rentals_ed_apply_scope($query, 'payments', $config, $user);
            }

            $payment = $query->where('id', $id)->first();
            if (!$payment) return response()->json(['message' => 'السجل غير موجود أو خارج صلاحياتك.'], 404);

            $payload = $request->input('fields', $request->all());
            unset($payload['_auth_user'], $payload['_schedule_edit'], $payload['schedule_edit'], $payload['status']);

            $updates = [];
            $writtenPaidAmount = null;

            foreach ($editable as $field) {
                if (!array_key_exists($field, $payload)) continue;

                if ($field === 'amount' && !$isScheduleEdit) {
                    // زر دفع / حفظ بطاقة قسط: المبلغ المرسل هو مبلغ مدفوع فعلي، وليس تعديل قيمة القسط.
                    $writtenPaidAmount = mr_payment_normalize_edit_value('paid_amount', $payload[$field]);
                    continue;
                }

                if ($field === 'paid_date' && !$isScheduleEdit) continue;

                $updates[$field] = mr_payment_normalize_edit_value($field, $payload[$field]);
            }

            if (!$isScheduleEdit && $writtenPaidAmount !== null && $writtenPaidAmount > 0) {
                if (Schema::hasColumn('payments', 'paid_amount')) $updates['paid_amount'] = $writtenPaidAmount;
                if (Schema::hasColumn('payments', 'paid_date')) $updates['paid_date'] = now()->toDateString();
                if (Schema::hasColumn('payments', 'status')) $updates['status'] = 'paid';
            }

            if (!$updates) return response()->json(['message' => 'لا توجد حقول قابلة للتحديث.'], 422);
            if (Schema::hasColumn('payments', 'updated_at')) $updates['updated_at'] = now();

            $before = $payment->toArray();
            DB::table('payments')->where('id', $payment->id)->update($updates);
            $fresh = Payment::find($payment->id);
            mr_payment_sync_contract_cumulative((int) ($fresh?->contract_id ?? $payment->contract_id ?? 0));
            $fresh = Payment::find($payment->id);

            if (function_exists('my_rentals_ed_save_activity')) {
                my_rentals_ed_save_activity($user, 'update', 'payments', $id, $before, $fresh?->toArray() ?? []);
            }

            return [
                'message' => $isScheduleEdit ? 'تم حفظ قيم جدول الدفعات وإعادة حساب المطلوب والمتأخر.' : 'تم تسجيل الدفعة ضمن المدفوعات وإعادة حساب المطلوب والمتأخر.',
                'item' => mr_payment_edit_payload($fresh, $editable),
            ];
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (Throwable $e) {
            return response()->json(['message' => 'تعذر تحديث الدفعة. راجع القيم المدخلة ثم حاول مرة أخرى.'], 500);
        }
    }
}

Route::get('/edit-delete-center/payments', function (Request $request) {
    $user = function_exists('my_rentals_ed_current_user') ? my_rentals_ed_current_user($request) : $request->user();
    return response()->json(mr_payment_edit_list_response($request, $user));
});

Route::get('/my/edit-delete-center/payments', function (Request $request) {
    $user = function_exists('my_rentals_ed_current_user') ? my_rentals_ed_current_user($request) : $request->user();
    return response()->json(mr_payment_edit_list_response($request, $user));
});

Route::post('/edit-delete-center/payments/{id}/update', function (Request $request, $id) {
    $user = function_exists('my_rentals_ed_current_user') ? my_rentals_ed_current_user($request) : $request->user();
    $response = mr_payment_edit_update_response((int) $id, $request, $user);
    return $response instanceof \Illuminate\Http\JsonResponse ? $response : response()->json($response);
});

Route::post('/my/edit-delete-center/payments/{id}/update', function (Request $request, $id) {
    $user = function_exists('my_rentals_ed_current_user') ? my_rentals_ed_current_user($request) : $request->user();
    $response = mr_payment_edit_update_response((int) $id, $request, $user);
    return $response instanceof \Illuminate\Http\JsonResponse ? $response : response()->json($response);
});
