<?php

namespace App\Services;

use App\Models\WebhookEvent;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class IncomingWhatsAppForwardingService
{
    public function forward(array $message, array $metadata = []): array
    {
        if (!config('whatsapp-forwarding.enabled')) {
            return ['ok' => true, 'skipped' => 'disabled'];
        }

        $to = $this->phone((string) config('whatsapp-forwarding.recipient'));
        $from = $this->phone((string) ($message['from'] ?? ''));
        if ($to === '' || $from === '') {
            return ['ok' => false, 'reason' => 'missing_recipient_or_sender'];
        }

        $incomingId = (string) ($message['id'] ?? hash('sha256', json_encode($message)));
        $externalId = hash('sha256', ($metadata['phone_number_id'] ?? '').'|'.$incomingId.'|'.$to);
        $lock = Cache::lock('incoming-whatsapp-forward-'.$externalId, 120);
        if (!$lock->get()) {
            return ['ok' => true, 'skipped' => 'already_processing'];
        }

        $event = null;
        try {
            if ($from === $to) {
                $timestamp = min(time(), (int) ($message['timestamp'] ?? time()));
                $windowKey = 'incoming-whatsapp-admin-window-'.$to;
                Cache::put($windowKey, max($timestamp, (int) Cache::get($windowKey, 0)), 86400);
            }

            $event = WebhookEvent::firstOrCreate([
                'provider' => 'whatsapp', 'event_type' => 'incoming_message_forward', 'external_id' => $externalId,
            ], [
                'direction' => 'outgoing', 'source' => $from, 'destination' => $to, 'status' => 'pending',
                'payload' => [
                    'incoming_message' => $message, 'metadata' => $metadata,
                    'parts' => mb_str_split($this->text($message), 700, 'UTF-8'),
                    'parts_sent' => 0, 'sent_parts' => [], 'part_message_ids' => [], 'provider_message_ids' => [], 'attempts' => 0,
                ],
            ]);

            if ($event->status === 'sent') {
                return ['ok' => true, 'duplicate' => true];
            }

            $payload = $event->payload;
            $payload['attempts'] = (int) ($payload['attempts'] ?? 0) + 1;
            $event->forceFill(['payload' => $payload, 'processed_at' => now()])->save();
            $useText = $this->windowIsOpen($to) && ($payload['last_delivery_error'] ?? null) !== 131047;
            $parts = $payload['parts'];

            for ($index = 0; $index < count($parts); $index++) {
                if (in_array($index, $payload['sent_parts'] ?? [], true)) {
                    continue;
                }
                $part = $parts[$index];
                if (count($parts) > 1) {
                    $part = '[الجزء '.($index + 1).' من '.count($parts).'] '.$part;
                }

                $result = $this->send($to, $from, $part, $useText);
                if (!$result['ok'] && $useText && ($result['error_code'] ?? null) === 131047) {
                    $useText = false;
                    $result = $this->send($to, $from, $part, false);
                }

                $payload['last_send_result'] = $result;
                if (!$result['ok']) {
                    $event->forceFill(['status' => 'failed', 'payload' => $payload, 'processed_at' => now()])->save();
                    Log::warning('Incoming WhatsApp alert will be retried', [
                        'event_id' => $event->id, 'error_code' => $result['error_code'] ?? null,
                    ]);
                    return $result;
                }

                $payload['sent_parts'][] = $index;
                $payload['parts_sent'] = count($payload['sent_parts']);
                $payload['part_message_ids'][$index] = $result['provider_message_id'];
                $payload['provider_message_ids'][] = $result['provider_message_id'];
                $event->forceFill(['payload' => $payload, 'processed_at' => now()])->save();
            }

            $event->forceFill(['status' => 'sent', 'processed_at' => now()])->save();
            return ['ok' => true, 'event_id' => $event->id, 'parts_sent' => count($parts)];
        } catch (\Throwable $exception) {
            if ($event) {
                $event->forceFill(['status' => 'failed', 'processed_at' => now()])->save();
            }
            Log::error('Incoming WhatsApp forwarding exception', ['exception_type' => $exception::class]);
            return ['ok' => false, 'reason' => 'exception'];
        } finally {
            $lock->release();
        }
    }

    public function recordDeliveryStatus(array $status): void
    {
        $providerId = (string) ($status['id'] ?? '');
        if ($providerId === '' || !in_array($status['status'] ?? '', ['sent', 'delivered', 'read', 'failed'], true)) {
            return;
        }

        $event = WebhookEvent::query()->where('provider', 'whatsapp')->where('event_type', 'incoming_message_forward')
            ->whereJsonContains('payload->provider_message_ids', $providerId)->first();
        if (!$event) {
            return;
        }

        $lock = Cache::lock('incoming-whatsapp-forward-'.$event->external_id, 120);
        $lock->block(5, function () use ($event, $status, $providerId) {
            $event->refresh();
            $payload = $event->payload;
            $index = array_search($providerId, $payload['part_message_ids'] ?? [], true);
            if ($index === false) {
                return;
            }
            $payload['delivery_statuses'][$providerId] = $status['status'];
            if ($status['status'] === 'failed') {
                $payload['sent_parts'] = array_values(array_filter($payload['sent_parts'] ?? [], fn ($part) => $part !== $index));
                $payload['parts_sent'] = count($payload['sent_parts']);
                unset($payload['part_message_ids'][$index]);
                $payload['last_delivery_error'] = $status['errors'][0]['code'] ?? null;
                $event->status = 'failed';
            }
            $event->forceFill(['payload' => $payload, 'processed_at' => now()])->save();
        });
    }

    private function send(string $to, string $from, string $text, bool $useText): array
    {
        $token = (string) config('services.whatsapp.access_token');
        $phoneNumberId = (string) config('services.whatsapp.phone_number_id');
        if ($token === '' || $phoneNumberId === '') {
            return ['ok' => false, 'reason' => 'missing_whatsapp_configuration'];
        }

        $body = ['messaging_product' => 'whatsapp', 'to' => $to];
        if ($useText) {
            $body += ['type' => 'text', 'text' => [
                'preview_url' => false, 'body' => "رسالة واتساب واردة\nرقم المرسل: +{$from}\nنص الرسالة:\n{$text}",
            ]];
        } else {
            // Meta template parameters cannot contain newlines, tabs or repeated spaces.
            $parameterText = preg_replace('/\s+/u', ' ', $text) ?: 'رسالة بدون نص';
            $body += ['type' => 'template', 'template' => [
                'name' => (string) config('whatsapp-forwarding.template'),
                'language' => ['code' => (string) config('whatsapp-forwarding.language', 'ar')],
                'components' => [['type' => 'body', 'parameters' => [
                    ['type' => 'text', 'text' => '+'.$from], ['type' => 'text', 'text' => $parameterText],
                ]]],
            ]];
        }

        $version = (string) config('whatsapp-forwarding.api_version', 'v25.0');
        $response = Http::withToken($token)->connectTimeout(3)->timeout(10)
            ->post("https://graph.facebook.com/{$version}/{$phoneNumberId}/messages", $body);

        return [
            'ok' => $response->successful() && (bool) $response->json('messages.0.id'),
            'http_status' => $response->status(), 'mode' => $useText ? 'text' : 'template',
            'provider_message_id' => $response->json('messages.0.id'),
            'error_code' => $response->json('error.code'), 'error' => $response->json('error.message'),
        ];
    }

    private function windowIsOpen(string $to): bool
    {
        if ((int) Cache::get('incoming-whatsapp-admin-window-'.$to, 0) > time() - 86400) {
            return true;
        }

        $local = str_starts_with($to, '966') ? '0'.substr($to, 3) : $to;
        $variants = array_unique([$to, $local, ltrim($local, '0'), '+'.$to]);
        $events = WebhookEvent::query()->where('provider', 'whatsapp')->where('event_type', 'message')
            ->where('direction', 'incoming')->whereIn('source', $variants)
            ->where('created_at', '>', now()->subDay())->latest('id')->limit(20)->get();

        foreach ($events as $event) {
            $timestamp = (int) Arr::get($event->payload, 'message.timestamp', $event->created_at->timestamp);
            if ($timestamp > time() - 86400) {
                return true;
            }
        }
        return false;
    }

    private function text(array $message): string
    {
        foreach (['text.body', 'image.caption', 'video.caption', 'document.caption', 'button.text',
            'interactive.button_reply.title', 'interactive.list_reply.title', 'interactive.nfm_reply.body',
            'reaction.emoji'] as $path) {
            $value = Arr::get($message, $path);
            if (is_string($value) && trim($value) !== '') {
                return $value;
            }
        }

        if (($message['type'] ?? '') === 'location') {
            return 'موقع: '.trim(implode(' ', array_filter([
                Arr::get($message, 'location.name'), Arr::get($message, 'location.address'),
                Arr::get($message, 'location.latitude'), Arr::get($message, 'location.longitude'),
            ], fn ($value) => $value !== null && $value !== '')));
        }
        if (($message['type'] ?? '') === 'contacts') {
            return 'جهات اتصال: '.implode('، ', array_map(fn ($contact) =>
                ($contact['name']['formatted_name'] ?? '').' '.implode(' / ', array_column($contact['phones'] ?? [], 'phone')),
                $message['contacts'] ?? []));
        }

        $labels = ['image' => 'صورة', 'video' => 'فيديو', 'audio' => 'رسالة صوتية', 'document' => 'مستند',
            'sticker' => 'ملصق', 'reaction' => 'تفاعل', 'unsupported' => 'رسالة غير مدعومة'];
        return '['.($labels[$message['type'] ?? ''] ?? 'رسالة بدون نص').']'
            .(!empty($message['document']['filename']) ? ' '.$message['document']['filename'] : '');
    }

    private function phone(string $phone): string
    {
        $phone = preg_replace('/\D+/', '', $phone) ?: '';
        if (str_starts_with($phone, '00')) {
            return substr($phone, 2);
        }
        if (strlen($phone) === 10 && str_starts_with($phone, '05')) {
            return '966'.substr($phone, 1);
        }
        return strlen($phone) === 9 && str_starts_with($phone, '5') ? '966'.$phone : $phone;
    }
}
