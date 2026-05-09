<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use App\Models\Tenant;
use App\Models\WebhookEvent;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
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
        Log::info('WhatsApp webhook received', [
            'has_entry' => !empty($payload['entry']),
            'object' => $payload['object'] ?? null,
        ]);

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
                $replyText = null;
                $sendResult = null;

                if (($event['event_type'] ?? null) === 'message' && ($event['direction'] ?? null) === 'incoming') {
                    $replyText = $this->buildInquiryReply($tenant, $event);
                }

                if ($replyText && config('services.whatsapp.auto_reply_enabled', true)) {
                    $sendResult = $this->sendWhatsAppText((string) ($event['source'] ?? ''), $replyText);
                }

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
                        'payload' => array_merge($event['payload'] ?? $payload, [
                            'inquiry_reply' => $replyText,
                            'inquiry_reply_send_result' => $sendResult,
                            'tenant_matched' => (bool) $tenant,
                        ]),
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

    private function buildInquiryReply(?Tenant $tenant, array $event): ?string
    {
        $incomingText = $this->extractIncomingText($event);

        if (!$incomingText) {
            return null;
        }

        if (!$tenant) {
            return "مرحبًا، لم أجد عقدًا مرتبطًا برقم جوالك.\nللاستفسار يرجى التواصل مع إدارة العقار.";
        }

        $contracts = Contract::with([
                'tenant',
                'unit.property.owner',
                'payments' => fn ($q) => $q->orderBy('due_date'),
            ])
            ->where('tenant_id', $tenant->id)
            ->orderByRaw("CASE WHEN status IN ('active', 'نشط') THEN 0 ELSE 1 END")
            ->orderByDesc('id')
            ->get();

        if ($contracts->isEmpty()) {
            return "مرحبًا {$tenant->name}، رقمك مسجل لدينا لكن لا يوجد عقد مرتبط به حاليًا.";
        }

        $contracts = $this->filterContractsByQuestion($contracts, $incomingText);
        $intent = $this->detectInquiryIntent($incomingText);

        if ($contracts->count() > 1 && !$this->questionLooksGeneral($incomingText)) {
            $lines = [
                "مرحبًا {$tenant->name}، لديك أكثر من عقد. اذكر رقم العقد أو اسم العقار لأجيبك بدقة.",
                "العقود المرتبطة برقمك:",
            ];

            foreach ($contracts->take(5) as $contract) {
                $lines[] = '- ' . $this->contractTitle($contract);
            }

            return implode("\n", $lines);
        }

        if ($intent === 'payments') {
            return $this->paymentInquiryReply($tenant, $contracts);
        }

        if ($intent === 'contract') {
            return $this->contractInquiryReply($tenant, $contracts);
        }

        if ($intent === 'property') {
            return $this->propertyInquiryReply($tenant, $contracts);
        }

        return $this->generalInquiryReply($tenant, $contracts);
    }

    private function extractIncomingText(array $event): string
    {
        $message = Arr::get($event, 'payload.message', []);
        $type = Arr::get($message, 'type');

        return trim((string) match ($type) {
            'text' => Arr::get($message, 'text.body'),
            'button' => Arr::get($message, 'button.text'),
            'interactive' => Arr::get($message, 'interactive.button_reply.title')
                ?: Arr::get($message, 'interactive.list_reply.title'),
            default => '',
        });
    }

    private function detectInquiryIntent(string $text): string
    {
        $normalized = mb_strtolower($text);

        if (Str::contains($normalized, ['دفع', 'دفعة', 'دفعات', 'قسط', 'اقساط', 'أقساط', 'متأخر', 'متاخر', 'سداد', 'مستحق', 'المبلغ', 'كم علي'])) {
            return 'payments';
        }

        if (Str::contains($normalized, ['عقد', 'العقد', 'بداية', 'نهاية', 'ينتهي', 'انتهاء', 'مدة', 'رقم العقد', 'ايجار', 'إيجار'])) {
            return 'contract';
        }

        if (Str::contains($normalized, ['عقار', 'الشقة', 'شقة', 'وحدة', 'الدور', 'موقع', 'عنوان', 'عمارة', 'فيلا'])) {
            return 'property';
        }

        return 'general';
    }

    private function filterContractsByQuestion($contracts, string $text)
    {
        $digits = $this->normalizePhone($text);
        $matches = $contracts->filter(function (Contract $contract) use ($text, $digits) {
            $haystack = collect([
                $contract->contract_number,
                $contract->government_contract_number,
                $contract->ejar_record_number,
                $contract->unit?->unit_number,
                $contract->unit?->property?->name,
            ])->filter()->implode(' ');

            if ($digits !== '') {
                foreach ([$contract->contract_number, $contract->government_contract_number, $contract->ejar_record_number, $contract->unit?->unit_number] as $value) {
                    if ($value && Str::contains($this->normalizePhone((string) $value), $digits)) {
                        return true;
                    }
                }
            }

            return $haystack !== '' && Str::contains(mb_strtolower($text), mb_strtolower($haystack));
        });

        return $matches->isNotEmpty() ? $matches->values() : $contracts;
    }

    private function questionLooksGeneral(string $text): bool
    {
        return Str::contains(mb_strtolower($text), ['كل', 'جميع', 'ملخص', 'عقودي', 'عقود']);
    }

    private function paymentInquiryReply(Tenant $tenant, $contracts): string
    {
        $lines = ["مرحبًا {$tenant->name}، هذه معلومات الدفعات لعقودك المرتبطة برقم جوالك:"];

        foreach ($contracts->take(5) as $contract) {
            $payments = $contract->payments;
            $unpaid = $payments->filter(fn ($p) => !in_array($p->status, ['paid', 'مدفوع', 'مسدد'], true));
            $overdue = $unpaid->filter(function ($p) {
                return $p->due_date && now()->startOfDay()->gt(\Carbon\Carbon::parse($p->due_date)->startOfDay());
            });
            $next = $unpaid->sortBy('due_date')->first();

            $lines[] = '';
            $lines[] = $this->contractTitle($contract);
            $lines[] = 'إجمالي غير المسدد: ' . $this->money($unpaid->sum('amount'));
            $lines[] = 'المتأخر: ' . $this->money($overdue->sum('amount'));

            if ($next) {
                $lines[] = 'أقرب دفعة: ' . $this->money($next->amount) . ' بتاريخ ' . ($next->due_date ?: '-');
            } else {
                $lines[] = 'لا توجد دفعات غير مسددة مسجلة.';
            }
        }

        return implode("\n", $lines);
    }

    private function contractInquiryReply(Tenant $tenant, $contracts): string
    {
        $lines = ["مرحبًا {$tenant->name}، هذه معلومات العقد المرتبط برقم جوالك:"];

        foreach ($contracts->take(5) as $contract) {
            $lines[] = '';
            $lines[] = $this->contractTitle($contract);
            $lines[] = 'الحالة: ' . ($contract->status ?: '-');
            $lines[] = 'بداية العقد: ' . ($contract->start_date ?: '-');
            $lines[] = 'نهاية العقد: ' . ($contract->end_date ?: '-');
            $lines[] = 'قيمة الإيجار: ' . $this->money($contract->rent_amount);
            $lines[] = 'إجمالي قيمة العقد: ' . $this->money($contract->total_contract_value ?: $contract->rent_amount);
        }

        return implode("\n", $lines);
    }

    private function propertyInquiryReply(Tenant $tenant, $contracts): string
    {
        $lines = ["مرحبًا {$tenant->name}، هذه معلومات العقار/الوحدة لعقدك:"];

        foreach ($contracts->take(5) as $contract) {
            $unit = $contract->unit;
            $property = $unit?->property;

            $lines[] = '';
            $lines[] = $this->contractTitle($contract);
            $lines[] = 'العقار: ' . ($property?->name ?: '-');
            $lines[] = 'الوحدة: ' . ($unit?->unit_number ?: '-');
            $lines[] = 'الدور: ' . ($unit?->floor ?? '-');
            $lines[] = 'المدينة/الحي: ' . trim(($property?->city ?: '') . ' ' . ($property?->district ?: '')) ?: '-';
            $lines[] = 'العنوان: ' . ($property?->address ?: $unit?->address ?: '-');
        }

        return implode("\n", $lines);
    }

    private function generalInquiryReply(Tenant $tenant, $contracts): string
    {
        $lines = ["مرحبًا {$tenant->name}، أستطيع خدمتك في معلومات عقدك فقط حسب رقم جوالك."];
        $lines[] = 'يمكنك السؤال مثل: كم المبلغ المستحق؟ متى تنتهي الدفعة؟ متى ينتهي العقد؟ ما بيانات الوحدة؟';
        $lines[] = '';
        $lines[] = 'ملخص عقودك:';

        foreach ($contracts->take(5) as $contract) {
            $unpaidTotal = $contract->payments
                ->filter(fn ($p) => !in_array($p->status, ['paid', 'مدفوع', 'مسدد'], true))
                ->sum('amount');
            $lines[] = '- ' . $this->contractTitle($contract) . ' | غير المسدد: ' . $this->money($unpaidTotal);
        }

        return implode("\n", $lines);
    }

    private function contractTitle(Contract $contract): string
    {
        $number = $contract->government_contract_number ?: $contract->contract_number ?: ('#' . $contract->id);
        $property = $contract->unit?->property?->name;
        $unit = $contract->unit?->unit_number;

        return 'العقد ' . $number
            . ($property ? ' - ' . $property : '')
            . ($unit ? ' - وحدة ' . $unit : '');
    }

    private function money($amount): string
    {
        return number_format((float) $amount, 2) . ' ريال';
    }

    private function sendWhatsAppText(string $to, string $message): array
    {
        $token = $this->firstConfiguredValue([
            'services.whatsapp.access_token',
        ], [
            'WHATSAPP_ACCESS_TOKEN',
            'WHATSAPP_TOKEN',
            'META_WHATSAPP_ACCESS_TOKEN',
            'META_ACCESS_TOKEN',
        ]);

        $phoneNumberId = $this->firstConfiguredValue([
            'services.whatsapp.phone_number_id',
        ], [
            'WHATSAPP_PHONE_NUMBER_ID',
            'META_WHATSAPP_PHONE_NUMBER_ID',
            'META_PHONE_NUMBER_ID',
        ]);

        $version = $this->firstConfiguredValue([
            'services.whatsapp.graph_version',
        ], [
            'WHATSAPP_GRAPH_VERSION',
            'META_GRAPH_VERSION',
        ], 'v20.0');

        $to = $this->normalizePhone($to);

        if ($token === '' || $phoneNumberId === '' || $to === '') {
            $result = [
                'ok' => false,
                'reason' => 'missing_config',
                'has_token' => $token !== '',
                'has_phone_number_id' => $phoneNumberId !== '',
                'to' => $to,
            ];

            Log::warning('WhatsApp inquiry reply not sent because outbound config is missing', [
                'result' => $result,
                'message' => $message,
            ]);

            return $result;
        }

        try {
            $response = Http::withToken($token)->post("https://graph.facebook.com/{$version}/{$phoneNumberId}/messages", [
                'messaging_product' => 'whatsapp',
                'to' => $to,
                'type' => 'text',
                'text' => [
                    'preview_url' => false,
                    'body' => $message,
                ],
            ]);

            $body = $response->json();
            $result = [
                'ok' => $response->successful(),
                'status' => $response->status(),
                'to' => $to,
                'provider_message_id' => Arr::get($body, 'messages.0.id'),
                'error' => Arr::get($body, 'error.message'),
                'error_code' => Arr::get($body, 'error.code'),
                'error_type' => Arr::get($body, 'error.type'),
            ];

            if ($response->successful()) {
                Log::info('WhatsApp inquiry reply sent', $result);
            } else {
                Log::warning('WhatsApp inquiry reply failed', [
                    'result' => $result,
                    'body' => $response->body(),
                ]);
            }

            return $result;
        } catch (\Throwable $e) {
            $result = [
                'ok' => false,
                'reason' => 'exception',
                'to' => $to,
                'error' => $e->getMessage(),
            ];

            Log::error('WhatsApp inquiry reply exception', $result);

            return $result;
        }
    }

    private function firstConfiguredValue(array $configKeys, array $envKeys = [], string $default = ''): string
    {
        foreach ($configKeys as $key) {
            $value = config($key);
            if ($value !== null && (string) $value !== '') {
                return (string) $value;
            }
        }

        foreach ($envKeys as $key) {
            $value = env($key);
            if ($value !== null && (string) $value !== '') {
                return (string) $value;
            }
        }

        return $default;
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
