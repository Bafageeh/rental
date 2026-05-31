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

if (!function_exists('mrow_cfg')) {
    function mrow_cfg(): array
    {
        return [
            'token' => (string) (config('services.whatsapp.access_token') ?: env('WHATSAPP_ACCESS_TOKEN') ?: env('WHATSAPP_TOKEN') ?: env('META_WHATSAPP_ACCESS_TOKEN') ?: env('META_ACCESS_TOKEN')),
            'phone_number_id' => (string) (config('services.whatsapp.phone_number_id') ?: env('WHATSAPP_PHONE_NUMBER_ID') ?: env('META_WHATSAPP_PHONE_NUMBER_ID') ?: env('META_PHONE_NUMBER_ID')),
            'version' => (string) (config('services.whatsapp.graph_version') ?: env('WHATSAPP_GRAPH_VERSION') ?: env('META_GRAPH_VERSION') ?: 'v20.0'),
        ];
    }
}

if (!function_exists('mrow_send_text')) {
    function mrow_send_text(string $to, string $message): array
    {
        $cfg = mrow_cfg();
        $to = mrow_phone($to);
        if ($cfg['token'] === '' || $cfg['phone_number_id'] === '' || $to === '') {
            return ['ok' => false, 'reason' => 'missing_config'];
        }
        try {
            $response = Http::withToken($cfg['token'])->post("https://graph.facebook.com/{$cfg['version']}/{$cfg['phone_number_id']}/messages", [
                'messaging_product' => 'whatsapp',
                'to' => $to,
                'type' => 'text',
                'text' => ['preview_url' => false, 'body' => $message],
            ]);
            return ['ok' => $response->successful(), 'status' => $response->status(), 'body' => $response->body()];
        } catch (Throwable $e) {
            return ['ok' => false, 'error' => $e->getMessage()];
        }
    }
}

if (!function_exists('mrow_upload_pdf')) {
    function mrow_upload_pdf(string $filePath): array
    {
        $cfg = mrow_cfg();
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
            return ['ok' => $response->successful() && (string) data_get($body, 'id') !== '', 'media_id' => data_get($body, 'id'), 'status' => $response->status(), 'body' => $response->body()];
        } catch (Throwable $e) {
            return ['ok' => false, 'error' => $e->getMessage()];
        }
    }
}

if (!function_exists('mrow_send_pdf_doc')) {
    function mrow_send_pdf_doc(string $to, string $mediaId, string $filename): array
    {
        $cfg = mrow_cfg();
        $to = mrow_phone($to);
        if ($cfg['token'] === '' || $cfg['phone_number_id'] === '' || $to === '' || $mediaId === '') {
            return ['ok' => false, 'reason' => 'missing_config_or_media'];
        }
        try {
            $response = Http::withToken($cfg['token'])->post("https://graph.facebook.com/{$cfg['version']}/{$cfg['phone_number_id']}/messages", [
                'messaging_product' => 'whatsapp',
                'to' => $to,
                'type' => 'document',
                'document' => ['id' => $mediaId, 'filename' => $filename, 'caption' => 'تقرير متأخرات الإيجار PDF'],
            ]);
            return ['ok' => $response->successful(), 'status' => $response->status(), 'body' => $response->body()];
        } catch (Throwable $e) {
            return ['ok' => false, 'error' => $e->getMessage()];
        }
    }
}

