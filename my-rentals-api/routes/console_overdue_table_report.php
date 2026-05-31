<?php

use App\Models\Contract;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

if (!function_exists('mrow_num')) {
    function mrow_num($value): float
    {
        if ($value === null || $value === '') return 0.0;
        return is_numeric($value) ? (float) $value : (float) str_replace(',', '', (string) $value);
    }
}

if (!function_exists('mrow_money')) {
    function mrow_money($amount): string
    {
        return number_format((float) $amount, 0) . ' ريال';
    }
}

if (!function_exists('mrow_phone')) {
    function mrow_phone($phone): string
    {
        $phone = preg_replace('/\D+/', '', (string) $phone) ?: '';
        if ($phone === '') return '';
        if (Str::startsWith($phone, '00')) $phone = substr($phone, 2);
        if (Str::startsWith($phone, '0')) return '966' . substr($phone, 1);
        if (Str::startsWith($phone, '5')) return '966' . $phone;
        return $phone;
    }
}

if (!function_exists('mrow_send_whatsapp')) {
    function mrow_send_whatsapp(string $to, string $message): array
    {
        $token = (string) (config('services.whatsapp.access_token') ?: env('WHATSAPP_ACCESS_TOKEN') ?: env('WHATSAPP_TOKEN') ?: env('META_WHATSAPP_ACCESS_TOKEN') ?: env('META_ACCESS_TOKEN'));
        $phoneNumberId = (string) (config('services.whatsapp.phone_number_id') ?: env('WHATSAPP_PHONE_NUMBER_ID') ?: env('META_WHATSAPP_PHONE_NUMBER_ID') ?: env('META_PHONE_NUMBER_ID'));
        $version = (string) (config('services.whatsapp.graph_version') ?: env('WHATSAPP_GRAPH_VERSION') ?: env('META_GRAPH_VERSION') ?: 'v20.0');
        $to = mrow_phone($to);

        if ($token === '' || $phoneNumberId === '' || $to === '') {
            $result = ['ok' => false, 'reason' => 'missing_config', 'to' => $to, 'has_token' => $token !== '', 'has_phone_number_id' => $phoneNumberId !== ''];
            Log::warning('Compact overdue WhatsApp report not sent because config is missing', $result);
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
                'provider_message_id' => data_get($body, 'messages.0.id'),
                'error' => data_get($body, 'error.message'),
            ];
            if ($response->successful()) Log::info('Compact overdue WhatsApp report sent', $result);
            else Log::warning('Compact overdue WhatsApp report failed', ['result' => $result, 'body' => $response->body()]);
            return $result;
        } catch (Throwable $e) {
            $result = ['ok' => false, 'reason' => 'exception', 'to' => $to, 'error' => $e->getMessage()];
            Log::error('Compact overdue WhatsApp report exception', $result);
            return $result;
        }
    }
}

if (!function_exists('mrow_overdue_rows')) {
    function mrow_overdue_rows()
    {
        $today = now()->toDateString();
        $activeStatuses = ['active', 'نشط'];

        return Contract::query()
            ->with(['tenant', 'unit.property', 'payments' => fn ($q) => $q->orderBy('due_date')->orderBy('id')])
            ->whereIn('status', $activeStatuses)
            ->get()
            ->map(function ($contract) use ($today) {
                $payments = $contract->payments ?? collect();
                $dueTotal = $payments
                    ->filter(fn ($p) => preg_match('/^\d{4}-\d{2}-\d{2}$/', substr((string) ($p->due_date ?? ''), 0, 10)) && substr((string) $p->due_date, 0, 10) <= $today)
                    ->sum(fn ($p) => mrow_num($p->amount ?? 0));
                $paidTotal = $payments->sum(function ($p) {
                    $paid = mrow_num($p->paid_amount ?? 0);
                    if ($paid > 0) return $paid;
                    $status = trim(mb_strtolower((string) ($p->status ?? '')));
                    return !empty($p->paid_date) && in_array($status, ['paid', 'مدفوع', 'مدفوعة', 'مسدد'], true) ? mrow_num($p->amount ?? 0) : 0;
                });
                $lateAmount = max(0, $dueTotal - $paidTotal);
                if ($lateAmount <= 0) return null;

                $oldest = $payments
                    ->filter(fn ($p) => substr((string) ($p->due_date ?? ''), 0, 10) <= $today)
                    ->sortBy('due_date')
                    ->first();

                return [
                    'tenant' => $contract->tenant?->name ?: '-',
                    'property' => $contract->unit?->property?->name ?: '-',
                    'unit' => $contract->unit?->unit_number ?: '-',
                    'amount' => $lateAmount,
                    'due_date' => substr((string) ($oldest?->due_date ?? ''), 0, 10) ?: '-',
                ];
            })
            ->filter()
            ->sortByDesc('amount')
            ->values();
    }
}

if (!function_exists('mrow_build_message')) {
    function mrow_build_message($rows): string
    {
        $count = $rows->count();
        $total = $rows->sum('amount');
        $today = now('Asia/Riyadh')->format('Y-m-d');

        if ($count === 0) {
            return "📋 تقرير متأخرات الإيجار\n{$today}\n\n✅ لا توجد مبالغ متأخرة حتى الآن.";
        }

        $lines = [
            '📋 *تقرير متأخرات الإيجار*',
            'التاريخ: ' . $today,
            'عدد الحالات: ' . $count,
            'الإجمالي: ' . mrow_money($total),
            '',
            '```',
            'الوحدة | المستأجر | المبلغ | الاستحقاق',
            '------ | -------- | ------ | --------',
        ];

        foreach ($rows->take(25) as $row) {
            $unit = trim(($row['property'] !== '-' ? $row['property'] . ' / ' : '') . 'وحدة ' . $row['unit']);
            $tenant = mb_substr((string) $row['tenant'], 0, 18);
            $lines[] = $unit . ' | ' . $tenant . ' | ' . number_format((float) $row['amount'], 0) . ' | ' . $row['due_date'];
        }

        $lines[] = '```';
        if ($count > 25) $lines[] = '... وباقي الحالات: ' . ($count - 25);
        $lines[] = '';
        $lines[] = 'مختصر للواتساب بدل القائمة الطويلة.';

        return implode("\n", $lines);
    }
}

Artisan::command('rent:send-overdue-whatsapp-table-report {--to=} {--test}', function () {
    $to = (string) ($this->option('to') ?: env('DAILY_RENT_OVERDUE_WHATSAPP_TO', '0500007650'));
    $rows = mrow_overdue_rows();
    $message = mrow_build_message($rows);

    $this->line($message);

    if ($this->option('test')) {
        return self::SUCCESS;
    }

    $result = mrow_send_whatsapp($to, $message);
    if (!($result['ok'] ?? false)) {
        $this->error('فشل إرسال تقرير المتأخرات المختصر.');
        return self::FAILURE;
    }

    $this->info('تم إرسال تقرير المتأخرات المختصر كجدول واتساب.');
    return self::SUCCESS;
})->purpose('Send compact WhatsApp overdue rent report as a table.');
