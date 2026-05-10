<?php

// PHASE2_ROUTE_MODULES: generated from routes/api.php on 2026-04-27-083758.
// Section: Tenants

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
| Tenants
|--------------------------------------------------------------------------
*/

Route::get('/tenants', function () {
    return Tenant::withCount(['contracts', 'contractFiles'])
        ->orderBy('id', 'desc')
        ->get();
});

Route::post('/tenants', function (Request $request) {
    $data = $request->validate([
        'name' => ['required', 'string', 'max:255'],
        'phone' => ['nullable', 'string', 'max:50'],
        'email' => ['nullable', 'email', 'max:255'],
        'national_id' => ['nullable', 'string', 'max:50'],
        'nationality' => ['nullable', 'string', 'max:100'],
        'address' => ['nullable', 'string'],
        'notes' => ['nullable', 'string'],
    ]);

    $tenant = Tenant::create([
        'name' => $data['name'],
        'phone' => $data['phone'] ?? null,
        'email' => $data['email'] ?? null,
        'national_id' => $data['national_id'] ?? null,
        'nationality' => $data['nationality'] ?? null,
        'address' => $data['address'] ?? null,
        'notes' => $data['notes'] ?? null,
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم إضافة المستأجر بنجاح',
        'tenant' => $tenant,
    ], 201);
});
