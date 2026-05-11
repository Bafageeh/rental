<?php

namespace App\Console\Commands;

use App\Models\ScheduledMessage;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;

class RunDueScheduledMessages extends Command
{
    protected $signature = 'scheduled-messages:run-due';

    protected $description = 'Run scheduled messages that are due based on editable settings.';

    public function handle(): int
    {
        $this->ensureDefaults();

        $messages = ScheduledMessage::query()
            ->where('status', 'active')
            ->get();

        foreach ($messages as $message) {
            if (! $this->isDue($message)) {
                continue;
            }

            if ($message->command === 'rent:send-overdue-whatsapp-report') {
                $exitCode = Artisan::call($message->command, [
                    '--to' => $message->recipient,
                ]);

                if ($exitCode === 0) {
                    $now = now($message->timezone ?: 'Asia/Riyadh');
                    $message->forceFill([
                        'last_sent_date' => $now->toDateString(),
                        'last_sent_at' => now(),
                    ])->save();

                    $this->info('تم تنفيذ الرسالة المجدولة: ' . $message->title);
                } else {
                    $this->error('فشل تنفيذ الرسالة المجدولة: ' . $message->title);
                }
            }
        }

        return self::SUCCESS;
    }

    private function ensureDefaults(): void
    {
        ScheduledMessage::dailyRentOverdueReport();
    }

    private function isDue(ScheduledMessage $message): bool
    {
        $timezone = $message->timezone ?: 'Asia/Riyadh';
        $now = now($timezone);
        $scheduledTime = $this->normalizeTime((string) $message->time);

        if ($message->frequency !== 'daily') {
            return false;
        }

        if ($message->last_sent_date === $now->toDateString()) {
            return false;
        }

        $dueAt = Carbon::parse($now->toDateString() . ' ' . $scheduledTime, $timezone);

        return $now->greaterThanOrEqualTo($dueAt);
    }

    private function normalizeTime(string $time): string
    {
        if (preg_match('/^([01]?\d|2[0-3]):([0-5]\d)$/', $time, $matches)) {
            return str_pad($matches[1], 2, '0', STR_PAD_LEFT) . ':' . $matches[2];
        }

        return '18:25';
    }
}
