<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Contract extends Model
{
    protected $fillable = [
        'unit_id',
        'tenant_id',
        'parking_spot_id',
        'contract_number',
        'government_contract_number',
        'start_date',
        'end_date',
        'rent_amount',
        'parking_fee',
        'services_fee',
        'deposit_amount',
        'payment_cycle',
        'status',
        'source',
        'notes',
    ];

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function parkingSpot(): BelongsTo
    {
        return $this->belongsTo(ParkingSpot::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function files(): HasMany
    {
        return $this->hasMany(ContractFile::class);
    }
}
