<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UnitMedia extends Model
{
    protected $table = 'unit_media';

    protected $fillable = [
        'unit_id',
        'file_name',
        'file_path',
        'file_type',
        'file_size',
        'media_type',
        'notes',
    ];

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }
}
