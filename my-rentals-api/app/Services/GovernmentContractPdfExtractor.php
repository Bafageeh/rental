<?php

namespace App\Services;

use Smalot\PdfParser\Parser;

class GovernmentContractPdfExtractor
{
    public function extract(string $filePath): array
    {
        $parser = new Parser();
        $pdf = $parser->parseFile($filePath);

        $rawText = $pdf->getText();
        $text = $this->normalize($rawText);
        $lineText = $this->normalizeToLines($rawText);

        $lessorBlock = $this->firstBlock($text, [
            ['Data Lessor', 'Data Representative Lessor'],
            ['Lessor Data', 'Lessor Representative Data'],
            ['بيانات المؤجر', 'بيانات ممثل المؤجر'],
            ['بيانات المؤّجر', 'بيانات ُممِّثل المؤّجر'],
        ]);

        $tenantBlock = $this->firstBlock($text, [
            ['Data Tenant', 'Data Representative Tenant'],
            ['Tenant Data', 'Tenant Representative Data'],
            ['بيانات المستأجر', 'بيانات ممثل المستأجر'],
            ['بيانات المستأجر', 'Brokerage Entity'],
        ]);

        $ownershipBlock = $this->firstBlock($text, [
            ['Data document Ownership', 'Data Property'],
            ['Ownership document Data', 'Property Data'],
            ['بيانات مستندات الملكية', 'بيانات العقار'],
            ['بيانات مستندات الملكّية', 'بيانات العقار'],
        ]);

        $propertyBlock = $this->firstBlock($text, [
            ['Data Property', 'Data Units Rental'],
            ['Property Data', 'Rental Units Data'],
            ['بيانات العقار', 'بيانات الوحدات الإيجارية'],
            ['بيانات العقار', 'بيانات الوحدات اإليجار'],
        ]);

        $unitBlock = $this->firstBlock($text, [
            ['Data Units Rental', 'Authority Tenant'],
            ['Rental Units Data', 'Tenant Authority'],
            ['بيانات الوحدات الإيجارية', 'صالحيات المستأجر'],
            ['بيانات الوحدات اإليجار', 'صالحيات المستأجر'],
        ]);

        $financialBlock = $this->firstBlock($text, [
            ['Data Financial', 'Schedule Payments Rent'],
            ['Financial Data', 'Rent Payments Schedule'],
            ['البيانات المالية', 'جدول سداد الدفعات'],
            ['البيانات المالَّية', 'جدول سداد الُّد فعات'],
        ]);

        $record = $this->extractContractRecord($text);
        $rooms = $this->extractRooms($unitBlock);
        $financial = $this->extractFinancial($financialBlock, $text);
        $payments = $this->extractPaymentSchedule($lineText);
        $lessor = $this->extractPerson($lessorBlock);
        $tenant = $this->extractPerson($tenantBlock);

        // اقرأ اسم المستأجر من حقل "الاسم" داخل قسم "بيانات المستأجر" تحديدًا.
        // هذا الموضع هو الاسم الظاهر في عقود إيجار بجانب Name، مثل الاسم المظلّل في نموذج المستخدم.
        $tenantNameFromTenantSection = $this->extractTenantNameFromContractText($text, $tenantBlock);
        if ($tenantNameFromTenantSection) {
            $tenant['name'] = $tenantNameFromTenantSection;
            $tenant['name_source'] = 'tenant_section_name_field';
        }

        // اقرأ جنسية المستأجر من نفس قسم بيانات المستأجر، وليس من قسم المؤجر أو الوسيط.
        // مثال عقود إيجار الرسمية: Nationality ثم القيمة "المملكة العربية السعودية" ثم "الجنسَّية".
        $tenantNationalityFromTenantSection = $this->extractTenantNationalityFromContractText($text, $tenantBlock);
        if ($tenantNationalityFromTenantSection) {
            $tenant['nationality'] = $tenantNationalityFromTenantSection;
            $tenant['nationality_source'] = 'tenant_section_nationality_field';
        }

        return [
            'contract' => [
                'contract_number' => $record['display_number'],
                'government_contract_number' => $record['record_number'],
                'ejar_record_number' => $record['record_number'],
                'ejar_version_number' => $record['version_number'],
                'contract_type' => $this->normalizeNullable($this->firstMatch([
                    '/نوع\s*العقد\s*:?\s*([^\s]+)\s*Type\s*Contract/ui',
                    '/Contract\s*Type\s+([^\s]+)\s+نوع\s*العقد/ui',
                ], $text)),
                'sealing_date' => $this->firstMatch([
                    '/تاريخ\s*إبرام\s*العقد\s*:?\s*(\d{4}-\d{2}-\d{2})/u',
                    '/Contract\s*Sealing\s*Date\s*(\d{4}-\d{2}-\d{2})/ui',
                ], $text),
                'sealing_location' => $this->normalizeNullable($this->firstMatch([
                    '/مكان\s*إبرام\s*العقد\s*:?\s*([^\s]+)/u',
                    '/Contract\s*Sealing\s*Location\s+([^\s]+)/ui',
                ], $text)),
                'start_date' => $this->firstMatch([
                    '/تاريخ\s*بداية.*?الإيجار\s*:?\s*(\d{4}-\d{2}-\d{2})/u',
                    '/تاريخ\s*بداية.*?اإليجار\s*:?\s*(\d{4}-\d{2}-\d{2})/u',
                    '/Tenancy\s*Start\s*Date\s*(\d{4}-\d{2}-\d{2})/ui',
                ], $text),
                'end_date' => $this->firstMatch([
                    '/تاريخ\s*نهاية.*?الإيجار\s*:?\s*(\d{4}-\d{2}-\d{2})/u',
                    '/تاريخ\s*نهاية.*?اإليجار\s*:?\s*(\d{4}-\d{2}-\d{2})/u',
                    '/Tenancy\s*End\s*Date\s*(\d{4}-\d{2}-\d{2})/ui',
                ], $text),
            ],

            'lessor' => $lessor,
            'tenant' => $tenant,

            'ownership' => [
                'deed_number' => $this->normalizeNullable($this->firstMatch([
                    '/رقم\s*المستند\s*:?\s*(\d+)/u',
                    '/Title\s*Deed\s*No\s*:?\s*(\d+)/ui',
                ], $ownershipBlock)),
                'issuer' => $this->normalizeNullable($this->firstMatch([
                    '/جهة\s*الإصدار\s*:?\s*([^:]+?)\s*:Issuer/u',
                    '/Issuer\s*:?\s*([^\s]+)/ui',
                ], $ownershipBlock)),
                'issue_date' => $this->firstMatch([
                    '/Issue\s*Date\s*:?\s*(\d{4}-\d{2}-\d{2})/ui',
                    '/تاريخ\s*الإصدار\s*:?\s*(\d{4}-\d{2}-\d{2})/u',
                ], $ownershipBlock),
                'deed_type' => $this->normalizeNullable($this->firstMatch([
                    '/نوع\s*الصك\s*:?\s*(.*?)\s*:type\s*deed\s*Title/ui',
                    '/Title\s*deed\s*type\s*:?\s*(.*?)\s+نوع\s*الصك/u',
                ], $ownershipBlock)),
            ],

            'property' => [
                'address' => $this->normalizeNullable($this->firstMatch([
                    '/العنوان\s*الوطني\s*:?\s*(.*?)\s*Address\s*National/ui',
                    '/National\s*Address\s*(.*?)\s*العنوان\s*الوطني/u',
                ], $propertyBlock)),
                'property_type' => $this->normalizeNullable($this->firstMatch([
                    '/نوع\s*بناء\s*العقار\s*:?\s*(.*?)\s*Type\s*Property/ui',
                    '/Property\s*Type\s*(.*?)\s*نوع\s*بناء\s*العقار/u',
                ], $propertyBlock)),
                'usage_type' => $this->normalizeNullable($this->firstMatch([
                    '/الغرض\s*من\s*استخدام\s*العقار\s*:?\s*(.*?)\s*Usage\s*Property/ui',
                    '/Property\s*Usage\s*(.*?)\s*الغرض\s*من\s*استخدام\s*العقار/u',
                ], $propertyBlock)),
                'units_count' => $this->toInt($this->firstMatch([
                    '/Number\s*of\s*Units\s*(\d+)/ui',
                    '/عدد\s*الوحدات\s*:?\s*(\d+)/u',
                ], $propertyBlock)),
                'floors_count' => $this->toInt($this->firstMatch([
                    '/Number\s*of\s*Floors\s*(\d+)/ui',
                    '/عدد\s*الطوابق\s*:?\s*(\d+)/u',
                ], $propertyBlock)),
                'parking_spots_count' => $this->toInt($this->firstMatch([
                    '/Number\s*of\s*Parking\s*Lots\s*(\d+)/ui',
                    '/عدد\s*المواقف\s*:?\s*(\d+)/u',
                ], $propertyBlock)),
                'elevators_count' => $this->toInt($this->firstMatch([
                    '/Number\s*of\s*Elevators\s*(\d+)/ui',
                    '/عدد\s*المصاعد\s*:?\s*(\d+)/u',
                ], $propertyBlock)),
            ],

            'unit' => [
                'type' => $this->normalizeNullable($this->firstMatch([
                    '/نوع\s*الوحدة\s*:?\s*(.*?)\s*Type\s*Unit/ui',
                    '/Unit\s*Type\s*(.*?)\s*نوع\s*الوحدة/u',
                ], $unitBlock)),
                'unit_number' => $this->normalizeNullable($this->firstMatch([
                    '/رقم\s*الوحدة\s*:?\s*([^\s]+)\s*\.?No\s*Unit/ui',
                    '/Unit\s*No\.?\s*([^\s]+)\s*رقم\s*الوحدة/u',
                ], $unitBlock)),
                'floor' => $this->normalizeNullable($this->firstMatch([
                    '/رقم\s*الطابق\s*:?\s*([^\s]+)\s*\.?No\s*Floor/ui',
                    '/Floor\s*No\.?\s*([^\s]+)\s*رقم\s*الطابق/u',
                ], $unitBlock)),
                'area' => $this->toFloat($this->firstMatch([
                    '/مساحة\s*الوحدة\s*:?\s*([\d.]+)/u',
                    '/Unit\s*Area\s*([\d.]+)/ui',
                ], $unitBlock)),
                'rooms_count' => $rooms['bedrooms'] ?? 0,
                'living_rooms_count' => $rooms['living_rooms'] ?? 0,
                'kitchens_count' => $rooms['kitchens'] ?? 0,
                'has_living_room' => (($rooms['living_rooms'] ?? 0) > 0),
                'has_kitchen' => (($rooms['kitchens'] ?? 0) > 0),
                'electricity_meter_number' => $this->normalizeNullable($this->firstMatch([
                    '/رقم\s*ع.*?داد\s*الكهرباء\s*([A-Za-z0-9]+)/u',
                    '/Electricity\s*meter\s*number\s*([A-Za-z0-9]+)/ui',
                ], $unitBlock)),
                'water_meter_number' => $this->normalizeNullable($this->firstMatch([
                    '/رقم\s*ع.*?داد\s*المياه\s*([A-Za-z0-9\-]+)/u',
                    '/Water\s*meter\s*number\s*([A-Za-z0-9\-]+)/ui',
                ], $unitBlock)),
                'gas_meter_number' => $this->normalizeNullable($this->firstMatch([
                    '/رقم\s*ع.*?داد\s*الغاز\s*([A-Za-z0-9\-]+)/u',
                    '/Gas\s*meter\s*number\s*([A-Za-z0-9\-]+)/ui',
                ], $unitBlock)),
                'ac_units_count' => $this->toInt($this->firstMatch([
                    '/عدد\s*وحدات\s*التكييف\s*(\d+)/u',
                    '/Number\s*of\s*AC\s*units\s*(\d+)/ui',
                ], $unitBlock)),
            ],

            'financial' => $financial,
            'payments' => $payments,
            'raw_text_excerpt' => mb_substr($text, 0, 3000),
        ];
    }

