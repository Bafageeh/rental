<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ScheduledMessage extends Model
{
    protected $fillable = [
        'key',
        'title',
        'description',
        'channel',
        'recipient',
        'command',
        'frequency',
        'time',
        'timezone',
        'status',
        'last_sent_date',
        'last_sent_at',
    ];

    protected $casts = [
        'last_sent_at' => 'datetime',
    ];

    public static function dailyRentOverdueReport(): self
    {
        $message = static::firstOrNew(['key' => 'daily_rent_overdue_whatsapp_report']);

        $message->fill([
            'title' => 'قائمة المتأخرين عن دفع الإيجار',
            'description' => 'إرسال تقرير PDF مختصر للمدير يحتوي على جدول المتأخرين عن السداد مع العقار والوحدة والمستأجر والمبلغ وتاريخ الاستحقاق.',
            'channel' => 'whatsapp',
            'recipient' => $message->recipient ?: env('DAILY_RENT_OVERDUE_WHATSAPP_TO', '0500007650'),
            'command' => 'rent:send-overdue-whatsapp-table-report-pdf',
            'frequency' => 'daily',
            'time' => $message->time ?: env('DAILY_RENT_OVERDUE_WHATSAPP_TIME', '18:25'),
            'timezone' => 'Asia/Riyadh',
            'status' => $message->status ?: 'active',
        ]);

        $message->save();

        return $message;
    }
}
