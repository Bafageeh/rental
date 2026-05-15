<?php

/*
|--------------------------------------------------------------------------
| Mirrored Arabic deed parser
|--------------------------------------------------------------------------
| Some deeds are extracted by the PDF parser as mirrored Arabic text, for
| example: "ةيساسلأا تانايبلا" instead of "البيانات الأساسية".
| This parser mirrors each extracted line back, fixes reversed numbers/dates,
| then extracts the common deed model fields.
*/

if (!function_exists('deed_m_clean')) {
    function deed_m_clean($value, int $max = 255): ?string
    {
        $value = trim((string) $value);
        if ($value === '' || $value === '-') return null;
        $value = strtr($value, ['٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9']);
        $value = preg_replace('/[\x{200E}\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}]/u', '', $value) ?? $value;
        $value = trim(preg_replace('/\s+/u', ' ', str_replace('ـ', '', $value)) ?? $value, " \t\n\r\0\x0B:-،؛");
        return $value === '' ? null : mb_substr($value, 0, $max);
    }
}

if (!function_exists('deed_m_num')) {
    function deed_m_num($value): ?string
    {
        $n = preg_replace('/[^0-9.]/', '', (string) $value);
        return $n === '' ? null : $n;
    }
}

if (!function_exists('deed_m_reverse')) {
    function deed_m_reverse(string $value): string
    {
        return implode('', array_reverse(preg_split('//u', $value, -1, PREG_SPLIT_NO_EMPTY) ?: []));
    }
}

if (!function_exists('deed_m_fix_numbers')) {
    function deed_m_fix_numbers(string $line): string
    {
        $dates = [];
        $line = preg_replace_callback('/(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/u', function ($m) use (&$dates) {
            $key = ' __DATE_' . count($dates) . '__ ';
            $dates[$key] = strrev($m[3]) . '/' . $m[2] . '/' . $m[1];
            return $key;
        }, $line) ?? $line;

        $line = preg_replace_callback('/(?<![\/\d])\d{2,}(?![\/\d])/u', fn ($m) => strrev($m[0]), $line) ?? $line;

        foreach ($dates as $key => $date) {
            $line = str_replace($key, $date, $line);
        }
        return $line;
    }
}

if (!function_exists('deed_m_mirror_text')) {
    function deed_m_mirror_text(string $text): string
    {
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $lines = preg_split('/\n/u', $text) ?: [];
        $out = [];
        foreach ($lines as $line) {
            $line = deed_m_clean($line, 2000);
            if (!$line) continue;
            $out[] = deed_m_clean(deed_m_fix_numbers(deed_m_reverse($line)), 2000);
        }
        return trim(implode("\n", array_filter($out)));
    }
}

if (!function_exists('deed_m_lines')) {
    function deed_m_lines(string $text): array
    {
        return array_values(array_filter(array_map(fn ($line) => deed_m_clean($line, 2000), preg_split('/\n/u', $text) ?: []), fn ($line) => $line !== null));
    }
}

if (!function_exists('deed_m_find_header')) {
    function deed_m_find_header(array $lines, array $tokens): ?int
    {
        foreach ($lines as $i => $line) {
            $ok = true;
            foreach ($tokens as $token) {
                if (mb_strpos($line, $token) === false) {
                    $ok = false;
                    break;
                }
            }
            if ($ok) return $i;
        }
        return null;
    }
}

if (!function_exists('deed_m_data_after')) {
    function deed_m_data_after(array $lines, array $tokens, int $lookAhead = 5): ?string
    {
        $idx = deed_m_find_header($lines, $tokens);
        if ($idx === null) return null;
        for ($i = $idx + 1; $i <= min(count($lines) - 1, $idx + $lookAhead); $i++) {
            $line = $lines[$i] ?? '';
            if ($line === '') continue;
            if (preg_match('/رقم الوثيقة|تاريخ الوثيقة|القيود|الحالة|نوع العقار|رقم الهوية|الحد النوع/u', $line)) continue;
            return $line;
        }
        return null;
    }
}

