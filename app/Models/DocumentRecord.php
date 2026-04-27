<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DocumentRecord extends Model
{
    protected $fillable = [
        'entity_type',
        'entity_id',
        'title',
        'document_type',
        'original_file_name',
        'mime_type',
        'file_size',
        'storage_path',
        'file_url',
        'issue_date',
        'expiry_date',
        'status',
        'notes',
    ];

    protected $casts = [
        'issue_date' => 'date',
        'expiry_date' => 'date',
    ];
}
