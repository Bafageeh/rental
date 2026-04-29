<?php

/*
|--------------------------------------------------------------------------
| Property deed extraction
|--------------------------------------------------------------------------
| Allows creating a property either manually or by uploading a title deed PDF.
| The extractor is intentionally conservative: it previews extracted fields and
| lets the mobile app send corrected values before applying and creating the
| property.
*/

use App\Models\Owner;
use App\Models\Property;
use App\Models\PropertyFile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Smalot\PdfParser\Parser;

if (!function_exists('mrdeed_normalize_text')) {
    function mrdeed_normalize_text(string $text): string
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
}

if (!function_exists('mrdeed_first_match')) {
    function mrdeed_first_match(array $patterns, string $text, int $group = 1): ?string
    {
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $text, $matches)) {
                $value = trim((string) ($matches[$group] ?? ''));
                $value = preg_replace('/\s+/u', ' ', $value) ?? $value;
                $value = trim($value, " \t\n\r\0\x0B:-،؛");
                if ($value !== '' && $value !== '-') return $value;
            }
        }
        return null;
    }
}

if (!function_exists('mrdeed_clean_short')) {
    function mrdeed_clean_short(?string $value, int $max = 255): ?string
    {
        $value = trim((string) $value);
        if ($value === '' || $value === '-') return null;
        $value = preg_replace('/\s+/u', ' ', $value) ?? $value;
        $value = trim($value, " \t\n\r\0\x0B:-،؛");
        return mb_substr($value, 0, $max);
    }
}

if (!function_exists('mrdeed_number')) {
    function mrdeed_number($value)
    {
        if ($value === null || $value === '') return null;
        $value = preg_replace('/[^0-9.]/', '', (string) $value);
        return $value === '' ? null : $value;
    }
}

if (!function_exists('mrdeed_property_type')) {
    function mrdeed_property_type(?string $value): string
    {
        $value = mb_strtolower((string) $value);
        if (str_contains($value, 'فيلا') || str_contains($value, 'villa')) return 'villa';
        if (str_contains($value, 'شقة') || str_contains($value, 'apartment')) return 'apartment';
        if (str_contains($value, 'أرض') || str_contains($value, 'ارض') || str_contains($value, 'land')) return 'land';
        if (str_contains($value, 'تجاري') || str_contains($value, 'commercial') || str_contains($value, 'محل')) return 'commercial';
        return 'building';
    }
}

if (!function_exists('mrdeed_extract_data')) {
    function mrdeed_extract_data(string $filePath): array
    {
        $parser = new Parser();
        $pdf = $parser->parseFile($filePath);
        $text = mrdeed_normalize_text($pdf->getText());

        $deedNumber = mrdeed_first_match([
            '/(?:رقم\s*الصك|رقم\s*الوثيقة|رقم\s*المستند|رقم\s*الصك\s*العقاري)\s*[:\-]?\s*([0-9]{5,})/u',
            '/(?:Title\s*Deed\s*(?:No|Number)|Deed\s*(?:No|Number))\s*[:\-]?\s*([0-9]{5,})/ui',
            '/\b([0-9]{10,})\b/u',
        ], $text);

        $city = mrdeed_first_match([
            '/(?:المدينة|مدينة)\s*[:\-]?\s*([\p{Arabic}A-Za-z ]{2,40})/u',
            '/City\s*[:\-]?\s*([\p{Arabic}A-Za-z ]{2,40})/ui',
        ], $text);

        $district = mrdeed_first_match([
            '/(?:الحي|حي)\s*[:\-]?\s*([\p{Arabic}A-Za-z0-9 ]{2,50})/u',
            '/District\s*[:\-]?\s*([\p{Arabic}A-Za-z0-9 ]{2,50})/ui',
        ], $text);

        $area = mrdeed_first_match([
            '/(?:المساحة|مساحة\s*العقار|إجمالي\s*المساحة|اجمالي\s*المساحة)\s*[:\-]?\s*([0-9,.]+)\s*(?:م|م2|م²|متر|sqm)?/u',
            '/(?:Area|Total\s*Area)\s*[:\-]?\s*([0-9,.]+)/ui',
        ], $text);

        $address = mrdeed_first_match([
            '/(?:العنوان|الموقع)\s*[:\-]?\s*(.{4,140}?)(?:\n|رقم|المدينة|الحي|المساحة|$)/u',
            '/(?:Address|Location)\s*[:\-]?\s*(.{4,140}?)(?:\n|Deed|City|District|Area|$)/ui',
        ], $text);

        $shortAddress = mrdeed_first_match([
            '/(?:العنوان\s*المختصر|الرمز\s*المختصر|National\s*Short\s*Address)\s*[:\-]?\s*([A-Za-z0-9]{4,8})/ui',
            '/\b([A-Z]{4}[0-9]{4})\b/u',
        ], $text);

        $typeText = mrdeed_first_match([
            '/(?:نوع\s*العقار|نوع\s*الملك|نوع\s*الاستخدام)\s*[:\-]?\s*([\p{Arabic}A-Za-z ]{2,40})/u',
            '/(?:Property\s*Type|Real\s*Estate\s*Type)\s*[:\-]?\s*([\p{Arabic}A-Za-z ]{2,40})/ui',
        ], $text);

        $cleanCity = mrdeed_clean_short($city, 80);
        $cleanDistrict = mrdeed_clean_short($district, 80);
        $nameParts = array_filter([$cleanDistrict, $cleanCity]);
        $name = count($nameParts) ? 'عقار ' . implode(' - ', $nameParts) : ($deedNumber ? 'عقار صك ' . $deedNumber : 'عقار مستورد من صك');

        return [
            'property' => [
                'name' => mrdeed_clean_short($name, 255),
                'deed_number' => mrdeed_clean_short($deedNumber, 255),
                'city' => $cleanCity,
                'district' => $cleanDistrict,
                'address' => mrdeed_clean_short($address, 500),
                'national_short_address' => mrdeed_clean_short($shortAddress, 8),
                'property_area' => mrdeed_number($area),
                'property_type' => mrdeed_property_type($typeText),
                'usage_type' => str_contains(mb_strtolower((string) $typeText), 'تجاري') ? 'commercial' : 'residential',
                'management_type' => 'managed',
                'floors_count' => null,
                'parking_spots_count' => null,
                'elevators_count' => null,
            ],
            'confidence_notes' => [
                'راجع البيانات المستخرجة قبل الاعتماد، لأن تنسيق الصكوك قد يختلف من ملف لآخر.',
            ],
            'raw_text_excerpt' => mb_substr($text, 0, 3000),
        ];
    }
}