    private function normalize(string $text): string
    {
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $text = $this->stripBidi($text);
        $text = $this->arabicDigitsToLatin($text);
        $text = str_replace(["\xc2\xa0", "ـ"], ' ', $text);
        $text = preg_replace('/[\x{064B}-\x{065F}\x{0670}]/u', '', $text);
        $text = preg_replace('/[ \t]+/u', ' ', $text);
        $text = preg_replace('/\n{2,}/u', "\n", $text);
        return trim($text);
    }

    private function normalizeToLines(string $text): string
    {
        $text = $this->normalize($text);
        $lines = array_map('trim', preg_split('/\n/u', $text) ?: []);
        return implode("\n", array_filter($lines, fn ($line) => $line !== ''));
    }

    private function stripBidi(string $text): string
    {
        return preg_replace('/[\x{200E}\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}]/u', '', $text) ?? $text;
    }

    private function arabicDigitsToLatin(string $text): string
    {
        return strtr($text, [
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
            '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
            '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
        ]);
    }

    private function firstBlock(string $text, array $pairs): string
    {
        foreach ($pairs as $pair) {
            $block = $this->between($text, $pair[0], $pair[1]);
            if (trim($block) !== '') {
                return $block;
            }
        }
        return '';
    }

    private function between(string $text, string $start, string $end): string
    {
        $startPos = mb_stripos($text, $start);
        if ($startPos === false) {
            return '';
        }

        $startPos += mb_strlen($start);
        $endPos = mb_stripos($text, $end, $startPos);

        if ($endPos === false) {
            return mb_substr($text, $startPos);
        }

        return mb_substr($text, $startPos, $endPos - $startPos);
    }

