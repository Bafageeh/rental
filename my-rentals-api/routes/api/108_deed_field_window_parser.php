<?php

/*
|--------------------------------------------------------------------------
| Layout-preserving deed parser
|--------------------------------------------------------------------------
| Electronic deeds use a fixed visual layout: green label rows and beige
| value rows. Plain PDF text extraction can scramble RTL Arabic order, so this
| parser first tries pdftotext -layout, then reads field rows by column index.
| A green row is treated as a table only when more than one value row follows.
*/

if (!function_exists('deed_w_digits')) {
    function deed_w_digits(string $text): string
    {
        return strtr($text, [
            '٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9',
            '۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9',
        ]);
    }
}

if (!function_exists('deed_w_clean')) {
    function deed_w_clean($value, int $max = 255): ?string
    {
        $value = deed_w_digits((string) $value);
        $value = preg_replace('/[\x{200E}\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}]/u', '', $value) ?? $value;
        $value = trim(preg_replace('/\s+/u', ' ', str_replace('ـ', '', $value)) ?? $value, " \t\n\r\0\x0B:-،؛");
        if ($value === '' || $value === '-') return null;
        return mb_substr($value, 0, $max);
    }
}

if (!function_exists('deed_w_num')) {
    function deed_w_num($value): ?string
    {
        $n = preg_replace('/[^0-9.]/', '', deed_w_digits((string) $value));
        return $n === '' ? null : $n;
    }
}

if (!function_exists('deed_w_extract_text')) {
    function deed_w_extract_text(string $filePath): array
    {
        $smalot = '';
        try {
            $smalot = (new \Smalot\PdfParser\Parser())->parseFile($filePath)->getText();
        } catch (\Throwable $e) {
            $smalot = '';
        }

        $layout = '';
        if (function_exists('shell_exec')) {
            foreach (['pdftotext', '/usr/bin/pdftotext', '/usr/local/bin/pdftotext'] as $bin) {
                $cmd = $bin . ' -layout -enc UTF-8 ' . escapeshellarg($filePath) . ' - 2>/dev/null';
                $out = @shell_exec($cmd);
                if (is_string($out) && mb_strlen(trim($out)) > 100) {
                    $layout = $out;
                    break;
                }
            }
        }

        $chosen = mb_strlen($layout) > mb_strlen($smalot) ? $layout : ($layout ?: $smalot);
        return [deed_w_digits((string) $chosen), $layout ? 'pdftotext_layout' : 'smalot_pdf_parser'];
    }
}

if (!function_exists('deed_w_raw_lines')) {
    function deed_w_raw_lines(string $text): array
    {
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $text = preg_replace('/[\x{200E}\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}]/u', '', $text) ?? $text;
        $lines = preg_split('/\n/u', $text) ?: [];
        return array_values(array_filter(array_map(fn ($line) => rtrim((string) $line), $lines), fn ($line) => trim($line) !== ''));
    }
}

if (!function_exists('deed_w_flat_lines')) {
    function deed_w_flat_lines(array $rawLines): array
    {
        return array_values(array_filter(array_map(fn ($line) => deed_w_clean($line, 2000), $rawLines), fn ($line) => $line !== null));
    }
}

if (!function_exists('deed_w_has_tokens')) {
    function deed_w_has_tokens(string $line, array $tokens): bool
    {
        $line = deed_w_clean($line, 2000) ?? '';
        foreach ($tokens as $token) {
            if (mb_strpos($line, $token) === false) return false;
        }
        return true;
    }
}

if (!function_exists('deed_w_split_cols')) {
    function deed_w_split_cols(string $line): array
    {
        $line = deed_w_digits($line);
        $parts = preg_split('/\s{2,}/u', trim($line)) ?: [];
        if (count($parts) <= 1) {
            $parts = preg_split('/\s+/u', trim($line)) ?: [];
        }
        return array_values(array_filter(array_map(fn ($part) => deed_w_clean($part, 500), $parts), fn ($part) => $part !== null));
    }
}

if (!function_exists('deed_w_header_index')) {
    function deed_w_header_index(array $lines, array $tokens): ?int
    {
        foreach ($lines as $index => $line) {
            if (deed_w_has_tokens($line, $tokens)) return $index;
        }
        return null;
    }
}

