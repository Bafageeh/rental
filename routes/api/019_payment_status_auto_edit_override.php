<?php

use App\Models\Payment;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (!function_exists('mr_payment_auto_status_value')) {
    function mr_payment_auto_status_value($payment): string
    {
        if (!empty($payment->paid_date)) {
            return 'paid';
        }

        if (!empty($payment->due_date)) {
            try {
                if (Carbon::parse($payment->due_date)->startOfDay()->lt(Carbon::today())) {
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
            $payment->status = $status;
            $payment->save();
        }
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
            // الحالة لا تُعرض ولا تُحفظ يدويًا؛ تُحتسب آليًا من تاريخ السداد وتاريخ الاستحقاق.
            'editable' => ['contract_id', 'amount', 'due_date', 'paid_date', 'notes'],
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
                if (function_exists('my_rentals_ed_cast_value')) {
                    $updates[$field] = my_rentals_ed_cast_value('payments', $field, $payload[$field]);
                } else {
                    $updates[$field] = $payload[$field] === '' ? null : $payload[$field];
                }
            }
        }

        if (!$updates) {
            return response()->json(['message' => 'لا توجد حقول قابلة للتحديث.'], 422);
        }

        $before = $payment->toArray();
        $payment->fill($updates);
        $payment->save();
        mr_payment_apply_auto_status($payment);
        $fresh = $payment->fresh();

        if (function_exists('my_rentals_ed_save_activity')) {
            my_rentals_ed_save_activity($user, 'update', 'payments', $id, $before, $fresh?->toArray() ?? []);
        }

        return [
            'message' => 'تم التحديث بنجاح. تم تحديد حالة الدفعة آليًا.',
            'item' => mr_payment_edit_payload($fresh, $editable),
        ];
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
    return response()->json(mr_payment_edit_update_response((int) $id, $request, $user));
});

Route::post('/my/edit-delete-center/payments/{id}/update', function (Request $request, $id) {
    $user = function_exists('my_rentals_ed_current_user') ? my_rentals_ed_current_user($request) : $request->user();
    return response()->json(mr_payment_edit_update_response((int) $id, $request, $user));
});
