<?php

use App\Models\Property;
use App\Models\Unit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

if (!function_exists('whole_property_unit_for_contract')) {
    function whole_property_unit_for_contract(Property $property): Unit
    {
        return Unit::firstOrCreate(
            ['property_id' => $property->id, 'unit_number' => 'العقار كامل'],
            [
                'owner_id' => $property->owner_id,
                'unit_scope' => 'property',
                'type' => 'whole_property',
                'area' => $property->property_area,
                'status' => 'available',
                'rent_amount' => 0,
                'notes' => 'وحدة افتراضية لتأجير العقار كاملًا عند عدم وجود وحدات.',
            ]
        );
    }
}

Route::get('/units', function (Request $request) {
    if ($request->filled('property_id')) {
        $property = Property::find($request->integer('property_id'));
        if ($property && !Unit::where('property_id', $property->id)->exists()) {
            whole_property_unit_for_contract($property);
        }
    }

    $query = Unit::with(['property.owner', 'parentUnit', 'contracts']);

    if ($request->filled('owner_id')) {
        $ownerId = $request->integer('owner_id');
        $query->where(function ($q) use ($ownerId) {
            $q->where('owner_id', $ownerId)
                ->orWhereHas('property', fn ($p) => $p->where('owner_id', $ownerId));
        });
    }

    if ($request->filled('property_id')) {
        $query->where('property_id', $request->integer('property_id'));
    }

    return $query->orderBy('id', 'desc')->get()->map(function ($unit) {
        $unit->contracts_count = $unit->relationLoaded('contracts') ? $unit->contracts->count() : 0;
        return $unit;
    })->values();
});
