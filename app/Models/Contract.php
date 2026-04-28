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
        'ejar_record_number',
        'ejar_version_number',
        'contract_type',
        'sealing_date',
        'sealing_location',
        'start_date',
        'end_date',
        'rent_amount',
        'parking_fee',
        'services_fee',
        'deposit_amount',
        'brokerage_fee',
        'brokerage_fee_paid_by',
        'brokerage_fee_due_date',
        'payment_cycle',
        'rent_payments_count',
        'regular_payment_amount',
        'last_payment_amount',
        'total_contract_value',
        'electricity_annual_amount',
        'water_annual_amount',
        'gas_annual_amount',
        'parking_annual_amount',
        'rented_parking_lots',
        'status',
        'source',
        'notes',
    ];

    protected $casts = [
        'sealing_date' => 'date',
        'start_date' => 'date',
        'end_date' => 'date',
        'brokerage_fee_due_date' => 'date',
        'rent_amount' => 'decimal:2',
        'parking_fee' => 'decimal:2',
        'services_fee' => 'decimal:2',
        'deposit_amount' => 'decimal:2',
        'brokerage_fee' => 'decimal:2',
        'regular_payment_amount' => 'decimal:2',
        'last_payment_amount' => 'decimal:2',
        'total_contract_value' => 'decimal:2',
        'electricity_annual_amount' => 'decimal:2',
        'water_annual_amount' => 'decimal:2',
        'gas_annual_amount' => 'decimal:2',
        'parking_annual_amount' => 'decimal:2',
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
