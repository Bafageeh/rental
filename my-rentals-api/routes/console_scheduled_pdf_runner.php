<?php

use App\Models\ScheduledMessage;
use Carbon\Carbon;
use Illuminate\Support\Facades\Artisan;

Artisan::command('scheduled-messages:run-due-pdf', function () {
    ScheduledMessage::dailyRentOverdueReport();

    $messages = ScheduledMessage::query()
        ->where('status', 'active')
        ->where('key', 'daily_rent_overdue_whatsapp_report')
        ->get();

    foreach ($messages as $message) {
        $timezone = $message->timezone ?: 'Asia/Riyadh';
        $now = now($timezone);
        $time = (string) ($message->time ?: '18:25');
        if (!preg_match('/^([01]?\d|2[0-3]):([0-5]\d)$/', $time, $matches)) {
            $time = '18:25';
        } else {
            $time = str_pad($matches[1], 2, '0', STR_PAD_LEFT) . ':' . $matches[2];
        }

        $dueAt = Carbon::parse($now->toDateString() . ' ' . $time, $timezone);
        if ($now->lessThan($dueAt)) {
            continue;
        }

        if ($message->last_sent_at) {
            $lastSentAt = Carbon::parse($message->last_sent_at)->setTimezone($timezone);
            if ($lastSentAt->greaterThanOrEqualTo($dueAt)) {
                continue;
            }
        }

        $exitCode = Artisan::call('rent:send-overdue-whatsapp-table-report', [
            '--to' => $message->recipient,
            '--pdf' => true,
        ]);

        if ($exitCode === 0) {
            $message->update([
                'command' => 'rent:send-overdue-whatsapp-table-report-pdf',
                'last_sent_date' => $now->toDateString(),
                'last_sent_at' => now(),
            ]);
            $this->info('تم إرسال تقرير المتأخرات كملف PDF.');
        } else {
            $this->error('فشل إرسال تقرير المتأخرات PDF.');
        }
    }

    return self::SUCCESS;
})->purpose('Run due scheduled overdue rent report as WhatsApp PDF.');
