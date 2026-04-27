<?php

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
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'app' => 'my-rentals-api',
    ]);
});

Route::post('/auth/login', [AuthController::class, 'login']);

// PHASE2_ROUTE_MODULES: api.php was split into routes/api/*.php for maintainability.
Route::middleware(['auth.api', 'api.scope'])->group(function () {
    foreach ([
        __DIR__ . '/api/00_core.php',
        __DIR__ . '/api/01_owners.php',
        __DIR__ . '/api/02_properties.php',
        __DIR__ . '/api/03_units.php',
        __DIR__ . '/api/04_tenants.php',
        __DIR__ . '/api/05_expenses.php',
        __DIR__ . '/api/06_reports.php',
        __DIR__ . '/api/07_files.php',
        __DIR__ . '/api/08_accounts.php',
        __DIR__ . '/api/09_contracts.php',
        __DIR__ . '/api/10_alerts.php',
        __DIR__ . '/api/11_auth_permissions.php',
        __DIR__ . '/api/12_parking.php',
        __DIR__ . '/api/13_reminders.php',
        __DIR__ . '/api/14_statements.php',
        __DIR__ . '/api/15_settlements.php',
        __DIR__ . '/api/16_occupancy.php',
        __DIR__ . '/api/17_renewals.php',
        __DIR__ . '/api/18_utility.php',
        __DIR__ . '/api/19_receipts.php',
    ] as $routeModule) {
        if (is_file($routeModule)) {
            require $routeModule;
        }
    }
});
