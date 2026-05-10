<?php

// PHASE2_ROUTE_MODULES: generated from routes/api.php on 2026-04-27-083758.
// Section: Owners

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
| Owners
|--------------------------------------------------------------------------
*/

Route::get('/owners', function () {
    return Owner::withCount('properties')
        ->orderBy('type')
        ->orderBy('name')
        ->get()
        ->map(function ($owner) {
            $owner->units_count = Unit::whereHas('property', function ($query) use ($owner) {
                $query->where('owner_id', $owner->id);
            })->count();

            $owner->contracts_count = Contract::whereHas('unit.property', function ($query) use ($owner) {
                $query->where('owner_id', $owner->id);
            })->count();

            $owner->has_rental_assets = ($owner->properties_count ?? 0) > 0 || $owner->units_count > 0 || $owner->contracts_count > 0;

            return $owner;
        });
});

Route::post('/owners', function (Request $request) {
    $data = $request->validate([
        'name' => ['required', 'string', 'max:255'],
        'phone' => ['nullable', 'string', 'max:50'],
        'email' => ['nullable', 'email', 'max:255'],
        'national_id' => ['nullable', 'string', 'max:50'],
        'type' => ['nullable', 'string', 'max:50'],
        'notes' => ['nullable', 'string'],
    ]);

    $owner = Owner::create([
        'name' => $data['name'],
        'phone' => $data['phone'] ?? null,
        'email' => $data['email'] ?? null,
        'national_id' => $data['national_id'] ?? null,
        'type' => $data['type'] ?? 'external',
        'notes' => $data['notes'] ?? null,
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم إضافة المالك بنجاح',
        'owner' => $owner,
    ], 201);
});



Route::get('/owners/{owner}/dashboard', [OwnerDashboardController::class, 'show']);
Route::get('/my/owners/{owner}/dashboard', [OwnerDashboardController::class, 'showScoped']);