if (!function_exists('deed_m_parse_location_line')) {
    function deed_m_parse_location_line(?string $line): array
    {
        $line = deed_m_clean($line, 800);
        if (!$line) return [];
        $city = null;
        foreach (['جدة', 'مكة', 'الرياض', 'المدينة', 'الدمام', 'الطائف', 'ينبع', 'الخبر', 'تبوك', 'أبها'] as $knownCity) {
            if (preg_match('/(?:^|\s)' . preg_quote($knownCity, '/') . '(?:\s|$)/u', $line)) {
                $city = $knownCity;
                $line = trim(preg_replace('/(?:^|\s)' . preg_quote($knownCity, '/') . '(?:\s|$)/u', ' ', $line) ?? $line);
                break;
            }
        }
        $district = null;
        foreach (['أبحر الشمالية', 'ابحر الشمالية', 'أبحر الجنوبية', 'ابحر الجنوبية', 'الصفا', 'الورود', 'النزهة', 'الروضة', 'الفيصلية', 'بني مالك'] as $knownDistrict) {
            if (preg_match('/(?:^|\s)' . preg_quote($knownDistrict, '/') . '(?:\s|$)/u', $line)) {
                $district = $knownDistrict;
                $line = trim(preg_replace('/(?:^|\s)' . preg_quote($knownDistrict, '/') . '(?:\s|$)/u', ' ', $line) ?? $line);
                break;
            }
        }
        preg_match('/([0-9]+(?:\s*\/\s*[^\s]+)*)/u', $line, $plotMatch);
        $plot = $plotMatch[1] ?? null;
        $plan = deed_m_clean(trim(str_replace((string) $plot, '', $line)), 150);
        return ['plot_number' => deed_m_clean($plot, 100), 'plan_number' => $plan, 'district' => $district, 'city' => $city];
    }
}

