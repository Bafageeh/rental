<?php

// PHASE2_ROUTE_MODULES: generated from routes/api.php on 2026-04-27-083758.
// Section: Alerts

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
| Alerts
|--------------------------------------------------------------------------
*/

Route::get('/alerts', function () {
    $today = \Carbon\Carbon::today();
    $upcomingDate = \Carbon\Carbon::today()->addDays(30);
    $endingDate = \Carbon\Carbon::today()->addDays(60);

    $overduePayments = \App\Models\Payment::with([
        'contract.tenant',
        'contract.unit.property.owner',
    ])
        ->where(function ($query) use ($today) {
            $query->where('status', 'overdue')
                ->orWhere(function ($query) use ($today) {
                    $query->whereIn('status', ['due', 'pending'])
                        ->whereNotNull('due_date')
                        ->whereDate('due_date', '<', $today->toDateString());
                });
        })
        ->orderBy('due_date')
        ->get();

    $upcomingPayments = \App\Models\Payment::with([
        'contract.tenant',
        'contract.unit.property.owner',
    ])
        ->whereNotIn('status', ['paid', 'cancelled'])
        ->whereNotNull('due_date')
        ->whereDate('due_date', '>=', $today->toDateString())
        ->whereDate('due_date', '<=', $upcomingDate->toDateString())
        ->orderBy('due_date')
        ->get();

    $endingContracts = \App\Models\Contract::with([
        'tenant',
        'unit.property.owner',
    ])
        ->where('status', 'active')
        ->whereNotNull('end_date')
        ->whereDate('end_date', '>=', $today->toDateString())
        ->whereDate('end_date', '<=', $endingDate->toDateString())
        ->orderBy('end_date')
        ->get();

    return response()->json([
        'status' => 'ok',
        'today' => $today->toDateString(),
        'summary' => [
            'overdue_count' => $overduePayments->count(),
            'overdue_total' => (float) $overduePayments->sum('amount'),
            'upcoming_count' => $upcomingPayments->count(),
            'upcoming_total' => (float) $upcomingPayments->sum('amount'),
            'ending_contracts_count' => $endingContracts->count(),
        ],
        'overdue_payments' => $overduePayments,
        'upcoming_payments' => $upcomingPayments,
        'ending_contracts' => $endingContracts,
    ]);
});



/* AUTH_PERMISSIONS_PATCH_START */
