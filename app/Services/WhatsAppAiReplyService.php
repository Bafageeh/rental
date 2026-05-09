<?php

namespace App\Services;

use App\Models\Contract;
use App\Models\Owner;
use App\Models\Payment;
use App\Models\Property;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\WebhookEvent;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class WhatsAppAiReplyService
{
    public function shouldHandle(WebhookEvent $event): bool
    {
        if (!config('services.whatsapp.ai_reply_enabled', false)) {
            return false;
        }

        if ($event->provider !== 'whatsapp' || $event->event_type !== 'message' || $event->direction !== 'incoming') {
            return false;
        }

        $payload = $event->payload ?: [];
        $alreadySent = (bool) Arr::get($payload, 'inquiry_reply_send_result.ok', false);

        if ($alreadySent) {
            return false;
        }

        if (!$this->extractIncomingText($event)) {
            return false;
        }

        return $this->isAllowedPhone($event->source);
    }

    public function handle(WebhookEvent $event): ?array
    {
        $message = $this->extractIncomingText($event);
        $reply = $this->buildAiReply($event, $message);

        if (!$reply) {
            return null;
        }

        $sendResult = $this->sendWhatsAppText((string) $event->source, $reply);

        $payload = $event->payload ?: [];
        $payload['ai_reply'] = $reply;
        $payload['ai_reply_send_result'] = $sendResult;

        WebhookEvent::withoutEvents(function () use ($event, $payload) {
            $event->forceFill(['payload' => $payload])->save();
        });

        return $sendResult;
    }

    private function buildAiReply(WebhookEvent $event, string $message): ?string
    {
        $apiKey = (string) config('services.openai.api_key');
        $model = (string) config('services.openai.model', 'gpt-4o-mini');

        if ($apiKey === '') {
            Log::warning('WhatsApp AI reply skipped: missing AI API key');
            return null;
        }

        $context = $this->buildContext($message, (string) $event->source);

        $system = 'أنت مساعد واتساب لنظام إدارة العقارات والإيجارات. '
            . 'حلل رسالة المستخدم العربية وحدد المطلوب، ثم أجب فقط من البيانات المرسلة في CONTEXT. '
            . 'لا تخترع أرقامًا أو أسماء غير موجودة. '
            . 'إذا سأل عن إحصائية مالك فحاول مطابقة اسم المالك من قائمة الملاك. '
            . 'إذا لم يحدد المالك وكان السؤال عن مالك محدد، اطلب منه ذكر اسم المالك واعرض أسماء مختصرة. '
            . 'اكتب ردًا قصيرًا واضحًا مناسبًا لواتساب بدون Markdown.';

        try {
            $response = Http::withToken($apiKey)
                ->timeout(25)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => $model,
                    'temperature' => 0.2,
                    'max_tokens' => 700,
                    'messages' => [
                        ['role' => 'system', 'content' => $system],
                        ['role' => 'user', 'content' => "MESSAGE:\n{$message}\n\nCONTEXT:\n" . json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)],
                    ],
                ]);

            if (!$response->successful()) {
                Log::warning('WhatsApp AI reply failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return null;
            }

            $reply = trim((string) Arr::get($response->json(), 'choices.0.message.content'));

            return $reply !== '' ? Str::limit($reply, 3500, '') : null;
        } catch (\Throwable $e) {
            Log::error('WhatsApp AI reply exception', ['error' => $e->getMessage()]);
            return null;
        }
    }

    private function buildContext(string $message, string $sourcePhone): array
    {
        $owners = Owner::query()->select(['id', 'name', 'phone'])->orderBy('name')->get();
        $ownerStats = [];

        foreach ($owners as $owner) {
            if ($this->ownerMentioned($message, $owner) || $owners->count() <= 10) {
                $ownerStats[] = $this->ownerStats($owner);
            }
        }

        return [
            'requester_phone' => $this->normalizePhone($sourcePhone),
            'global' => $this->globalStats(),
            'owners' => $ownerStats,
            'available_owner_names' => $owners->pluck('name')->values()->all(),
            'rules' => [
                'currency' => 'SAR',
                'active_contract_statuses' => ['active', 'نشط'],
                'paid_payment_statuses' => ['paid', 'مدفوع', 'مسدد'],
            ],
        ];
    }

    private function ownerStats(Owner $owner): array
    {
        $activeStatuses = ['active', 'نشط'];
        $paidStatuses = ['paid', 'مدفوع', 'مسدد'];
        $propertyIds = Property::query()->where('owner_id', $owner->id)->pluck('id');

        $unitsQuery = Unit::query()->where(function ($q) use ($owner, $propertyIds) {
            $q->whereIn('property_id', $propertyIds)->orWhere('owner_id', $owner->id);
        });

        $contractsQuery = Contract::query()->whereHas('unit', function ($q) use ($owner, $propertyIds) {
            $q->whereIn('property_id', $propertyIds)->orWhere('owner_id', $owner->id);
        });

        $paymentQuery = Payment::query()->whereHas('contract.unit', function ($q) use ($owner, $propertyIds) {
            $q->whereIn('property_id', $propertyIds)->orWhere('owner_id', $owner->id);
        });

        $unitsCount = (clone $unitsQuery)->count();
        $occupiedUnits = (clone $contractsQuery)->whereIn('status', $activeStatuses)->distinct('unit_id')->count('unit_id');

        return [
            'owner_id' => $owner->id,
            'owner_name' => $owner->name,
            'properties_count' => $propertyIds->count(),
            'units_count' => $unitsCount,
            'occupied_units' => $occupiedUnits,
            'vacant_units' => max($unitsCount - $occupiedUnits, 0),
            'active_tenants_count' => (clone $contractsQuery)->whereIn('status', $activeStatuses)->distinct('tenant_id')->count('tenant_id'),
            'all_contract_tenants_count' => (clone $contractsQuery)->distinct('tenant_id')->count('tenant_id'),
            'active_contracts_count' => (clone $contractsQuery)->whereIn('status', $activeStatuses)->count(),
            'all_contracts_count' => (clone $contractsQuery)->count(),
            'unpaid_amount' => (float) (clone $paymentQuery)->whereNotIn('status', $paidStatuses)->sum('amount'),
            'overdue_amount' => (float) (clone $paymentQuery)->whereNotIn('status', $paidStatuses)->whereDate('due_date', '<', now()->toDateString())->sum('amount'),
            'paid_amount' => (float) (clone $paymentQuery)->whereIn('status', $paidStatuses)->sum('amount'),
        ];
    }

    private function globalStats(): array
    {
        $activeStatuses = ['active', 'نشط'];
        $paidStatuses = ['paid', 'مدفوع', 'مسدد'];
        $unitsCount = Unit::query()->count();
        $occupiedUnits = Contract::query()->whereIn('status', $activeStatuses)->distinct('unit_id')->count('unit_id');

        return [
            'owners_count' => Owner::query()->count(),
            'properties_count' => Property::query()->count(),
            'units_count' => $unitsCount,
            'occupied_units' => $occupiedUnits,
            'vacant_units' => max($unitsCount - $occupiedUnits, 0),
            'tenants_count' => Tenant::query()->count(),
            'active_contracts_count' => Contract::query()->whereIn('status', $activeStatuses)->count(),
            'all_contracts_count' => Contract::query()->count(),
            'unpaid_amount' => (float) Payment::query()->whereNotIn('status', $paidStatuses)->sum('amount'),
            'overdue_amount' => (float) Payment::query()->whereNotIn('status', $paidStatuses)->whereDate('due_date', '<', now()->toDateString())->sum('amount'),
            'paid_amount' => (float) Payment::query()->whereIn('status', $paidStatuses)->sum('amount'),
        ];
    }

    private function ownerMentioned(string $message, Owner $owner): bool
    {
        $text = $this->normalizeArabicText($message);
        $name = $this->normalizeArabicText((string) $owner->name);

        if ($name !== '' && Str::contains($text, $name)) {
            return true;
        }

        $tokens = collect(preg_split('/\s+/u', $name) ?: [])->filter(fn ($token) => mb_strlen($token) >= 3);
        return $tokens->count() >= 2 && $tokens->every(fn ($token) => Str::contains($text, $token));
    }

    private function isAllowedPhone(?string $phone): bool
    {
        $normalized = $this->normalizePhone($phone);
        $allowed = collect(explode(',', (string) config('services.whatsapp.ai_admin_phones', '0500007650,500007650,966500007650')))
            ->map(fn ($item) => $this->normalizePhone($item))
            ->filter()
            ->unique()
            ->values();

        return $allowed->contains($normalized)
            || ($normalized !== '' && $allowed->contains(ltrim($normalized, '0')))
            || (Str::startsWith($normalized, '966') && $allowed->contains('0' . substr($normalized, 3)))
            || (Str::startsWith($normalized, '5') && $allowed->contains('966' . $normalized));
    }

    private function sendWhatsAppText(string $to, string $message): array
    {
        $token = (string) config('services.whatsapp.access_token');
        $phoneNumberId = (string) config('services.whatsapp.phone_number_id');
        $version = (string) config('services.whatsapp.graph_version', 'v20.0');
        $to = $this->normalizePhone($to);

        if ($token === '' || $phoneNumberId === '' || $to === '') {
            return ['ok' => false, 'reason' => 'missing_whatsapp_config', 'to' => $to];
        }

        try {
            $response = Http::withToken($token)->post("https://graph.facebook.com/{$version}/{$phoneNumberId}/messages", [
                'messaging_product' => 'whatsapp',
                'to' => $to,
                'type' => 'text',
                'text' => ['preview_url' => false, 'body' => $message],
            ]);

            return [
                'ok' => $response->successful(),
                'status' => $response->status(),
                'to' => $to,
                'provider_message_id' => Arr::get($response->json(), 'messages.0.id'),
                'error' => Arr::get($response->json(), 'error.message'),
            ];
        } catch (\Throwable $e) {
            return ['ok' => false, 'reason' => 'exception', 'to' => $to, 'error' => $e->getMessage()];
        }
    }

    private function extractIncomingText(WebhookEvent $event): string
    {
        $message = Arr::get($event->payload ?: [], 'message', []);
        $type = Arr::get($message, 'type');

        return trim((string) match ($type) {
            'text' => Arr::get($message, 'text.body'),
            'button' => Arr::get($message, 'button.text'),
            'interactive' => Arr::get($message, 'interactive.button_reply.title') ?: Arr::get($message, 'interactive.list_reply.title'),
            default => '',
        });
    }

    private function normalizeArabicText(string $text): string
    {
        $text = mb_strtolower($text);
        $text = str_replace(['أ', 'إ', 'آ'], 'ا', $text);
        $text = str_replace(['ة'], 'ه', $text);
        $text = str_replace(['ى'], 'ي', $text);
        $text = str_replace('ـ', '', $text);
        $text = preg_replace('/[^\p{Arabic}\p{N}\s]+/u', ' ', $text) ?: $text;
        $text = preg_replace('/\s+/u', ' ', $text) ?: $text;

        return trim($text);
    }

    private function normalizePhone(?string $phone): string
    {
        return preg_replace('/\D+/', '', (string) $phone) ?: '';
    }
}