if (!function_exists('deed_m_payload')) {
    function deed_m_payload(string $filePath): array
    {
        try {
            $raw = (new \Smalot\PdfParser\Parser())->parseFile($filePath)->getText();
        } catch (\Throwable $e) {
            $raw = '';
        }

        $text = deed_m_mirror_text((string) $raw);
        $lines = deed_m_lines($text);
        $joined = implode(' ', $lines);
        $payload = [];

        if (preg_match('/رقم\s*الوثيقة\s+([0-9]{5,})\s+تاريخ\s*الوثيقة\s+([0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2})/u', $joined, $m)) {
            $payload['deed_number'] = $payload['document_number'] = deed_m_clean($m[1]);
            $payload['document_date_hijri'] = deed_m_clean($m[2], 50);
        } elseif (preg_match('/\b([0-9]{12})\b/u', $joined, $m)) {
            $payload['deed_number'] = $payload['document_number'] = deed_m_clean($m[1]);
        }

        if (preg_match('/القيود\s+(.+?)\s+الحالة\s+(فعال|غير فعال|ملغي|منتهي)/u', $joined, $m)) {
            $payload['document_restrictions'] = deed_m_clean($m[1]);
            $payload['document_status'] = deed_m_clean($m[2], 100);
        } elseif (($line = deed_m_data_after($lines, ['القيود', 'الحالة']))) {
            if (preg_match('/(لا يوجد قيود|مرهون|قيد.*?)\s+(فعال|غير فعال|ملغي|منتهي)/u', $line, $m)) {
                $payload['document_restrictions'] = deed_m_clean($m[1]);
                $payload['document_status'] = deed_m_clean($m[2], 100);
            }
        }

        if (preg_match('/تاريخ\s*الوثيقة\s*السابقة\s+([0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2})\s+المساحة\s+([0-9]+(?:\.[0-9]+)?)/u', $joined, $m)
            || (($line = deed_m_data_after($lines, ['تاريخ الوثيقة السابقة', 'المساحة'])) && preg_match('/([0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2}).*?([0-9]+(?:\.[0-9]+)?)/u', $line, $m))) {
            $payload['previous_document_date_hijri'] = deed_m_clean($m[1], 50);
            $payload['property_area'] = deed_m_num($m[2]);
        }

        if (preg_match('/نوع\s*العملية\s+(تحديث\s*\/\s*تعديل|رهن|صفقة|فرز|تحديث|تعديل)\s+رقم\s*الوثيقة\s*السابقة\s+([^\n]+?)(?:\s+الملاك|\s+رقم الهوية|$)/u', $joined, $m)) {
            $payload['operation_type'] = deed_m_clean($m[1], 100);
            $payload['previous_document_number'] = deed_m_clean($m[2], 150);
        } elseif (($line = deed_m_data_after($lines, ['نوع العملية', 'رقم الوثيقة السابقة']))) {
            if (preg_match('/(تحديث\s*\/\s*تعديل|رهن|صفقة|فرز|تحديث|تعديل)\s+(.+)$/u', $line, $m)) {
                $payload['operation_type'] = deed_m_clean($m[1], 100);
                $payload['previous_document_number'] = deed_m_clean($m[2], 150);
            }
        }

        foreach ($lines as $line) {
            if (preg_match('/^([0-9]{6,})\s+(.+?)\s+(سعودي|سعودية)\s+([0-9]+)\s*%?$/u', $line, $m)) {
                $payload['deed_owner_identifier'] = deed_m_clean($m[1]);
                $payload['deed_owner_name'] = deed_m_clean($m[2]);
                $payload['deed_owner_nationality'] = deed_m_clean($m[3]);
                $payload['deed_ownership_percentage'] = deed_m_num($m[4]);
                break;
            }
        }

        $propertyLine = deed_m_data_after($lines, ['رقم الهوية العقارية', 'نوع العقار']) ?: '';
        if ($propertyLine && preg_match('/(لا يوجد|[0-9]{8,})\s+(قطعة الأرض|قطعة أرض|قطعة ارض|شقة|فيلا|عمارة|أرض|ارض)\s+([0-9]+(?:\.[0-9]+)?)\s+(لا يوجد|سكني|تجاري|مختلط)?/u', $propertyLine, $m)) {
            $payload['real_estate_identity_number'] = $m[1] === 'لا يوجد' ? null : deed_m_clean($m[1]);
            $payload['deed_property_type_text'] = deed_m_clean($m[2], 100);
            $payload['property_area'] = deed_m_num($m[3]);
            if (!empty($m[4])) $payload['deed_usage_text'] = deed_m_clean($m[4], 100);
        }

        foreach (deed_m_parse_location_line(deed_m_data_after($lines, ['رقم القطعة', 'رقم المخطط', 'الحي', 'المدينة'], 8)) as $key => $value) {
            if ($value !== null) $payload[$key] = $value;
        }

        $typeText = $payload['deed_property_type_text'] ?? null;
        $ptype = str_contains((string) $typeText, 'شقة') ? 'apartment' : ((str_contains((string) $typeText, 'قطعة') || str_contains((string) $typeText, 'ارض') || str_contains((string) $typeText, 'أرض')) ? 'land' : 'building');
        $payload['property_type'] = $ptype;
        $payload['usage_type'] = 'residential';
        $payload['management_type'] = 'managed';
        $district = $payload['district'] ?? null;
        $city = $payload['city'] ?? null;
        $plot = $payload['plot_number'] ?? null;
        $plan = $payload['plan_number'] ?? null;
        $payload['name'] = deed_m_clean(implode(' - ', array_filter([$ptype === 'land' ? 'قطعة أرض' : 'عقار', $district, $city]))) ?: (($payload['document_number'] ?? null) ? 'عقار صك ' . $payload['document_number'] : 'عقار من صك');
        $payload['address'] = implode('، ', array_filter([$district ? 'حي ' . deed_m_clean($district, 80) : null, deed_m_clean($city, 80), $plan ? 'مخطط ' . deed_m_clean($plan, 100) : null, $plot ? 'قطعة ' . deed_m_clean($plot, 100) : null]));
        $payload['deed_parser_engine'] = 'mirrored_smalot_pdf_parser';
        $payload['deed_parse_quality'] = count(array_filter($payload, fn ($v) => $v !== null && $v !== ''));
        $payload['deed_raw_excerpt'] = mb_substr($text, 0, 6000);

        return $payload;
    }
}
