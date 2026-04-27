<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Property extends Model
{
    protected $fillable = [
        'owner_id',
        'name',
        'deed_number',
        'city',
        'district',
        'address',
        'national_short_address',
        'property_area',
        'floors_count',
        'parking_spots_count',
        'elevators_count',
        'property_type',
        'usage_type',
        'management_type',
        'notes',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(Owner::class);
    }

    public function units(): HasMany
    {
        return $this->hasMany(Unit::class);
    }

    public function parkingSpots(): HasMany
    {
        return $this->hasMany(ParkingSpot::class);
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(PropertyExpense::class);
    }

    public function files(): HasMany
    {
        return $this->hasMany(PropertyFile::class);
    }
}