if (!function_exists('mrow_overdue_rows')) {
    function mrow_overdue_rows()
    {
        $today = now()->toDateString();
        return Contract::query()
            ->with(['tenant', 'unit.property', 'payments' => fn ($q) => $q->orderBy('due_date')->orderBy('id')])
            ->whereIn('status', ['active', 'نشط'])
            ->get()
            ->map(function ($contract) use ($today) {
                $payments = $contract->payments ?? collect();
                $dueTotal = $payments->filter(fn ($p) => substr((string) ($p->due_date ?? ''), 0, 10) <= $today)->sum(fn ($p) => mrow_num($p->amount ?? 0));
                $paidTotal = $payments->sum(function ($p) {
                    $paid = mrow_num($p->paid_amount ?? 0);
                    if ($paid > 0) return $paid;
                    $status = trim(mb_strtolower((string) ($p->status ?? '')));
                    return !empty($p->paid_date) && in_array($status, ['paid', 'مدفوع', 'مدفوعة', 'مسدد'], true) ? mrow_num($p->amount ?? 0) : 0;
                });
                $lateAmount = max(0, $dueTotal - $paidTotal);
                if ($lateAmount <= 0) return null;
                $oldest = $payments->filter(fn ($p) => substr((string) ($p->due_date ?? ''), 0, 10) <= $today)->sortBy('due_date')->first();
                return [
                    'tenant' => $contract->tenant?->name ?: '-',
                    'property' => $contract->unit?->property?->name ?: '-',
                    'unit' => $contract->unit?->unit_number ?: '-',
                    'amount' => $lateAmount,
                    'due_date' => substr((string) ($oldest?->due_date ?? ''), 0, 10) ?: '-',
                ];
            })->filter()->sortByDesc('amount')->values();
    }
}

if (!function_exists('mrow_build_message')) {
    function mrow_build_message($rows): string
    {
        $count = $rows->count();
        $total = $rows->sum('amount');
        $lines = ['📋 *تقرير متأخرات الإيجار*', 'التاريخ: ' . now('Asia/Riyadh')->format('Y-m-d'), 'عدد الحالات: ' . $count, 'الإجمالي: ' . mrow_money($total), '', '```', 'الوحدة | المستأجر | المبلغ | الاستحقاق', '------ | -------- | ------ | --------'];
        foreach ($rows->take(25) as $row) {
            $lines[] = trim(($row['property'] !== '-' ? $row['property'] . ' / ' : '') . 'وحدة ' . $row['unit']) . ' | ' . mb_substr((string) $row['tenant'], 0, 18) . ' | ' . number_format((float) $row['amount'], 0) . ' | ' . $row['due_date'];
        }
        $lines[] = '```';
        $lines[] = 'تنبيه: تم إرسال هذا النص كبديل لأن PDF لم يكتمل.';
        return implode("\n", $lines);
    }
}

