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
        $missingName = empty($tenant['name']) || trim((string) $tenant['name']) === 'مستأجر غير محدد';
        $missingNationality = empty($tenant['nationality']);

        if (!$missingName && !$missingNationality) {
            return $data;
        }

        try {
            $parser = new Parser();
            $pdf = $parser->parseFile($fullPath);
            $text = $this->normalizePdfText($pdf->getText());
            $tenantBlock = $this->tenantBlock($text);

            if ($tenantBlock === '') {
                $data['tenant_identity_fallback_note'] = 'لم يتم العثور على قسم بيانات المستأجر بوضوح؛ تم ترك الاسم والجنسية كما هي لتجنب قراءة بيانات المؤجر.';
                return $data;
            }

            if ($missingName) {
                $name = $this->extractTenantNameFallback($tenantBlock);
                if ($name) {
                    $tenant['name'] = $name;
                    $tenant['name_source'] = 'controller_strict_tenant_block';
                }
            }

            if ($missingNationality) {
                $nationality = $this->extractTenantNationalityFallback($tenantBlock);
                if ($nationality) {
                    $tenant['nationality'] = $nationality;
                    $tenant['nationality_source'] = 'controller_strict_tenant_block';
                }
            }

            $data['tenant'] = $tenant;
        } catch (\Throwable $e) {
            $data['tenant_identity_fallback_error'] = $e->getMessage();
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
        $startMarkers = [
            'Data Tenant',
            'Tenant Data',
            'بيانات المستأجر',
            'بيانات المستاجر',
        ];

        $endMarkers = [
            'Data Representative Tenant',
            'Tenant Representative Data',
            'بيانات ممثل المستأجر',
            'بيانات ممثل المستاجر',
            'Brokerage Entity',
            'Data Brokerage',
            'بيانات الوسيط',
            'بيانات المنشأة الوسيطة',
            'بيانات العقار',
        ];

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
            if ($block !== '' && !$this->looksLikeLessorBlock($block)) {
                return $block;
            }
        }

        return '';
    }

    private function looksLikeLessorBlock(string $block): bool
    {
        return mb_stripos($block, 'Data Lessor') !== false
            || mb_stripos($block, 'بيانات المؤجر') !== false
            || mb_stripos($block, 'Lessor Data') !== false;
    }

    private function extractTenantNameFallback(string $tenantBlock): ?string
    {
        $patterns = [
            '/(?:الاسم|االسم|الإسم|اإلسم)\s*:?\s*([\p{Arabic}\s]{3,80}?)(?:\s*Name|\n|الجنس|Nationality|نوع\s*الهوية|رقم\s*الهوية)/u',
            '/Name\s*:?\s*([\p{Arabic}\s]{3,80}?)(?:\s*(?:Nationality|الجنس|Type\s*ID|نوع\s*الهوية|ID\s*No|رقم\s*الهوية)|\n)/ui',
            '/Name\s*([\p{Arabic}\s]{3,80}?)\s*:?\s*(?:مسالا|مساال)/u',
            '/Name\s*([\p{Arabic}\s]{3,80}?)(?:\d{8,}|ID|Nationality)/ui',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $tenantBlock, $matches)) {
                $candidate = $this->cleanArabicName($matches[1] ?? '');
                if ($candidate) {
                    return $candidate;
                }
            }
        }

        return null;
    }

    private function extractTenantNationalityFallback(string $tenantBlock): ?string
    {
        $patterns = [
            '/(?:الجنسية|الجنسّية|الجنسَّية|الجنس\s*ية)\s*:?\s*([\p{Arabic}\s]{3,80}?)(?:\s*Nationality|\n|نوع\s*الهوية|Type\s*ID|رقم\s*الهوية)/u',
            '/Nationality\s*:?\s*([\p{Arabic}\s]{3,80}?)(?:\s*(?:الجنسية|الجنس|Type\s*ID|نوع\s*الهوية|ID\s*No|رقم\s*الهوية)|\n)/ui',
            '/Nationality\s*([\p{Arabic}\s]{3,80}?)\s*:?\s*(?:ةيسنجلا|الجنسية)/u',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $tenantBlock, $matches)) {
                $candidate = $this->cleanArabicPhrase($matches[1] ?? '');
                if ($candidate) {
                    return $candidate;
                }
            }
        }

        return null;
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

        return mb_strlen($value) >= 3 ? $value : null;
    }

    private function cleanArabicPhrase(?string $value): ?string
    {
        $value = trim((string) $value);
        if ($value === '' || $value === '-') {
            return null;
        }

        $value = preg_replace('/[^\p{Arabic}\s]+/u', ' ', $value) ?? $value;
        $value = preg_replace('/\s+/u', ' ', trim($value)) ?? trim($value);
        $value = preg_replace('/^(بيانات|المستأجر|المستاجر|الفرد|شركة|مؤسسة)\s+/u', '', $value) ?? $value;
        $value = trim($value);

        return mb_strlen($value) >= 3 ? $value : null;
    }
}
