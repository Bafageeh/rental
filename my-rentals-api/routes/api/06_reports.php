<?php

// PHASE2_ROUTE_MODULES: generated from routes/api.php on 2026-04-27-083758.
// Section: Reports

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
| Reports
|--------------------------------------------------------------------------
*/

Route::get('/reports/owners-summary', function () {
    $owners = Owner::orderBy('type')->orderBy('name')->get();

    $rows = $owners->map(function ($owner) {
        $propertyIds = \Illuminate\Support\Facades\DB::table('properties')
            ->where('owner_id', $owner->id)
            ->pluck('id');

        $unitIds = \Illuminate\Support\Facades\DB::table('units')
            ->whereIn('property_id', $propertyIds)
            ->pluck('id');

        $contractIds = \Illuminate\Support\Facades\DB::table('contracts')
            ->whereIn('unit_id', $unitIds)
            ->pluck('id');

        $propertiesCount = $propertyIds->count();
        $unitsCount = $unitIds->count();

        $activeContractsCount = \Illuminate\Support\Facades\DB::table('contracts')
            ->whereIn('id', $contractIds)
            ->where('status', 'active')
            ->count();

        $paidIncome = (float) \Illuminate\Support\Facades\DB::table('payments')
            ->whereIn('contract_id', $contractIds)
            ->where('status', 'paid')
            ->sum('amount');

        $dueIncome = (float) \Illuminate\Support\Facades\DB::table('payments')
            ->whereIn('contract_id', $contractIds)
            ->where('status', 'due')
            ->sum('amount');

        $overdueIncome = (float) \Illuminate\Support\Facades\DB::table('payments')
            ->whereIn('contract_id', $contractIds)
            ->where('status', 'overdue')
            ->sum('amount');

        $expenses = 0.0;

        if (\Illuminate\Support\Facades\Schema::hasTable('property_expenses')) {
            $expenses = (float) \Illuminate\Support\Facades\DB::table('property_expenses')
                ->whereIn('property_id', $propertyIds)
                ->sum('amount');
        }

        $netIncome = $paidIncome - $expenses;

        return [
            'owner_id' => $owner->id,
            'owner_name' => $owner->name,
            'owner_type' => $owner->type,
            'properties_count' => $propertiesCount,
            'units_count' => $unitsCount,
            'active_contracts_count' => $activeContractsCount,
            'paid_income' => $paidIncome,
            'due_income' => $dueIncome,
            'overdue_income' => $overdueIncome,
            'expenses' => $expenses,
            'net_income' => $netIncome,
        ];
    })->values();

    return response()->json([
        'status' => 'ok',
        'summary' => [
            'owners_count' => $rows->count(),
            'properties_count' => $rows->sum('properties_count'),
            'units_count' => $rows->sum('units_count'),
            'active_contracts_count' => $rows->sum('active_contracts_count'),
            'paid_income' => $rows->sum('paid_income'),
            'due_income' => $rows->sum('due_income'),
            'overdue_income' => $rows->sum('overdue_income'),
            'expenses' => $rows->sum('expenses'),
            'net_income' => $rows->sum('net_income'),
        ],
        'owners' => $rows,
    ]);
});
