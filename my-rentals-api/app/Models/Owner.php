<?php

namespace App\Models;

use App\Models\Concerns\ScopedToManager;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Owner extends Model
{
    use ScopedToManager;

    protected $fillable = [
        'manager_id',
        'name',
        'phone',
        'email',
        'national_id',
        'type',
        'notes',
    ];

    public function properties(): HasMany
    {
        return $this->hasMany(Property::class);
    }
}
