<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

/*
|--------------------------------------------------------------------------
| Expense scope fix
|--------------------------------------------------------------------------
| كل وحدة/فرع لها مصروفاتها الخاصة فقط.
| - عند طلب unit_id: لا نعرض إلا مصروفات نفس الوحدة فقط.
| - عند طلب property_id عاديًا: لا نعرض إلا مصروفات العقار المباشرة فقط.
| - عند طلب الإجمالي صراحة include_children/total/scope=total: نجمع مصروفات العقار المباشرة + الوحدات التابعة.
*/

if (!function_exists('my_rentals_expense_scope_user_property_ids')) {
    function my_rentals_expense_scope_user_property_ids(?\App\Models\User $user)
    {
        if (function_exists('my_rentals_owner_property_ids')) {
            return my_rentals_owner_property_ids($user);
        }

        if (!$user) {
            return collect();
        }

        $role = function_exists('my_rentals_effective_role') ? my_rentals_effective_role($user) : ($user->role ?? 'owner');
        if (in_array($role, ['admin', 'manager', 'super_admin'], true)) {
            return \App\Models\Property::query()->pluck('id');
        }

        if (!$user->owner_id) {
            return collect();
        }

        return \App\Models\Property::query()->where('owner_id', $user->owner_id)->pluck('id');
    }
}

if (!function_exists('my_rentals_expense_scope_response')) {
    function my_rentals_expense_scope_response(Request $request, bool $requireUserScope)
    {
        if (!class_exists(\App\Models\PropertyExpense::class) || !Schema::hasTable('property_expenses')) {
            return [];
        }

        $allowedPropertyIds = null;
        if ($requireUserScope) {
            $user = function_exists('my_rentals_current_user_for_scope')
                ? my_rentals_current_user_for_scope($request)
                : (function_exists('my_rentals_bearer_user') ? my_rentals_bearer_user($request) : null);

            if (!$user) {
                return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
            }

            $allowedPropertyIds = collect(my_rentals_expense_scope_user_property_ids($user))->map(fn ($id) => (int) $id)->values();
        }

        $query = \App\Models\PropertyExpense::with([
            'property.owner',
            'unit',
            'category',
        ]);

        if ($allowedPropertyIds !== null) {
            $query->whereIn('property_id', $allowedPropertyIds);
        }

        if ($request->filled('unit_id')) {
            $unitId = $request->integer('unit_id');

            $query->where('unit_id', $unitId);

            if ($allowedPropertyIds !== null) {
                $query->whereHas('unit', function ($unitQuery) use ($allowedPropertyIds) {
                    $unitQuery->whereIn('property_id', $allowedPropertyIds);
                });
            }
        } elseif ($request->filled('property_id')) {
            $propertyId = $request->integer('property_id');
            $query->where('property_id', $propertyId);

            $includeChildren = $request->boolean('include_children')
                || $request->boolean('total')
                || $request->input('scope') === 'total';

            if (!$includeChildren) {
                $query->whereNull('unit_id');
            }
        }

        if ($request->filled('owner_id')) {
            $query->whereHas('property', function ($propertyQuery) use ($request) {
                $propertyQuery->where('owner_id', $request->integer('owner_id'));
            });
        }

        return $query
            ->orderBy('expense_date', 'desc')
            ->orderBy('id', 'desc')
            ->get();
    }
}

Route::get('/expenses', function (Request $request) {
    return my_rentals_expense_scope_response($request, false);
});

Route::get('/my/expenses', function (Request $request) {
    return my_rentals_expense_scope_response($request, true);
});

// تحميل مسارات إدارة المستخدمين بعد مسارات الصلاحيات حتى يعمل رابط شاشة #S-453.
$userAccountsRouteFile = __DIR__ . '/114_user_accounts.php';
if (is_file($userAccountsRouteFile)) {
    require_once $userAccountsRouteFile;
}
