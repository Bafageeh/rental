<?php

// PHASE2_ROUTE_MODULES: generated from routes/api.php on 2026-04-27-083758.
// Section: Owner Settlements

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
| Owner Settlements
|--------------------------------------------------------------------------
*/

if (!function_exists('my_rentals_owner_settlement_payload')) {
    function my_rentals_owner_settlement_payload(\App\Models\Owner $owner): array
    {
        $properties = \App\Models\Property::with('owner')
            ->where('owner_id', $owner->id)
            ->orderBy('id', 'desc')
            ->get();

        $propertyIds = $properties->pluck('id');

        $units = \App\Models\Unit::whereIn('property_id', $propertyIds)->get();
        $unitIds = $units->pluck('id');

        $contracts = \App\Models\Contract::with(['tenant', 'unit.property.owner'])
            ->whereIn('unit_id', $unitIds)
            ->orderBy('id', 'desc')
            ->get();

        $contractIds = $contracts->pluck('id');

        $payments = \App\Models\Payment::with(['contract.tenant', 'contract.unit.property'])
            ->whereIn('contract_id', $contractIds)
            ->orderBy('due_date')
            ->get();

        $expenses = collect();

        if (class_exists(\App\Models\PropertyExpense::class) && \Illuminate\Support\Facades\Schema::hasTable('property_expenses')) {
            $expenses = \App\Models\PropertyExpense::with(['property', 'category'])
                ->whereIn('property_id', $propertyIds)
                ->orderBy('expense_date', 'desc')
                ->get();
        }

        $paidIncome = (float) $payments->where('status', 'paid')->sum('amount');
        $dueIncome = (float) $payments->where('status', 'due')->sum('amount');
        $overdueIncome = (float) $payments->where('status', 'overdue')->sum('amount');
        $expectedIncome = (float) $payments->sum('amount');
        $expensesTotal = (float) $expenses->sum('amount');

        $propertyDetails = $properties->map(function ($property) use ($payments, $expenses, $contracts, $units) {
            $propertyUnitIds = $units->where('property_id', $property->id)->pluck('id');
            $propertyContractIds = $contracts->whereIn('unit_id', $propertyUnitIds)->pluck('id');
            $propertyPayments = $payments->whereIn('contract_id', $propertyContractIds);
            $propertyExpenses = $expenses->where('property_id', $property->id);

            $paid = (float) $propertyPayments->where('status', 'paid')->sum('amount');
            $due = (float) $propertyPayments->where('status', 'due')->sum('amount');
            $overdue = (float) $propertyPayments->where('status', 'overdue')->sum('amount');
            $expenseTotal = (float) $propertyExpenses->sum('amount');

            return [
                'id' => $property->id,
                'name' => $property->name,
                'city' => $property->city,
                'district' => $property->district,
                'property_type' => $property->property_type,
                'units_count' => $propertyUnitIds->count(),
                'contracts_count' => $propertyContractIds->count(),
                'paid_income' => $paid,
                'due_income' => $due,
                'overdue_income' => $overdue,
                'expenses' => $expenseTotal,
                'net_income' => $paid - $expenseTotal,
            ];
        })->values();

        return [
            'owner' => [
                'id' => $owner->id,
                'name' => $owner->name,
                'phone' => $owner->phone,
                'email' => $owner->email,
                'national_id' => $owner->national_id,
                'type' => $owner->type,
            ],
            'summary' => [
                'properties_count' => $properties->count(),
                'units_count' => $units->count(),
                'contracts_count' => $contracts->count(),
                'active_contracts_count' => $contracts->where('status', 'active')->count(),
                'payments_count' => $payments->count(),
                'expected_income' => $expectedIncome,
                'paid_income' => $paidIncome,
                'due_income' => $dueIncome,
                'overdue_income' => $overdueIncome,
                'remaining_income' => $dueIncome + $overdueIncome,
                'expenses' => $expensesTotal,
                'net_income' => $paidIncome - $expensesTotal,
            ],
            'properties' => $propertyDetails,
            'recent_payments' => $payments->take(20)->values()->map(function ($payment) {
                return [
                    'id' => $payment->id,
                    'amount' => $payment->amount,
                    'due_date' => $payment->due_date,
                    'paid_date' => $payment->paid_date,
                    'status' => $payment->status,
                    'tenant_name' => $payment->contract?->tenant?->name,
                    'property_name' => $payment->contract?->unit?->property?->name,
                    'unit_number' => $payment->contract?->unit?->unit_number,
                ];
            }),
            'recent_expenses' => $expenses->take(20)->values()->map(function ($expense) {
                return [
                    'id' => $expense->id,
                    'amount' => $expense->amount,
                    'expense_date' => $expense->expense_date,
                    'title' => $expense->title,
                    'category_name' => $expense->category?->name,
                    'property_name' => $expense->property?->name,
                ];
            }),
        ];
    }
}

Route::get('/owner-settlements', function () {
    $owners = \App\Models\Owner::orderBy('id', 'desc')->get();

    return $owners->map(fn ($owner) => my_rentals_owner_settlement_payload($owner))->values();
});

Route::get('/my/owner-settlements', function (\Illuminate\Http\Request $request) {
    $user = function_exists('my_rentals_current_user_for_scope')
        ? my_rentals_current_user_for_scope($request)
        : (function_exists('my_rentals_bearer_user') ? my_rentals_bearer_user($request) : null);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $isAdmin = function_exists('my_rentals_is_admin_user')
        ? my_rentals_is_admin_user($user)
        : in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);

    $ownersQuery = \App\Models\Owner::orderBy('id', 'desc');

    if (!$isAdmin) {
        if (!$user->owner_id) {
            return [];
        }

        $ownersQuery->where('id', $user->owner_id);
    }

    return $ownersQuery->get()
        ->map(fn ($owner) => my_rentals_owner_settlement_payload($owner))
        ->values();
});
