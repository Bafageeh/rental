<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContractFile extends Model
{
    protected $fillable = [
        'contract_id',
        'tenant_id',
        'file_type',
        'file_name',
        'file_path',
        'mime_type',
        'file_size',
        'extraction_status',
        'extracted_data',
        'notes',
        'uploaded_by',
    ];

    protected $casts = [
        'extracted_data' => 'array',
    ];

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class);
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
