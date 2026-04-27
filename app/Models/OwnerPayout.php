<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OwnerPayout extends Model
{
    protected $fillable = [
        'owner_id',
        'owner_bank_account_id',
        'amount',
        'payout_date',
        'period_start',
        'period_end',
        'method',
        'reference_number',
        'status',
        'notes',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'payout_date' => 'date',
        'period_start' => 'date',
        'period_end' => 'date',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(Owner::class);
    }

    public function ownerBankAccount(): BelongsTo
    {
        return $this->belongsTo(OwnerBankAccount::class, 'owner_bank_account_id');
    }
}
