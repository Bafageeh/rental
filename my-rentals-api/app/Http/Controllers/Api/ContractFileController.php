<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContractFile;
use App\Models\Owner;
use App\Models\Property;
use App\Models\Unit;
use App\Services\GovernmentContractImporter;
use App\Services\GovernmentContractPdfExtractor;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Smalot\PdfParser\Parser;

class ContractFileController extends Controller
{
    public function extract(
        Request $request,
        GovernmentContractPdfExtractor $extractor,
        GovernmentContractImporter $importer
    ) {
        $request->validate([
            'file' => ['required', 'file', 'mimes:pdf', 'max:20480'],
            'tenant_id' => ['nullable', 'integer'],
            'contract_id' => ['nullable', 'integer'],
            'owner_id' => ['nullable', 'integer', 'exists:owners,id'],
            'property_id' => ['nullable', 'integer', 'exists:properties,id'],
            'unit_id' => ['nullable', 'integer', 'exists:units,id'],
            'apply' => ['nullable'],
        ]);

        $file = $request->file('file');
        $folder = 'contract_files/' . now()->format('Y/m');
        $safeName = now()->format('Ymd_His') . '_' . Str::random(8) . '.pdf';
        $path = $file->storeAs($folder, $safeName, 'local');
        $fullPath = Storage::disk('local')->path($path);

        $contractFile = ContractFile::create([
            'tenant_id' => $request->integer('tenant_id') ?: null,
            'contract_id' => $request->integer('contract_id') ?: null,
            'file_type' => 'government_contract_pdf',
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $path,
            'mime_type' => $file->getClientMimeType(),
            'file_size' => $file->getSize(),
            'extraction_status' => 'pending',
        ]);

        try {
            $data = $extractor->extract($fullPath);
            $data = $this->completeTenantIdentityFromPdf($data, $fullPath);
            $data = $this->normalizeExtractedArabicValues($data);

            $contractFile->update([
                'extraction_status' => 'processed',
                'extracted_data' => $data,
            ]);

            $importResult = null;

            if ($request->boolean('apply')) {
                $forcedOwner = $request->integer('owner_id') ? Owner::find($request->integer('owner_id')) : null;
                $forcedProperty = $request->integer('property_id') ? Property::with('owner')->find($request->integer('property_id')) : null;
                $forcedUnit = $request->integer('unit_id') ? Unit::with('property.owner')->find($request->integer('unit_id')) : null;

                $importResult = $importer->import($data, $forcedOwner, $forcedProperty, $forcedUnit);

                $contractFile->update([
                    'tenant_id' => $importResult['tenant']->id ?? $contractFile->tenant_id,
                    'contract_id' => $importResult['contract']->id ?? $contractFile->contract_id,
                ]);
            }

            return response()->json([
                'status' => 'ok',
                'message' => $request->boolean('apply')
                    ? 'تم رفع العقد واستخراج بياناته وحفظها في السجلات'
                    : 'تم رفع العقد واستخراج البيانات للمراجعة',
                'contract_file' => $contractFile->fresh(),
                'extracted_data' => $data,
                'import_result' => $importResult,
            ]);
        } catch (\Throwable $e) {
            $contractFile->update([
                'extraction_status' => 'failed',
                'notes' => $e->getMessage(),
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'فشل استخراج بيانات العقد',
                'error' => $e->getMessage(),
                'contract_file' => $contractFile->fresh(),
            ], 500);
        }
    }

    public function show(ContractFile $contractFile)
    {
        return response()->json([
            'status' => 'ok',
            'contract_file' => $contractFile,
        ]);
    }

