<?php

use App\Models\Owner;
use App\Models\Property;
use App\Models\PropertyFile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Smalot\PdfParser\Parser;

if (!function_exists('deed_visual_norm')) {
    function deed_visual_norm(string $text): string
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

if (!function_exists('deed_visual_clean')) {
    function deed_visual_clean($value, int $max = 255): ?string
    {
        $value = trim((string) $value);
        if ($value === '' || $value === '-') return null;
        return mb_substr(trim(preg_replace('/\s+/u', ' ', $value) ?? $value, " \t\n\r\0\x0B:-،؛"), 0, $max);
    }
}

if (!function_exists('deed_visual_num')) {
    function deed_visual_num($value): ?string
    {
        $n = preg_replace('/[^0-9.]/', '', (string) $value);
        return $n === '' ? null : $n;
    }
}

if (!function_exists('deed_visual_lines')) {
    function deed_visual_lines(string $text): array
    {
        return array_values(array_filter(array_map(
            fn ($line) => deed_visual_clean($line, 1000),
            preg_split('/\n/u', $text) ?: []
        ), fn ($line) => $line !== null && $line !== ''));
    }
}

if (!function_exists('deed_visual_line_after')) {
    function deed_visual_line_after(array $lines, string $needle): ?string
    {
        foreach ($lines as $index => $line) {
            if (mb_strpos($line, $needle) !== false) {
                return $lines[$index + 1] ?? null;
            }
        }
        return null;
    }
}

if (!function_exists('deed_visual_extract_location')) {
    function deed_visual_extract_location(?string $row): array
    {
        $row = deed_visual_clean($row, 500);
        if (!$row) return [];

        $city = null;
        foreach (['جدة', 'مكة', 'الرياض', 'المدينة', 'الدمام', 'الطائف', 'ينبع', 'الخبر', 'تبوك', 'أبها'] as $knownCity) {
            if (preg_match('/(?:^|\s)' . preg_quote($knownCity, '/') . '$/u', $row)) {
                $city = $knownCity;
                $row = trim(preg_replace('/\s*' . preg_quote($knownCity, '/') . '$/u', '', $row) ?? $row);
                break;
            }
        }

        $parts = preg_split('/\s+/u', $row) ?: [];
        $plot = array_shift($parts);
        $tail = trim(implode(' ', $parts));
        $district = null;
        $plan = null;

        if ($tail !== '') {
            if (preg_match('/^(.*?)(?:\s+)([\p{Arabic}]+(?:\s+[\p{Arabic}]+)?)$/u', $tail, $m)) {
                $plan = deed_visual_clean($m[1], 150);
                $district = deed_visual_clean($m[2], 100);
                if ($district && preg_match('/^(ج|س|ع|د|هـ|و|المعدل)$/u', $district)) {
                    $plan = deed_visual_clean($tail, 150);
                    $district = null;
                }
            } else {
                $plan = deed_visual_clean($tail, 150);
            }
        }

        return [
            'plot_number' => deed_visual_clean($plot, 100),
            'plan_number' => $plan,
            'district' => $district,
            'city' => deed_visual_clean($city, 80),
        ];
    }
}

if (!function_exists('deed_visual_boundary_row')) {
    function deed_visual_boundary_row(string $line): ?array
    {
        $line = deed_visual_clean($line, 500);
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
            $type = deed_visual_clean($tm[1], 100);
            $description = deed_visual_clean($tm[2], 255);
        } else {
            $pieces = preg_split('/\s+/u', $beforeLength, 2) ?: [];
            $type = deed_visual_clean($pieces[0] ?? null, 100);
            $description = deed_visual_clean($pieces[1] ?? null, 255);
        }

        return $type ? [
            'direction' => $direction,
            'type' => $type,
            'description' => $description,
            'length' => deed_visual_num($length),
        ] : null;
    }
}

