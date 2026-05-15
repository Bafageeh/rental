<?php

/*
|--------------------------------------------------------------------------
| Deed field-window parser
|--------------------------------------------------------------------------
| This parser is used when PDF text extraction keeps the document number/date
| but changes the ordering of the remaining green labels and beige values.
| It searches the whole extracted text around each known label group instead
| of depending on exact row order.
*/

if (!function_exists('deed_w_clean')) {
    function deed_w_clean($value, int $max = 255): ?string
    {
        $value = trim((string) $value);
        if ($value === '' || $value === '-') return null;
        $value = preg_replace('/[\x{200E}\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}]/u', '', $value) ?? $value;
        $value = trim(preg_replace('/\s+/u', ' ', $value) ?? $value, " \t\n\r\0\x0B:-،؛");
        return $value === '' ? null : mb_substr($value, 0, $max);
    }
}

if (!function_exists('deed_w_num')) {
    function deed_w_num($value): ?string
    {
        $n = preg_replace('/[^0-9.]/', '', (string) $value);
        return $n === '' ? null : $n;
    }
}

if (!function_exists('deed_w_norm')) {
    function deed_w_norm(string $text): string
    {
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $text = preg_replace('/[\x{200E}\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}]/u', '', $text) ?? $text;
        $text = strtr($text, [
            '٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9',
            '۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9',
        ]);
        $text = preg_replace('/[ \t]+/u', ' ', str_replace(['ـ', "\xc2\xa0"], ' ', $text)) ?? $text;
        return trim(preg_replace('/\n{2,}/u', "\n", $text) ?? $text);
    }
}

if (!function_exists('deed_w_lines')) {
    function deed_w_lines(string $text): array
    {
        return array_values(array_filter(array_map(
            fn ($line) => deed_w_clean($line, 1500),
            preg_split('/\n/u', $text) ?: []
        ), fn ($line) => $line !== null && $line !== ''));
    }
}

if (!function_exists('deed_w_join')) {
    function deed_w_join(array $lines): string
    {
        return deed_w_clean(implode(' ', $lines), 200000) ?? '';
    }
}

if (!function_exists('deed_w_line_index')) {
    function deed_w_line_index(array $lines, array $tokens): ?int
    {
        foreach ($lines as $index => $line) {
            $ok = true;
            foreach ($tokens as $token) {
                if (mb_strpos($line, $token) === false) {
                    $ok = false;
                    break;
                }
            }
            if ($ok) return $index;
        }
        return null;
    }
}

if (!function_exists('deed_w_value_near_header')) {
    function deed_w_value_near_header(array $lines, array $tokens, ?string $mustMatch = null, int $lookAround = 6): ?string
    {
        $index = deed_w_line_index($lines, $tokens);
        if ($index === null) return null;

        $start = max(0, $index - $lookAround);
        $end = min(count($lines) - 1, $index + $lookAround);
        for ($i = $index + 1; $i <= $end; $i++) {
            $candidate = $lines[$i] ?? '';
            if ($mustMatch === null || preg_match($mustMatch, $candidate)) return $candidate;
        }
        for ($i = $index - 1; $i >= $start; $i--) {
            $candidate = $lines[$i] ?? '';
            if ($mustMatch === null || preg_match($mustMatch, $candidate)) return $candidate;
        }
        return null;
    }
}

if (!function_exists('deed_w_set')) {
    function deed_w_set(array &$payload, string $key, $value, int $max = 255): void
    {
        $clean = deed_w_clean($value, $max);
        if ($clean !== null) $payload[$key] = $clean;
    }
}

