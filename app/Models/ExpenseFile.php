<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExpenseFile extends Model
{
    protected $fillable = [
        'property_expense_id',
        'file_name',
        'file_path',
        'mime_type',
        'file_size',
    ];

    public function expense(): BelongsTo
    {
        return $this->belongsTo(PropertyExpense::class, 'property_expense_id');
    }
}
