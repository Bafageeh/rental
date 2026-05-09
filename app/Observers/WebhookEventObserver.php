<?php

namespace App\Observers;

use App\Models\WebhookEvent;
use App\Services\WhatsAppAiReplyService;
use Illuminate\Support\Facades\Log;

class WebhookEventObserver
{
    public function saved(WebhookEvent $event): void
    {
        try {
            $service = app(WhatsAppAiReplyService::class);

            if (!$service->shouldHandle($event)) {
                return;
            }

            $result = $service->handle($event);

            if ($result) {
                Log::info('WhatsApp AI observer handled message', [
                    'event_id' => $event->id,
                    'result' => $result,
                ]);
            }
        } catch (\Throwable $e) {
            Log::error('WhatsApp AI observer exception', [
                'event_id' => $event->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
