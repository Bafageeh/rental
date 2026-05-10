<?php

// PHASE2_ROUTE_MODULES: generated from routes/api.php on 2026-04-27-083758.
// Section: Utility Bills

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ContractFileController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\OwnerDashboardController;
use App\Models\Contract;
use App\Models\Owner;
use App\Models\Payment;
use App\Models\Property;
use App\Models\Tenant;
use App\Models\Unit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

/*
|--------------------------------------------------------------------------
| Utility Bills
|--------------------------------------------------------------------------
*/

if (!function_exists('my_rentals_utility_category_code')) {
    function my_rentals_utility_category_code(?string $type): string
    {
        if ($type === 'common_electricity') {
            return 'common_electricity';
        }

        if ($type === 'water') {
            return 'water';
        }

        if ($type === 'internet') {
            return 'internet';
        }

        return 'other';
    }
}

if (!function_exists('my_rentals_utility_type_label')) {
    function my_rentals_utility_type_label(?string $type): string
    {
        if ($type === 'common_electricity') {
            return 'كهرباء الخدمات';
        }

        if ($type === 'water') {
            return 'مياه';
        }

        if ($type === 'internet') {
            return 'إنترنت';
        }

        return 'فاتورة خدمات';
    }
}

if (!function_exists('my_rentals_create_expense_for_utility_bill')) {
    function my_rentals_create_expense_for_utility_bill(\App\Models\UtilityBill $bill): ?int
    {
        if (!class_exists(\App\Models\PropertyExpense::class) || !\Illuminate\Support\Facades\Schema::hasTable('property_expenses')) {
            return null;
        }

        if ($bill->property_expense_id) {
            return $bill->property_expense_id;
        }

        $categoryId = null;

        if (class_exists(\App\Models\ExpenseCategory::class) && \Illuminate\Support\Facades\Schema::hasTable('expense_categories')) {
            $code = my_rentals_utility_category_code($bill->bill_type);
            $categoryId = \App\Models\ExpenseCategory::where('code', $code)->value('id');
        }

        $expense = \App\Models\PropertyExpense::create([
            'property_id' => $bill->property_id,
            'expense_category_id' => $categoryId,
            'amount' => $bill->amount ?? 0,
            'expense_date' => $bill->paid_date ?: now()->toDateString(),
            'title' => my_rentals_utility_type_label($bill->bill_type) . ' - ' . ($bill->bill_number ?: ('#' . $bill->id)),
            'description' => 'مصروف منشأ تلقائيًا من شاشة فواتير الخدمات',
        ]);

        $bill->update([
            'property_expense_id' => $expense->id,
        ]);

        return $expense->id;
    }
}

Route::get('/utility-bills', function () {
    return \App\Models\UtilityBill::with(['property.owner', 'expense.category'])
        ->orderByRaw("CASE status WHEN 'overdue' THEN 1 WHEN 'due' THEN 2 WHEN 'paid' THEN 3 ELSE 4 END")
        ->orderBy('due_date')
        ->orderBy('id', 'desc')
        ->get();
});

Route::post('/utility-bills', function (Request $request) {
    $data = $request->validate([
        'property_id' => ['required', 'integer', 'exists:properties,id'],
        'bill_type' => ['required', 'string', 'max:100'],
        'provider' => ['nullable', 'string', 'max:255'],
        'bill_number' => ['nullable', 'string', 'max:255'],
        'amount' => ['required', 'numeric', 'min:0'],
        'bill_date' => ['nullable', 'date'],
        'due_date' => ['nullable', 'date'],
        'paid_date' => ['nullable', 'date'],
        'status' => ['nullable', 'string', 'max:50'],
        'notes' => ['nullable', 'string'],
    ]);

    $bill = \App\Models\UtilityBill::create([
        'property_id' => $data['property_id'],
        'bill_type' => $data['bill_type'],
        'provider' => $data['provider'] ?? null,
        'bill_number' => $data['bill_number'] ?? null,
        'amount' => $data['amount'],
        'bill_date' => $data['bill_date'] ?? now()->toDateString(),
        'due_date' => $data['due_date'] ?? null,
        'paid_date' => $data['paid_date'] ?? null,
        'status' => $data['status'] ?? 'due',
        'notes' => $data['notes'] ?? null,
    ]);

    if ($bill->status === 'paid') {
        if (!$bill->paid_date) {
            $bill->update(['paid_date' => now()->toDateString()]);
        }

        my_rentals_create_expense_for_utility_bill($bill->fresh());
    }

    return response()->json([
        'status' => 'ok',
        'message' => 'تم إضافة فاتورة الخدمات بنجاح',
        'utility_bill' => $bill->fresh()->load(['property.owner', 'expense.category']),
    ], 201);
});

Route::post('/utility-bills/{utilityBill}/status', function (
    \App\Models\UtilityBill $utilityBill,
    Request $request
) {
    $data = $request->validate([
        'status' => ['required', 'string', 'max:50'],
        'create_expense' => ['nullable', 'boolean'],
    ]);

    $updates = [
        'status' => $data['status'],
    ];

    if ($data['status'] === 'paid') {
        $updates['paid_date'] = now()->toDateString();
    }

    if (in_array($data['status'], ['due', 'overdue', 'cancelled'], true)) {
        $updates['paid_date'] = null;
    }

    $utilityBill->update($updates);

    if ($data['status'] === 'paid' && ($data['create_expense'] ?? true)) {
        my_rentals_create_expense_for_utility_bill($utilityBill->fresh());
    }

    return response()->json([
        'status' => 'ok',
        'message' => 'تم تحديث حالة فاتورة الخدمات',
        'utility_bill' => $utilityBill->fresh()->load(['property.owner', 'expense.category']),
    ]);
});

Route::post('/utility-bills/fix-overdue', function () {
    $updated = \App\Models\UtilityBill::where('status', 'due')
        ->whereNotNull('due_date')
        ->whereDate('due_date', '<', now()->toDateString())
        ->update(['status' => 'overdue']);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم تحديث فواتير الخدمات المتأخرة',
        'updated_count' => $updated,
    ]);
});

Route::get('/my/utility-bills', function (\Illuminate\Http\Request $request) {
    $user = function_exists('my_rentals_current_user_for_scope')
        ? my_rentals_current_user_for_scope($request)
        : (function_exists('my_rentals_bearer_user') ? my_rentals_bearer_user($request) : null);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $isAdmin = function_exists('my_rentals_is_admin_user')
        ? my_rentals_is_admin_user($user)
        : in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);

    $query = \App\Models\UtilityBill::with(['property.owner', 'expense.category']);

    if (!$isAdmin) {
        if (!$user->owner_id) {
            return [];
        }

        $propertyIds = \App\Models\Property::where('owner_id', $user->owner_id)->pluck('id');
        $query->whereIn('property_id', $propertyIds);
    }

    return $query
        ->orderByRaw("CASE status WHEN 'overdue' THEN 1 WHEN 'due' THEN 2 WHEN 'paid' THEN 3 ELSE 4 END")
        ->orderBy('due_date')
        ->orderBy('id', 'desc')
        ->get();
});
