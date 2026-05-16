<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Unit extends Model
{
    protected $fillable = [
        'property_id',
        'owner_id',
        'unit_scope',
        'parent_unit_id',
        'deed_number',
        'document_number',
        'document_date_hijri',
        'document_status',
        'previous_document_number',
        'plan_number',
        'plot_number',
        'city',
        'district',
        'address',
        'deed_owner_name',
        'deed_ownership_percentage',
        'deed_raw_excerpt',
        'unit_number',
        'floor',
        'type',
        'area',
        'is_furnished',
        'furnishing_status',
        'is_subdivided',
        'rooms_count',
        'bathrooms_count',
        'has_kitchen',
        'kitchen_type',
        'is_kitchen_installed',
        'kitchen_cabinets_installed',
        'has_living_room',
        'is_rooftop',
        'orientation',
        'ac_units_count',
        'electricity_meter_number',
        'water_meter_number',
        'gas_meter_number',
        'rent_amount',
        'status',
        'notes',
    ];

    protected $casts = [
        'is_subdivided' => 'boolean',
        'has_kitchen' => 'boolean',
        'is_kitchen_installed' => 'boolean',
        'kitchen_cabinets_installed' => 'boolean',
        'has_living_room' => 'boolean',
        'is_rooftop' => 'boolean',
        'is_furnished' => 'boolean',
        'area' => 'decimal:2',
        'rent_amount' => 'decimal:2',
    ];

    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(Owner::class);
    }

    public function parentUnit(): BelongsTo
    {
        return $this->belongsTo(Unit::class, 'parent_unit_id');
    }

    public function childUnits(): HasMany
    {
        return $this->hasMany(Unit::class, 'parent_unit_id');
    }

    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class);
    }

    public function media(): HasMany
    {
        return $this->hasMany(UnitMedia::class);
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(PropertyExpense::class);
    }
}
