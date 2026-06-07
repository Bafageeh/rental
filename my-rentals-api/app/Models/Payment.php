<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Schema;

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
        'paid_amount',
        'remaining_amount',
        'status',
        'notes',
    ];

    protected static function booted(): void
    {
        static::saving(function (Payment $payment) {
            if (
                Schema::hasColumn('payments', 'payment_deadline')
                && empty($payment->payment_deadline)
                && is_string($payment->notes)
                && preg_match('/نهاية\s+مهلة\s+السداد\s*:?\s*(\d{4}-\d{2}-\d{2})/u', $payment->notes, $matches)
            ) {
                $payment->payment_deadline = $matches[1];
            }
        });
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class);
    }
}
