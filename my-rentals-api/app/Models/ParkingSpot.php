<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ParkingSpot extends Model
{
    protected $fillable = [
        'property_id',
        'spot_number',
        'location',
        'monthly_fee',
        'status',
        'notes',
    ];

    protected $casts = [
        'monthly_fee' => 'decimal:2',
    ];

    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }
}
