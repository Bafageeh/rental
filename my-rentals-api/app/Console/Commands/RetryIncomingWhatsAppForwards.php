<?php

namespace App\Console\Commands;

use App\Models\WebhookEvent;
use App\Services\IncomingWhatsAppForwardingService;
use Illuminate\Console\Command;

class RetryIncomingWhatsAppForwards extends Command
{
    protected $signature = 'whatsapp:retry-incoming-forwards';

    protected $description = 'Retry incoming WhatsApp alerts that could not be delivered to the configured recipient.';

    public function handle(IncomingWhatsAppForwardingService $service): int
    {
        if (!config('whatsapp-forwarding.enabled')) {
            return self::SUCCESS;
        }

        $events = WebhookEvent::query()
            ->where('provider', 'whatsapp')
            ->where('event_type', 'incoming_message_forward')
            ->whereIn('status', ['pending', 'failed'])
            ->where(function ($query) {
                $query->whereNull('processed_at')->orWhere('processed_at', '<=', now()->subMinute());
            })
            ->orderBy('id')->limit(20)->get();

        foreach ($events as $event) {
            $payload = $event->payload ?? [];
            if (!empty($payload['incoming_message'])) {
                $service->forward($payload['incoming_message'], $payload['metadata'] ?? []);
            }
        }

        return self::SUCCESS;
    }
}
