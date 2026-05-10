<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ActivityLog extends Model
{
    protected $fillable = [
        'action',
        'resource',
        'resource_label',
        'record_id',
        'record_title',
        'owner_id',
        'user_id',
        'user_name',
        'user_email',
        'old_payload',
        'new_payload',
        'metadata',
        'ip_address',
        'user_agent',
    ];

    protected $casts = [
        'old_payload' => 'array',
        'new_payload' => 'array',
        'metadata' => 'array',
    ];
}