    private function firstMatch(array $patterns, string $text, int $group = 1): ?string
    {
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $text, $matches)) {
                $value = trim($matches[$group] ?? '');
                if ($value !== '' && $value !== '-') {
                    return preg_replace('/\s+/u', ' ', $value);
                }
            }
        }

        return null;
    }

    private function normalizeNullable(?string $value): ?string
    {
        $value = trim((string) $value);
        if ($value === '' || $value === '-') {
            return null;
        }
        return preg_replace('/\s+/u', ' ', $value);
    }

    private function extractContractRecord(string $text): array
    {
        $left = null;
        $right = null;

        if (preg_match('/(?:رقم\s*سجل\s*العقد|Contract\s*No\.?)\s*:?\s*([0-9\-]+)\s*\/\s*([0-9\-]+)/ui', $text, $m)) {
            $left = $m[1];
            $right = $m[2];
        } elseif (preg_match('/([0-9\-]+)\s*\/\s*([0-9\-]+)\s*(?:رقم\s*سجل\s*العقد|Contract\s*No\.?)/ui', $text, $m)) {
            $left = $m[1];
            $right = $m[2];
        }

        $record = null;
        $version = null;

        foreach ([$left, $right] as $part) {
            if (!$part) {
                continue;
            }
            if (preg_match('/^\d{6,}$/', $part)) {
                $record = $part;
            } elseif (preg_match('/\d+-\d+/', $part)) {
                $version = $part;
            }
        }

        $display = $record && $version ? $record . ' / ' . $version : ($record ?: ($left && $right ? $left . ' / ' . $right : null));

        return [
            'record_number' => $record,
            'version_number' => $version,
            'display_number' => $display,
        ];
    }

    /**
     * Extracts the tenant name from the official Ejar tenant section.
     *
     * The PDF parser can sometimes return the text in mixed Arabic/English order.
     * This method intentionally targets the section:
     *   4 بيانات المستأجر Data Tenant
     * and reads the value between:
     *   الاسم: ... Name
     */
    private function extractTenantNameFromContractText(string $fullText, string $tenantBlock): ?string
    {
        $searchBlocks = array_values(array_filter([
            $tenantBlock,
            $this->firstBlock($fullText, [
                ['Data Tenant', 'Data Representative Tenant'],
                ['Data Tenant', 'Brokerage Entity'],
                ['Tenant Data', 'Tenant Representative Data'],
                ['بيانات المستأجر', 'بيانات ممثل المستأجر'],
                ['بيانات المستأجر', 'بيانات ُممِّثل المستأجر'],
                ['بيانات المستأجر', 'Brokerage Entity'],
            ]),
        ], fn ($block) => trim((string) $block) !== ''));

        foreach ($searchBlocks as $block) {
            // Smalot/PdfParser may output Arabic glyphs in visual reversed order, for example:
            // Nameرجوك داوع ديعس دمحم:مسالا
            if (preg_match('/Name\s*([\p{Arabic}\s]+?)\s*:?\s*مسالا/u', $block, $matches)) {
                $name = $this->cleanArabicPersonName($this->reverseUtf8($matches[1] ?? ''));
                if ($name) {
                    return $name;
                }
            }

            $name = $this->firstMatch([
                '/(?:االسم|الاسم|الإسم|اإلسم)\s*:?\s*([\p{Arabic}\s]+?)\s*Name/u',
                '/Name\s*:?\s*([\p{Arabic}\s]+?)\s*(?:Nationality|الجنس|نوع\s*الهو)/ui',
                '/(?:االسم|الاسم|الإسم|اإلسم)\s*:?\s*([^\n\r:]+?)(?:\s*Name|\n)/u',
            ], $block);

            $name = $this->cleanArabicPersonName($name);
            if ($name) {
                return $name;
            }
        }

        // Last-resort fallback: capture a short slice after the tenant section title.
        $slice = $this->firstBlock($fullText, [
            ['4 بيانات المستأجر', '5 بيانات'],
            ['بيانات المستأجر', 'بيانات ُممِّثل المستأجر'],
            ['بيانات المستأجر', 'Brokerage Entity'],
        ]);

        if ($slice !== '') {
            $name = $this->firstMatch([
                '/(?:االسم|الاسم|الإسم|اإلسم)\s*:?\s*([\p{Arabic}\s]+?)\s*Name/u',
                '/(?:االسم|الاسم|الإسم|اإلسم)\s*:?\s*([^\n\r:]+?)(?:\s*Name|\n)/u',
            ], $slice);

            return $this->cleanArabicPersonName($name);
        }

        return null;
    }

    /**
     * Extracts tenant nationality from the official Ejar tenant section only.
     *
     * The same Arabic value appears several times in Ejar contracts: lessor,
     * tenant, and broker. This method deliberately searches the tenant block,
     * so it does not accidentally read the lessor/broker nationality.
     */
    private function extractTenantNationalityFromContractText(string $fullText, string $tenantBlock): ?string
    {
        $searchBlocks = array_values(array_filter([
            $tenantBlock,
            $this->firstBlock($fullText, [
                ['Data Tenant', 'Data Representative Tenant'],
                ['Data Tenant', 'Brokerage Entity'],
                ['Tenant Data', 'Tenant Representative Data'],
                ['بيانات المستأجر', 'بيانات ممثل المستأجر'],
                ['بيانات المستأجر', 'بيانات ُممِّثل المستأجر'],
                ['بيانات المستأجر', 'Brokerage Entity'],
            ]),
        ], fn ($block) => trim((string) $block) !== ''));

        foreach ($searchBlocks as $block) {
            // Common parsed order:
            // Nationality
            // المملكة العربية
            // السعودية
            // الجنسَّية:
            $nationality = $this->firstMatch([
                '/Nationality\s*([\p{Arabic}\s]+?)\s*الجنس/u',
                '/Nationality\s*:?\s*([\p{Arabic}\s]+?)\s*(?:Type\s*ID|نوع\s*الهو)/ui',
                '/الجنس(?:ي|يّ|َّي|َّي)?ة\s*:?\s*([\p{Arabic}\s]+?)\s*(?:نوع\s*الهو|Type\s*ID|رقم\s*الهو)/u',
            ], $block);

            $nationality = $this->cleanArabicPhrase($nationality);
            if ($nationality) {
                return $nationality;
            }

            // Some PDF parsers may reverse only the Arabic segment around the English label.
            if (preg_match('/([\p{Arabic}\s]+?)\s*Nationality/u', $block, $matches)) {
                $candidate = $this->cleanArabicPhrase($this->reverseUtf8($matches[1] ?? ''));
                if ($candidate && mb_stripos($candidate, 'المملكة') !== false) {
                    return $candidate;
                }
            }
        }

        return null;
    }

    /**
     * Reads the rent payment cycle value from the financial section.
     *
     * Example from the user's Ejar PDF:
     *   دورة سداد الايجار ربعي cycle payment Rent
     */
    private function extractRentPaymentCycleLabel(string $financialBlock, string $fullText): ?string
    {
        $searchBlocks = array_values(array_filter([
            $financialBlock,
            $this->firstBlock($fullText, [
                ['Data Financial', 'Schedule Payments Rent'],
                ['Financial Data', 'Rent Payments Schedule'],
                ['البيانات المالية', 'جدول سداد الدفعات'],
                ['البيانات المالَّية', 'جدول سداد الُّد فعات'],
                ['البيانات المال', 'جدول سداد'],
            ]),
        ], fn ($block) => trim((string) $block) !== ''));

        foreach ($searchBlocks as $block) {
            $cycle = $this->firstMatch([
                '/دورة\s*سداد\s*(?:ا+ل?ا?يجار|الا?يجار|الإيجار|اإليجار|الايجار)\s*:?\s*([\p{Arabic}A-Za-z_\- ]+?)\s*(?:cycle\s*payment\s*Rent|Rent\s*payment\s*cycle|Number\s*of\s*Rent|عدد\s*دفعات|دفعة\s*الإيجار|دفعة\s*اإليجار)/ui',
                '/Rent\s*payment\s*cycle\s*:?\s*([\p{Arabic}A-Za-z_\- ]+?)\s*(?:دورة\s*سداد|Regular\s*Rent|دفعة\s*الإيجار|دفعة\s*اإليجار)/ui',
                '/cycle\s*payment\s*Rent\s*:?\s*([\p{Arabic}A-Za-z_\- ]+?)\s*(?:دورة\s*سداد|Regular\s*Rent|دفعة\s*الإيجار|دفعة\s*اإليجار)/ui',
            ], $block);

            $cycle = $this->cleanPaymentCycleLabel($cycle);
            if ($cycle) {
                return $cycle;
            }
        }

        return null;
    }

    private function cleanPaymentCycleLabel(?string $value): ?string
    {
        $value = $this->normalizeNullable($value);
        if (!$value) {
            return null;
        }

        $value = preg_replace('/\b(cycle|payment|Rent|Regular|Number|of|Payments?)\b.*$/iu', '', $value) ?? $value;
        $value = preg_replace('/(?:دورة\s*سداد|دفعة\s*الإيجار|دفعة\s*اإليجار|عدد\s*دفعات).*$/u', '', $value) ?? $value;
        $value = preg_replace('/[^\p{Arabic}A-Za-z_\- ]+/u', ' ', $value) ?? $value;
        $value = preg_replace('/\s+/u', ' ', trim($value)) ?? trim($value);

        $map = [
            'ربعي' => 'ربعي',
            'ربعى' => 'ربعي',
            'ربع سنوي' => 'ربعي',
            'ربع سنوى' => 'ربعي',
            'quarterly' => 'ربعي',
            'quarter' => 'ربعي',
            'شهري' => 'شهري',
            'شهرى' => 'شهري',
            'monthly' => 'شهري',
            'نصف سنوي' => 'نصف سنوي',
            'نصف سنوى' => 'نصف سنوي',
            'semi annual' => 'نصف سنوي',
            'semi_annual' => 'نصف سنوي',
            'سنوي' => 'سنوي',
            'سنوى' => 'سنوي',
            'annual' => 'سنوي',
            'مرن' => 'مرن',
            'flexible' => 'مرن',
        ];

        $lower = mb_strtolower($value);
        return $map[$lower] ?? ($value !== '' ? $value : null);
    }

    private function cleanArabicPhrase(?string $value): ?string
    {
        $value = $this->normalizeNullable($value);
        if (!$value) {
            return null;
        }

        $value = preg_replace('/\b(Name|Nationality|Email|Mobile|Type|ID|No)\b.*$/iu', '', $value) ?? $value;
        $value = preg_replace('/(?:الجنس(?:ي|يّ|َّي|َّي)?ة|نوع\s*الهو.*?ية|رقم\s*الهو.*?ية|رقم\s*الج.*?وال|البريد\s*الإلكتروني|البريد\s*اإللكتروني).*$/u', '', $value) ?? $value;
        $value = preg_replace('/[^\p{Arabic}\s]+/u', ' ', $value) ?? $value;
        $value = preg_replace('/\s+/u', ' ', trim($value)) ?? trim($value);

        return $value !== '' ? $value : null;
    }

    private function reverseUtf8(string $value): string
    {
        $chars = preg_split('//u', $value, -1, PREG_SPLIT_NO_EMPTY);
        if (!is_array($chars)) {
            return $value;
        }

        return implode('', array_reverse($chars));
    }

    private function cleanArabicPersonName(?string $name): ?string
    {
        $name = $this->normalizeNullable($name);
        if (!$name) {
            return null;
        }

        $name = preg_replace('/\b(Name|Nationality|Email|Mobile|Type|ID|No)\b.*$/iu', '', $name) ?? $name;
        $name = preg_replace('/(?:الجنس(?:ي|َّي)?ة|نوع\s*الهو.*?ية|رقم\s*الهو.*?ية|رقم\s*الج.*?وال|البريد\s*الإلكتروني|البريد\s*اإللكتروني).*$/u', '', $name) ?? $name;
        $name = preg_replace('/[^\p{Arabic}\s]+/u', ' ', $name) ?? $name;
        $name = preg_replace('/\s+/u', ' ', trim($name)) ?? trim($name);

        return $name !== '' ? $name : null;
    }
    private function extractPerson(string $block): array
    {
        return [
            'name' => $this->normalizeNullable($this->firstMatch([
                '/(?:االسم|الاسم)\s*:?\s*(.*?)\s*Name/u',
                '/Name\s+(.*?)\s+(?:االسم|الاسم)/u',
            ], $block)),
            'nationality' => $this->normalizeNullable($this->firstMatch([
                '/Nationality\s*(.*?)\s*الجنس/u',
                '/الجنس(?:ي|َّي)ة\s*:?\s*(.*?)\s*(?:نوع\s*الهو|ID\s*Type)/u',
            ], $block)),
            'identity_type' => $this->normalizeNullable($this->firstMatch([
                '/نوع\s*الهو.*?ية\s*:?\s*(.*?)\s*Type\s*ID/ui',
                '/ID\s*Type\s*(.*?)\s*نوع\s*الهو/u',
            ], $block)),
            'id_type' => $this->normalizeNullable($this->firstMatch([
                '/نوع\s*الهو.*?ية\s*:?\s*(.*?)\s*Type\s*ID/ui',
                '/ID\s*Type\s*(.*?)\s*نوع\s*الهو/u',
            ], $block)),
            'national_id' => $this->normalizeNullable($this->firstMatch([
                '/رقم\s*الهو.*?ية\s*:?\s*(\d+)/u',
                '/ID\s*No\.?\s*(\d+)/ui',
            ], $block)),
            'phone' => $this->normalizePhone($this->firstMatch([
                '/Mobile\s+No\.?\s*([+\d]+)/iu',
                '/رقم\s*الج.*?وال\s*:?\s*([+\d]+)/u',
            ], $block)),
            'email' => $this->normalizeNullable($this->firstMatch([
                '/([A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,})/iu',
            ], $block)),
        ];
    }

    private function normalizePhone(?string $phone): ?string
    {
        $phone = preg_replace('/\D+/', '', (string) $phone);
        return $phone !== '' ? $phone : null;
    }

    private function extractRooms(string $unitBlock): array
    {
        $result = [
            'living_rooms' => 0,
            'kitchens' => 0,
            'bedrooms' => 0,
            'raw' => [],
        ];

        $patterns = [
            '/نوع\s*الغرفة\s*(.*?)\s*Type\s*Room\s*العدد\s*(\d+)/u',
            '/Room\s*Type\s*(.*?)\s*نوع\s*الغرفة\s*Number\s*(\d+)/ui',
            '/Number\s*(\d+)\s*العدد\s*Room\s*Type\s*(.*?)\s*نوع\s*الغرفة/ui',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match_all($pattern, $unitBlock, $matches, PREG_SET_ORDER)) {
                foreach ($matches as $match) {
                    if (str_contains($pattern, 'Number\\s*(')) {
                        $count = (int) $match[1];
                        $type = trim($match[2]);
                    } else {
                        $type = trim($match[1]);
                        $count = (int) $match[2];
                    }

                    $result['raw'][] = ['type' => $type, 'count' => $count];

                    if (str_contains($type, 'صا')) {
                        $result['living_rooms'] += $count;
                    } elseif (str_contains($type, 'مطبخ')) {
                        $result['kitchens'] += $count;
                    } elseif (str_contains($type, 'نوم')) {
                        $result['bedrooms'] += $count;
                    }
                }

                if (!empty($result['raw'])) {
                    break;
                }
            }
        }

        return $result;
    }

    private function extractFinancial(string $financialBlock, string $fullText): array
    {
        $block = $financialBlock ?: $fullText;
        $cycleLabel = $this->extractRentPaymentCycleLabel($financialBlock, $fullText);

        return [
            'brokerage_fee' => $this->toFloat($this->firstMatch([
                '/أجرة.*?السعي.*?:\s*([\d.]+)/u',
                '/Brokerage\s*Fee.*?([\d.]+)/uis',
            ], $block)),
            'brokerage_fee_due_date' => $this->firstMatch([
                '/تاريخ\s*استحقاق\s*أجرة\s*السعي\s*:?\s*(\d{4}-\d{2}-\d{2})/u',
                '/BO\s*fee\s*Due\s*date\s*(\d{4}-\d{2}-\d{2})/ui',
            ], $block),
            'deposit_amount' => $this->toFloat($this->firstMatch([
                '/مبلغ.*?الضمان.*?:\s*([\d.]+)/u',
                '/Security\s*Deposit.*?([\d.]+)/uis',
            ], $block)),
            'gas_annual_amount' => $this->toFloat($this->firstMatch(['/Gas\s*Annual\s*Amount\s*([\d.]+)/ui'], $block)),
            'electricity_annual_amount' => $this->toFloat($this->firstMatch(['/Electricity\s*Annual\s*Amount\s*([\d.]+)/ui'], $block)),
            'parking_annual_amount' => $this->toFloat($this->firstMatch(['/Parking\s*Annual\s*Amount\s*([\d.]+)/ui'], $block)),
            'water_annual_amount' => $this->toFloat($this->firstMatch(['/Water\s*Annual\s*Amount\s*([\d.]+)/ui'], $block)),
            'rent_amount' => $this->toFloat($this->firstMatch([
                '/قيمة\s*الإيجار\s*([\d.]+)/u',
                '/قيمة\s*اإليجار\s*([\d.]+)/u',
                '/Annual\s*Rent\s*([\d.]+)/ui',
            ], $block)),
            'rented_parking_lots' => $this->toInt($this->firstMatch([
                '/عدد\s*المواقف\s*المستأجرة\s*:?\s*(\d+)/u',
                '/Parking\s*Lots\s*Rented\s*:?\s*(\d+)/ui',
            ], $block)),
            'regular_payment_amount' => $this->toFloat($this->firstMatch([
                '/دفعة\s*الإيجار.*?الدورية\s*:?\s*([\d.]+)/u',
                '/دفعة\s*اإليجار.*?الدورية\s*:?\s*([\d.]+)/u',
                '/Regular\s*Rent\s*Payment\s*:?\s*([\d.]+)/ui',
            ], $block)),
            'payment_cycle' => $this->mapPaymentCycle($cycleLabel),
            'payment_cycle_label' => $cycleLabel,
            'rent_payments_count' => $this->toInt($this->firstMatch([
                '/عدد\s*دفعات\s*الإيجار\s*:?\s*(\d+)/u',
                '/عدد\s*دفعات\s*اإليجار\s*:?\s*(\d+)/u',
                '/Number\s*of\s*Rent\s*Payments\s*:?\s*(\d+)/ui',
            ], $block)),
            'last_payment_amount' => $this->toFloat($this->firstMatch([
                '/دفعة\s*الإيجار\s*الأخيرة\s*:?\s*([\d.]+)/u',
                '/دفعة\s*اإليجار\s*األخيرة\s*:?\s*([\d.]+)/u',
                '/Last\s*Rent\s*Payment\s*:?\s*([\d.]+)/ui',
            ], $block)),
            'total_contract_value' => $this->toFloat($this->firstMatch([
                '/اجمالي\s*قيمة\s*العقد\s*:?\s*([\d.]+)/u',
                '/إجمالي\s*قيمة\s*العقد\s*:?\s*([\d.]+)/u',
                '/Total\s*Contract\s*value\s*([\d.]+)/ui',
            ], $block)),
        ];
    }

    private function mapPaymentCycle(?string $label): string
    {
        $label = trim((string) $label);
        if ($label === '') {
            return 'monthly';
        }

        if (str_contains($label, 'ربع') || str_contains(strtolower($label), 'quarter')) {
            return 'quarterly';
        }
        if (str_contains($label, 'نصف') || str_contains(strtolower($label), 'semi')) {
            return 'semi_annual';
        }
        if (str_contains($label, 'سنوي') || str_contains(strtolower($label), 'annual')) {
            return 'annual';
        }
        if (str_contains($label, 'شهر') || str_contains(strtolower($label), 'month')) {
            return 'monthly';
        }

        return $label;
    }

    private function extractPaymentSchedule(string $lineText): array
    {
        $payments = [];
        $lines = preg_split('/\n/u', $lineText) ?: [];

        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }

            // Text style: 1 2025-08-30 2025-09-09 ... 8250.00
            if (preg_match('/^\s*(\d+)\s+(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2}).*?([\d,.]+)\s*$/u', $line, $m)) {
                $amount = $this->toFloat($m[4]);
                if ($amount > 0) {
                    $payments[] = [
                        'sequence' => (int) $m[1],
                        'due_date' => $m[2],
                        'payment_deadline' => $m[3],
                        'amount' => $amount,
                    ];
                }
                continue;
            }

            // Layout style: 8250.00 ... 2025-09-09 2025-08-30 1
            if (preg_match('/^\s*([\d,.]+).*?(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})\s+(\d+)\s*$/u', $line, $m)) {
                $amount = $this->toFloat($m[1]);
                if ($amount > 0) {
                    $payments[] = [
                        'sequence' => (int) $m[4],
                        'due_date' => $m[3],
                        'payment_deadline' => $m[2],
                        'amount' => $amount,
                    ];
                }
            }
        }

        $seen = [];
        $payments = array_values(array_filter($payments, function ($payment) use (&$seen) {
            $key = ($payment['sequence'] ?? '') . '|' . ($payment['due_date'] ?? '') . '|' . ($payment['amount'] ?? '');
            if (isset($seen[$key])) {
                return false;
            }
            $seen[$key] = true;
            return true;
        }));

        usort($payments, fn ($a, $b) => ($a['sequence'] ?? 0) <=> ($b['sequence'] ?? 0));

        return $payments;
    }

    private function toFloat(?string $value): float
    {
        $value = trim((string) $value);
        if ($value === '' || $value === '-') {
            return 0.0;
        }

        return (float) str_replace(',', '', $value);
    }

    private function toInt(?string $value): int
    {
        $value = trim((string) $value);
        if ($value === '' || $value === '-') {
            return 0;
        }

        return (int) preg_replace('/\D+/', '', $value);
    }
}