if (!function_exists('deed_w_parse_status')) {
    function deed_w_parse_status(array $lines, string $text, array &$payload): void
    {
        if (preg_match('/القيود\s+(.{1,120}?)\s+الحالة\s+(.{1,80}?)(?:\s+(?:تاريخ\s*الوثيقة|المساحة|نوع\s*العملية|الملاك)|$)/u', $text, $m)) {
            deed_w_set($payload, 'document_restrictions', $m[1]);
            deed_w_set($payload, 'document_status', $m[2], 100);
            return;
        }

        $row = deed_w_value_near_header($lines, ['القيود', 'الحالة'], '/لا\s*يوجد|فعال|مرهون|ملغي|منتهي|قيد/u');
        if (!$row) return;

        if (preg_match('/^(.*?)\s+(فعال|غير\s*فعال|ملغي|منتهي)$/u', $row, $m)) {
            deed_w_set($payload, 'document_restrictions', $m[1]);
            deed_w_set($payload, 'document_status', $m[2], 100);
        } elseif (preg_match('/^(فعال|غير\s*فعال|ملغي|منتهي)\s+(.+)$/u', $row, $m)) {
            deed_w_set($payload, 'document_status', $m[1], 100);
            deed_w_set($payload, 'document_restrictions', $m[2]);
        } elseif (preg_match('/(فعال|غير\s*فعال|ملغي|منتهي)/u', $row, $m)) {
            deed_w_set($payload, 'document_status', $m[1], 100);
            $restrictions = trim(str_replace($m[1], '', $row));
            deed_w_set($payload, 'document_restrictions', $restrictions ?: 'لا يوجد قيود');
        }
    }
}

if (!function_exists('deed_w_parse_prev_area')) {
    function deed_w_parse_prev_area(array $lines, string $text, array &$payload): void
    {
        if (preg_match('/تاريخ\s*الوثيقة\s*السابقة\s+([0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2})\s+المساحة\s+([0-9]+(?:\.[0-9]+)?)/u', $text, $m)) {
            deed_w_set($payload, 'previous_document_date_hijri', $m[1], 50);
            $payload['property_area'] = deed_w_num($m[2]);
            return;
        }
        $row = deed_w_value_near_header($lines, ['تاريخ الوثيقة السابقة', 'المساحة'], '/[0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2}|[0-9]+(?:\.[0-9]+)?/u');
        if (!$row) return;
        if (preg_match('/([0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2})/u', $row, $m)) deed_w_set($payload, 'previous_document_date_hijri', $m[1], 50);
        preg_match_all('/[0-9]+(?:\.[0-9]+)?/u', $row, $nums);
        if (!empty($nums[0])) {
            $numbers = array_values(array_filter($nums[0], fn ($n) => !preg_match('/^[0-9]{4}$/', $n)));
            $payload['property_area'] = deed_w_num(end($numbers) ?: end($nums[0]));
        }
    }
}

if (!function_exists('deed_w_parse_operation')) {
    function deed_w_parse_operation(array $lines, string $text, array &$payload): void
    {
        if (preg_match('/نوع\s*العملية\s+(.{1,100}?)\s+رقم\s*الوثيقة\s*السابقة\s+(.{1,120}?)(?:\s+(?:الملاك|رقم\s*الهوية)|$)/u', $text, $m)) {
            deed_w_set($payload, 'operation_type', $m[1], 100);
            deed_w_set($payload, 'previous_document_number', $m[2], 150);
            return;
        }
        $row = deed_w_value_near_header($lines, ['نوع العملية', 'رقم الوثيقة السابقة'], '/[0-9]|تحديث|تعديل|رهن|صفقة|فرز/u');
        if (!$row) return;
        if (preg_match('/(تحديث\s*\/\s*تعديل|رهن|صفقة|فرز|تحديث|تعديل)\s+(.+)$/u', $row, $m)) {
            deed_w_set($payload, 'operation_type', $m[1], 100);
            deed_w_set($payload, 'previous_document_number', $m[2], 150);
        } elseif (preg_match('/^(.+?)\s+([0-9][0-9\s\/\-\p{Arabic}]*)$/u', $row, $m)) {
            deed_w_set($payload, 'operation_type', $m[1], 100);
            deed_w_set($payload, 'previous_document_number', $m[2], 150);
        }
    }
}

