<?php

/*
|--------------------------------------------------------------------------
| Generic electronic deed model parser
|--------------------------------------------------------------------------
| Saudi electronic deeds are visually consistent: green labels and beige
| values. In parsed PDF text this appears either as:
| 1) label value label value on the same line, or
| 2) green label row followed by one beige value row.
|
| A green row is treated as a real table header only when more than one beige
| data row follows it. Otherwise it is treated as normal fields.
*/

if (!function_exists('deed_v2_clean')) {
    function deed_v2_clean($value, int $max = 255): ?string
    {
        if (function_exists('deed_visual_clean')) {
            return deed_visual_clean($value, $max);
        }
        $value = trim((string) $value);
        if ($value === '' || $value === '-') return null;
        return mb_substr(trim(preg_replace('/\s+/u', ' ', $value) ?? $value, " \t\n\r\0\x0B:-،؛"), 0, $max);
    }
}

if (!function_exists('deed_v2_num')) {
    function deed_v2_num($value): ?string
    {
        if (function_exists('deed_visual_num')) {
            return deed_visual_num($value);
        }
        $n = preg_replace('/[^0-9.]/', '', (string) $value);
        return $n === '' ? null : $n;
    }
}

if (!function_exists('deed_v2_norm')) {
    function deed_v2_norm(string $text): string
    {
        if (function_exists('deed_visual_norm')) {
            return deed_visual_norm($text);
        }
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $text = preg_replace('/[\x{200E}\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}]/u', '', $text) ?? $text;
        $text = strtr($text, ['٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9']);
        $text = preg_replace('/[ \t]+/u', ' ', str_replace(['ـ', "\xc2\xa0"], ' ', $text)) ?? $text;
        return trim(preg_replace('/\n{2,}/u', "\n", $text) ?? $text);
    }
}

if (!function_exists('deed_v2_lines')) {
    function deed_v2_lines(string $text): array
    {
        return array_values(array_filter(array_map(
            fn ($line) => deed_v2_clean($line, 1000),
            preg_split('/\n/u', $text) ?: []
        ), fn ($line) => $line !== null && $line !== ''));
    }
}

if (!function_exists('deed_v2_line_after')) {
    function deed_v2_line_after(array $lines, string $needle): ?string
    {
        foreach ($lines as $index => $line) {
            if (mb_strpos($line, $needle) !== false) {
                return $lines[$index + 1] ?? null;
            }
        }
        return null;
    }
}

if (!function_exists('deed_v2_set')) {
    function deed_v2_set(array &$payload, string $key, $value, int $max = 255): void
    {
        $clean = deed_v2_clean($value, $max);
        if ($clean !== null && $clean !== 'لا يوجد') {
            $payload[$key] = $clean;
        } elseif ($clean === 'لا يوجد') {
            $payload[$key] = $clean;
        }
    }
}

if (!function_exists('deed_v2_known_city_at_end')) {
    function deed_v2_known_city_at_end(string &$row): ?string
    {
        foreach (['جدة', 'مكة', 'الرياض', 'المدينة', 'الدمام', 'الطائف', 'ينبع', 'الخبر', 'تبوك', 'أبها', 'جازان', 'حائل'] as $city) {
            if (preg_match('/(?:^|\s)' . preg_quote($city, '/') . '$/u', $row)) {
                $row = trim(preg_replace('/\s*' . preg_quote($city, '/') . '$/u', '', $row) ?? $row);
                return $city;
            }
        }
        return null;
    }
}

