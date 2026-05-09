<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\WebhookEvent;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class WebhookController extends Controller
{
    use ApiResponse;

    public function verifyWhatsApp(Request $request)
    {
        $mode = $request->query('hub_mode') ?: $request->query('hub.mode');
        $token = $request->query('hub_verify_token') ?: $request->query('hub.verify_token');
        $challenge = $request->query('hub_challenge') ?: $request->query('hub.challenge');

        if ($mode === 'subscribe' && hash_equals((string) config('services.whatsapp.webhook_verify_token'), (string) $token)) {
            return response((string) $challenge, 200)->header('Content-Type', 'text/plain');
        }

        return response('Forbidden', 403)->header('Content-Type', 'text/plain');
    }

    public function receiveWhatsApp(Request $request): JsonResponse
    {
        if (! $this->signatureIsValid($request)) {
            Log::warning('WhatsApp webhook rejected: invalid signature', [
                'ip' => $request->ip(),
                'signature' => $request->header('X-Hub-Signature-256'),
            ]);

            return response()->json(['ok' => false, 'message' => 'Invalid signature'], 403);
        }

        $payload = $request->all();
        $events = $this->extractWhatsAppEvents($payload);

        if (empty($events)) {
            WebhookEvent::create([
                'provider' => 'whatsapp',
                'event_type' => 'raw',
                'direction' => null,
                'external_id' => null,
                'source' => null,
                'destination' => null,
                'status' => null,
                'payload' => $payload,
                'processed_at' => now(),
            ]);
        } else {
            foreach ($events as $event) {
                $tenant = $this->findTenantByPhone($event['source'] ?? null);

                WebhookEvent::updateOrCreate(
                    [
                        'provider' => 'whatsapp',
                        'external_id' => $event['external_id'],
                        'event_type' => $event['event_type'],
                    ],
                    [
                        'direction' => $event['direction'] ?? null,
                        'tenant_id' => $tenant?->id,
                        'source' => $event['source'] ?? null,
                        'destination' => $event['destination'] ?? null,
                        'status' => $event['status'] ?? null,
                        'payload' => $event['payload'] ?? $payload,
                        'processed_at' => now(),
                    ]
                );
            }
        }

        return response()->json(['ok' => true]);
    }

    public function index(Request $request): JsonResponse
    {
        $query = WebhookEvent::with('tenant:id,name,phone')
            ->latest('id');

        if ($provider = $request->query('provider')) {
            $query->where('provider', $provider);
        }

        if ($eventType = $request->query('event_type')) {
            $query->where('event_type', $eventType);
        }

        if ($tenantId = $request->query('tenant_id')) {
            $query->where('tenant_id', $tenantId);
        }

        if ($phone = $request->query('phone')) {
            $normalized = $this->normalizePhone($phone);
            $query->where(function ($q) use ($normalized) {
                $q->where('source', 'like', '%' . $normalized . '%')
                    ->orWhere('destination', 'like', '%' . $normalized . '%');
            });
        }

        return $this->paginated($query->paginate((int) $request->query('per_page', 30)));
    }

    private function signatureIsValid(Request $request): bool
    {
        $appSecret = (string) config('services.whatsapp.app_secret');

        if ($appSecret === '') {
            return true;
        }

        $signature = (string) $request->header('X-Hub-Signature-256');

        if (! Str::startsWith($signature, 'sha256=')) {
            return false;
        }

        $expected = 'sha256=' . hash_hmac('sha256', $request->getContent(), $appSecret);

        return hash_equals($expected, $signature);
    }

    private function extractWhatsAppEvents(array $payload): array
    {
        $events = [];

        foreach (Arr::get($payload, 'entry', []) as $entry) {
            foreach (Arr::get($entry, 'changes', []) as $change) {
                $value = Arr::get($change, 'value', []);
                $phoneNumberId = Arr::get($value, 'metadata.phone_number_id');
                $displayPhoneNumber = Arr::get($value, 'metadata.display_phone_number');

                foreach (Arr::get($value, 'messages', []) as $message) {
                    $messageId = Arr::get($message, 'id') ?: (string) Str::uuid();
                    $from = Arr::get($message, 'from');

                    $events[] = [
                        'event_type' => 'message',
                        'direction' => 'incoming',
                        'external_id' => $messageId,
                        'source' => $from,
                        'destination' => $displayPhoneNumber ?: $phoneNumberId,
                        'status' => Arr::get($message, 'type'),
                        'payload' => [
                            'message' => $message,
                            'contacts' => Arr::get($value, 'contacts', []),
                            'metadata' => Arr::get($value, 'metadata', []),
                            'field' => Arr::get($change, 'field'),
                        ],
                    ];
                }

                foreach (Arr::get($value, 'statuses', []) as $status) {
                    $statusId = Arr::get($status, 'id') ?: (string) Str::uuid();
                    $eventType = 'status_' . (Arr::get($status, 'status') ?: 'unknown');

                    $events[] = [
                        'event_type' => $eventType,
                        'direction' => 'outgoing',
                        'external_id' => $statusId,
                        'source' => $displayPhoneNumber ?: $phoneNumberId,
                        'destination' => Arr::get($status, 'recipient_id'),
                        'status' => Arr::get($status, 'status'),
                        'payload' => [
                            'status' => $status,
                            'metadata' => Arr::get($value, 'metadata', []),
                            'field' => Arr::get($change, 'field'),
                        ],
                    ];
                }
            }
        }

        return $events;
    }

    private function findTenantByPhone(?string $phone): ?Tenant
    {
        $normalized = $this->normalizePhone($phone);

        if ($normalized === '') {
            return null;
        }

        $candidates = collect([
            $normalized,
            ltrim($normalized, '0'),
            Str::startsWith($normalized, '966') ? '0' . substr($normalized, 3) : null,
            Str::startsWith($normalized, '5') ? '966' . $normalized : null,
        ])->filter()->unique()->values();

        return Tenant::query()
            ->where(function ($query) use ($candidates) {
                foreach ($candidates as $candidate) {
                    $query->orWhere('phone', 'like', '%' . $candidate . '%');
                }
            })
            ->first();
    }

    private function normalizePhone(?string $phone): string
    {
        return preg_replace('/\D+/', '', (string) $phone) ?: '';
    }
}