if (!function_exists('deed_w_parse_owner')) {
    function deed_w_parse_owner(array $lines, array &$payload): void
    {
        foreach ($lines as $line) {
            if (preg_match('/^([0-9]{6,})\s+(.+?)\s+(سعودي|سعودية)\s+([0-9]+)\s*%?$/u', $line, $m)) {
                deed_w_set($payload, 'deed_owner_identifier', $m[1]);
                deed_w_set($payload, 'deed_owner_name', $m[2]);
                deed_w_set($payload, 'deed_owner_nationality', $m[3]);
                $payload['deed_ownership_percentage'] = deed_w_num($m[4]);
                return;
            }
        }
    }
}

if (!function_exists('deed_w_parse_property_row')) {
    function deed_w_parse_property_row(array $lines, string $text, array &$payload): void
    {
        $row = deed_w_value_near_header($lines, ['رقم الهوية العقارية', 'نوع العقار'], '/قطعة|شقة|أرض|ارض|فيلا|عمارة|[0-9]+(?:\.[0-9]+)?/u');
        if (!$row && preg_match('/رقم\s*الهوية\s*العقارية\s+(.{0,100}?)\s+نوع\s*العقار\s+(.{1,80}?)\s+مساحة\s*العقار\s*\(?\s*م\s*²?\s*\)?\s+([0-9]+(?:\.[0-9]+)?)(?:\s+نوع\s*الاستخدام\s+(.{1,80}?))?(?:\s|$)/u', $text, $m)) {
            deed_w_set($payload, 'real_estate_identity_number', $m[1], 100);
            deed_w_set($payload, 'deed_property_type_text', $m[2], 100);
            $payload['property_area'] = deed_w_num($m[3]);
            if (!empty($m[4])) deed_w_set($payload, 'deed_usage_text', $m[4], 100);
            return;
        }
        if (!$row) return;
        if (preg_match('/\b([0-9]+(?:\.[0-9]+)?)\b/u', $row, $areaMatch, PREG_OFFSET_CAPTURE)) {
            $area = $areaMatch[1][0];
            $payload['property_area'] = deed_w_num($area);
            $before = trim(mb_substr($row, 0, $areaMatch[1][1]));
            $after = trim(mb_substr($row, $areaMatch[1][1] + mb_strlen($area)));
            if (preg_match('/(قطعة\s*الأرض|قطعة\s*ارض|قطعة\s*أرض|شقة|فيلا|عمارة|أرض|ارض)/u', $before, $tm)) deed_w_set($payload, 'deed_property_type_text', $tm[1], 100);
            if (preg_match('/([0-9]{8,}|لا\s*يوجد)/u', $before, $im)) $payload['real_estate_identity_number'] = $im[1] === 'لا يوجد' ? null : deed_w_clean($im[1]);
            deed_w_set($payload, 'deed_usage_text', $after, 100);
        }
    }
}

if (!function_exists('deed_w_city_extract')) {
    function deed_w_city_extract(string &$row): ?string
    {
        foreach (['جدة', 'مكة', 'الرياض', 'المدينة', 'الدمام', 'الطائف', 'ينبع', 'الخبر', 'تبوك', 'أبها', 'جازان', 'حائل'] as $city) {
            if (preg_match('/^' . preg_quote($city, '/') . '(?:\s|$)/u', $row)) {
                $row = trim(preg_replace('/^' . preg_quote($city, '/') . '\s*/u', '', $row) ?? $row);
                return $city;
            }
            if (preg_match('/(?:^|\s)' . preg_quote($city, '/') . '$/u', $row)) {
                $row = trim(preg_replace('/\s*' . preg_quote($city, '/') . '$/u', '', $row) ?? $row);
                return $city;
            }
        }
        return null;
    }
}