if (!function_exists('mrow_pdf_html')) {
    function mrow_pdf_html($rows): string
    {
        $today = now('Asia/Riyadh')->format('Y-m-d');
        $body = '';
        foreach ($rows as $index => $row) {
            $body .= '<tr><td>' . ($index + 1) . '</td><td>' . e($row['property']) . '</td><td>' . e($row['unit']) . '</td><td>' . e($row['tenant']) . '</td><td class="amount">' . number_format((float) $row['amount'], 0) . '</td><td>' . e($row['due_date']) . '</td></tr>';
        }
        if ($body === '') $body = '<tr><td colspan="6" class="empty">لا توجد مبالغ متأخرة حتى الآن</td></tr>';
        return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>body{font-family:dejavusans,DejaVu Sans,Tahoma,Arial,sans-serif;direction:rtl;text-align:right;color:#111827;margin:0;padding:22px}.header{background:#111827;color:#fff;border-radius:18px;padding:18px;margin-bottom:14px}.title{font-size:24px;font-weight:bold}.sub{color:#d1d5db;font-size:13px;margin-top:6px}.summary{display:table;width:100%;margin-bottom:14px}.box{display:table-cell;background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;padding:12px;text-align:center}.box b{display:block;color:#dc2626;font-size:20px;margin-bottom:5px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#dbeafe;color:#1e3a8a;padding:9px;border:1px solid #bfdbfe}td{padding:8px;border:1px solid #e5e7eb}tr:nth-child(even) td{background:#f8fafc}.amount{color:#dc2626;font-weight:bold}.empty{text-align:center;padding:28px;color:#0f766e;font-weight:bold}.footer{margin-top:14px;color:#64748b;font-size:11px;text-align:center}</style></head><body><div class="header"><div class="title">تقرير متأخرات الإيجار</div><div class="sub">تقرير مختصر مرسل عبر واتساب بتاريخ ' . $today . '</div></div><div class="summary"><div class="box"><b>' . $rows->count() . '</b>عدد الحالات</div><div class="box"><b>' . mrow_money($rows->sum('amount')) . '</b>إجمالي المتأخرات</div></div><table><thead><tr><th>#</th><th>العقار</th><th>الوحدة</th><th>المستأجر</th><th>المبلغ</th><th>الاستحقاق</th></tr></thead><tbody>' . $body . '</tbody></table><div class="footer">تم إنشاء التقرير تلقائيًا من نظام إيجار</div></body></html>';
    }
}

if (!function_exists('mrow_generate_pdf')) {
    function mrow_generate_pdf($rows): string
    {
        $dir = storage_path('app/reports/overdue');
        if (!is_dir($dir)) @mkdir($dir, 0775, true);
        if (!is_dir(storage_path('app/mpdf-temp'))) @mkdir(storage_path('app/mpdf-temp'), 0775, true);
        $path = $dir . '/rent-overdue-' . now('Asia/Riyadh')->format('Ymd-His') . '.pdf';
        if (class_exists(\Mpdf\Mpdf::class)) {
            $mpdf = new \Mpdf\Mpdf(['mode' => 'utf-8', 'format' => 'A4', 'default_font' => 'dejavusans', 'tempDir' => storage_path('app/mpdf-temp')]);
            $mpdf->autoScriptToLang = true;
            $mpdf->autoLangToFont = true;
            $mpdf->WriteHTML(mrow_pdf_html($rows));
            $mpdf->Output($path, \Mpdf\Output\Destination::FILE);
            return $path;
        }
        throw new RuntimeException('mpdf is not installed');
    }
}

Artisan::command('rent:send-overdue-whatsapp-table-report {--to=} {--test} {--text}', function () {
    $to = (string) ($this->option('to') ?: env('DAILY_RENT_OVERDUE_WHATSAPP_TO', '0500007650'));
    $rows = mrow_overdue_rows();
    $message = mrow_build_message($rows);

    if ($this->option('text')) {
        $this->line($message);
        if ($this->option('test')) return self::SUCCESS;
        $result = mrow_send_text($to, $message);
        if (!($result['ok'] ?? false)) Log::warning('WhatsApp text fallback failed', $result);
        return ($result['ok'] ?? false) ? self::SUCCESS : self::FAILURE;
    }

    try {
        $pdfPath = mrow_generate_pdf($rows);
        $this->line('PDF: ' . $pdfPath);
        if ($this->option('test')) return self::SUCCESS;
        $upload = mrow_upload_pdf($pdfPath);
        if (!($upload['ok'] ?? false)) throw new RuntimeException('PDF upload failed: ' . ($upload['body'] ?? $upload['reason'] ?? 'unknown'));
        $send = mrow_send_pdf_doc($to, (string) $upload['media_id'], basename($pdfPath));
        if (!($send['ok'] ?? false)) throw new RuntimeException('PDF send failed: ' . ($send['body'] ?? $send['reason'] ?? 'unknown'));
        $this->info('PDF report sent.');
        return self::SUCCESS;
    } catch (Throwable $e) {
        Log::warning('PDF report failed, trying WhatsApp text fallback', ['error' => $e->getMessage()]);
        $this->warn('PDF failed, sending text fallback: ' . $e->getMessage());
        if ($this->option('test')) return self::FAILURE;
        $result = mrow_send_text($to, $message);
        if (!($result['ok'] ?? false)) {
            Log::warning('WhatsApp text fallback failed', $result);
            return self::FAILURE;
        }
        $this->info('Text fallback sent.');
        return self::SUCCESS;
    }
})->purpose('Send compact WhatsApp overdue rent report as PDF with text fallback.');
