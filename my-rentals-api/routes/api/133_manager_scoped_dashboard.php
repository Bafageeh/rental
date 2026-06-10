<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (is_file(__DIR__ . '/130_manager_data_scope.php')) require_once __DIR__ . '/130_manager_data_scope.php';

if (!function_exists('mr_dashboard_current_user')) {
    function mr_dashboard_current_user(Request $request)
    {
        if ($request->user()) return $request->user();
        if (function_exists('myRentalsApiUser')) return myRentalsApiUser($request);
        return null;
    }
}

if (!function_exists('mr_dashboard_role')) {
    function mr_dashboard_role($user): string
    {
        if (!$user) return '';
        if (function_exists('myRentalsEffectiveRole')) return myRentalsEffectiveRole($user);
        return strtolower(trim((string) ($user->role ?? '')));
    }
}

if (!function_exists('mr_dashboard_filter_manager')) {
    function mr_dashboard_filter_manager($query, string $tableName, int $managerId)
    {
        if ($managerId > 0 && Schema::hasTable($tableName) && Schema::hasColumn($tableName, 'manager_id')) {
            $query->where($tableName . '.manager_id', $managerId);
        }
        return $query;
    }
}

Route::get('/auth/manager-scoped-dashboard', function (Request $request) {
    if (function_exists('mr_manager_scope_ensure_schema')) mr_manager_scope_ensure_schema();

    $user = mr_dashboard_current_user($request);
    if (!$user) return response()->json(['message' => 'غير مسجل الدخول'], 401);

    $role = mr_dashboard_role($user);
    $userId = (int) ($user->id ?? 0);
    $ownerId = (int) ($user->owner_id ?? 0);
    $isSystemAdmin = in_array($role, ['admin', 'super_admin'], true);
    $isManager = $role === 'manager';
    $isOwner = $role === 'owner' && $ownerId > 0;

    $ownersQuery = DB::table('owners');
    if ($isManager) mr_dashboard_filter_manager($ownersQuery, 'owners', $userId);
    elseif ($isOwner) $ownersQuery->where('id', $ownerId);
    elseif (!$isSystemAdmin) $ownersQuery->whereRaw('1 = 0');
    $owners = $ownersQuery->orderBy('name')->get();
    $ownerIds = $owners->pluck('id')->map(fn ($id) => (int) $id)->all();

    $propertiesQuery = DB::table('properties');
    if ($isManager) mr_dashboard_filter_manager($propertiesQuery, 'properties', $userId);
    elseif ($isOwner) $propertiesQuery->where('owner_id', $ownerId);
    elseif (!$isSystemAdmin) $propertiesQuery->whereRaw('1 = 0');
    $properties = $propertiesQuery->orderByDesc('id')->get();
    $propertyIds = $properties->pluck('id')->map(fn ($id) => (int) $id)->all();

    $unitsQuery = DB::table('units');
    if ($isManager) {
        if (Schema::hasColumn('units', 'manager_id')) {
            $unitsQuery->where(function ($q) use ($userId, $propertyIds) {
                $q->where('manager_id', $userId);
                if (!empty($propertyIds)) $q->orWhereIn('property_id', $propertyIds);
            });
        } else {
            $unitsQuery->whereIn('property_id', $propertyIds ?: [-1]);
        }
    } elseif ($isOwner || !$isSystemAdmin) {
        $unitsQuery->whereIn('property_id', $propertyIds ?: [-1]);
    }
    $units = $unitsQuery->orderByDesc('id')->get();
    $unitIds = $units->pluck('id')->map(fn ($id) => (int) $id)->all();

    $contractsQuery = DB::table('contracts');
    if ($isManager) {
        if (Schema::hasColumn('contracts', 'manager_id')) {
            $contractsQuery->where(function ($q) use ($userId, $unitIds) {
                $q->where('manager_id', $userId);
                if (!empty($unitIds)) $q->orWhereIn('unit_id', $unitIds);
            });
        } else {
            $contractsQuery->whereIn('unit_id', $unitIds ?: [-1]);
        }
    } elseif ($isOwner || !$isSystemAdmin) {
        $contractsQuery->whereIn('unit_id', $unitIds ?: [-1]);
    }
    $contracts = $contractsQuery->orderByDesc('id')->get();
    $contractIds = $contracts->pluck('id')->map(fn ($id) => (int) $id)->all();
    $tenantIds = $contracts->pluck('tenant_id')->filter()->map(fn ($id) => (int) $id)->unique()->values()->all();

    $tenantsQuery = DB::table('tenants');
    if ($isManager) {
        if (Schema::hasColumn('tenants', 'manager_id')) {
            $tenantsQuery->where(function ($q) use ($userId, $tenantIds) {
                $q->where('manager_id', $userId);
                if (!empty($tenantIds)) $q->orWhereIn('id', $tenantIds);
            });
        } else {
            $tenantsQuery->whereIn('id', $tenantIds ?: [-1]);
        }
    } elseif ($isOwner || !$isSystemAdmin) {
        $tenantsQuery->whereIn('id', $tenantIds ?: [-1]);
    }
    $tenantsCount = $tenantsQuery->count();

    $paymentsQuery = DB::table('payments');
    if ($isManager) {
        if (Schema::hasColumn('payments', 'manager_id')) {
            $paymentsQuery->where(function ($q) use ($userId, $contractIds) {
                $q->where('manager_id', $userId);
                if (!empty($contractIds)) $q->orWhereIn('contract_id', $contractIds);
            });
        } else {
            $paymentsQuery->whereIn('contract_id', $contractIds ?: [-1]);
        }
    } elseif ($isOwner || !$isSystemAdmin) {
        $paymentsQuery->whereIn('contract_id', $contractIds ?: [-1]);
    }
    $payments = $paymentsQuery->get();

    $expensesQuery = DB::table('property_expenses');
    if (Schema::hasTable('property_expenses')) {
        if ($isManager && Schema::hasColumn('property_expenses', 'manager_id')) {
            $expensesQuery->where(function ($q) use ($userId, $propertyIds) {
                $q->where('manager_id', $userId);
                if (!empty($propertyIds)) $q->orWhereIn('property_id', $propertyIds);
            });
        } elseif ($isOwner || !$isSystemAdmin || $isManager) {
            $expensesQuery->whereIn('property_id', $propertyIds ?: [-1]);
        }
        $expensesTotal = (float) $expensesQuery->sum('amount');
    } else {
        $expensesTotal = 0.0;
    }

    $totalPaid = (float) $payments->where('status', 'paid')->sum('amount');
    $totalDue = (float) $payments->whereIn('status', ['due', 'overdue'])->sum('amount');
    $overdueAmount = (float) $payments->where('status', 'overdue')->sum('amount');
    $overdueCount = (int) $payments->where('status', 'overdue')->count();

    return response()->json([
        'status' => 'ok',
        'scope' => [
            'role' => $role,
            'owner_id' => $ownerId ?: null,
            'manager_id' => $isManager ? $userId : null,
            'is_system_admin' => $isSystemAdmin,
            'is_manager' => $isManager,
        ],
        'summary' => [
            'owners_count' => $owners->count(),
            'properties_count' => $properties->count(),
            'units_count' => $units->count(),
            'tenants_count' => $tenantsCount,
            'contracts_count' => $contracts->count(),
            'active_contracts_count' => $contracts->where('status', 'active')->count(),
            'total_paid' => $totalPaid,
            'total_due' => $totalDue,
            'overdue_amount' => $overdueAmount,
            'overdue_count' => $overdueCount,
            'total_expenses' => $expensesTotal,
            'net_income' => $totalPaid - $expensesTotal,
        ],
        'owners' => $owners,
        'properties' => $properties,
    ]);
});