if (!function_exists('deed_w_next_data_line')) {
    function deed_w_next_data_line(array $lines, int $headerIndex, int $maxLookAhead = 5): ?string
    {
        for ($i = $headerIndex + 1; $i <= min(count($lines) - 1, $headerIndex + $maxLookAhead); $i++) {
            $line = deed_w_clean($lines[$i], 1500) ?? '';
            if ($line === '') continue;
            if (preg_match('/رقم\s*الوثيقة|تاريخ\s*الوثيقة|الحالة|القيود|نوع\s*العقار|الحد\s+النوع|نسبة\s*التملك/u', $line)) continue;
            return $lines[$i];
        }
        return null;
    }
}

if (!function_exists('deed_w_value_for_label')) {
    function deed_w_value_for_label(array $headerCols, array $valueCols, string $label): ?string
    {
        foreach ($headerCols as $index => $header) {
            if (mb_strpos($header, $label) !== false) {
                return $valueCols[$index] ?? $valueCols[count($valueCols) - 1 - $index] ?? null;
            }
        }
        return null;
    }
}

if (!function_exists('deed_w_parse_pair_row')) {
    function deed_w_parse_pair_row(array $rawLines, array $tokens): array
    {
        $idx = deed_w_header_index($rawLines, $tokens);
        if ($idx === null) return [[], []];
        $headerCols = deed_w_split_cols($rawLines[$idx]);
        $dataLine = deed_w_next_data_line($rawLines, $idx);
        $valueCols = $dataLine ? deed_w_split_cols($dataLine) : [];
        return [$headerCols, $valueCols];
    }
}

if (!function_exists('deed_w_set')) {
    function deed_w_set(array &$payload, string $key, $value, int $max = 255, bool $skipNoValue = false): void
    {
        $clean = deed_w_clean($value, $max);
        if ($clean === null) return;
        if ($skipNoValue && $clean === 'لا يوجد') return;
        $payload[$key] = $clean;
    }
}

if (!function_exists('deed_w_parse_document')) {
    function deed_w_parse_document(array $rawLines, string $joined, array &$payload): void
    {
        [$h, $v] = deed_w_parse_pair_row($rawLines, ['رقم الوثيقة', 'تاريخ الوثيقة']);
        $doc = deed_w_value_for_label($h, $v, 'رقم الوثيقة');
        $date = deed_w_value_for_label($h, $v, 'تاريخ الوثيقة');
        if (!$doc && preg_match('/رقم\s*الوثيقة\s+([0-9]{5,})/u', $joined, $m)) $doc = $m[1];
        if (!$date && preg_match('/تاريخ\s*الوثيقة\s+([0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2})/u', $joined, $m)) $date = $m[1];
        if (!$doc && preg_match('/\b([0-9]{12})\b/u', $joined, $m)) $doc = $m[1];
        if ($doc) $payload['deed_number'] = $payload['document_number'] = deed_w_num($doc) ?: deed_w_clean($doc);
        if ($date && preg_match('/[0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2}/u', $date, $m)) $payload['document_date_hijri'] = $m[0];
    }
}

if (!function_exists('deed_w_parse_status')) {
    function deed_w_parse_status(array $rawLines, string $joined, array &$payload): void
    {
        [$h, $v] = deed_w_parse_pair_row($rawLines, ['القيود', 'الحالة']);
        $restrictions = deed_w_value_for_label($h, $v, 'القيود');
        $status = deed_w_value_for_label($h, $v, 'الحالة');
        if (!$status && preg_match('/(فعال|غير\s*فعال|ملغي|منتهي)/u', implode(' ', $v), $m)) $status = $m[1];
        if (!$restrictions && preg_match('/(لا\s*يوجد\s*قيود|مرهون|قيد[^\s]*)/u', implode(' ', $v), $m)) $restrictions = $m[1];
        if (!$status && preg_match('/الحالة\s+(فعال|غير\s*فعال|ملغي|منتهي)/u', $joined, $m)) $status = $m[1];
        if (!$restrictions && preg_match('/القيود\s+(لا\s*يوجد\s*قيود|مرهون|قيد[^\s]*)/u', $joined, $m)) $restrictions = $m[1];
        deed_w_set($payload, 'document_restrictions', $restrictions);
        deed_w_set($payload, 'document_status', $status, 100);
    }
}

