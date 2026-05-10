<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UnitInspection extends Model
{
    protected $fillable = [
        'property_id',
        'unit_id',
        'tenant_id',
        'contract_id',
        'inspection_type',
        'status',
        'inspection_date',
        'inspector_name',
        'electricity_meter_reading',
        'water_meter_reading',
        'keys_count',
        'walls_ok',
        'doors_ok',
        'windows_ok',
        'plumbing_ok',
        'electricity_ok',
        'ac_ok',
        'kitchen_ok',
        'bathrooms_ok',
        'cleanliness_ok',
        'damage_notes',
        'estimated_repair_cost',
        'recommendations',
        'notes',
    ];

    protected $casts = [
        'inspection_date' => 'date',
        'keys_count' => 'integer',
        'walls_ok' => 'boolean',
        'doors_ok' => 'boolean',
        'windows_ok' => 'boolean',
        'plumbing_ok' => 'boolean',
        'electricity_ok' => 'boolean',
        'ac_ok' => 'boolean',
        'kitchen_ok' => 'boolean',
        'bathrooms_ok' => 'boolean',
        'cleanliness_ok' => 'boolean',
        'estimated_repair_cost' => 'decimal:2',
    ];

    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class);
    }
}
