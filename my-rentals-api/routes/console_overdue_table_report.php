<?php

use App\Models\Contract;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
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

if (!function_exists('mrow_whatsapp_config')) {
    function mrow_whatsapp_config(): array
    {
        return [
            'token' => (string) (config('services.whatsapp.access_token') ?: env('WHATSAPP_ACCESS_TOKEN') ?: env('WHATSAPP_TOKEN') ?: env('META_WHATSAPP_ACCESS_TOKEN') ?: env('META_ACCESS_TOKEN')),
            'phone_number_id' => (string) (config('services.whatsapp.phone_number_id') ?: env('WHATSAPP_PHONE_NUMBER_ID') ?: env('META_WHATSAPP_PHONE_NUMBER_ID') ?: env('META_PHONE_NUMBER_ID')),
            'version' => (string) (config('services.whatsapp.graph_version') ?: env('WHATSAPP_GRAPH_VERSION') ?: env('META_GRAPH_VERSION') ?: 'v20.0'),
        ];
    }
}

if (!function_exists('mrow_send_whatsapp')) {
    function mrow_send_whatsapp(string $to, string $message): array
    {
        $cfg = mrow_whatsapp_config();
        $to = mrow_phone($to);

        if ($cfg['token'] === '' || $cfg['phone_number_id'] === '' || $to === '') {
            $result = ['ok' => false, 'reason' => 'missing_config', 'to' => $to, 'has_token' => $cfg['token'] !== '', 'has_phone_number_id' => $cfg['phone_number_id'] !== ''];
            Log::warning('Compact overdue WhatsApp report not sent because config is missing', $result);
            return $result;
        }

        try {
            $response = Http::withToken($cfg['token'])->post("https://graph.facebook.com/{$cfg['version']}/{$cfg['phone_number_id']}/messages", [
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

if (!function_exists('mrow_upload_whatsapp_media')) {
    function mrow_upload_whatsapp_media(string $filePath): array
    {
        $cfg = mrow_whatsapp_config();
        if ($cfg['token'] === '' || $cfg['phone_number_id'] === '' || !is_file($filePath)) {
            return ['ok' => false, 'reason' => 'missing_config_or_file'];
        }

        try {
            $response = Http::withToken($cfg['token'])
                ->attach('file', fopen($filePath, 'r'), basename($filePath), ['Content-Type' => 'application/pdf'])
                ->post("https://graph.facebook.com/{$cfg['version']}/{$cfg['phone_number_id']}/media", [
                    'messaging_product' => 'whatsapp',
                    'type' => 'application/pdf',
                ]);
            $body = $response->json();
            return [
                'ok' => $response->successful() && (string) data_get($body, 'id') !== '',
                'status' => $response->status(),
                'media_id' => data_get($body, 'id'),
                'error' => data_get($body, 'error.message'),
                'body' => $response->successful() ? null : $response->body(),
            ];
        } catch (Throwable $e) {
            return ['ok' => false, 'reason' => 'exception', 'error' => $e->getMessage()];
        }
    }
}

if (!function_exists('mrow_send_whatsapp_document')) {
    function mrow_send_whatsapp_document(string $to, string $mediaId, string $filename, string $caption): array
    {
        $cfg = mrow_whatsapp_config();
        $to = mrow_phone($to);
        if ($cfg['token'] === '' || $cfg['phone_number_id'] === '' || $to === '' || $mediaId === '') {
            return ['ok' => false, 'reason' => 'missing_config_or_media'];
        }

        try {
            $response = Http::withToken($cfg['token'])->post("https://graph.facebook.com/{$cfg['version']}/{$cfg['phone_number_id']}/messages", [
                'messaging_product' => 'whatsapp',
                'to' => $to,
                'type' => 'document',
                'document' => [
                    'id' => $mediaId,
                    'filename' => $filename,
                    'caption' => $caption,
                ],
            ]);
            $body = $response->json();
            return [
                'ok' => $response->successful(),
                'status' => $response->status(),
                'provider_message_id' => data_get($body, 'messages.0.id'),
                'error' => data_get($body, 'error.message'),
                'body' => $response->successful() ? null : $response->body(),
            ];
        } catch (Throwable $e) {
            return ['ok' => false, 'reason' => 'exception', 'error' => $e->getMessage()];
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

if (!function_exists('mrow_pdf_html')) {
    function mrow_pdf_html($rows): string
    {
        $today = now('Asia/Riyadh')->format('Y-m-d');
        $total = $rows->sum('amount');
        $count = $rows->count();
        $body = '';
        foreach ($rows as $index => $row) {
            $body .= '<tr>'
                . '<td>' . ($index + 1) . '</td>'
                . '<td>' . e($row['property']) . '</td>'
                . '<td>' . e($row['unit']) . '</td>'
                . '<td>' . e($row['tenant']) . '</td>'
                . '<td>' . number_format((float) $row['amount'], 0) . '</td>'
                . '<td>' . e($row['due_date']) . '</td>'
                . '</tr>';
        }
        if ($body === '') {
            $body = '<tr><td colspan="6" class="empty">لا توجد مبالغ متأخرة حتى الآن</td></tr>';
        }

        return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>'
            . 'body{font-family:dejavusans,DejaVu Sans,Tahoma,Arial,sans-serif;direction:rtl;text-align:right;color:#111827;margin:0;padding:22px;background:#fff}'
            . '.header{background:#111827;color:#fff;border-radius:18px;padding:18px;margin-bottom:14px}.title{font-size:24px;font-weight:bold;margin-bottom:7px}.sub{color:#d1d5db;font-size:13px}'
            . '.summary{display:table;width:100%;margin-bottom:14px}.box{display:table-cell;background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;padding:12px;text-align:center}.box b{display:block;color:#dc2626;font-size:20px;margin-bottom:5px}'
            . 'table{width:100%;border-collapse:collapse;font-size:12px}th{background:#dbeafe;color:#1e3a8a;padding:9px;border:1px solid #bfdbfe}td{padding:8px;border:1px solid #e5e7eb}tr:nth-child(even) td{background:#f8fafc}.amount{color:#dc2626;font-weight:bold}.empty{text-align:center;padding:28px;color:#0f766e;font-weight:bold}'
            . '.footer{margin-top:14px;color:#64748b;font-size:11px;text-align:center}'
            . '</style></head><body>'
            . '<div class="header"><div class="title">تقرير متأخرات الإيجار</div><div class="sub">تقرير مختصر مرسل عبر واتساب بتاريخ ' . $today . '</div></div>'
            . '<div class="summary"><div class="box"><b>' . $count . '</b>عدد الحالات</div><div class="box"><b>' . mrow_money($total) . '</b>إجمالي المتأخرات</div></div>'
            . '<table><thead><tr><th>#</th><th>العقار</th><th>الوحدة</th><th>المستأجر</th><th>المبلغ</th><th>الاستحقاق</th></tr></thead><tbody>' . $body . '</tbody></table>'
            . '<div class="footer">تم إنشاء التقرير تلقائيًا من نظام إيجار</div>'
            . '</body></html>';
    }
}

if (!function_exists('mrow_generate_pdf')) {
    function mrow_generate_pdf($rows): string
    {
        $dir = storage_path('app/reports/overdue');
        if (!is_dir($dir)) @mkdir($dir, 0775, true);
        $path = $dir . '/rent-overdue-' . now('Asia/Riyadh')->format('Ymd-His') . '.pdf';
        $html = mrow_pdf_html($rows);

        if (class_exists(\Mpdf\Mpdf::class)) {
            $mpdf = new \Mpdf\Mpdf(['mode' => 'utf-8', 'format' => 'A4', 'default_font' => 'dejavusans', 'tempDir' => storage_path('app/mpdf-temp')]);
            $mpdf->autoScriptToLang = true;
            $mpdf->autoLangToFont = true;
            $mpdf->WriteHTML($html);
            $mpdf->Output($path, \Mpdf\Output\Destination::FILE);
            return $path;
        }

        if (class_exists(\Dompdf\Dompdf::class)) {
            $dompdf = new \Dompdf\Dompdf(['isRemoteEnabled' => true, 'defaultFont' => 'DejaVu Sans']);
            $dompdf->loadHtml($html, 'UTF-8');
            $dompdf->setPaper('A4', 'portrait');
            $dompdf->render();
            file_put_contents($path, $dompdf->output());
            return $path;
        }

        throw new RuntimeException('لا توجد مكتبة PDF مثبتة. ثبّت mpdf/mpdf أو dompdf/dompdf ثم أعد المحاولة.');
    }
}

Artisan::command('rent:send-overdue-whatsapp-table-report {--to=} {--test} {--pdf}', function () {
    $to = (string) ($this->option('to') ?: env('DAILY_RENT_OVERDUE_WHATSAPP_TO', '0500007650'));
    $rows = mrow_overdue_rows();
    $message = mrow_build_message($rows);

    if ($this->option('pdf')) {
        try {
            $pdfPath = mrow_generate_pdf($rows);
            $this->line('PDF: ' . $pdfPath);
            if ($this->option('test')) return self::SUCCESS;

            $upload = mrow_upload_whatsapp_media($pdfPath);
            if (!($upload['ok'] ?? false)) {
                $this->error('فشل رفع ملف PDF إلى واتساب: ' . ($upload['error'] ?? $upload['reason'] ?? 'unknown'));
                return self::FAILURE;
            }

            $send = mrow_send_whatsapp_document($to, (string) $upload['media_id'], basename($pdfPath), 'تقرير متأخرات الإيجار PDF');
            if (!($send['ok'] ?? false)) {
                $this->error('فشل إرسال ملف PDF عبر واتساب: ' . ($send['error'] ?? $send['reason'] ?? 'unknown'));
                return self::FAILURE;
            }

            $this->info('تم إرسال تقرير المتأخرات كملف PDF عبر واتساب.');
            return self::SUCCESS;
        } catch (Throwable $e) {
            $this->error($e->getMessage());
            return self::FAILURE;
        }
    }

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
})->purpose('Send compact WhatsApp overdue rent report as a table or PDF document.');