if (!function_exists('deed_w_parse_prev_area')) {
    function deed_w_parse_prev_area(array $rawLines, string $joined, array &$payload): void
    {
        [$h, $v] = deed_w_parse_pair_row($rawLines, ['تاريخ الوثيقة السابقة', 'المساحة']);
        $prevDate = deed_w_value_for_label($h, $v, 'تاريخ الوثيقة السابقة');
        $area = deed_w_value_for_label($h, $v, 'المساحة');
        if (!$prevDate && preg_match('/تاريخ\s*الوثيقة\s*السابقة\s+([0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2})/u', $joined, $m)) $prevDate = $m[1];
        if (!$area && preg_match('/المساحة\s+([0-9]+(?:\.[0-9]+)?)/u', $joined, $m)) $area = $m[1];
        if ($prevDate && preg_match('/[0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2}/u', $prevDate, $m)) $payload['previous_document_date_hijri'] = $m[0];
        if ($area) $payload['property_area'] = deed_w_num($area);
    }
}

if (!function_exists('deed_w_parse_operation')) {
    function deed_w_parse_operation(array $rawLines, string $joined, array &$payload): void
    {
        [$h, $v] = deed_w_parse_pair_row($rawLines, ['نوع العملية', 'رقم الوثيقة السابقة']);
        $operation = deed_w_value_for_label($h, $v, 'نوع العملية');
        $prevNo = deed_w_value_for_label($h, $v, 'رقم الوثيقة السابقة');
        if (!$operation && preg_match('/(تحديث\s*\/\s*تعديل|رهن|صفقة|فرز|تحديث|تعديل)/u', implode(' ', $v) . ' ' . $joined, $m)) $operation = $m[1];
        if (!$prevNo && preg_match('/رقم\s*الوثيقة\s*السابقة\s+([0-9][0-9\s\/\-\p{Arabic}]*)/u', $joined, $m)) $prevNo = $m[1];
        deed_w_set($payload, 'operation_type', $operation, 100);
        deed_w_set($payload, 'previous_document_number', $prevNo, 150);
    }
}

if (!function_exists('deed_w_parse_owner')) {
    function deed_w_parse_owner(array $rawLines, array &$payload): void
    {
        [$h, $v] = deed_w_parse_pair_row($rawLines, ['رقم الهوية', 'الاسم', 'الجنسية']);
        $id = deed_w_value_for_label($h, $v, 'رقم الهوية');
        $name = deed_w_value_for_label($h, $v, 'الاسم');
        $nationality = deed_w_value_for_label($h, $v, 'الجنسية');
        $percent = deed_w_value_for_label($h, $v, 'نسبة التملك');
        $line = implode(' ', $v);
        if (!$id && preg_match('/([0-9]{6,})/u', $line, $m)) $id = $m[1];
        if (!$nationality && preg_match('/(سعودي|سعودية)/u', $line, $m)) $nationality = $m[1];
        if (!$percent && preg_match('/([0-9]+)\s*%/u', $line, $m)) $percent = $m[1];
        if (!$name && $id) {
            $name = trim(preg_replace('/' . preg_quote((string)$id, '/') . '|سعودي|سعودية|[0-9]+\s*%/u', ' ', $line) ?? '');
        }
        deed_w_set($payload, 'deed_owner_identifier', $id);
        deed_w_set($payload, 'deed_owner_name', $name);
        deed_w_set($payload, 'deed_owner_nationality', $nationality);
        if ($percent) $payload['deed_ownership_percentage'] = deed_w_num($percent);
    }
}

if (!function_exists('deed_w_parse_property')) {
    function deed_w_parse_property(array $rawLines, string $joined, array &$payload): void
    {
        [$h, $v] = deed_w_parse_pair_row($rawLines, ['رقم الهوية العقارية', 'نوع العقار']);
        $identity = deed_w_value_for_label($h, $v, 'رقم الهوية العقارية');
        $type = deed_w_value_for_label($h, $v, 'نوع العقار');
        $area = deed_w_value_for_label($h, $v, 'مساحة العقار');
        $usage = deed_w_value_for_label($h, $v, 'نوع الاستخدام');
        $line = implode(' ', $v);
        if (!$identity && preg_match('/([0-9]{8,}|لا\s*يوجد)/u', $line, $m)) $identity = $m[1];
        if (!$type && preg_match('/(قطعة\s*الأرض|قطعة\s*ارض|قطعة\s*أرض|شقة|فيلا|عمارة|أرض|ارض)/u', $line, $m)) $type = $m[1];
        if (!$area && preg_match('/([0-9]+(?:\.[0-9]+)?)/u', $line, $m)) $area = $m[1];
        if (!$usage && preg_match('/(سكني|تجاري|لا\s*يوجد)/u', $line, $m)) $usage = $m[1];
        $payload['real_estate_identity_number'] = $identity === 'لا يوجد' ? null : deed_w_clean($identity);
        deed_w_set($payload, 'deed_property_type_text', $type, 100);
        if ($area) $payload['property_area'] = deed_w_num($area);
        deed_w_set($payload, 'deed_usage_text', $usage, 100);
    }
}

