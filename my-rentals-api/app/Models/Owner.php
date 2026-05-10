<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Owner extends Model
{
    protected $fillable = [
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