if (!function_exists('deed_visual_payload')) {
    function deed_visual_payload(string $filePath): array
    {
        $text = deed_visual_norm((new Parser())->parseFile($filePath)->getText());
        $payload = function_exists('deed_up_payload') ? deed_up_payload($filePath) : [];
        $lines = deed_visual_lines($text);

        if (preg_match('/رقم\s*الوثيقة\s+([0-9]{5,})\s+تاريخ\s*الوثيقة\s+([0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2})/u', $text, $m)) {
            $payload['deed_number'] = $payload['document_number'] = deed_visual_clean($m[1]);
            $payload['document_date_hijri'] = deed_visual_clean($m[2], 50);
        } elseif (preg_match('/\b([0-9]{12})\b/u', $text, $m)) {
            $payload['deed_number'] = $payload['document_number'] = deed_visual_clean($m[1]);
        }

        if (preg_match('/القيود\s+(.+?)\s+الحالة\s+(.+?)(?:\n|$)/u', $text, $m)) {
            $payload['document_restrictions'] = deed_visual_clean($m[1]);
            $payload['document_status'] = deed_visual_clean($m[2], 100);
        }

        if (preg_match('/تاريخ\s*الوثيقة\s*السابقة\s+([0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2})\s+المساحة\s+([0-9]+(?:\.[0-9]+)?)/u', $text, $m)) {
            $payload['previous_document_date_hijri'] = deed_visual_clean($m[1], 50);
            $payload['property_area'] = deed_visual_num($m[2]);
        }

        if (preg_match('/نوع\s*العملية\s+(.+?)\s+رقم\s*الوثيقة\s*السابقة\s+(.+?)(?:\n|الملاك|$)/u', $text, $m)) {
            $payload['operation_type'] = deed_visual_clean($m[1], 100);
            $payload['previous_document_number'] = deed_visual_clean($m[2], 150);
        }

        foreach ($lines as $line) {
            if (preg_match('/^([0-9]{6,})\s+(.+?)\s+(سعودي|سعودية)\s+([0-9]+)\s*%?$/u', $line, $m)) {
                $payload['deed_owner_identifier'] = deed_visual_clean($m[1]);
                $payload['deed_owner_name'] = deed_visual_clean($m[2]);
                $payload['deed_owner_nationality'] = deed_visual_clean($m[3]);
                $payload['deed_ownership_percentage'] = deed_visual_num($m[4]);
                break;
            }
        }

        $propertyMain = deed_visual_line_after($lines, 'رقم الهوية العقارية نوع العقار');
        if ($propertyMain && preg_match('/^(لا\s*يوجد|[0-9]{5,})\s+(.+?)\s+([0-9]+(?:\.[0-9]+)?)\s+(.+)$/u', $propertyMain, $m)) {
            $payload['real_estate_identity_number'] = trim($m[1]) === 'لا يوجد' ? null : deed_visual_clean($m[1]);
            $payload['deed_property_type_text'] = deed_visual_clean($m[2], 100);
            $payload['property_area'] = deed_visual_num($m[3]);
            $payload['deed_usage_text'] = deed_visual_clean($m[4], 100);
        }

        $blockRow = deed_visual_line_after($lines, 'البلك المجاورة / الجزء');
        if ($blockRow && preg_match('/^(.+?)\s+(.+)$/u', $blockRow, $m)) {
            $payload['block_number'] = trim($m[1]) === 'لا يوجد' ? null : deed_visual_clean($m[1], 100);
            $payload['deed_neighboring_part'] = deed_visual_clean($m[2], 100);
        }

        $modelRow = deed_visual_line_after($lines, 'الموقع نموذج العقار');
        if ($modelRow && preg_match('/^(.+?)\s+(.+)$/u', $modelRow, $m)) {
            $payload['deed_location_text'] = deed_visual_clean($m[1], 150);
            $payload['deed_property_model'] = deed_visual_clean($m[2], 150);
        }

        foreach (deed_visual_extract_location(deed_visual_line_after($lines, 'رقم القطعة رقم المخطط الحي المدينة')) as $key => $value) {
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
                $row = deed_visual_boundary_row($lines[$i]);
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

        $payload['name'] = deed_visual_clean(implode(' - ', array_filter([
            $ptype === 'apartment' && $unitNumber ? 'شقة رقم ' . $unitNumber : ($ptype === 'land' ? 'قطعة أرض' : 'عقار'),
            $district,
            $city,
        ]))) ?: ($payload['name'] ?? null);

        $payload['address'] = implode('، ', array_filter([
            $district ? 'حي ' . deed_visual_clean($district, 80) : null,
            deed_visual_clean($city, 80),
            $plan ? 'مخطط ' . deed_visual_clean($plan, 100) : null,
            $plot ? 'قطعة ' . deed_visual_clean($plot, 100) : null,
            $unitNumber ? 'شقة رقم ' . deed_visual_clean($unitNumber, 50) : null,
        ]));
        $payload['deed_raw_excerpt'] = mb_substr($text, 0, 6000);

        return $payload;
    }
}

if (!function_exists('deed_visual_handle')) {
    function deed_visual_handle(Request $request)
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:pdf', 'max:20480'],
            'owner_id' => ['nullable', 'integer', 'exists:owners,id'],
            'apply' => ['nullable', 'boolean'],
        ]);

        $uploaded = $request->file('file');
        $payload = deed_visual_payload($uploaded->getRealPath());
        foreach (array_keys($payload) as $field) {
            if ($request->filled($field)) $payload[$field] = $request->input($field);
        }

        if (!$request->boolean('apply')) {
            return response()->json([
                'status' => 'ok',
                'message' => 'تم قراءة الصك حسب قاعدة الحقول الخضراء والقيم البيج. راجع البيانات قبل الحفظ.',
                'asset_kind' => ($payload['property_type'] ?? '') === 'apartment' ? 'apartment' : 'property',
                'extracted_data' => ['property' => $payload],
            ]);
        }

        $ownerId = $request->filled('owner_id')
            ? (int) $request->input('owner_id')
            : (int) (Owner::where('type', 'self')->value('id') ?: Owner::create(['name' => 'أملاكي الخاصة', 'type' => 'self'])->id);

        $payload['owner_id'] = $ownerId;
        $payload['notes'] = 'تم إنشاء/تحديث هذا العقار من رفع صك الملكية حسب قاعدة الحقول الخضراء والقيم البيج.';
        $data = array_filter($payload, fn($value, $key) => Schema::hasColumn('properties', $key), ARRAY_FILTER_USE_BOTH);
        $doc = $payload['document_number'] ?? $payload['deed_number'] ?? null;
        $property = $doc ? Property::where('document_number', $doc)->orWhere('deed_number', $doc)->first() : null;
        $updated = (bool) $property;

        if ($property) {
            unset($data['owner_id']);
            $property->fill($data)->save();
        } else {
            $property = Property::create($data);
        }

        $path = $uploaded->store('property-deeds', 'public');
        $file = PropertyFile::create([
            'property_id' => $property->id,
            'file_name' => $uploaded->getClientOriginalName(),
            'file_path' => $path,
            'file_type' => $uploaded->getClientMimeType(),
            'file_size' => $uploaded->getSize(),
            'category' => 'deed',
            'notes' => 'صك ملكية محفوظ ضمن مستندات العقار ويمكن للمالك تنزيله مستقبلًا.',
        ]);

        return response()->json([
            'status' => 'ok',
            'message' => $updated ? 'تم تحديث العقار الموجود بنفس رقم الصك وحفظ الصك ضمن مستنداته.' : 'تم إنشاء العقار من الصك وحفظ الصك ضمن مستندات العقار.',
            'mode' => $updated ? 'updated' : 'created',
            'asset_kind' => ($payload['property_type'] ?? '') === 'apartment' ? 'apartment' : 'property',
            'extracted_data' => ['property' => $payload],
            'property' => $property->fresh()->load('owner'),
            'file' => $file,
        ], $updated ? 200 : 201);
    }
}
