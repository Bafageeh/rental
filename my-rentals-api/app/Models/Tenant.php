<?php

namespace App\Models;

use App\Models\Concerns\ScopedToManager;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tenant extends Model
{
    use ScopedToManager;

    protected $fillable = [
        'manager_id',
        'name',
        'phone',
        'national_id',
        'identity_type',
        'birth_date',
        'nationality',
        'email',
        'address',
        'notes',
    ];

    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class);
    }

    public function contractFiles(): HasMany
    {
        return $this->hasMany(ContractFile::class);
    }
}