    private function completeTenantIdentityFromPdf(array $data, string $fullPath): array
    {
        $tenant = $data['tenant'] ?? [];

        try {
            $parser = new Parser();
            $pdf = $parser->parseFile($fullPath);
            $text = $this->normalizePdfText($pdf->getText());
            $tenantBlock = $this->tenantBlock($text);
            $tenantRepresentativeBlock = $this->tenantRepresentativeBlock($text);

            if ($tenantBlock === '') {
                $data['tenant_identity_fallback_note'] = 'لم يتم العثور على قسم بيانات المستأجر بوضوح؛ تم ترك الاسم والجنسية كما هي لتجنب قراءة بيانات المؤجر.';
                return $data;
            }

            $directTenant = $this->extractDirectTenantFields($tenantBlock);
            foreach ($directTenant as $key => $value) {
                if ($value !== null && $value !== '') {
                    $tenant[$key] = $value;
                }
            }

            $companyTenant = $this->extractCompanyTenant($tenantBlock);
            if (!($tenant['name'] ?? null) && ($companyTenant['name'] ?? null)) {
                $tenant['name'] = $companyTenant['name'];
                $tenant['tenant_kind'] = 'company';
                $tenant['name_source'] = 'tenant_company_section';
                if (!empty($companyTenant['organization_type'])) {
                    $tenant['organization_type'] = $companyTenant['organization_type'];
                }
                if (!empty($companyTenant['cr_number'])) {
                    $tenant['commercial_registration_number'] = $companyTenant['cr_number'];
                }
                if (!empty($companyTenant['unified_number'])) {
                    $tenant['unified_number'] = $companyTenant['unified_number'];
                }
            } elseif (!($tenant['name'] ?? null)) {
                $name = $this->extractTenantNameFallback($tenantBlock);
                if ($name) {
                    $tenant['name'] = $name;
                    $tenant['tenant_kind'] = 'individual';
                    $tenant['name_source'] = 'tenant_individual_section';
                }
            }

            if (!($tenant['nationality'] ?? null)) {
                $tenantNationality = $this->extractTenantNationalityFallback($tenantBlock);
                if ($tenantNationality) {
                    $tenant['nationality'] = $tenantNationality;
                    $tenant['nationality_source'] = 'tenant_section';
                }
            }

            if ($tenantRepresentativeBlock !== '') {
                $repName = $this->extractTenantNameFallback($tenantRepresentativeBlock);
                $repNationality = $this->extractTenantNationalityFallback($tenantRepresentativeBlock);
                $repId = $this->extractIdNumber($tenantRepresentativeBlock);
                $repPhone = $this->extractMobileNumber($tenantRepresentativeBlock);

                if ($repName) {
                    $tenant['representative_name'] = $repName;
                }
                if ($repNationality) {
                    $tenant['representative_nationality'] = $repNationality;
                    if (empty($tenant['nationality']) && empty($companyTenant['name'])) {
                        $tenant['nationality'] = $repNationality;
                        $tenant['nationality_source'] = 'tenant_representative_section';
                    }
                }
                if ($repId) {
                    $tenant['representative_id_number'] = $repId;
                    if (empty($tenant['national_id']) && empty($companyTenant['name'])) {
                        $tenant['national_id'] = $repId;
                    }
                }
                if ($repPhone) {
                    $tenant['representative_phone'] = $repPhone;
                    if (empty($tenant['phone'])) {
                        $tenant['phone'] = $repPhone;
                    }
                }
            }

            $data['tenant'] = $tenant;
        } catch (\Throwable $e) {
            $data['tenant_identity_fallback_error'] = $e->getMessage();
        }

        return $data;
    }

    private function extractDirectTenantFields(string $tenantBlock): array
    {
        return [
            'name' => $this->cleanArabicName($this->firstMatch('/(?:االسم|الاسم|الإسم|اإلسم)\s*:?\s*([\p{Arabic}\s\-]+?)\s*Name/u', $tenantBlock)),
            'nationality' => $this->cleanArabicPhrase($this->firstMatch('/(?:الجنسية|الجنسَّية|الجنس\s*ية)\s*:?\s*([\p{Arabic}\s\-]+?)\s*Nationality/u', $tenantBlock)),
            'identity_type' => $this->cleanArabicPhrase($this->firstMatch('/(?:نوع\s*الهوية|نوع\s*الهوَّية)\s*:?\s*([\p{Arabic}\s\-]+?)\s*Type\s*ID/ui', $tenantBlock)),
            'national_id' => $this->firstMatch('/(?:رقم\s*الهوية|رقم\s*الهوَّية)\s*:?\s*(\d{6,20})\s*\.?(?:No\s*ID|ID)/ui', $tenantBlock),
            'phone' => $this->normalizePhone($this->firstMatch('/(?:رقم\s*الجوال|رقم\s*الجَّوال)\s*:?\s*(\+?\d[\d\s]{7,20})\s*\.?(?:No\s*Mobile|Mobile)/ui', $tenantBlock)),
            'tenant_kind' => 'individual',
            'name_source' => 'strict_section_4_tenant_data',
        ];
    }

    private function normalizeExtractedArabicValues(array $data): array
    {
        foreach ([
            ['tenant', 'name'],
            ['tenant', 'nationality'],
            ['tenant', 'identity_type'],
            ['tenant', 'representative_name'],
            ['tenant', 'representative_nationality'],
            ['contract', 'sealing_location'],
            ['property', 'address'],
            ['property', 'city'],
            ['property', 'district'],
            ['unit', 'type'],
        ] as $path) {
            $ref =& $data;
            foreach ($path as $index => $key) {
                if (!is_array($ref) || !array_key_exists($key, $ref)) {
                    unset($ref);
                    continue 2;
                }
                if ($index === count($path) - 1 && is_string($ref[$key])) {
                    $ref[$key] = $this->normalizeKnownArabicPdfWords($ref[$key]);
                } else {
                    $ref =& $ref[$key];
                }
            }
            unset($ref);
        }

        return $data;
    }

