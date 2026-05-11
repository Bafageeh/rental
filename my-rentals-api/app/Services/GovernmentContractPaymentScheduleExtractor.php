<?php

namespace App\Services;

use Smalot\PdfParser\Parser;

class GovernmentContractPaymentScheduleExtractor
{
    public function extract(string $filePath): array
    {
        try {
            $parser = new Parser();
            $pdf = $parser->parseFile($filePath);
            $text = $this->normalize($pdf->getText());

            $scheduleBlock = $this->paymentScheduleBlock($text);
            $payments = $this->parseRows($scheduleBlock !== '' ? $scheduleBlock : $text);

            if (empty($payments) && $scheduleBlock !== '') {
                $payments = $this->parseRows($text);
            }

            return $this->deduplicateAndSort($payments);
        } catch (\Throwable $e) {
            return [];
        }
    }

    private function normalize(string $text): string
    {
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $text = preg_replace('/[\x{200E}\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}]/u', '', $text) ?? $text;
        $text = strtr($text, [
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
            '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
            '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
        ]);
        $text = str_replace(["\xc2\xa0", "ـ"], ' ', $text);
        $text = preg_replace('/[\x{064B}-\x{065F}\x{0670}]/u', '', $text) ?? $text;
        $text = preg_replace('/[ \t]+/u', ' ', $text) ?? $text;
        $text = preg_replace('/\n{2,}/u', "\n", $text) ?? $text;

        return trim($text);
    }

    private function paymentScheduleBlock(string $text): string
    {
        $startMarkers = [
            'Schedule Payments Rent',
            'Rent Payments Schedule',
            'جدول سداد الدفعات',
            'جدول سداد الُّد فعات',
            'جدول سداد ال دفعات',
            'Schedule Payments',
        ];

        $endMarkers = [
            'Obligations by Parties',
            'التزامات الأطراف',
            'التزامات األطراف',
            'أحكام عامة',
            'احكام عامة',
            'المادة الأولى',
            'المادة الاولى',
        ];

        $startPos = null;
        foreach ($startMarkers as $marker) {
            $pos = mb_stripos($text, $marker);
            if ($pos !== false && ($startPos === null || $pos < $startPos)) {
                $startPos = $pos + mb_strlen($marker);
            }
        }

        if ($startPos === null) {
            return '';
        }

        $endPos = null;
        foreach ($endMarkers as $marker) {
            $pos = mb_stripos($text, $marker, $startPos);
            if ($pos !== false && ($endPos === null || $pos < $endPos)) {
                $endPos = $pos;
            }
        }

        $block = $endPos === null
            ? mb_substr($text, $startPos, 6000)
            : mb_substr($text, $startPos, $endPos - $startPos);

        return trim($block);
    }

    private function parseRows(string $text): array
    {
        $payments = [];

        $patterns = [
            // Official Ejar table row, as parsed from PDFs:
            // 1 2025-07-04 2025-07-19 92يوم 1447-01-09 1447-01-24 16250.00
            '/(?:^|\n|\s)(\d{1,3})\s+(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})\s+([0-9]{1,4})\s*(?:يوم|يوما|days?|day)\s+(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})\s+(?:ر\.?س|SAR|﷼)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/ui',
            // Some parsers drop the Arabic/English period label but keep the two Gregorian dates,
            // two Hijri dates and the amount in the same order.
            '/(?:^|\n|\s)(\d{1,3})\s+(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})\s+(?:ر\.?س|SAR|﷼)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/ui',
        ];

        foreach ($patterns as $patternIndex => $pattern) {
            if (!preg_match_all($pattern, $text, $matches, PREG_SET_ORDER)) {
                continue;
            }

            foreach ($matches as $match) {
                $sequence = (int) ($match[1] ?? 0);
                if ($sequence < 1 || $sequence > 120) {
                    continue;
                }

                $amountIndex = $patternIndex === 0 ? 7 : 6;
                $periodDays = $patternIndex === 0 ? (int) ($match[4] ?? 0) : null;
                $dueHijriIndex = $patternIndex === 0 ? 5 : 4;
                $deadlineHijriIndex = $patternIndex === 0 ? 6 : 5;

                $dueDate = $this->dateOrNull($match[2] ?? null);
                $deadline = $this->dateOrNull($match[3] ?? null);
                $dueHijri = $this->dateOrNull($match[$dueHijriIndex] ?? null);
                $deadlineHijri = $this->dateOrNull($match[$deadlineHijriIndex] ?? null);
                $amount = $this->amountOrNull($match[$amountIndex] ?? null);

                if (!$dueDate || !$deadline || $amount === null || $amount <= 0) {
                    continue;
                }

                $payments[] = [
                    'sequence' => $sequence,
                    'due_date' => $dueDate,
                    'payment_deadline' => $deadline,
                    'due_date_hijri' => $dueHijri,
                    'payment_deadline_hijri' => $deadlineHijri,
                    'rental_period_days' => $periodDays,
                    'amount' => $amount,
                    'source' => 'official_ejar_schedule',
                ];
            }

            if (!empty($payments)) {
                break;
            }
        }

        return $payments;
    }

    private function deduplicateAndSort(array $payments): array
    {
        $unique = [];

        foreach ($payments as $payment) {
            $key = implode('|', [
                $payment['sequence'] ?? '',
                $payment['due_date'] ?? '',
                $payment['payment_deadline'] ?? '',
                number_format((float) ($payment['amount'] ?? 0), 2, '.', ''),
            ]);

            $unique[$key] = $payment;
        }

        $payments = array_values($unique);
        usort($payments, function (array $a, array $b) {
            return [(int) ($a['sequence'] ?? 0), (string) ($a['due_date'] ?? '')]
                <=> [(int) ($b['sequence'] ?? 0), (string) ($b['due_date'] ?? '')];
        });

        return $payments;
    }

    private function dateOrNull(?string $value): ?string
    {
        $value = trim((string) $value);
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? $value : null;
    }

    private function amountOrNull(?string $value): ?float
    {
        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }

        $value = str_replace(',', '', $value);
        return is_numeric($value) ? round((float) $value, 2) : null;
    }
}
