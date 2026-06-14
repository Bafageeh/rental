<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ServiceProvider extends Model
{
    protected $fillable = [
        'manager_id',
        'name',
        'provider_type',
        'phone',
        'alternate_phone',
        'email',
        'city',
        'district',
        'address',
        'default_visit_fee',
        'rating',
        'is_preferred',
        'is_active',
        'notes',
    ];

    protected $casts = [
        'manager_id' => 'integer',
        'default_visit_fee' => 'decimal:2',
        'rating' => 'integer',
        'is_preferred' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function maintenanceRequests(): HasMany
    {
        return $this->hasMany(MaintenanceRequest::class);
    }
}