if (!function_exists('deed_v2_extract_location_row')) {
    function deed_v2_extract_location_row(?string $row): array
    {
        $row = deed_v2_clean($row, 700);
        if (!$row) return [];

        $city = deed_v2_known_city_at_end($row);
        $row = trim($row);
        $plot = null;

        if (preg_match('/^([0-9]+\s*\/\s*[0-9]+(?:\s*\/\s*[^\s]+)?)\s+(.+)$/u', $row, $m)) {
            $plot = deed_v2_clean($m[1], 100);
            $row = trim($m[2]);
        } elseif (preg_match('/^([0-9]+(?:\s*\/\s*[^\s]+)?)\s+(.+)$/u', $row, $m)) {
            $plot = deed_v2_clean($m[1], 100);
            $row = trim($m[2]);
        }

        $district = null;
        $plan = $row;
        $twoWordDistricts = [
            'أبحر الشمالية', 'ابحر الشمالية', 'أبحر الجنوبية', 'ابحر الجنوبية',
            'بني مالك', 'أم السلم', 'ام السلم', 'طيبة الجديدة', 'الشاطئ الغربي',
        ];
        foreach ($twoWordDistricts as $candidate) {
            if (preg_match('/\s*' . preg_quote($candidate, '/') . '$/u', $row)) {
                $district = $candidate;
                $plan = trim(preg_replace('/\s*' . preg_quote($candidate, '/') . '$/u', '', $row) ?? $row);
                break;
            }
        }
        if (!$district && preg_match('/^(.*)\s+([\p{Arabic}]+)$/u', $row, $m)) {
            $lastWord = $m[2];
            $district = $lastWord;
            $plan = trim($m[1]);
        }

        return [
            'plot_number' => deed_v2_clean($plot, 100),
            'plan_number' => deed_v2_clean($plan, 150),
            'district' => deed_v2_clean($district, 100),
            'city' => deed_v2_clean($city, 80),
        ];
    }
}

if (!function_exists('deed_v2_boundary_row')) {
    function deed_v2_boundary_row(string $line): ?array
    {
        $line = deed_v2_clean($line, 700);
        if (!$line || !preg_match('/^(شمالا|شمالاً|شمال|جنوبا|جنوباً|جنوب|شرقا|شرقاً|شرق|غربا|غرباً|غرب)\s+(.+)$/u', $line, $m)) {
            return null;
        }
        $direction = match ($m[1]) {
            'شمالا', 'شمالاً', 'شمال' => 'north',
            'جنوبا', 'جنوباً', 'جنوب' => 'south',
            'شرقا', 'شرقاً', 'شرق' => 'east',
            'غربا', 'غرباً', 'غرب' => 'west',
            default => null,
        };
        if (!$direction) return null;

        $rest = trim($m[2]);
        preg_match_all('/\d+(?:\.\d+)?/u', $rest, $matches, PREG_OFFSET_CAPTURE);
        if (empty($matches[0])) return null;
        $lastNumber = end($matches[0]);
        $length = $lastNumber[0];
        $beforeLength = trim(mb_substr($rest, 0, $lastNumber[1]));

        if (preg_match('/^(جزء\s+من|قطعة|شارع|سكة|ممر|أرض|ارض)\s*(.*)$/u', $beforeLength, $tm)) {
            $type = deed_v2_clean($tm[1], 100);
            $description = deed_v2_clean($tm[2], 255);
        } else {
            $pieces = preg_split('/\s+/u', $beforeLength, 2) ?: [];
            $type = deed_v2_clean($pieces[0] ?? null, 100);
            $description = deed_v2_clean($pieces[1] ?? null, 255);
        }

        return $type ? [
            'direction' => $direction,
            'type' => $type,
            'description' => $description,
            'length' => deed_v2_num($length),
        ] : null;
    }
}

if (!function_exists('deed_v2_parse_property_main_row')) {
    function deed_v2_parse_property_main_row(?string $row, array &$payload): void
    {
        $row = deed_v2_clean($row, 700);
        if (!$row) return;
        if (!preg_match('/\b([0-9]+(?:\.[0-9]+)?)\b/u', $row, $areaMatch, PREG_OFFSET_CAPTURE)) return;

        $area = $areaMatch[1][0];
        $before = trim(mb_substr($row, 0, $areaMatch[1][1]));
        $after = trim(mb_substr($row, $areaMatch[1][1] + mb_strlen($area)));

        if (preg_match('/^(لا\s*يوجد)\s+(.+)$/u', $before, $m)) {
            $payload['real_estate_identity_number'] = null;
            deed_v2_set($payload, 'deed_property_type_text', $m[2], 100);
        } elseif (preg_match('/^([0-9]{5,})\s+(.+)$/u', $before, $m)) {
            deed_v2_set($payload, 'real_estate_identity_number', $m[1]);
            deed_v2_set($payload, 'deed_property_type_text', $m[2], 100);
        } else {
            deed_v2_set($payload, 'deed_property_type_text', $before, 100);
        }
        $payload['property_area'] = deed_v2_num($area);
        deed_v2_set($payload, 'deed_usage_text', $after, 100);
    }
}

