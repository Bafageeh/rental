<?php

/*
|--------------------------------------------------------------------------
| Generic electronic deed model parser v2
|--------------------------------------------------------------------------
| Reads the common Saudi deed layout where labels are green and values are
| beige. It supports both PDF text orders:
| - label row then value row
| - reversed value/header order caused by RTL PDF extraction
| A green row becomes a table only when more than one beige row follows it.
*/

if (!function_exists('deed_v2_clean')) {
    function deed_v2_clean($value, int $max = 255): ?string
    {
        $value = trim((string) $value);
        if ($value === '' || $value === '-') return null;
        $value = preg_replace('/[\x{200E}\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}]/u', '', $value) ?? $value;
        $value = trim(preg_replace('/\s+/u', ' ', $value) ?? $value, " \t\n\r\0\x0B:-،؛");
        if ($value === '') return null;
        return mb_substr($value, 0, $max);
    }
}

if (!function_exists('deed_v2_num')) {
    function deed_v2_num($value): ?string
    {
        $n = preg_replace('/[^0-9.]/', '', (string) $value);
        return $n === '' ? null : $n;
    }
}

if (!function_exists('deed_v2_norm')) {
    function deed_v2_norm(string $text): string
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

if (!function_exists('deed_v2_lines')) {
    function deed_v2_lines(string $text): array
    {
        return array_values(array_filter(array_map(
            fn ($line) => deed_v2_clean($line, 1200),
            preg_split('/\n/u', $text) ?: []
        ), fn ($line) => $line !== null && $line !== ''));
    }
}

if (!function_exists('deed_v2_has_tokens')) {
    function deed_v2_has_tokens(string $line, array $tokens): bool
    {
        foreach ($tokens as $token) {
            if (mb_strpos($line, $token) === false) return false;
        }
        return true;
    }
}

if (!function_exists('deed_v2_next_value_row')) {
    function deed_v2_next_value_row(array $lines, array $tokens, int $lookAhead = 4): ?string
    {
        foreach ($lines as $index => $line) {
            if (!deed_v2_has_tokens($line, $tokens)) continue;
            for ($i = $index + 1; $i <= min(count($lines) - 1, $index + $lookAhead); $i++) {
                $candidate = deed_v2_clean($lines[$i], 1200);
                if (!$candidate) continue;
                $looksLikeHeader = preg_match('/رقم|تاريخ|الحالة|القيود|نوع|مساحة|المدينة|الحي|الحد|الطول|الجنسية|نسبة/u', $candidate);
                $hasUsefulValue = preg_match('/[0-9]|لا\s*يوجد|فعال|سعودي|سعودية|جدة|مكة|الرياض|قطعة|شقة|أرض|ارض|شارع/u', $candidate);
                if ($hasUsefulValue && (!$looksLikeHeader || preg_match('/^[0-9]|^لا\s*يوجد|^فعال|^مرهون|^سعودي|^سعودية/u', $candidate))) {
                    return $candidate;
                }
            }
        }
        return null;
    }
}

if (!function_exists('deed_v2_first_line_matching')) {
    function deed_v2_first_line_matching(array $lines, string $pattern): ?string
    {
        foreach ($lines as $line) {
            if (preg_match($pattern, $line)) return $line;
        }
        return null;
    }
}

if (!function_exists('deed_v2_set')) {
    function deed_v2_set(array &$payload, string $key, $value, int $max = 255, bool $keepNoValue = true): void
    {
        $clean = deed_v2_clean($value, $max);
        if ($clean === null) return;
        if ($clean === 'لا يوجد' && !$keepNoValue) return;
        $payload[$key] = $clean;
    }
}

if (!function_exists('deed_v2_city_from_start_or_end')) {
    function deed_v2_city_from_start_or_end(string &$row): ?string
    {
        $cities = ['جدة', 'مكة', 'الرياض', 'المدينة', 'الدمام', 'الطائف', 'ينبع', 'الخبر', 'تبوك', 'أبها', 'جازان', 'حائل'];
        foreach ($cities as $city) {
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

if (!function_exists('deed_v2_extract_location_row')) {
    function deed_v2_extract_location_row(?string $row): array
    {
        $row = deed_v2_clean($row, 800);
        if (!$row) return [];

        $city = deed_v2_city_from_start_or_end($row);
        $row = trim($row);
        $plot = null;
        $district = null;
        $plan = null;

        $knownDistricts = ['أبحر الشمالية', 'ابحر الشمالية', 'أبحر الجنوبية', 'ابحر الجنوبية', 'الصفا', 'الورود', 'بني مالك', 'أم السلم', 'ام السلم', 'طيبة', 'الشاطئ', 'النزهة', 'الروضة', 'الفيصلية'];

        $startsWithPlot = preg_match('/^([0-9]+(?:\s*\/\s*[^\s]+)*)\s+(.+)$/u', $row, $startMatch);
        if ($startsWithPlot) {
            $plot = deed_v2_clean($startMatch[1], 100);
            $rest = trim($startMatch[2]);
            foreach ($knownDistricts as $candidate) {
                if (preg_match('/\s*' . preg_quote($candidate, '/') . '$/u', $rest)) {
                    $district = $candidate;
                    $plan = trim(preg_replace('/\s*' . preg_quote($candidate, '/') . '$/u', '', $rest) ?? $rest);
                    break;
                }
            }
            if (!$district && preg_match('/^(.*)\s+([\p{Arabic}]+)$/u', $rest, $m)) {
                $plan = trim($m[1]);
                $district = $m[2];
            }
        } else {
            if (preg_match('/(.+)\s+([0-9]+(?:\s*\/\s*[^\s]+)*)$/u', $row, $endMatch)) {
                $plot = deed_v2_clean($endMatch[2], 100);
                $rest = trim($endMatch[1]);
            } else {
                $rest = $row;
            }
            foreach ($knownDistricts as $candidate) {
                if (preg_match('/^' . preg_quote($candidate, '/') . '(?:\s|$)/u', $rest)) {
                    $district = $candidate;
                    $plan = trim(preg_replace('/^' . preg_quote($candidate, '/') . '\s*/u', '', $rest) ?? $rest);
                    break;
                }
            }
            if (!$district && preg_match('/^([\p{Arabic}]+(?:\s+[\p{Arabic}]+)?)\s+(.*)$/u', $rest, $m)) {
                $district = $m[1];
                $plan = trim($m[2]);
            }
        }

        return [
            'plot_number' => deed_v2_clean($plot, 100),
            'plan_number' => deed_v2_clean($plan, 150),
            'district' => deed_v2_clean($district, 100),
            'city' => deed_v2_clean($city, 80),
        ];
    }
}

if (!function_exists('deed_v2_parse_owner_row')) {
    function deed_v2_parse_owner_row(array $lines, array &$payload): void
    {
        foreach ($lines as $line) {
            if (preg_match('/^([0-9]{6,})\s+(.+?)\s+(سعودي|سعودية)\s+([0-9]+)\s*%?$/u', $line, $m)) {
                deed_v2_set($payload, 'deed_owner_identifier', $m[1]);
                deed_v2_set($payload, 'deed_owner_name', $m[2]);
                deed_v2_set($payload, 'deed_owner_nationality', $m[3]);
                $payload['deed_ownership_percentage'] = deed_v2_num($m[4]);
                return;
            }
            if (preg_match('/([0-9]{6,}).*?(سعودي|سعودية).*?([0-9]+)\s*%/u', $line, $m)) {
                deed_v2_set($payload, 'deed_owner_identifier', $m[1]);
                deed_v2_set($payload, 'deed_owner_nationality', $m[2]);
                $payload['deed_ownership_percentage'] = deed_v2_num($m[3]);
                $name = trim(preg_replace('/' . preg_quote($m[1], '/') . '|سعودي|سعودية|' . preg_quote($m[3], '/') . '\s*%?/u', ' ', $line) ?? '');
                deed_v2_set($payload, 'deed_owner_name', $name);
                return;
            }
        }
    }
}

if (!function_exists('deed_v2_parse_property_main_row')) {
    function deed_v2_parse_property_main_row(?string $row, array &$payload): void
    {
        $row = deed_v2_clean($row, 800);
        if (!$row) return;
        if (!preg_match('/\b([0-9]+(?:\.[0-9]+)?)\b/u', $row, $areaMatch, PREG_OFFSET_CAPTURE)) return;

        $area = $areaMatch[1][0];
        $before = trim(mb_substr($row, 0, $areaMatch[1][1]));
        $after = trim(mb_substr($row, $areaMatch[1][1] + mb_strlen($area)));
        $payload['property_area'] = deed_v2_num($area);

        if (preg_match('/^(لا\s*يوجد)\s+(.+)$/u', $before, $m)) {
            $payload['real_estate_identity_number'] = null;
            deed_v2_set($payload, 'deed_property_type_text', $m[2], 100);
        } elseif (preg_match('/^([0-9]{5,})\s+(.+)$/u', $before, $m)) {
            deed_v2_set($payload, 'real_estate_identity_number', $m[1]);
            deed_v2_set($payload, 'deed_property_type_text', $m[2], 100);
        } elseif (preg_match('/^(.+)\s+(لا\s*يوجد|[0-9]{5,})$/u', $before, $m)) {
            deed_v2_set($payload, 'deed_property_type_text', $m[1], 100);
            $payload['real_estate_identity_number'] = $m[2] === 'لا يوجد' ? null : deed_v2_clean($m[2]);
        } else {
            deed_v2_set($payload, 'deed_property_type_text', $before, 100);
        }
        deed_v2_set($payload, 'deed_usage_text', $after, 100);
    }
}

if (!function_exists('deed_v2_boundary_row')) {
    function deed_v2_boundary_row(string $line): ?array
    {
        $line = deed_v2_clean($line, 800);
        if (!$line || !preg_match('/^(شمالا|شمالاً|شمال|جنوبا|جنوباً|جنوب|شرقا|شرقاً|شرق|غربا|غرباً|غرب)\s+(.+)$/u', $line, $m)) return null;
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
        return $type ? ['direction' => $direction, 'type' => $type, 'description' => $description, 'length' => deed_v2_num($length)] : null;
    }
}

if (!function_exists('deed_v2_save_payload')) {
    function deed_v2_save_payload(\Illuminate\Http\Request $request, array $payload, string $doc, string $assetKind = 'property')
    {
        foreach (array_keys($payload) as $field) {
            if ($request->filled($field)) $payload[$field] = $request->input($field);
        }

        if (!$request->boolean('apply')) {
            return response()->json(['status' => 'ok', 'message' => 'تم قراءة الصك. راجع البيانات قبل الحفظ.', 'asset_kind' => $assetKind, 'extracted_data' => ['property' => $payload]]);
        }

        $uploaded = $request->file('file');
        $ownerId = $request->filled('owner_id')
            ? (int) $request->input('owner_id')
            : (int) (\App\Models\Owner::where('type', 'self')->value('id') ?: \App\Models\Owner::create(['name' => 'أملاكي الخاصة', 'type' => 'self'])->id);
        $payload['owner_id'] = $ownerId;
        $payload['notes'] = 'تم إنشاء/تحديث هذا العقار من رفع صك الملكية.';
        $data = array_filter($payload, fn($value, $key) => \Illuminate\Support\Facades\Schema::hasColumn('properties', $key), ARRAY_FILTER_USE_BOTH);
        $property = \App\Models\Property::where('document_number', $doc)->orWhere('deed_number', $doc)->first();
        $updated = (bool) $property;
        if ($property) {
            $property->fill($data)->save();
        } else {
            $property = \App\Models\Property::create($data);
        }
        $path = $uploaded->store('property-deeds', 'public');
        $file = \App\Models\PropertyFile::create(['property_id' => $property->id, 'file_name' => $uploaded->getClientOriginalName(), 'file_path' => $path, 'file_type' => $uploaded->getClientMimeType(), 'file_size' => $uploaded->getSize(), 'category' => 'deed', 'notes' => 'صك ملكية محفوظ ضمن مستندات العقار ويمكن للمالك تنزيله مستقبلًا.']);

        return response()->json(['status' => 'ok', 'message' => $updated ? 'تم تحديث العقار الموجود بنفس رقم الصك وحفظ الصك ضمن مستنداته.' : 'تم إنشاء العقار من الصك وحفظ الصك ضمن مستندات العقار.', 'mode' => $updated ? 'updated' : 'created', 'asset_kind' => $assetKind, 'extracted_data' => ['property' => $payload], 'property' => $property->fresh()->load('owner'), 'file' => $file], $updated ? 200 : 201);
    }
}

if (!function_exists('deed_visual_payload_v2')) {
    function deed_visual_payload_v2(string $filePath): array
    {
        $text = deed_v2_norm((new \Smalot\PdfParser\Parser())->parseFile($filePath)->getText());
        $payload = [];
        $lines = deed_v2_lines($text);

        $docDateRow = deed_v2_next_value_row($lines, ['رقم الوثيقة', 'تاريخ الوثيقة']) ?: deed_v2_first_line_matching($lines, '/[0-9]{5,}.*[0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2}|[0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2}.*[0-9]{5,}/u');
        if ($docDateRow && preg_match('/([0-9]{5,})/u', $docDateRow, $dm)) $payload['deed_number'] = $payload['document_number'] = deed_v2_clean($dm[1]);
        if ($docDateRow && preg_match('/([0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2})/u', $docDateRow, $hm)) $payload['document_date_hijri'] = deed_v2_clean($hm[1], 50);
        if (empty($payload['document_number']) && preg_match('/\b([0-9]{12})\b/u', $text, $m)) $payload['deed_number'] = $payload['document_number'] = deed_v2_clean($m[1]);

        $statusRow = deed_v2_next_value_row($lines, ['القيود', 'الحالة']);
        if ($statusRow) {
            if (preg_match('/^(.*?)\s+(فعال|غير\s*فعال|ملغي|منتهي)$/u', $statusRow, $m)) {
                $payload['document_restrictions'] = deed_v2_clean($m[1]);
                $payload['document_status'] = deed_v2_clean($m[2], 100);
            } elseif (preg_match('/^(فعال|غير\s*فعال|ملغي|منتهي)\s+(.+)$/u', $statusRow, $m)) {
                $payload['document_status'] = deed_v2_clean($m[1], 100);
                $payload['document_restrictions'] = deed_v2_clean($m[2]);
            }
        }

        $prevAreaRow = deed_v2_next_value_row($lines, ['تاريخ الوثيقة السابقة', 'المساحة']);
        if ($prevAreaRow) {
            if (preg_match('/([0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2})/u', $prevAreaRow, $m)) $payload['previous_document_date_hijri'] = deed_v2_clean($m[1], 50);
            preg_match_all('/[0-9]+(?:\.[0-9]+)?/u', $prevAreaRow, $nums);
            if (!empty($nums[0])) $payload['property_area'] = deed_v2_num(end($nums[0]));
        }

        $operationRow = deed_v2_next_value_row($lines, ['نوع العملية', 'رقم الوثيقة السابقة']);
        if ($operationRow && preg_match('/^(.*?)\s+([0-9][0-9\s\/\-\p{Arabic}]*)$/u', $operationRow, $m)) {
            $payload['operation_type'] = deed_v2_clean($m[1], 100);
            $payload['previous_document_number'] = deed_v2_clean($m[2], 150);
        }

        deed_v2_parse_owner_row($lines, $payload);
        deed_v2_parse_property_main_row(deed_v2_next_value_row($lines, ['رقم الهوية العقارية', 'نوع العقار']), $payload);

        $blockRow = deed_v2_next_value_row($lines, ['البلك', 'المجاورة']);
        if ($blockRow && preg_match('/^(.+?)\s+(.+)$/u', $blockRow, $m)) {
            $payload['block_number'] = trim($m[1]) === 'لا يوجد' ? null : deed_v2_clean($m[1], 100);
            $payload['deed_neighboring_part'] = deed_v2_clean($m[2], 100);
        }

        $modelRow = deed_v2_next_value_row($lines, ['الموقع', 'نموذج العقار']);
        if ($modelRow && preg_match('/^(.+?)\s+(.+)$/u', $modelRow, $m)) {
            $payload['deed_location_text'] = deed_v2_clean($m[1], 150);
            $payload['deed_property_model'] = deed_v2_clean($m[2], 150);
        }

        foreach (deed_v2_extract_location_row(deed_v2_next_value_row($lines, ['رقم القطعة', 'رقم المخطط', 'الحي', 'المدينة'])) as $key => $value) {
            if ($value !== null) $payload[$key] = $value;
        }

        foreach ($lines as $index => $line) {
            if (!deed_v2_has_tokens($line, ['الحد', 'النوع', 'الطول'])) continue;
            $rows = [];
            for ($i = $index + 1; $i < min(count($lines), $index + 8); $i++) {
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
            break;
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
        $payload['name'] = deed_v2_clean(implode(' - ', array_filter([$ptype === 'land' ? 'قطعة أرض' : 'عقار', $district, $city]))) ?: ($payload['document_number'] ? 'عقار صك ' . $payload['document_number'] : 'عقار من صك');
        $payload['address'] = implode('، ', array_filter([$district ? 'حي ' . deed_v2_clean($district, 80) : null, deed_v2_clean($city, 80), $plan ? 'مخطط ' . deed_v2_clean($plan, 100) : null, $plot ? 'قطعة ' . deed_v2_clean($plot, 100) : null]));
        $payload['deed_raw_excerpt'] = mb_substr($text, 0, 6000);

        return $payload;
    }
}

if (!function_exists('deed_visual_handle_v2')) {
    function deed_visual_handle_v2(\Illuminate\Http\Request $request)
    {
        $request->validate(['file' => ['required', 'file', 'mimes:pdf', 'max:20480'], 'owner_id' => ['nullable', 'integer', 'exists:owners,id'], 'apply' => ['nullable', 'boolean']]);
        $uploaded = $request->file('file');
        $payload = deed_visual_payload_v2($uploaded->getRealPath());
        $doc = $payload['document_number'] ?? $payload['deed_number'] ?? null;
        if (!$doc) return response()->json(['status' => 'error', 'message' => 'تعذر قراءة رقم الصك من الملف.'], 422);
        return deed_v2_save_payload($request, $payload, (string) $doc, ($payload['property_type'] ?? '') === 'apartment' ? 'apartment' : 'property');
    }
}
