<?php

namespace App\Console\Commands;

use App\Models\Payment;
use App\Models\WebhookEvent;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SendDailyRentOverdueWhatsAppReport extends Command
{
    private const WHATSAPP_TEXT_LIMIT = 3900;

    protected $signature = 'rent:send-overdue-whatsapp-report
        {--to= : WhatsApp recipient phone number}
        {--dry-run : Print the report without sending it}';

    protected $description = 'Send the daily WhatsApp report of overdue rent payments.';

    public function handle(): int
    {
        $to = (string) ($this->option('to') ?: env('DAILY_RENT_OVERDUE_WHATSAPP_TO', '0500007650'));
        $messages = $this->buildReportMessages();

        if ($this->option('dry-run')) {
            foreach ($messages as $message) {
                $this->line($message);
                $this->line(str_repeat('-', 30));
            }
            return self::SUCCESS;
        }

        $allOk = true;
        $results = [];

        foreach ($messages as $partIndex => $message) {
            $result = $this->sendWhatsAppText($to, $message);
            $results[] = $result;
            $allOk = $allOk && (bool) $result['ok'];

            WebhookEvent::create([
                'provider' => 'whatsapp',
                'event_type' => 'daily_rent_overdue_report',
                'direction' => 'outgoing',
                'external_id' => $result['message_id'] ?? (string) Str::uuid(),
                'source' => config('services.whatsapp.phone_number_id'),
                'destination' => $this->normalizePhone($to),
                'status' => $result['ok'] ? 'sent' : 'failed',
                'payload' => [
                    'message' => $message,
                    'part' => $partIndex + 1,
                    'parts_count' => count($messages),
                    'result' => $result,
                ],
                'processed_at' => now(),
            ]);

            usleep(250000);
        }

        if (! $allOk) {
            $this->error('فشل إرسال تقرير المتأخرين عبر واتساب. راجع سجل Laravel.');
            Log::warning('Daily rent overdue WhatsApp report failed in one or more parts', [
                'parts_count' => count($messages),
                'results' => $results,
            ]);
            return self::FAILURE;
        }

        $this->info('تم إرسال تقرير المتأخرين عبر واتساب إلى ' . $to . ' على ' . count($messages) . ' رسالة.');
        return self::SUCCESS;
    }

    private function buildReportMessages(): array
    {
        $today = now('Asia/Riyadh')->toDateString();
        $paidStatuses = ['paid', 'مدفوع', 'مسدد'];
        $cancelledStatuses = ['cancelled', 'canceled', 'ملغي', 'ملغى'];

        $payments = Payment::query()
            ->with(['contract.tenant', 'contract.unit.property.owner'])
            ->whereDate('due_date', '<', $today)
            ->whereNotIn('status', array_merge($paidStatuses, $cancelledStatuses))
            ->orderBy('due_date')
            ->orderBy('id')
            ->get();

        $totalAmount = $payments->sum(fn (Payment $payment) => (float) $payment->amount);
        $headerLines = [
            'تقرير المتأخرين عن دفع الإيجار',
            'التاريخ: ' . Carbon::parse($today)->format('Y-m-d'),
            'عدد الدفعات المتأخرة: ' . $payments->count(),
            'إجمالي المتأخرات: ' . $this->money($totalAmount),
        ];

        if ($payments->isEmpty()) {
            return [implode("\n", array_merge($headerLines, ['', 'لا توجد دفعات إيجار متأخرة حتى الآن.']))];
        }

        $entryBlocks = [];
        foreach ($payments as $index => $payment) {
            $contract = $payment->contract;
            $tenant = $contract?->tenant;
            $unit = $contract?->unit;
            $property = $unit?->property;
            $daysLate = $payment->due_date
                ? Carbon::parse($payment->due_date)->startOfDay()->diffInDays(now('Asia/Riyadh')->startOfDay())
                : 0;

            $contractNumber = $contract?->government_contract_number
                ?: $contract?->contract_number
                ?: $contract?->ejar_record_number
                ?: ($contract?->id ? '#' . $contract->id : '-');

            $locationParts = array_values(array_filter([
                $property?->name,
                $unit?->unit_number ? 'وحدة ' . $unit->unit_number : null,
                $unit?->floor !== null && $unit?->floor !== '' ? 'الدور ' . $unit->floor : null,
            ]));

            $entryBlocks[] = implode("\n", [
                ($index + 1) . ') ' . ($tenant?->name ?: 'مستأجر غير محدد'),
                'الجوال: ' . ($tenant?->phone ?: '-'),
                'العقار: ' . (empty($locationParts) ? '-' : implode(' - ', $locationParts)),
                'العقد: ' . $contractNumber,
                'الاستحقاق: ' . ($payment->due_date ?: '-') . ' | التأخير: ' . $daysLate . ' يوم',
                'المبلغ: ' . $this->money($payment->amount),
            ]);
        }

        $messages = [];
        $current = implode("\n", array_merge($headerLines, ['', 'القائمة:']));

        foreach ($entryBlocks as $block) {
            $candidate = $current . "\n\n" . $block;
            if (mb_strlen($candidate) > self::WHATSAPP_TEXT_LIMIT && $current !== '') {
                $messages[] = $current;
                $current = implode("\n", [
                    'تقرير المتأخرين عن دفع الإيجار - تتمة',
                    'التاريخ: ' . Carbon::parse($today)->format('Y-m-d'),
                    '',
                    $block,
                ]);
            } else {
                $current = $candidate;
            }
        }

        if (trim($current) !== '') {
            $messages[] = $current;
        }

        $totalParts = count($messages);
        if ($totalParts > 1) {
            $messages = array_map(
                fn (string $message, int $index) => 'جزء ' . ($index + 1) . ' من ' . $totalParts . "\n" . $message,
                $messages,
                array_keys($messages)
            );
        }

        return $messages;
    }

    private function sendWhatsAppText(string $to, string $message): array
    {
        $token = (string) config('services.whatsapp.access_token');
        $phoneNumberId = (string) config('services.whatsapp.phone_number_id');
        $version = (string) config('services.whatsapp.graph_version', 'v20.0');

        if ($token === '' || $phoneNumberId === '') {
            return [
                'ok' => false,
                'message' => 'WhatsApp credentials are missing.',
            ];
        }

        $response = Http::withToken($token)->post("https://graph.facebook.com/{$version}/{$phoneNumberId}/messages", [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $this->normalizePhone($to),
            'type' => 'text',
            'text' => [
                'preview_url' => false,
                'body' => $message,
            ],
        ]);

        $json = $response->json() ?: [];

        if (! $response->successful()) {
            Log::warning('Daily rent overdue WhatsApp report failed', [
                'status' => $response->status(),
                'length' => mb_strlen($message),
                'response' => $json,
            ]);
        }

        return [
            'ok' => $response->successful(),
            'status' => $response->status(),
            'message_id' => data_get($json, 'messages.0.id'),
            'response' => $json,
        ];
    }

    private function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?: '';

        if (Str::startsWith($digits, '00')) {
            $digits = substr($digits, 2);
        }

        if (Str::startsWith($digits, '0') && strlen($digits) === 10) {
            return '966' . substr($digits, 1);
        }

        if (Str::startsWith($digits, '5') && strlen($digits) === 9) {
            return '966' . $digits;
        }

        return $digits;
    }

    private function money($amount): string
    {
        return number_format((float) $amount, 2) . ' ريال';
    }
}