if (!function_exists('deed_visual_payload_v2')) {
    function deed_visual_payload_v2(string $filePath): array
    {
        $text = deed_v2_norm((new \Smalot\PdfParser\Parser())->parseFile($filePath)->getText());
        $payload = function_exists('deed_visual_payload') ? deed_visual_payload($filePath) : [];
        $lines = deed_v2_lines($text);

        if (preg_match('/رقم\s*الوثيقة\s+([0-9]{5,})\s+تاريخ\s*الوثيقة\s+([0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2})/u', $text, $m)) {
            $payload['deed_number'] = $payload['document_number'] = deed_v2_clean($m[1]);
            $payload['document_date_hijri'] = deed_v2_clean($m[2], 50);
        } elseif (($row = deed_v2_line_after($lines, 'رقم الوثيقة تاريخ الوثيقة')) && preg_match('/([0-9]{5,})\s+([0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2})/u', $row, $m)) {
            $payload['deed_number'] = $payload['document_number'] = deed_v2_clean($m[1]);
            $payload['document_date_hijri'] = deed_v2_clean($m[2], 50);
        } elseif (preg_match('/\b([0-9]{12})\b/u', $text, $m)) {
            $payload['deed_number'] = $payload['document_number'] = deed_v2_clean($m[1]);
        }

        if (preg_match('/القيود\s+(.+?)\s+الحالة\s+(.+?)(?:\n|$)/u', $text, $m)) {
            $payload['document_restrictions'] = deed_v2_clean($m[1]);
            $payload['document_status'] = deed_v2_clean($m[2], 100);
        } elseif (($row = deed_v2_line_after($lines, 'القيود الحالة')) && preg_match('/^(.*?)\s+(فعال|غير\s*فعال|ملغي|منتهي)$/u', $row, $m)) {
            $payload['document_restrictions'] = deed_v2_clean($m[1]);
            $payload['document_status'] = deed_v2_clean($m[2], 100);
        }

        if (preg_match('/تاريخ\s*الوثيقة\s*السابقة\s+([0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2})\s+المساحة\s+([0-9]+(?:\.[0-9]+)?)/u', $text, $m)) {
            $payload['previous_document_date_hijri'] = deed_v2_clean($m[1], 50);
            $payload['property_area'] = deed_v2_num($m[2]);
        } elseif (($row = deed_v2_line_after($lines, 'تاريخ الوثيقة السابقة المساحة')) && preg_match('/([0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2})\s+([0-9]+(?:\.[0-9]+)?)/u', $row, $m)) {
            $payload['previous_document_date_hijri'] = deed_v2_clean($m[1], 50);
            $payload['property_area'] = deed_v2_num($m[2]);
        }

        if (preg_match('/نوع\s*العملية\s+(.+?)\s+رقم\s*الوثيقة\s*السابقة\s+(.+?)(?:\n|الملاك|$)/u', $text, $m)) {
            $payload['operation_type'] = deed_v2_clean($m[1], 100);
            $payload['previous_document_number'] = deed_v2_clean($m[2], 150);
        } elseif (($row = deed_v2_line_after($lines, 'نوع العملية رقم الوثيقة السابقة'))) {
            if (preg_match('/^(.*?)\s+([0-9][0-9\s\/\-\p{Arabic}]*)$/u', $row, $m)) {
                $payload['operation_type'] = deed_v2_clean($m[1], 100);
                $payload['previous_document_number'] = deed_v2_clean($m[2], 150);
            }
        }

        foreach ($lines as $line) {
            if (preg_match('/^([0-9]{6,})\s+(.+?)\s+(سعودي|سعودية)\s+([0-9]+)\s*%?$/u', $line, $m)) {
                $payload['deed_owner_identifier'] = deed_v2_clean($m[1]);
                $payload['deed_owner_name'] = deed_v2_clean($m[2]);
                $payload['deed_owner_nationality'] = deed_v2_clean($m[3]);
                $payload['deed_ownership_percentage'] = deed_v2_num($m[4]);
                break;
            }
        }

        deed_v2_parse_property_main_row(deed_v2_line_after($lines, 'رقم الهوية العقارية نوع العقار'), $payload);

        if (($row = deed_v2_line_after($lines, 'البلك المجاورة / الجزء')) && preg_match('/^(.+?)\s+(.+)$/u', $row, $m)) {
            $payload['block_number'] = trim($m[1]) === 'لا يوجد' ? null : deed_v2_clean($m[1], 100);
            $payload['deed_neighboring_part'] = deed_v2_clean($m[2], 100);
        }
        if (($row = deed_v2_line_after($lines, 'الموقع نموذج العقار')) && preg_match('/^(.+?)\s+(.+)$/u', $row, $m)) {
            $payload['deed_location_text'] = deed_v2_clean($m[1], 150);
            $payload['deed_property_model'] = deed_v2_clean($m[2], 150);
        }
        foreach (deed_v2_extract_location_row(deed_v2_line_after($lines, 'رقم القطعة رقم المخطط الحي المدينة')) as $key => $value) {
            if ($value !== null) $payload[$key] = $value;
        }

        $boundaryHeaderIndex = null;
        foreach ($lines as $index => $line) {
            if (preg_match('/الحد\s+النوع\s+وصف\s*الحد\s+الطول/u', $line)) {
                $boundaryHeaderIndex = $index;
                break;
            }
        }
        if ($boundaryHeaderIndex !== null) {
            $rows = [];
            for ($i = $boundaryHeaderIndex + 1; $i < count($lines); $i++) {
                if (preg_match('/^(الرقم|التاريخ|صدرت|الصفحة)\b/u', $lines[$i])) break;
                $row = deed_v2_boundary_row($lines[$i]);
                if ($row) $rows[] = $row;
            }
            if (count($rows) > 1) {
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

        $typeText = $payload['deed_property_type_text'] ?? null;
        $ptype = str_contains((string) $typeText, 'شقة')
            ? 'apartment'
            : ((str_contains((string) $typeText, 'قطعة') || str_contains((string) $typeText, 'ارض') || str_contains((string) $typeText, 'أرض')) ? 'land' : ($payload['property_type'] ?? 'building'));
        $payload['property_type'] = $ptype;
        $payload['usage_type'] = 'residential';
        $payload['management_type'] = $payload['management_type'] ?? 'managed';

        $district = $payload['district'] ?? null;
        $city = $payload['city'] ?? null;
        $plot = $payload['plot_number'] ?? null;
        $plan = $payload['plan_number'] ?? null;
        $unitNumber = $payload['deed_unit_number'] ?? null;
        $payload['name'] = deed_v2_clean(implode(' - ', array_filter([
            $ptype === 'apartment' && $unitNumber ? 'شقة رقم ' . $unitNumber : ($ptype === 'land' ? 'قطعة أرض' : 'عقار'),
            $district,
            $city,
        ]))) ?: ($payload['name'] ?? null);
        $payload['address'] = implode('، ', array_filter([
            $district ? 'حي ' . deed_v2_clean($district, 80) : null,
            deed_v2_clean($city, 80),
            $plan ? 'مخطط ' . deed_v2_clean($plan, 100) : null,
            $plot ? 'قطعة ' . deed_v2_clean($plot, 100) : null,
            $unitNumber ? 'شقة رقم ' . deed_v2_clean($unitNumber, 50) : null,
        ]));
        $payload['deed_raw_excerpt'] = mb_substr($text, 0, 6000);

        return $payload;
    }
}

if (!function_exists('deed_visual_handle_v2')) {
    function deed_visual_handle_v2(\Illuminate\Http\Request $request)
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:pdf', 'max:20480'],
            'owner_id' => ['nullable', 'integer', 'exists:owners,id'],
            'apply' => ['nullable', 'boolean'],
        ]);
        $uploaded = $request->file('file');
        $payload = deed_visual_payload_v2($uploaded->getRealPath());
        $doc = $payload['document_number'] ?? $payload['deed_number'] ?? null;
        if (function_exists('deed_route_save_payload') && $doc) {
            return deed_route_save_payload($request, $payload, (string) $doc, ($payload['property_type'] ?? '') === 'apartment' ? 'apartment' : 'property');
        }
        return function_exists('deed_visual_handle') ? deed_visual_handle($request) : response()->json(['status' => 'error', 'message' => 'تعذر قراءة الصك.'], 422);
    }
}
