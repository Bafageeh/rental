<?php

// PHASE2_ROUTE_MODULES: generated from routes/api.php on 2026-04-27-083758.
// Section: Occupancy & Vacancy Report

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
| Occupancy & Vacancy Report
|--------------------------------------------------------------------------
*/

if (!function_exists('my_rentals_occupancy_payload')) {
    function my_rentals_occupancy_payload($properties): array
    {
        $propertyIds = $properties->pluck('id');

        $units = \App\Models\Unit::with(['property.owner'])
            ->whereIn('property_id', $propertyIds)
            ->orderBy('property_id')
            ->orderBy('unit_number')
            ->get();

        $unitIds = $units->pluck('id');

        $activeContracts = \App\Models\Contract::with([
                'tenant',
                'unit.property.owner',
            ])
            ->whereIn('unit_id', $unitIds)
            ->where('status', 'active')
            ->orderBy('end_date')
            ->get();

        $activeByUnit = $activeContracts->keyBy('unit_id');
        $rentedUnitIds = $activeContracts->pluck('unit_id')->unique();

        $unitsCount = $units->count();
        $rentedCount = $rentedUnitIds->count();
        $availableCount = max($unitsCount - $rentedCount, 0);
        $occupancyRate = $unitsCount > 0 ? round(($rentedCount / $unitsCount) * 100, 2) : 0;

        $propertiesPayload = $properties->map(function ($property) use ($units, $activeByUnit) {
            $propertyUnits = $units->where('property_id', $property->id)->values();

            $rented = [];
            $vacant = [];

            foreach ($propertyUnits as $unit) {
                $activeContract = $activeByUnit->get($unit->id);

                $unitPayload = [
                    'id' => $unit->id,
                    'unit_number' => $unit->unit_number,
                    'floor' => $unit->floor,
                    'status' => $unit->status,
                    'rent_amount' => $unit->rent_amount,
                    'rooms_count' => $unit->rooms_count,
                    'bathrooms_count' => $unit->bathrooms_count,
                    'is_rooftop' => $unit->is_rooftop,
                    'orientation' => $unit->orientation,
                ];

                if ($activeContract) {
                    $rented[] = array_merge($unitPayload, [
                        'tenant_name' => $activeContract->tenant?->name,
                        'tenant_phone' => $activeContract->tenant?->phone,
                        'contract_id' => $activeContract->id,
                        'contract_number' => $activeContract->government_contract_number ?: $activeContract->contract_number,
                        'start_date' => $activeContract->start_date,
                        'end_date' => $activeContract->end_date,
                    ]);
                } else {
                    $vacant[] = $unitPayload;
                }
            }

            $total = $propertyUnits->count();
            $rentedCount = count($rented);
            $vacantCount = count($vacant);
            $rate = $total > 0 ? round(($rentedCount / $total) * 100, 2) : 0;

            return [
                'property' => [
                    'id' => $property->id,
                    'name' => $property->name,
                    'city' => $property->city,
                    'district' => $property->district,
                    'property_type' => $property->property_type,
                    'owner_name' => $property->owner?->name,
                    'parking_spots_count' => $property->parking_spots_count,
                ],
                'summary' => [
                    'units_count' => $total,
                    'rented_units_count' => $rentedCount,
                    'vacant_units_count' => $vacantCount,
                    'occupancy_rate' => $rate,
                ],
                'vacant_units' => array_values($vacant),
                'rented_units' => array_values($rented),
            ];
        })->values();

        return [
            'summary' => [
                'properties_count' => $properties->count(),
                'units_count' => $unitsCount,
                'rented_units_count' => $rentedCount,
                'vacant_units_count' => $availableCount,
                'occupancy_rate' => $occupancyRate,
            ],
            'properties' => $propertiesPayload,
        ];
    }
}

Route::get('/occupancy-report', function () {
    $properties = \App\Models\Property::with('owner')
        ->orderBy('id', 'desc')
        ->get();

    return my_rentals_occupancy_payload($properties);
});

Route::get('/my/occupancy-report', function (\Illuminate\Http\Request $request) {
    $user = function_exists('my_rentals_current_user_for_scope')
        ? my_rentals_current_user_for_scope($request)
        : (function_exists('my_rentals_bearer_user') ? my_rentals_bearer_user($request) : null);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $isAdmin = function_exists('my_rentals_is_admin_user')
        ? my_rentals_is_admin_user($user)
        : in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);

    $propertiesQuery = \App\Models\Property::with('owner')->orderBy('id', 'desc');

    if (!$isAdmin) {
        if (!$user->owner_id) {
            return [
                'summary' => [
                    'properties_count' => 0,
                    'units_count' => 0,
                    'rented_units_count' => 0,
                    'vacant_units_count' => 0,
                    'occupancy_rate' => 0,
                ],
                'properties' => [],
            ];
        }

        $propertiesQuery->where('owner_id', $user->owner_id);
    }

    return my_rentals_occupancy_payload($propertiesQuery->get());
});
