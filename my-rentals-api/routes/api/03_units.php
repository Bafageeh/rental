<?php

// PHASE2_ROUTE_MODULES: generated from routes/api.php on 2026-04-27-083758.
// Section: Units

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
| Units
|--------------------------------------------------------------------------
*/

Route::get('/units', function (Request $request) {
    $query = Unit::with(['property.owner', 'parentUnit']);

    if ($request->filled('owner_id')) {
        $query->whereHas('property', function ($propertyQuery) use ($request) {
            $propertyQuery->where('owner_id', $request->integer('owner_id'));
        });
    }

    if ($request->filled('property_id')) {
        $query->where('property_id', $request->integer('property_id'));
    }

    return $query->orderBy('id', 'desc')->get();
});

Route::post('/units', function (Request $request) {
    $data = $request->validate([
        'property_id' => ['required', 'integer', 'exists:properties,id'],
        'parent_unit_id' => ['nullable', 'integer', 'exists:units,id'],
        'unit_number' => ['required', 'string', 'max:100'],
        'floor' => ['nullable', 'string', 'max:100'],
        'type' => ['nullable', 'string', 'max:100'],
        'is_subdivided' => ['nullable', 'boolean'],
        'rooms_count' => ['nullable', 'integer', 'min:0'],
        'bathrooms_count' => ['nullable', 'integer', 'min:0'],
        'has_kitchen' => ['nullable', 'boolean'],
        'kitchen_type' => ['nullable', 'string', 'max:50'],
        'is_kitchen_installed' => ['nullable', 'boolean'],
        'has_living_room' => ['nullable', 'boolean'],
        'is_rooftop' => ['nullable', 'boolean'],
        'orientation' => ['nullable', 'string', 'max:50'],
        'rent_amount' => ['nullable', 'numeric', 'min:0'],
        'status' => ['nullable', 'string', 'max:50'],
        'notes' => ['nullable', 'string'],
    ]);

    $unit = Unit::create([
        'property_id' => $data['property_id'],
        'parent_unit_id' => $data['parent_unit_id'] ?? null,
        'unit_number' => $data['unit_number'],
        'floor' => $data['floor'] ?? null,
        'type' => $data['type'] ?? 'apartment',
        'is_subdivided' => $data['is_subdivided'] ?? false,
        'rooms_count' => $data['rooms_count'] ?? 0,
        'bathrooms_count' => $data['bathrooms_count'] ?? 0,
        'has_kitchen' => $data['has_kitchen'] ?? false,
        'kitchen_type' => $data['kitchen_type'] ?? null,
        'is_kitchen_installed' => $data['is_kitchen_installed'] ?? false,
        'has_living_room' => $data['has_living_room'] ?? false,
        'is_rooftop' => $data['is_rooftop'] ?? false,
        'orientation' => $data['orientation'] ?? null,
        'rent_amount' => $data['rent_amount'] ?? 0,
        'status' => $data['status'] ?? 'available',
        'notes' => $data['notes'] ?? null,
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم إضافة الوحدة بنجاح',
        'unit' => $unit->load(['property.owner', 'parentUnit']),
    ], 201);
});