if (!function_exists('deed_w_parse_location')) {
    function deed_w_parse_location(array $lines, array &$payload): void
    {
        $row = deed_w_value_near_header($lines, ['رقم القطعة', 'رقم المخطط', 'الحي', 'المدينة'], '/[0-9]|جدة|مكة|الرياض|الصفا|أبحر|ابحر|الورود/u', 8);
        if (!$row) return;
        $city = deed_w_city_extract($row);
        $knownDistricts = ['أبحر الشمالية', 'ابحر الشمالية', 'أبحر الجنوبية', 'ابحر الجنوبية', 'الصفا', 'الورود', 'بني مالك', 'أم السلم', 'ام السلم', 'طيبة', 'الشاطئ', 'النزهة', 'الروضة', 'الفيصلية'];
        $district = null;
        foreach ($knownDistricts as $candidate) {
            if (preg_match('/(?:^|\s)' . preg_quote($candidate, '/') . '(?:\s|$)/u', $row)) {
                $district = $candidate;
                $row = trim(preg_replace('/(?:^|\s)' . preg_quote($candidate, '/') . '(?:\s|$)/u', ' ', $row) ?? $row);
                break;
            }
        }
        if (!$district && preg_match('/\s([\p{Arabic}]{3,})\s*$/u', $row, $m)) {
            $district = $m[1];
            $row = trim(mb_substr($row, 0, mb_strrpos($row, $m[1]) ?: null));
        }
        preg_match('/([0-9]+(?:\s*\/\s*[^\s]+)*)/u', $row, $plotMatch);
        $plot = $plotMatch[1] ?? null;
        $plan = trim(str_replace((string) $plot, '', $row));
        deed_w_set($payload, 'plot_number', $plot, 100);
        deed_w_set($payload, 'plan_number', $plan, 150);
        deed_w_set($payload, 'district', $district, 100);
        deed_w_set($payload, 'city', $city, 80);
    }
}

if (!function_exists('deed_w_parse_boundaries')) {
    function deed_w_parse_boundaries(array $lines, array &$payload): void
    {
        $headerIndex = deed_w_line_index($lines, ['الحد', 'النوع', 'الطول']);
        if ($headerIndex === null) return;
        $rows = [];
        for ($i = $headerIndex + 1; $i < min(count($lines), $headerIndex + 10); $i++) {
            $line = $lines[$i];
            if (preg_match('/^(الرقم|التاريخ|صدرت|الصفحة)\b/u', $line)) break;
            if (!preg_match('/^(شمالا|شمالاً|شمال|جنوبا|جنوباً|جنوب|شرقا|شرقاً|شرق|غربا|غرباً|غرب)\s+(.+)$/u', $line, $m)) continue;
            $dir = match ($m[1]) {
                'شمالا', 'شمالاً', 'شمال' => 'north',
                'جنوبا', 'جنوباً', 'جنوب' => 'south',
                'شرقا', 'شرقاً', 'شرق' => 'east',
                'غربا', 'غرباً', 'غرب' => 'west',
                default => null,
            };
            if (!$dir) continue;
            $rest = trim($m[2]);
            preg_match_all('/\d+(?:\.\d+)?/u', $rest, $matches, PREG_OFFSET_CAPTURE);
            if (empty($matches[0])) continue;
            $last = end($matches[0]);
            $length = $last[0];
            $beforeLength = trim(mb_substr($rest, 0, $last[1]));
            if (preg_match('/^(جزء\s+من|قطعة|شارع|سكة|ممر|أرض|ارض)\s*(.*)$/u', $beforeLength, $tm)) {
                $type = deed_w_clean($tm[1], 100);
                $desc = deed_w_clean($tm[2], 255);
            } else {
                $pieces = preg_split('/\s+/u', $beforeLength, 2) ?: [];
                $type = deed_w_clean($pieces[0] ?? null, 100);
                $desc = deed_w_clean($pieces[1] ?? null, 255);
            }
            if ($type) $rows[] = ['direction' => $dir, 'type' => $type, 'description' => $desc, 'length' => deed_w_num($length)];
        }
        if (count($rows) <= 1) return;
        $summary = [];
        foreach ($rows as $row) {
            $dir = $row['direction'];
            $label = ['north'=>'شمالا','south'=>'جنوبا','east'=>'شرقا','west'=>'غربا'][$dir] ?? $dir;
            $payload['deed_' . $dir . '_boundary_type'] = $row['type'];
            $payload['deed_' . $dir . '_boundary_description'] = $row['description'];
            $payload['deed_' . $dir . '_boundary_length'] = $row['length'];
            $summary[] = $label . ': ' . trim($row['type'] . ' ' . ($row['description'] ?? '') . ' طول ' . ($row['length'] ?? '') . ' م');
        }
        $payload['deed_boundaries_description'] = implode('. ', $summary) . '.';
    }
}

