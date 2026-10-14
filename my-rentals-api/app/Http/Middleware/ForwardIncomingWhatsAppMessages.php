<?php

namespace App\Http\Middleware;

use App\Services\IncomingWhatsAppForwardingService;
use Closure;
use Illuminate\Http\Request;

class ForwardIncomingWhatsAppMessages
{
    public function handle(Request $request, Closure $next)
    {
        if (!config('whatsapp-forwarding.enabled') || !$request->isMethod('POST')
            || !$request->is('api/wa/webhook', 'api/webhooks/whatsapp', 'api/v1/wa/webhook', 'api/v1/webhooks/whatsapp')) {
            return $next($request);
        }

        $secret = (string) config('services.whatsapp.app_secret');
        if ($secret !== '' && !hash_equals('sha256='.hash_hmac('sha256', $request->getContent(), $secret),
            (string) $request->header('X-Hub-Signature-256'))) {
            return response()->json(['ok' => false, 'message' => 'Invalid signature'], 403);
        }

        // Read the original body before the Wasl router consumes its own messages.
        $payload = json_decode($request->getContent(), true);
        if (!is_array($payload) || ($payload['object'] ?? null) !== 'whatsapp_business_account') {
            return $next($request);
        }

        $service = app(IncomingWhatsAppForwardingService::class);
        foreach ($payload['entry'] ?? [] as $entry) {
            foreach ($entry['changes'] ?? [] as $change) {
                $value = $change['value'] ?? [];
                $metadata = $value['metadata'] ?? [];
                if ((string) ($metadata['phone_number_id'] ?? '') !== (string) config('services.whatsapp.phone_number_id')) {
                    continue;
                }
                foreach ($value['messages'] ?? [] as $message) {
                    if (is_array($message) && !empty($message['from'])) {
                        $service->forward($message, $metadata);
                    }
                }
                foreach ($value['statuses'] ?? [] as $status) {
                    if (is_array($status)) {
                        $service->recordDeliveryStatus($status);
                    }
                }
            }
        }

        return $next($request);
    }
}
