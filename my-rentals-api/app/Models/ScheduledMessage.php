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
        return static::firstOrCreate(
            ['key' => 'daily_rent_overdue_whatsapp_report'],
            [
                'title' => 'قائمة المتأخرين عن دفع الإيجار',
                'description' => 'إرسال قائمة يومية للمدير تحتوي على المستأجرين المتأخرين عن السداد مع العقار والوحدة والعقد والمبلغ وتاريخ الاستحقاق.',
                'channel' => 'whatsapp',
                'recipient' => env('DAILY_RENT_OVERDUE_WHATSAPP_TO', '0500007650'),
                'command' => 'rent:send-overdue-whatsapp-report',
                'frequency' => 'daily',
                'time' => env('DAILY_RENT_OVERDUE_WHATSAPP_TIME', '18:25'),
                'timezone' => 'Asia/Riyadh',
                'status' => 'active',
            ]
        );
    }
}