    private function normalizePdfText(string $text): string
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

    private function tenantBlock(string $text): string
    {
        return $this->strictBlock($text, [
            '4 بيانات المستأجر',
            'بيانات المستأجر',
            'بيانات المستاجر',
            'Data Tenant',
            'Tenant Data',
        ], [
            '5 بيانات ممثل المستأجر',
            'بيانات ممثل المستأجر',
            'بيانات ممثل المستاجر',
            'Data Representative Tenant',
            'Tenant Representative Data',
            'Brokerage Entity',
            'Data Brokerage',
            'بيانات الوسيط',
            'بيانات المنشأة الوسيطة',
            'بيانات العقار',
        ]);
    }

    private function tenantRepresentativeBlock(string $text): string
    {
        return $this->strictBlock($text, [
            '5 بيانات ممثل المستأجر',
            'Data Representative Tenant',
            'Tenant Representative Data',
            'بيانات ممثل المستأجر',
            'بيانات ممثل المستاجر',
        ], [
            'Brokerage Entity',
            'Data Brokerage',
            'بيانات الوسيط',
            'بيانات المنشأة الوسيطة',
            'Data document Ownership',
            'Ownership document Data',
            'بيانات مستندات الملكية',
            'بيانات العقار',
        ]);
    }

    private function strictBlock(string $text, array $startMarkers, array $endMarkers): string
    {
        foreach ($startMarkers as $start) {
            $startPos = mb_stripos($text, $start);
            if ($startPos === false) {
                continue;
            }

            $startPos += mb_strlen($start);
            $bestEnd = null;

            foreach ($endMarkers as $end) {
                $endPos = mb_stripos($text, $end, $startPos);
                if ($endPos !== false && ($bestEnd === null || $endPos < $bestEnd)) {
                    $bestEnd = $endPos;
                }
            }

            $block = $bestEnd === null
                ? mb_substr($text, $startPos, 2500)
                : mb_substr($text, $startPos, $bestEnd - $startPos);

            $block = trim($block);
            if ($block !== '' && !$this->looksLikeWrongPartyBlock($block)) {
                return $block;
            }
        }

        return '';
    }

    private function looksLikeWrongPartyBlock(string $block): bool
    {
        return mb_stripos($block, 'Data Lessor') !== false
            || mb_stripos($block, 'بيانات المؤجر') !== false
            || mb_stripos($block, 'Lessor Data') !== false
            || mb_stripos($block, 'Name Broker') !== false
            || mb_stripos($block, 'اسم الموظف') !== false;
    }

    private function extractCompanyTenant(string $tenantBlock): array
    {
        $name = null;

        if (preg_match('/Company\s*name\/Founder\s*([\p{Arabic}\s\-]+?)\s*(?:نوع\s*المنظمة|Type\s*Organization|رقم\s*السجل)/ui', $tenantBlock, $m)) {
            $name = $this->cleanArabicPhrase($m[1] ?? null);
        }

        if (!$name && preg_match('/اسم\s*(?:الشركة|الَّشركة|المؤسسة|المؤَّسسة)\s*:?\s*([\p{Arabic}\s\-]+?)\s*(?:Company|نوع\s*المنظمة|Type\s*Organization|رقم\s*السجل)/u', $tenantBlock, $m)) {
            $name = $this->cleanArabicPhrase($m[1] ?? null);
        }

        return [
            'name' => $name,
            'organization_type' => $this->cleanArabicPhrase($this->firstMatch('/نوع\s*المنظمة\s*:?\s*([\p{Arabic}\s\-]+?)\s*(?:Type\s*Organization|اسم|رقم)/u', $tenantBlock)),
            'cr_number' => $this->firstMatch('/(?:رقم\s*السجل\s*التجاري|No\s*CR)\s*:?\s*(\d{5,20})/ui', $tenantBlock),
            'unified_number' => $this->firstMatch('/(?:الرقم\s*الموحد|Number\s*Unified)\s*:?\s*(\d{5,20})/ui', $tenantBlock),
        ];
    }