if (!function_exists('deed_window_payload')) {
    function deed_window_payload(string $filePath): array
    {
        $text = deed_w_norm((new \Smalot\PdfParser\Parser())->parseFile($filePath)->getText());
        $lines = deed_w_lines($text);
        $joined = deed_w_join($lines);
        $payload = [];

        if (preg_match('/رقم\s*الوثيقة\s+([0-9]{5,})\s+تاريخ\s*الوثيقة\s+([0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2})/u', $joined, $m)
            || preg_match('/([0-9]{5,})\s+([0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2})/u', deed_w_value_near_header($lines, ['رقم الوثيقة', 'تاريخ الوثيقة'], '/[0-9]{5,}|[0-9]{4}\//u') ?? '', $m)) {
            $payload['deed_number'] = $payload['document_number'] = deed_w_clean($m[1]);
            $payload['document_date_hijri'] = deed_w_clean($m[2], 50);
        } elseif (preg_match('/\b([0-9]{12})\b/u', $joined, $m)) {
            $payload['deed_number'] = $payload['document_number'] = deed_w_clean($m[1]);
        }

        deed_w_parse_status($lines, $joined, $payload);
        deed_w_parse_prev_area($lines, $joined, $payload);
        deed_w_parse_operation($lines, $joined, $payload);
        deed_w_parse_owner($lines, $payload);
        deed_w_parse_property_row($lines, $joined, $payload);
        deed_w_parse_location($lines, $payload);
        deed_w_parse_boundaries($lines, $payload);

        $typeText = $payload['deed_property_type_text'] ?? null;
        $ptype = str_contains((string) $typeText, 'شقة') ? 'apartment' : ((str_contains((string) $typeText, 'قطعة') || str_contains((string) $typeText, 'ارض') || str_contains((string) $typeText, 'أرض')) ? 'land' : 'building');
        $payload['property_type'] = $ptype;
        $payload['usage_type'] = 'residential';
        $payload['management_type'] = 'managed';
        $district = $payload['district'] ?? null;
        $city = $payload['city'] ?? null;
        $plot = $payload['plot_number'] ?? null;
        $plan = $payload['plan_number'] ?? null;
        $payload['name'] = deed_w_clean(implode(' - ', array_filter([$ptype === 'land' ? 'قطعة أرض' : 'عقار', $district, $city]))) ?: (($payload['document_number'] ?? null) ? 'عقار صك ' . $payload['document_number'] : 'عقار من صك');
        $payload['address'] = implode('، ', array_filter([$district ? 'حي ' . deed_w_clean($district, 80) : null, deed_w_clean($city, 80), $plan ? 'مخطط ' . deed_w_clean($plan, 100) : null, $plot ? 'قطعة ' . deed_w_clean($plot, 100) : null]));
        $payload['deed_raw_excerpt'] = mb_substr($text, 0, 6000);
        return $payload;
    }
}

if (!function_exists('deed_window_handle')) {
    function deed_window_handle(\Illuminate\Http\Request $request)
    {
        $request->validate(['file' => ['required', 'file', 'mimes:pdf', 'max:20480'], 'owner_id' => ['nullable', 'integer', 'exists:owners,id'], 'apply' => ['nullable', 'boolean']]);
        $uploaded = $request->file('file');
        $payload = deed_window_payload($uploaded->getRealPath());
        $doc = $payload['document_number'] ?? $payload['deed_number'] ?? null;
        if (!$doc) return response()->json(['status' => 'error', 'message' => 'تعذر قراءة رقم الصك من الملف.'], 422);
        return deed_v2_save_payload($request, $payload, (string) $doc, ($payload['property_type'] ?? '') === 'apartment' ? 'apartment' : 'property');
    }
}
