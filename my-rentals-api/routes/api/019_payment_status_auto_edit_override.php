<?php

use App\Models\Payment;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (!function_exists('mr_payment_auto_status_value')) {
    function mr_payment_auto_status_value($payment): string
    {
        if (!empty($payment->paid_date)) {
            return 'paid';
        }

        $lateReferenceDate = null;

        if (Schema::hasColumn('payments', 'payment_deadline') && !empty($payment->payment_deadline)) {
            $lateReferenceDate = $payment->payment_deadline;
        } elseif (!empty($payment->notes) && preg_match('/نهاية\s+مهلة\s+السداد\s*:?\s*(\d{4}-\d{2}-\d{2})/u', (string) $payment->notes, $matches)) {
            $lateReferenceDate = $matches[1];
        } elseif (!empty($payment->due_date)) {
            $lateReferenceDate = $payment->due_date;
        }

        if ($lateReferenceDate) {
            try {
                if (Carbon::parse($lateReferenceDate)->startOfDay()->lt(Carbon::today())) {
                    return 'overdue';
                }
            } catch (Throwable $e) {
                // Keep due when the stored date is not parseable.
            }
        }

        return 'due';
    }
}

if (!function_exists('mr_payment_apply_auto_status')) {
    function mr_payment_apply_auto_status($payment): void
    {
        if (!$payment || !Schema::hasColumn('payments', 'status')) {
            return;
        }

        $status = mr_payment_auto_status_value($payment);
        if ((string) $payment->status !== $status) {
            DB::table('payments')->where('id', $payment->id)->update(['status' => $status]);
            $payment->status = $status;
        }
    }
}

if (!function_exists('mr_payment_normalize_edit_value')) {
    function mr_payment_normalize_edit_value(string $field, mixed $value): mixed
    {
        if ($value === '') {
            return null;
        }

        if (in_array($field, ['due_date', 'paid_date', 'payment_deadline'], true)) {
            if ($value === null) {
                return null;
            }

            try {
                return Carbon::parse((string) $value)->toDateString();
            } catch (Throwable $e) {
                throw new InvalidArgumentException('صيغة التاريخ غير صحيحة في حقل ' . $field . '. استخدم yyyy-mm-dd');
            }
        }

        if ($field === 'amount') {
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
        mr_payment_apply_auto_status($payment);
        $payment = $payment->fresh() ?: $payment;

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
            // الحالة لا تُعرض ولا تُحفظ يدويًا؛ تُحتسب آليًا من تاريخ السداد ونهاية مهلة السداد الرسمية إن وجدت.
            'editable' => ['contract_id', 'sequence', 'amount', 'due_date', 'payment_deadline', 'due_date_hijri', 'payment_deadline_hijri', 'rental_period_days', 'paid_date', 'notes'],
            'scope' => 'payment',
        ];
    }
}

if (!function_exists('mr_payment_edit_list_response')) {
    function mr_payment_edit_list_response(Request $request, ?\App\Models\User $user)
    {
        if (!Schema::hasTable('payments')) {
            return response()->json(['message' => 'جدول الدفعات غير موجود.'], 404);
        }

        $config = mr_payment_edit_config();
        $editable = array_values(array_filter($config['editable'], fn ($field) => Schema::hasColumn('payments', $field)));
        $query = Payment::query();

        if (function_exists('my_rentals_ed_apply_scope') && function_exists('my_rentals_ed_is_admin')) {
            $query = my_rentals_ed_apply_scope($query, 'payments', $config, $user);
        }

        $id = $request->query('id');
        if ($id !== null && $id !== '') {
            $query->where('id', (int) $id);
        }

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
            if (!Schema::hasTable('payments')) {
                return response()->json(['message' => 'جدول الدفعات غير موجود.'], 404);
            }

            $config = mr_payment_edit_config();
            $editable = array_values(array_filter($config['editable'], fn ($field) => Schema::hasColumn('payments', $field)));
            $query = Payment::query();

            if (function_exists('my_rentals_ed_apply_scope') && function_exists('my_rentals_ed_is_admin')) {
                $query = my_rentals_ed_apply_scope($query, 'payments', $config, $user);
            }

            $payment = $query->where('id', $id)->first();
            if (!$payment) {
                return response()->json(['message' => 'السجل غير موجود أو خارج صلاحياتك.'], 404);
            }

            $payload = $request->input('fields', $request->all());
            unset($payload['_auth_user'], $payload['status']);

            $updates = [];
            foreach ($editable as $field) {
                if (array_key_exists($field, $payload)) {
                    $updates[$field] = mr_payment_normalize_edit_value($field, $payload[$field]);
                }
            }

            if (!$updates) {
                return response()->json(['message' => 'لا توجد حقول قابلة للتحديث.'], 422);
            }

            if (Schema::hasColumn('payments', 'updated_at')) {
                $updates['updated_at'] = now();
            }

            $before = $payment->toArray();

            // نستخدم Query Builder هنا بدل fill/save لتجنب أي أخطاء Mass Assignment أو casts قد تظهر عند الدفعات غير المسددة.
            DB::table('payments')->where('id', $payment->id)->update($updates);
            $fresh = Payment::find($payment->id);
            mr_payment_apply_auto_status($fresh);
            $fresh = Payment::find($payment->id);

            if (function_exists('my_rentals_ed_save_activity')) {
                my_rentals_ed_save_activity($user, 'update', 'payments', $id, $before, $fresh?->toArray() ?? []);
            }

            return [
                'message' => 'تم التحديث بنجاح. تم تحديد حالة الدفعة آليًا.',
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