if (!function_exists('mrdeed_owner_id')) {
    function mrdeed_owner_id(?int $ownerId = null): int
    {
        if ($ownerId) return $ownerId;

        $ownerId = Owner::where('type', 'self')->value('id');
        if ($ownerId) return (int) $ownerId;

        $owner = Owner::create(['name' => 'أملاكي الخاصة', 'type' => 'self']);
        return (int) $owner->id;
    }
}

Route::post('/property-deeds/extract', function (Request $request) {
    $data = $request->validate([
        'file' => ['required', 'file', 'mimes:pdf', 'max:20480'],
        'owner_id' => ['nullable', 'integer', 'exists:owners,id'],
        'apply' => ['nullable', 'boolean'],
        'name' => ['nullable', 'string', 'max:255'],
        'deed_number' => ['nullable', 'string', 'max:255'],
        'city' => ['nullable', 'string', 'max:255'],
        'district' => ['nullable', 'string', 'max:255'],
        'address' => ['nullable', 'string'],
        'national_short_address' => ['nullable', 'string', 'max:8'],
        'property_area' => ['nullable', 'numeric', 'min:0'],
        'property_type' => ['nullable', 'string', 'max:100'],
        'usage_type' => ['nullable', 'string', 'max:100'],
        'management_type' => ['nullable', 'string', 'max:100'],
        'floors_count' => ['nullable', 'integer', 'min:0'],
        'parking_spots_count' => ['nullable', 'integer', 'min:0'],
        'elevators_count' => ['nullable', 'integer', 'min:0'],
    ]);

    $uploaded = $request->file('file');
    $extracted = mrdeed_extract_data($uploaded->getRealPath());
    $propertyData = $extracted['property'] ?? [];

    foreach (['name', 'deed_number', 'city', 'district', 'address', 'national_short_address', 'property_area', 'property_type', 'usage_type', 'management_type', 'floors_count', 'parking_spots_count', 'elevators_count'] as $field) {
        if ($request->filled($field)) {
            $propertyData[$field] = $request->input($field);
        }
    }

    if (!$request->boolean('apply')) {
        $extracted['property'] = $propertyData;
        return response()->json([
            'status' => 'ok',
            'message' => 'تم قراءة الصك. راجع البيانات قبل الحفظ.',
            'extracted_data' => $extracted,
        ]);
    }

    $ownerId = mrdeed_owner_id(isset($data['owner_id']) ? (int) $data['owner_id'] : null);
    $propertyType = $propertyData['property_type'] ?? 'building';

    $property = Property::create([
        'owner_id' => $ownerId,
        'name' => mrdeed_clean_short($propertyData['name'] ?? null) ?: ('عقار صك ' . ($propertyData['deed_number'] ?? '')),
        'deed_number' => mrdeed_clean_short($propertyData['deed_number'] ?? null),
        'city' => mrdeed_clean_short($propertyData['city'] ?? null),
        'district' => mrdeed_clean_short($propertyData['district'] ?? null),
        'address' => mrdeed_clean_short($propertyData['address'] ?? null, 1000),
        'national_short_address' => mrdeed_clean_short($propertyData['national_short_address'] ?? null, 8),
        'property_area' => $propertyData['property_area'] ?? null,
        'floors_count' => $propertyData['floors_count'] ?? ($propertyType === 'apartment' ? 1 : 0),
        'parking_spots_count' => $propertyData['parking_spots_count'] ?? 0,
        'elevators_count' => $propertyData['elevators_count'] ?? 0,
        'property_type' => $propertyType,
        'usage_type' => $propertyData['usage_type'] ?? 'residential',
        'management_type' => $propertyData['management_type'] ?? 'managed',
        'notes' => 'تم إنشاء هذا العقار من رفع صك الملكية.',
    ]);

    $path = $uploaded->store('property-deeds', 'public');
    $propertyFile = PropertyFile::create([
        'property_id' => $property->id,
        'file_name' => $uploaded->getClientOriginalName(),
        'file_path' => $path,
        'file_type' => $uploaded->getClientMimeType(),
        'file_size' => $uploaded->getSize(),
        'category' => 'deed',
        'notes' => 'صك ملكية مرفوع عند إنشاء العقار.',
    ]);

    $extracted['property'] = $propertyData;

    return response()->json([
        'status' => 'ok',
        'message' => 'تم إنشاء العقار من الصك وحفظ ملف الصك.',
        'extracted_data' => $extracted,
        'property' => $property->fresh()->load('owner'),
        'file' => $propertyFile,
    ], 201);
});

Route::post('/my/property-deeds/extract', function (Request $request) {
    return app('router')->dispatch($request->duplicate(null, null, null, null, null, array_merge($request->server->all(), ['REQUEST_URI' => '/api/property-deeds/extract'])));
});
