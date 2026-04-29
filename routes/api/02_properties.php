<?php

// PHASE2_ROUTE_MODULES: generated from routes/api.php on 2026-04-27-083758.
// Section: Properties

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
| Properties
|--------------------------------------------------------------------------
*/

if (!function_exists('mr_visible_units_query')) {
    function mr_visible_units_query($query)
    {
        return $query
            ->where('unit_number', '!=', 'العقار كامل')
            ->where(function ($unitQuery) {
                $unitQuery->whereNull('type')->orWhere('type', '!=', 'whole_property');
            });
    }
}

Route::get('/properties', function (Request $request) {
    $query = Property::with(['owner'])
        ->withCount([
            'units' => function ($unitQuery) {
                mr_visible_units_query($unitQuery);
            },
            'parkingSpots',
            'expenses',
            'files',
        ]);

    if ($request->filled('owner_id')) {
        $query->where('owner_id', $request->integer('owner_id'));
    }

    if ($request->filled('property_id')) {
        $query->where('id', $request->integer('property_id'));
    }

    return $query->orderBy('id', 'desc')->get();
});

Route::post('/properties', function (Request $request) {
    $data = $request->validate([
        'owner_id' => ['nullable', 'integer', 'exists:owners,id'],
        'name' => ['required', 'string', 'max:255'],
        'deed_number' => ['nullable', 'string', 'max:255'],
        'city' => ['nullable', 'string', 'max:255'],
        'district' => ['nullable', 'string', 'max:255'],
        'address' => ['nullable', 'string'],
        'national_short_address' => ['nullable', 'string', 'max:8', 'regex:/^[A-Za-z0-9]+$/'],
        'property_area' => ['nullable', 'numeric', 'min:0'],
        'floors_count' => ['nullable', 'integer', 'min:0'],
        'parking_spots_count' => ['nullable', 'integer', 'min:0'],
        'elevators_count' => ['nullable', 'integer', 'min:0'],
        'property_type' => ['nullable', 'string', 'max:100'], // building, apartment, villa, other
        'usage_type' => ['nullable', 'string', 'max:100'],
        'management_type' => ['nullable', 'string', 'max:100'],
        'default_unit_number' => ['nullable', 'string', 'max:100'],
        'notes' => ['nullable', 'string'],
    ]);

    $ownerId = $data['owner_id'] ?? null;

    if (!$ownerId) {
        $ownerId = Owner::where('type', 'self')->value('id');

        if (!$ownerId) {
            $owner = Owner::create([
                'name' => 'أملاكي الخاصة',
                'type' => 'self',
            ]);

            $ownerId = $owner->id;
        }
    }

    $propertyType = $data['property_type'] ?? 'building';

    $property = Property::create([
        'owner_id' => $ownerId,
        'name' => $data['name'],
        'deed_number' => $data['deed_number'] ?? null,
        'city' => $data['city'] ?? null,
        'district' => $data['district'] ?? null,
        'address' => $data['address'] ?? null,
        'national_short_address' => $data['national_short_address'] ?? null,
        'property_area' => $data['property_area'] ?? null,
        'floors_count' => $data['floors_count'] ?? ($propertyType === 'apartment' ? 1 : 0),
        'parking_spots_count' => $data['parking_spots_count'] ?? 0,
        'elevators_count' => $data['elevators_count'] ?? 0,
        'property_type' => $propertyType,
        'usage_type' => $data['usage_type'] ?? 'residential',
        'management_type' => $data['management_type'] ?? 'owned',
        'notes' => $data['notes'] ?? null,
    ]);

    $defaultUnit = null;

    if ($propertyType === 'apartment') {
        $defaultUnit = Unit::firstOrCreate(
            [
                'property_id' => $property->id,
                'unit_number' => $data['default_unit_number'] ?? 'الشقة',
            ],
            [
                'floor' => null,
                'type' => 'apartment',
                'is_subdivided' => false,
                'rent_amount' => 0,
                'status' => 'available',
                'notes' => 'وحدة افتراضية تم إنشاؤها تلقائيًا لأن نوع العقار شقة مستقلة.',
            ]
        );
    }

    return response()->json([
        'status' => 'ok',
        'message' => $propertyType === 'apartment'
            ? 'تم إضافة الشقة كعقار مستقل وإنشاء وحدة افتراضية لها'
            : 'تم إضافة العقار بنجاح',
        'property' => $property->load('owner'),
        'default_unit' => $defaultUnit,
    ], 201);
});

Route::get('/properties/{property}', function (Property $property) {
    $property->load([
        'owner',
        'units' => function ($unitQuery) {
            mr_visible_units_query($unitQuery)->with(['childUnits', 'contracts']);
        },
        'parkingSpots',
        'expenses.category',
        'files',
    ]);

    $property->units->each(function ($unit) {
        $unit->contracts_count = $unit->relationLoaded('contracts') ? $unit->contracts->count() : 0;
    });

    $visibleUnitIds = $property->units->pluck('id')->all();
    $unitContractsCount = empty($visibleUnitIds) ? 0 : Contract::whereIn('unit_id', $visibleUnitIds)->count();

    $wholeUnitIds = Unit::where('property_id', $property->id)
        ->where(function ($unitQuery) {
            $unitQuery->where('type', 'whole_property')->orWhere('unit_number', 'العقار كامل');
        })
        ->pluck('id')
        ->all();

    $wholeContractsCount = empty($wholeUnitIds) ? 0 : Contract::whereIn('unit_id', $wholeUnitIds)->count();

    $property->units_count = $property->units->count();
    $property->property_contracts_count = $wholeContractsCount;
    $property->unit_contracts_count = $unitContractsCount;
    $property->whole_property_contract_exists = $wholeContractsCount > 0;
    $property->can_create_whole_property_contract = $wholeContractsCount === 0 && $unitContractsCount === 0;
    $property->can_create_unit_contract = $wholeContractsCount === 0 && $property->units->contains(fn ($unit) => (int) ($unit->contracts_count ?? 0) === 0);
    $property->can_create_contract = $property->can_create_whole_property_contract || $property->can_create_unit_contract;

    return $property;
});
