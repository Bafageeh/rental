<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UtilityBill extends Model
{
    protected $fillable = [
        'property_id',
        'property_expense_id',
        'bill_type',
        'provider',
        'bill_number',
        'amount',
        'bill_date',
        'due_date',
        'paid_date',
        'status',
        'notes',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'bill_date' => 'date',
        'due_date' => 'date',
        'paid_date' => 'date',
    ];

    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    public function expense(): BelongsTo
    {
        return $this->belongsTo(PropertyExpense::class, 'property_expense_id');
    }
}