if (!function_exists('deed_w_known_city')) {
    function deed_w_known_city(string &$line): ?string
    {
        foreach (['جدة', 'مكة', 'الرياض', 'المدينة', 'الدمام', 'الطائف', 'ينبع', 'الخبر', 'تبوك', 'أبها', 'جازان', 'حائل'] as $city) {
            if (preg_match('/^' . preg_quote($city, '/') . '(?:\s|$)/u', $line)) {
                $line = trim(preg_replace('/^' . preg_quote($city, '/') . '\s*/u', '', $line) ?? $line);
                return $city;
            }
            if (preg_match('/(?:^|\s)' . preg_quote($city, '/') . '$/u', $line)) {
                $line = trim(preg_replace('/\s*' . preg_quote($city, '/') . '$/u', '', $line) ?? $line);
                return $city;
            }
        }
        return null;
    }
}

if (!function_exists('deed_w_parse_location')) {
    function deed_w_parse_location(array $rawLines, array &$payload): void
    {
        [$h, $v] = deed_w_parse_pair_row($rawLines, ['رقم القطعة', 'رقم المخطط', 'الحي', 'المدينة']);
        $plot = deed_w_value_for_label($h, $v, 'رقم القطعة');
        $plan = deed_w_value_for_label($h, $v, 'رقم المخطط');
        $district = deed_w_value_for_label($h, $v, 'الحي');
        $city = deed_w_value_for_label($h, $v, 'المدينة');
        $line = implode(' ', $v);
        if (!$city) $city = deed_w_known_city($line);
        foreach (['أبحر الشمالية', 'ابحر الشمالية', 'أبحر الجنوبية', 'ابحر الجنوبية', 'الصفا', 'الورود', 'بني مالك', 'أم السلم', 'النزهة', 'الروضة', 'الفيصلية'] as $known) {
            if (!$district && preg_match('/(?:^|\s)' . preg_quote($known, '/') . '(?:\s|$)/u', $line)) $district = $known;
        }
        if (!$plot && preg_match('/([0-9]+(?:\s*\/\s*[^\s]+)*)/u', $line, $m)) $plot = $m[1];
        deed_w_set($payload, 'plot_number', $plot, 100);
        deed_w_set($payload, 'plan_number', $plan, 150);
        deed_w_set($payload, 'district', $district, 100);
        deed_w_set($payload, 'city', $city, 80);
    }
}

if (!function_exists('deed_w_parse_boundaries')) {
    function deed_w_parse_boundaries(array $rawLines, array &$payload): void
    {
        $idx = deed_w_header_index($rawLines, ['الحد', 'النوع', 'الطول']);
        if ($idx === null) return;
        $headerCols = deed_w_split_cols($rawLines[$idx]);
        $rows = [];
        for ($i = $idx + 1; $i < min(count($rawLines), $idx + 10); $i++) {
            $flat = deed_w_clean($rawLines[$i], 1000) ?? '';
            if (preg_match('/^(الرقم|التاريخ|صدرت|الصفحة)\b/u', $flat)) break;
            if (!preg_match('/شمال|جنوب|شرق|غرب/u', $flat)) continue;
            $cols = deed_w_split_cols($rawLines[$i]);
            $directionText = deed_w_value_for_label($headerCols, $cols, 'الحد') ?: $cols[0] ?? null;
            $type = deed_w_value_for_label($headerCols, $cols, 'النوع') ?: $cols[1] ?? null;
            $desc = deed_w_value_for_label($headerCols, $cols, 'وصف') ?: $cols[2] ?? null;
            $length = deed_w_value_for_label($headerCols, $cols, 'الطول') ?: $cols[3] ?? null;
            $direction = match (true) {
                str_contains((string)$directionText, 'شمال') => 'north',
                str_contains((string)$directionText, 'جنوب') => 'south',
                str_contains((string)$directionText, 'شرق') => 'east',
                str_contains((string)$directionText, 'غرب') => 'west',
                default => null,
            };
            if ($direction) $rows[] = ['direction' => $direction, 'type' => deed_w_clean($type, 100), 'description' => deed_w_clean($desc, 255), 'length' => deed_w_num($length)];
        }
        if (count($rows) <= 1) return;
        $summary = [];
        foreach ($rows as $row) {
            $dir = $row['direction'];
            $label = ['north'=>'شمالا','south'=>'جنوبا','east'=>'شرقا','west'=>'غربا'][$dir] ?? $dir;
            $payload['deed_' . $dir . '_boundary_type'] = $row['type'];
            $payload['deed_' . $dir . '_boundary_description'] = $row['description'];
            $payload['deed_' . $dir . '_boundary_length'] = $row['length'];
            $summary[] = $label . ': ' . trim(($row['type'] ?? '') . ' ' . ($row['description'] ?? '') . ' طول ' . ($row['length'] ?? '') . ' م');
        }
        $payload['deed_boundaries_description'] = implode('. ', $summary) . '.';
    }
}

