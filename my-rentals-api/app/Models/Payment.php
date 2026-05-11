<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    protected $fillable = [
        'contract_id',
        'sequence',
        'due_date',
        'payment_deadline',
        'due_date_hijri',
        'payment_deadline_hijri',
        'rental_period_days',
        'paid_date',
        'amount',
        'status',
        'notes',
    ];

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class);
    }
}
