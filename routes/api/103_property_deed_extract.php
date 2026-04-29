<?php

/*
|--------------------------------------------------------------------------
| Property deed extraction
|--------------------------------------------------------------------------
| Supports electronic title deed PDFs from the Real Estate Market / Ministry
| of Justice. It previews extracted fields, then creates the property and saves
| the uploaded deed as a downloadable property document when apply=1.
*/

use App\Models\Owner;
use App\Models\Property;
use App\Models\PropertyFile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
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
    function mrdeed_clean_short($value, int $max = 255): ?string
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

if (!function_exists('mrdeed_gregorian_date')) {
    function mrdeed_gregorian_date($value): ?string
    {
        $value = mrdeed_clean_short($value, 50);
        if (!$value) return null;
        if (preg_match('/(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})/', $value, $m)) {
            return sprintf('%04d-%02d-%02d', (int) $m[1], (int) $m[2], (int) $m[3]);
        }
        return null;
    }
}

if (!function_exists('mrdeed_percentage')) {
    function mrdeed_percentage($value): ?float
    {
        $number = mrdeed_number($value);
        return $number === null ? null : (float) $number;
    }
}

if (!function_exists('mrdeed_property_type')) {
    function mrdeed_property_type(?string $value): string
    {
        $value = mb_strtolower((string) $value);
        if (str_contains($value, 'فيلا') || str_contains($value, 'villa')) return 'villa';
        if (str_contains($value, 'شقة') || str_contains($value, 'apartment')) return 'apartment';
        if (str_contains($value, 'أرض') || str_contains($value, 'ارض') || str_contains($value, 'قطعة')) return 'land';
        if (str_contains($value, 'تجاري') || str_contains($value, 'commercial') || str_contains($value, 'محل')) return 'commercial';
        return 'building';
    }
}

if (!function_exists('mrdeed_type_label')) {
    function mrdeed_type_label(string $type): string
    {
        return match ($type) {
            'land' => 'قطعة أرض',
            'apartment' => 'شقة مستقلة',
            'villa' => 'فيلا',
            'commercial' => 'عقار تجاري',
            default => 'عقار',
        };
    }
}