if (!function_exists('deed_window_payload')) {
    function deed_window_payload(string $filePath): array
    {
        [$text, $engine] = deed_w_extract_text($filePath);
        $rawLines = deed_w_raw_lines($text);
        $flatLines = deed_w_flat_lines($rawLines);
        $joined = implode(' ', $flatLines);
        $payload = [];

        deed_w_parse_document($rawLines, $joined, $payload);
        deed_w_parse_status($rawLines, $joined, $payload);
        deed_w_parse_prev_area($rawLines, $joined, $payload);
        deed_w_parse_operation($rawLines, $joined, $payload);
        deed_w_parse_owner($rawLines, $payload);
        deed_w_parse_property($rawLines, $joined, $payload);
        deed_w_parse_location($rawLines, $payload);
        deed_w_parse_boundaries($rawLines, $payload);

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
        $payload['deed_parser_engine'] = $engine;
        $payload['deed_parse_quality'] = count(array_filter($payload, fn($v) => $v !== null && $v !== ''));
        $payload['deed_raw_excerpt'] = mb_substr($text, 0, 6000);
        return $payload;
    }
}

if (!function_exists('deed_window_save_payload')) {
    function deed_window_save_payload(\Illuminate\Http\Request $request, array $payload, string $doc, string $assetKind = 'property')
    {
        foreach (array_keys($payload) as $field) {
            if ($request->filled($field)) $payload[$field] = $request->input($field);
        }
        if (!$request->boolean('apply')) {
            return response()->json(['status' => 'ok', 'message' => 'تم قراءة الصك. راجع البيانات قبل الحفظ.', 'asset_kind' => $assetKind, 'extracted_data' => ['property' => $payload]]);
        }
        $uploaded = $request->file('file');
        $ownerId = $request->filled('owner_id') ? (int) $request->input('owner_id') : (int) (\App\Models\Owner::where('type', 'self')->value('id') ?: \App\Models\Owner::create(['name' => 'أملاكي الخاصة', 'type' => 'self'])->id);
        $payload['owner_id'] = $ownerId;
        $payload['notes'] = 'تم إنشاء/تحديث هذا العقار من رفع صك الملكية.';
        $data = array_filter($payload, fn($value, $key) => \Illuminate\Support\Facades\Schema::hasColumn('properties', $key), ARRAY_FILTER_USE_BOTH);
        $property = \App\Models\Property::where('document_number', $doc)->orWhere('deed_number', $doc)->first();
        $updated = (bool) $property;
        if ($property) $property->fill($data)->save(); else $property = \App\Models\Property::create($data);
        $path = $uploaded->store('property-deeds', 'public');
        $file = \App\Models\PropertyFile::create(['property_id' => $property->id, 'file_name' => $uploaded->getClientOriginalName(), 'file_path' => $path, 'file_type' => $uploaded->getClientMimeType(), 'file_size' => $uploaded->getSize(), 'category' => 'deed', 'notes' => 'صك ملكية محفوظ ضمن مستندات العقار ويمكن للمالك تنزيله مستقبلًا.']);
        return response()->json(['status' => 'ok', 'message' => $updated ? 'تم تحديث العقار الموجود بنفس رقم الصك وحفظ الصك ضمن مستنداته.' : 'تم إنشاء العقار من الصك وحفظ الصك ضمن مستندات العقار.', 'mode' => $updated ? 'updated' : 'created', 'asset_kind' => $assetKind, 'extracted_data' => ['property' => $payload], 'property' => $property->fresh()->load('owner'), 'file' => $file], $updated ? 200 : 201);
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
        return deed_window_save_payload($request, $payload, (string) $doc, ($payload['property_type'] ?? '') === 'apartment' ? 'apartment' : 'property');
    }
}