    private function extractTenantNameFallback(string $block): ?string
    {
        $patterns = [
            '/(?:الاسم|االسم|الإسم|اإلسم)\s*:?\s*([\p{Arabic}\s\-]{3,100}?)\s*Name/u',
            '/Name\s*:?\s*([\p{Arabic}\s\-]{3,100}?)(?:\s*(?:Nationality|الجنس|Type\s*ID|نوع\s*الهوية|ID\s*No|رقم\s*الهوية)|\n)/ui',
            '/Name\s*([\p{Arabic}\s\-]{3,100}?)\s*:?\s*(?:مسالا|مساال)/u',
            '/Name\s*([\p{Arabic}\s\-]{3,100}?)(?:\d{8,}|ID|Nationality)/ui',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $block, $matches)) {
                $candidate = $this->cleanArabicName($matches[1] ?? '');
                if ($candidate) {
                    return $candidate;
                }
            }
        }

        return null;
    }

    private function extractTenantNationalityFallback(string $block): ?string
    {
        $patterns = [
            '/(?:الجنسية|الجنسَّية|الجنس\s*ية)\s*:?\s*([\p{Arabic}\s\-]{2,80}?)\s*Nationality/u',
            '/Nationality\s*:?\s*([\p{Arabic}\s\-]{2,80}?)(?:\s*(?:الجنسية|الجنس|Type\s*ID|نوع\s*الهوية|ID\s*No|رقم\s*الهوية)|\n)/ui',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $block, $matches)) {
                $candidate = $this->cleanArabicPhrase($matches[1] ?? '');
                if ($candidate) {
                    return $candidate;
                }
            }
        }

        return null;
    }

    private function extractIdNumber(string $block): ?string
    {
        return $this->firstMatch('/(?:رقم\s*الهوية|رقم\s*الهوَّية|No\s*ID|ID\s*No\.?)\s*:?\s*(\d{6,20})/ui', $block);
    }

    private function extractMobileNumber(string $block): ?string
    {
        return $this->normalizePhone($this->firstMatch('/(?:رقم\s*الجوال|رقم\s*الجَّوال|Mobile\s*No\.?)\s*:?\s*(\+?\d[\d\s]{7,20})/ui', $block));
    }

    private function firstMatch(string $pattern, string $text): ?string
    {
        if (preg_match($pattern, $text, $matches)) {
            $value = trim($matches[1] ?? '');
            return $value !== '' ? preg_replace('/\s+/u', ' ', $value) : null;
        }

        return null;
    }

    private function normalizePhone(?string $phone): ?string
    {
        if (!$phone) {
            return null;
        }
        $phone = preg_replace('/\s+/u', '', trim($phone)) ?? trim($phone);
        return $phone !== '' ? $phone : null;
    }

    private function cleanArabicName(?string $value): ?string
    {
        $value = $this->cleanArabicPhrase($value);
        if (!$value) {
            return null;
        }

        $value = preg_replace('/\b(Name|Nationality|Email|Mobile|Type|ID|No)\b.*$/iu', '', $value) ?? $value;
        $value = preg_replace('/(?:الاسم|االسم|الإسم|اإلسم|الجنسية|نوع\s*الهوية|رقم\s*الهوية|المؤجر|مالك).*$/u', '', $value) ?? $value;
        $value = trim($value);
        $value = $this->normalizeKnownArabicPdfWords($value);

        return mb_strlen($value) >= 2 ? $value : null;
    }

    private function cleanArabicPhrase(?string $value): ?string
    {
        $value = trim((string) $value);
        if ($value === '' || $value === '-') {
            return null;
        }

        $value = preg_replace('/[^\p{Arabic}\s\-]+/u', ' ', $value) ?? $value;
        $value = preg_replace('/\s+/u', ' ', trim($value)) ?? trim($value);
        $value = preg_replace('/^(بيانات|المستأجر|المستاجر|الفرد|شركة|مؤسسة)\s+/u', '', $value) ?? $value;
        $value = trim($value, " \t\n\r\0\x0B-");
        $value = $this->normalizeKnownArabicPdfWords($value);

        return mb_strlen($value) >= 2 ? $value : null;
    }

    private function normalizeKnownArabicPdfWords(string $value): string
    {
        $value = preg_replace('/\s+/u', ' ', trim($value)) ?? trim($value);

        $map = [
            'رصم' => 'مصر',
            'ايروس' => 'سوريا',
            'هدج' => 'جدة',
            'ةدج' => 'جدة',
            'دقعلا' => 'العقد',
            'ناميلس' => 'سليمان',
            'يولبلا' => 'البلوي',
            'نب' => 'بن',
            'دب' => 'بدر',
            'ردب' => 'بدر',
            'دردب' => 'بدر',
            'دمحم' => 'محمد',
            'ةكلمملا' => 'المملكة',
            'ةيبرعلا' => 'العربية',
            'ةيدوعسلا' => 'السعودية',
            'ةكرش' => 'شركة',
            'يتفايض' => 'ضيافتي',
            'ةراجتلل' => 'للتجارة',
            'صخش' => 'شخص',
            'دحاو' => 'واحد',
        ];

        $words = preg_split('/\s+/u', $value) ?: [];
        $words = array_map(fn ($word) => $map[$word] ?? $word, $words);
        $value = implode(' ', $words);

        if (mb_stripos($value, 'المملكة العربية') !== false && mb_stripos($value, 'السعودية') === false) {
            return 'المملكة العربية السعودية';
        }

        return trim($value);
    }
}
