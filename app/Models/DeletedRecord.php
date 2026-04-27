<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeletedRecord extends Model
{
    protected $fillable = [
        'resource',
        'resource_label',
        'table_name',
        'record_id',
        'record_title',
        'owner_id',
        'deleted_by_user_id',
        'deleted_by_name',
        'payload',
        'metadata',
        'status',
        'deleted_at',
        'restored_at',
        'restored_by_user_id',
        'restore_error',
    ];

    protected $casts = [
        'payload' => 'array',
        'metadata' => 'array',
        'deleted_at' => 'datetime',
        'restored_at' => 'datetime',
    ];
}
