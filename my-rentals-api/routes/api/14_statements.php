<?php

// PHASE2_ROUTE_MODULES: generated from routes/api.php on 2026-04-27-083758.
// Section: Tenant Statements

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
| Tenant Statements
|--------------------------------------------------------------------------
*/

if (!function_exists('my_rentals_statement_payload')) {
    function my_rentals_statement_payload(\Illuminate\Support\Collection $tenants): array
    {
        return $tenants->map(function ($tenant) {
            $contracts = $tenant->contracts ?? collect();

            $payments = $contracts->flatMap(function ($contract) {
                return $contract->payments ?? collect();
            });

            $paid = (float) $payments->where('status', 'paid')->sum('amount');
            $due = (float) $payments->where('status', 'due')->sum('amount');
            $overdue = (float) $payments->where('status', 'overdue')->sum('amount');
            $total = (float) $payments->sum('amount');

            $activeContracts = $contracts->where('status', 'active')->count();

            $latestContract = $contracts->sortByDesc('id')->first();

            return [
                'tenant' => [
                    'id' => $tenant->id,
                    'name' => $tenant->name,
                    'phone' => $tenant->phone,
                    'email' => $tenant->email,
                    'national_id' => $tenant->national_id,
                    'nationality' => $tenant->nationality,
                ],
                'summary' => [
                    'contracts_count' => $contracts->count(),
                    'active_contracts_count' => $activeContracts,
                    'payments_count' => $payments->count(),
                    'total_amount' => $total,
                    'paid_amount' => $paid,
                    'due_amount' => $due,
                    'overdue_amount' => $overdue,
                    'remaining_amount' => $due + $overdue,
                ],
                'latest_contract' => $latestContract ? [
                    'id' => $latestContract->id,
                    'contract_number' => $latestContract->government_contract_number ?: $latestContract->contract_number,
                    'status' => $latestContract->status,
                    'start_date' => $latestContract->start_date,
                    'end_date' => $latestContract->end_date,
                    'property_name' => $latestContract->unit?->property?->name,
                    'owner_name' => $latestContract->unit?->property?->owner?->name,
                    'unit_number' => $latestContract->unit?->unit_number,
                ] : null,
                'contracts' => $contracts->map(function ($contract) {
                    $contractPayments = $contract->payments ?? collect();

                    return [
                        'id' => $contract->id,
                        'contract_number' => $contract->government_contract_number ?: $contract->contract_number,
                        'status' => $contract->status,
                        'start_date' => $contract->start_date,
                        'end_date' => $contract->end_date,
                        'rent_amount' => $contract->rent_amount,
                        'property_name' => $contract->unit?->property?->name,
                        'owner_name' => $contract->unit?->property?->owner?->name,
                        'unit_number' => $contract->unit?->unit_number,
                        'payments' => $contractPayments->sortBy('due_date')->values()->map(function ($payment) {
                            return [
                                'id' => $payment->id,
                                'amount' => $payment->amount,
                                'due_date' => $payment->due_date,
                                'paid_date' => $payment->paid_date,
                                'status' => $payment->status,
                                'notes' => $payment->notes,
                            ];
                        })->values(),
                    ];
                })->values(),
            ];
        })->values()->all();
    }
}

Route::get('/tenant-statements', function () {
    $tenants = \App\Models\Tenant::with([
            'contracts.unit.property.owner',
            'contracts.payments' => function ($query) {
                $query->orderBy('due_date');
            },
        ])
        ->orderBy('id', 'desc')
        ->get();

    return my_rentals_statement_payload($tenants);
});

Route::get('/my/tenant-statements', function (\Illuminate\Http\Request $request) {
    $user = function_exists('my_rentals_current_user_for_scope')
        ? my_rentals_current_user_for_scope($request)
        : (function_exists('my_rentals_bearer_user') ? my_rentals_bearer_user($request) : null);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $isAdmin = function_exists('my_rentals_is_admin_user')
        ? my_rentals_is_admin_user($user)
        : in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);

    $query = \App\Models\Tenant::with([
            'contracts.unit.property.owner',
            'contracts.payments' => function ($paymentQuery) {
                $paymentQuery->orderBy('due_date');
            },
        ])
        ->orderBy('id', 'desc');

    if (!$isAdmin) {
        if (!$user->owner_id) {
            return [];
        }

        $propertyIds = \App\Models\Property::where('owner_id', $user->owner_id)->pluck('id');

        $query->whereHas('contracts.unit', function ($q) use ($propertyIds) {
            $q->whereIn('property_id', $propertyIds);
        });
    }

    return my_rentals_statement_payload($query->get());
});
