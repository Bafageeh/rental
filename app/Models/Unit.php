<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Unit extends Model
{
    protected $fillable = [
        'property_id',
        'parent_unit_id',
        'unit_number',
        'floor',
        'type',
        'is_subdivided',
        'rooms_count',
        'bathrooms_count',
        'has_kitchen',
        'kitchen_type',
        'is_kitchen_installed',
        'has_living_room',
        'is_rooftop',
        'orientation',
        'rent_amount',
        'status',
        'notes',
    ];

    protected $casts = [
        'is_subdivided' => 'boolean',
        'has_kitchen' => 'boolean',
        'is_kitchen_installed' => 'boolean',
        'has_living_room' => 'boolean',
        'is_rooftop' => 'boolean',
    ];

    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
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
}