if (!function_exists('mrdeed_extract_data')) {
    function mrdeed_extract_data(string $filePath): array
    {
        $parser = new Parser();
        $pdf = $parser->parseFile($filePath);
        $text = mrdeed_normalize_text($pdf->getText());

        $documentNumber = mrdeed_first_match([
            '/رقم\s*الوثيقة\s*([0-9]{5,})/u',
            '/الرقم\s*[:：]?\s*([0-9]{5,})/u',
            '/\b([0-9]{10,})\b/u',
        ], $text);
        $documentDateHijri = mrdeed_first_match(['/تاريخ\s*الوثيقة\s*([0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2})/u'], $text);
        $documentDateGregorian = mrdeed_first_match(['/التاريخ\s*[:：]?\s*(20[0-9]{2}\/[0-9]{1,2}\/[0-9]{1,2})/u'], $text);
        $documentStatus = mrdeed_first_match(['/الحالة\s*([\p{Arabic}A-Za-z ]+?)\s*(?:تاريخ|المساحة|$)/u'], $text);
        $restrictions = mrdeed_first_match(['/القيود\s*([\p{Arabic}A-Za-z ]+?)\s*الحالة/u'], $text);
        $previousDate = mrdeed_first_match(['/تاريخ\s*الوثيقة\s*السابقة\s*([0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2})/u'], $text);
        $operationType = mrdeed_first_match(['/نوع\s*العملية\s*([^\n]+?)\s*رقم\s*الوثيقة\s*السابقة/u'], $text);
        $previousNumber = mrdeed_first_match(['/رقم\s*الوثيقة\s*السابقة\s*([^\n]+?)(?:\n|الملاك|$)/u'], $text);

        $ownerIdentifier = mrdeed_first_match(['/الملاك\s*رقم\s*الهوية\s*الاسم\s*الجنسية\s*نسبة\s*التملك\s*([0-9]{6,})/u'], $text)
            ?: mrdeed_first_match(['/\n([0-9]{6,})\s+([\p{Arabic}\s]+?)\s+سعودي\s+100/u'], $text, 1);
        $ownerName = mrdeed_first_match(['/\n[0-9]{6,}\s+([\p{Arabic}\s]+?)\s+سعودي\s+100\s*%/u'], $text);
        $ownerNationality = mrdeed_first_match(['/\n[0-9]{6,}\s+[\p{Arabic}\s]+?\s+(سعودي|سعودية)\s+100\s*%/u'], $text);
        $ownershipPercentage = mrdeed_first_match(['/\n[0-9]{6,}\s+[\p{Arabic}\s]+?\s+(?:سعودي|سعودية)\s+([0-9.]+)\s*%/u'], $text);

        $realEstateIdentity = mrdeed_first_match(['/رقم\s*الهوية\s*العقارية\s*([0-9]{6,})/u'], $text);
        $city = mrdeed_first_match(['/المدينة\s*([\p{Arabic}A-Za-z ]+?)\s*رقم\s*المخطط/u'], $text);
        $planNumber = mrdeed_first_match(['/رقم\s*المخطط\s*([^\n]+?)\s*الحي/u'], $text);
        $district = mrdeed_first_match(['/الحي\s*([\p{Arabic}A-Za-z0-9 ]+?)\s*رقم\s*القطعة/u'], $text);
        $plotBlock = mrdeed_first_match(['/رقم\s*القطعة\s*([^\n]+?)\s*مساحة\s*العقار/u'], $text);
        $area = mrdeed_first_match(['/مساحة\s*العقار\s*\(?\s*م\s*²?\)?\s*([0-9,.]+)/u', '/المساحة\s*([0-9,.]+)/u'], $text);
        $propertyTypeText = mrdeed_first_match(['/نوع\s*العقار\s*([^\n]+?)(?:\n|خريطة|الوصول|$)/u'], $text);

        $plotNumber = mrdeed_clean_short($plotBlock, 100);
        $blockNumber = null;
        if ($plotBlock && preg_match('/(.+?)\s+بلك\s+(.+)$/u', trim($plotBlock), $m)) {
            $plotNumber = mrdeed_clean_short($m[1], 100);
            $blockNumber = mrdeed_clean_short($m[2], 100);
        }

        $cleanCity = mrdeed_clean_short($city, 80);
        $cleanDistrict = mrdeed_clean_short($district, 80);
        $type = mrdeed_property_type($propertyTypeText);
        $nameParts = array_filter([mrdeed_type_label($type), $cleanDistrict, $cleanCity]);
        $name = implode(' - ', $nameParts) ?: ($documentNumber ? 'عقار صك ' . $documentNumber : 'عقار مستورد من صك');
        $addressParts = array_filter([
            $cleanDistrict ? 'حي ' . $cleanDistrict : null,
            $cleanCity,
            $planNumber ? 'مخطط ' . trim($planNumber) : null,
            $plotNumber ? 'قطعة ' . trim($plotNumber) : null,
            $blockNumber ? 'بلك ' . trim($blockNumber) : null,
        ]);

        return [
            'property' => [
                'name' => mrdeed_clean_short($name, 255),
                'deed_number' => mrdeed_clean_short($documentNumber, 255),
                'document_number' => mrdeed_clean_short($documentNumber, 255),
                'document_date_hijri' => mrdeed_clean_short($documentDateHijri, 50),
                'document_date_gregorian' => mrdeed_gregorian_date($documentDateGregorian),
                'document_status' => mrdeed_clean_short($documentStatus, 100),
                'document_restrictions' => mrdeed_clean_short($restrictions, 255),
                'previous_document_date_hijri' => mrdeed_clean_short($previousDate, 50),
                'previous_document_number' => mrdeed_clean_short($previousNumber, 255),
                'operation_type' => mrdeed_clean_short($operationType, 100),
                'real_estate_identity_number' => mrdeed_clean_short($realEstateIdentity, 255),
                'plan_number' => mrdeed_clean_short($planNumber, 255),
                'plot_number' => mrdeed_clean_short($plotNumber, 100),
                'block_number' => mrdeed_clean_short($blockNumber, 100),
                'deed_owner_identifier' => mrdeed_clean_short($ownerIdentifier, 255),
                'deed_owner_name' => mrdeed_clean_short($ownerName, 255),
                'deed_owner_nationality' => mrdeed_clean_short($ownerNationality, 100),
                'deed_ownership_percentage' => mrdeed_percentage($ownershipPercentage),
                'deed_source' => 'منصة البورصة العقارية',
                'deed_issuer' => 'وزارة العدل',
                'deed_notes' => 'وثيقة تملك عقار إلكترونية. القيود: ' . (mrdeed_clean_short($restrictions, 255) ?: '-') . '. الحالة: ' . (mrdeed_clean_short($documentStatus, 100) ?: '-'),
                'city' => $cleanCity,
                'district' => $cleanDistrict,
                'address' => count($addressParts) ? implode('، ', $addressParts) : null,
                'national_short_address' => null,
                'property_area' => mrdeed_number($area),
                'property_type' => $type,
                'usage_type' => str_contains(mb_strtolower((string) $propertyTypeText), 'تجاري') ? 'commercial' : 'residential',
                'management_type' => 'managed',
                'floors_count' => null,
                'parking_spots_count' => null,
                'elevators_count' => null,
                'deed_raw_excerpt' => mb_substr($text, 0, 6000),
            ],
            'deed_owner' => [
                'identifier' => mrdeed_clean_short($ownerIdentifier, 255),
                'name' => mrdeed_clean_short($ownerName, 255),
                'nationality' => mrdeed_clean_short($ownerNationality, 100),
                'ownership_percentage' => mrdeed_percentage($ownershipPercentage),
            ],
            'confidence_notes' => [
                'تم تجهيز الحقول بناءً على وثيقة تملك عقار إلكترونية. راجع القيم قبل الاعتماد إذا كان تنسيق الصك مختلفًا.',
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

if (!function_exists('mrdeed_property_payload')) {
    function mrdeed_property_payload(array $propertyData, int $ownerId): array
    {
        $type = $propertyData['property_type'] ?? 'building';
        $payload = [
            'owner_id' => $ownerId,
            'name' => mrdeed_clean_short($propertyData['name'] ?? null) ?: ('عقار صك ' . ($propertyData['deed_number'] ?? '')),
            'deed_number' => mrdeed_clean_short($propertyData['deed_number'] ?? null),
            'document_number' => mrdeed_clean_short($propertyData['document_number'] ?? null),
            'document_date_hijri' => mrdeed_clean_short($propertyData['document_date_hijri'] ?? null, 50),
            'document_date_gregorian' => mrdeed_gregorian_date($propertyData['document_date_gregorian'] ?? null) ?: ($propertyData['document_date_gregorian'] ?? null),
            'document_status' => mrdeed_clean_short($propertyData['document_status'] ?? null),
            'document_restrictions' => mrdeed_clean_short($propertyData['document_restrictions'] ?? null),
            'previous_document_date_hijri' => mrdeed_clean_short($propertyData['previous_document_date_hijri'] ?? null, 50),
            'previous_document_number' => mrdeed_clean_short($propertyData['previous_document_number'] ?? null),
            'operation_type' => mrdeed_clean_short($propertyData['operation_type'] ?? null),
            'real_estate_identity_number' => mrdeed_clean_short($propertyData['real_estate_identity_number'] ?? null),
            'plan_number' => mrdeed_clean_short($propertyData['plan_number'] ?? null),
            'plot_number' => mrdeed_clean_short($propertyData['plot_number'] ?? null),
            'block_number' => mrdeed_clean_short($propertyData['block_number'] ?? null),
            'deed_owner_identifier' => mrdeed_clean_short($propertyData['deed_owner_identifier'] ?? null),
            'deed_owner_name' => mrdeed_clean_short($propertyData['deed_owner_name'] ?? null),
            'deed_owner_nationality' => mrdeed_clean_short($propertyData['deed_owner_nationality'] ?? null),
            'deed_ownership_percentage' => $propertyData['deed_ownership_percentage'] ?? null,
            'deed_source' => mrdeed_clean_short($propertyData['deed_source'] ?? null),
            'deed_issuer' => mrdeed_clean_short($propertyData['deed_issuer'] ?? null),
            'deed_notes' => $propertyData['deed_notes'] ?? null,
            'deed_raw_excerpt' => $propertyData['deed_raw_excerpt'] ?? null,
            'city' => mrdeed_clean_short($propertyData['city'] ?? null),
            'district' => mrdeed_clean_short($propertyData['district'] ?? null),
            'address' => mrdeed_clean_short($propertyData['address'] ?? null, 1000),
            'national_short_address' => mrdeed_clean_short($propertyData['national_short_address'] ?? null, 8),
            'property_area' => $propertyData['property_area'] ?? null,
            'floors_count' => $propertyData['floors_count'] ?? ($type === 'apartment' ? 1 : 0),
            'parking_spots_count' => $propertyData['parking_spots_count'] ?? 0,
            'elevators_count' => $propertyData['elevators_count'] ?? 0,
            'property_type' => $type,
            'usage_type' => $propertyData['usage_type'] ?? 'residential',
            'management_type' => $propertyData['management_type'] ?? 'managed',
            'notes' => 'تم إنشاء هذا العقار من رفع صك الملكية.',
        ];

        return array_filter($payload, fn ($value, $key) => $key === 'owner_id' || Schema::hasColumn('properties', $key), ARRAY_FILTER_USE_BOTH);
    }
}

if (!function_exists('mrdeed_handle_extract')) {
    function mrdeed_handle_extract(Request $request)
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:pdf', 'max:20480'],
            'owner_id' => ['nullable', 'integer', 'exists:owners,id'],
            'apply' => ['nullable', 'boolean'],
        ]);

        $uploaded = $request->file('file');
        $extracted = mrdeed_extract_data($uploaded->getRealPath());
        $propertyData = $extracted['property'] ?? [];

        $overrideFields = [
            'name', 'deed_number', 'document_number', 'document_date_hijri', 'document_date_gregorian',
            'document_status', 'document_restrictions', 'previous_document_date_hijri', 'previous_document_number',
            'operation_type', 'real_estate_identity_number', 'plan_number', 'plot_number', 'block_number',
            'deed_owner_identifier', 'deed_owner_name', 'deed_owner_nationality', 'deed_ownership_percentage',
            'deed_source', 'deed_issuer', 'deed_notes', 'city', 'district', 'address', 'national_short_address',
            'property_area', 'property_type', 'usage_type', 'management_type', 'floors_count',
            'parking_spots_count', 'elevators_count',
        ];

        foreach ($overrideFields as $field) {
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

        $ownerId = mrdeed_owner_id($request->filled('owner_id') ? (int) $request->input('owner_id') : null);
        $property = Property::create(mrdeed_property_payload($propertyData, $ownerId));

        $path = $uploaded->store('property-deeds', 'public');
        $propertyFile = PropertyFile::create([
            'property_id' => $property->id,
            'file_name' => $uploaded->getClientOriginalName(),
            'file_path' => $path,
            'file_type' => $uploaded->getClientMimeType(),
            'file_size' => $uploaded->getSize(),
            'category' => 'deed',
            'notes' => 'صك ملكية محفوظ ضمن مستندات العقار ويمكن للمالك تنزيله مستقبلًا.',
        ]);

        $extracted['property'] = $propertyData;

        return response()->json([
            'status' => 'ok',
            'message' => 'تم إنشاء العقار من الصك وحفظ الصك ضمن مستندات العقار.',
            'extracted_data' => $extracted,
            'property' => $property->fresh()->load('owner'),
            'file' => $propertyFile,
        ], 201);
    }
}

Route::post('/property-deeds/extract', fn (Request $request) => mrdeed_handle_extract($request));
Route::post('/my/property-deeds/extract', fn (Request $request) => mrdeed_handle_extract($request));
