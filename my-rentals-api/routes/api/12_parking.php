<?php

// PHASE2_ROUTE_MODULES: generated from routes/api.php on 2026-04-27-083758.
// Section: Parking Spots

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
| Parking Spots
|--------------------------------------------------------------------------
*/

Route::get('/parking-spots', function () {
    return \App\Models\ParkingSpot::with(['property.owner'])
        ->orderBy('property_id')
        ->orderBy('spot_number')
        ->get();
});

Route::post('/parking-spots', function (Request $request) {
    $data = $request->validate([
        'property_id' => ['required', 'integer', 'exists:properties,id'],
        'spot_number' => ['required', 'string', 'max:100'],
        'location' => ['nullable', 'string', 'max:255'],
        'monthly_fee' => ['nullable', 'numeric', 'min:0'],
        'status' => ['nullable', 'string', 'max:50'],
        'notes' => ['nullable', 'string'],
    ]);

    $spot = \App\Models\ParkingSpot::updateOrCreate(
        [
            'property_id' => $data['property_id'],
            'spot_number' => $data['spot_number'],
        ],
        [
            'location' => $data['location'] ?? null,
            'monthly_fee' => $data['monthly_fee'] ?? 0,
            'status' => $data['status'] ?? 'available',
            'notes' => $data['notes'] ?? null,
        ]
    );

    return response()->json([
        'status' => 'ok',
        'message' => 'تم حفظ الموقف بنجاح',
        'parking_spot' => $spot->fresh()->load(['property.owner']),
    ], 201);
});

Route::post('/parking-spots/{parkingSpot}/status', function (
    \App\Models\ParkingSpot $parkingSpot,
    Request $request
) {
    $data = $request->validate([
        'status' => ['required', 'string', 'max:50'],
        'notes' => ['nullable', 'string'],
    ]);

    $updates = [
        'status' => $data['status'],
    ];

    if (array_key_exists('notes', $data)) {
        $updates['notes'] = $data['notes'];
    }

    $parkingSpot->update($updates);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم تحديث حالة الموقف',
        'parking_spot' => $parkingSpot->fresh()->load(['property.owner']),
    ]);
});

Route::get('/my/parking-spots', function (\Illuminate\Http\Request $request) {
    $user = function_exists('my_rentals_current_user_for_scope')
        ? my_rentals_current_user_for_scope($request)
        : (function_exists('my_rentals_bearer_user') ? my_rentals_bearer_user($request) : null);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $isAdmin = function_exists('my_rentals_is_admin_user')
        ? my_rentals_is_admin_user($user)
        : in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);

    $query = \App\Models\ParkingSpot::with(['property.owner']);

    if (!$isAdmin) {
        if (!$user->owner_id) {
            return [];
        }

        $propertyIds = \App\Models\Property::where('owner_id', $user->owner_id)->pluck('id');
        $query->whereIn('property_id', $propertyIds);
    }

    return $query
        ->orderBy('property_id')
        ->orderBy('spot_number')
        ->get();
});
