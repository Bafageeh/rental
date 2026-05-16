<?php

use App\Http\Controllers\Api\ContractFileController;
use App\Models\Contract;
use App\Models\ContractFile;
use App\Models\Property;
use App\Models\Unit;
use App\Services\GovernmentContractImporter;
use App\Services\GovernmentContractPdfExtractor;
use App\Services\OfficialPaymentScheduleSynchronizer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

/*
|--------------------------------------------------------------------------
| Contract PDF extraction guard
|--------------------------------------------------------------------------
| This route is intentionally loaded before routes/api/00_core.php because
| Laravel uses the first matching route. It lets the existing controller do
| the upload/extract/import work, then forces the database payments to match
| the official PDF payment table shown in the preview.
|
| Important import rule:
| When applying an uploaded rent contract, do not create a property or a unit
| from the PDF. The contract must be linked only to the property/unit context
| that opened the upload screen.
*/

if (!function_exists('mr_existing_contract_upload_unit_for_property')) {
    function mr_existing_contract_upload_unit_for_property(int $propertyId): ?Unit
    {
        $property = Property::find($propertyId);
        if (!$property) {
            return null;
        }

        $wholePropertyUnit = Unit::where('property_id', $property->id)
            ->where(function ($query) {
                $query->where('type', 'whole_property')
                    ->orWhere('unit_number', 'العقار كامل');
            })
            ->orderBy('id')
            ->first();

        if ($wholePropertyUnit) {
            return $wholePropertyUnit;
        }

        $units = Unit::where('property_id', $property->id)
            ->orderBy('id')
            ->get();

        if ($units->count() === 1) {
            return $units->first();
        }

        return null;
    }
}

if (!function_exists('mr_force_contract_upload_existing_target')) {
    function mr_force_contract_upload_existing_target(Request $request): void
    {
        if (!$request->boolean('apply')) {
            return;
        }

        $unitId = $request->integer('unit_id') ?: null;
        if ($unitId) {
            return;
        }

        $propertyId = $request->integer('property_id') ?: null;
        if (!$propertyId) {
            abort(response()->json([
                'status' => 'error',
                'message' => 'لا يمكن اعتماد عقد الإيجار بدون فتح الرفع من شاشة عقار أو وحدة محددة. لن يتم إنشاء عقار أو وحدة من ملف PDF.',
            ], 422));
        }

        $targetUnit = mr_existing_contract_upload_unit_for_property($propertyId);
        if (!$targetUnit) {
            abort(response()->json([
                'status' => 'error',
                'message' => 'لا يمكن اعتماد عقد الإيجار على هذا العقار لأن العقار لا يحتوي وحدة ربط موجودة. افتح الرفع من الوحدة المطلوبة أو أنشئ العقد على وحدة موجودة؛ لن يتم إنشاء وحدة تلقائيًا من ملف PDF.',
            ], 422));
        }

        $request->merge([
            'unit_id' => $targetUnit->id,
            'property_id' => $targetUnit->property_id ?: $propertyId,
            'contract_scope' => 'unit',
            'target_type' => 'unit',
        ]);
    }
}

if (!function_exists('mr_contract_file_clean_segment')) {
    function mr_contract_file_clean_segment(?string $value): string
    {
        $value = trim((string) $value);

        if ($value !== '') {
            try {
                $decoded = rawurldecode($value);
                if ($decoded !== '') {
                    $value = $decoded;
                }
            } catch (Throwable $e) {
                // Keep the original value when decoding fails.
            }
        }

        $value = preg_replace('/[\\\\\/\:\*\?"<>\|]+/u', '-', $value) ?? $value;
        $value = preg_replace('/\s+/u', ' ', trim($value)) ?? trim($value);
        $value = trim($value, " \t\n\r\0\x0B.-_");

        return $value !== '' ? mb_substr($value, 0, 90) : 'عقد إيجار';
    }
}

if (!function_exists('mr_contract_file_unit_is_whole_property')) {
    function mr_contract_file_unit_is_whole_property(?Unit $unit): bool
    {
        if (!$unit) {
            return false;
        }

        return ($unit->type ?? null) === 'whole_property'
            || trim((string) ($unit->unit_number ?? '')) === 'العقار كامل';
    }
}

if (!function_exists('mr_contract_file_target_label')) {
    function mr_contract_file_target_label(?Contract $contract, ?Request $request = null): string
    {
        $contract?->loadMissing(['unit.property']);
        $unit = $contract?->unit;
        $property = $unit?->property;

        if (!$unit && $request?->integer('unit_id')) {
            $unit = Unit::with('property')->find($request->integer('unit_id'));
            $property = $unit?->property;
        }

        if (!$property && $request?->integer('property_id')) {
            $property = Property::find($request->integer('property_id'));
        }

        if ($unit && !mr_contract_file_unit_is_whole_property($unit)) {
            $unitLabel = $unit->name
                ?? $unit->unit_name
                ?? $unit->unit_number
                ?? ('وحدة ' . $unit->id);

            return mr_contract_file_clean_segment((string) $unitLabel);
        }

        if ($property) {
            return mr_contract_file_clean_segment($property->name ?? ('عقار ' . $property->id));
        }

        if ($unit) {
            return mr_contract_file_clean_segment($unit->unit_number ?? ('وحدة ' . $unit->id));
        }

        return 'عقد إيجار';
    }
}

if (!function_exists('mr_contract_file_display_name')) {
    function mr_contract_file_display_name(?Contract $contract, ?Request $request = null): string
    {
        return 'عقد إيجار - ' . mr_contract_file_target_label($contract, $request) . '.pdf';
    }
}

if (!function_exists('mr_rename_contract_file_for_target')) {
    function mr_rename_contract_file_for_target(?int $contractFileId, ?int $contractId, Request $request): ?ContractFile
    {
        if (!$contractFileId) {
            return null;
        }

        $contract = $contractId
            ? Contract::with(['unit.property', 'tenant'])->find($contractId)
            : null;

        $fileName = mr_contract_file_display_name($contract, $request);

        $contractFile = ContractFile::find($contractFileId);
        if (!$contractFile) {
            return null;
        }

        $contractFile->update(['file_name' => $fileName]);

        return $contractFile->fresh(['contract.tenant', 'contract.unit.property.owner', 'tenant']);
    }
}

if (!function_exists('mr_publish_contract_file_for_download')) {
    function mr_publish_contract_file_for_download(?int $contractFileId): ?ContractFile
    {
        if (!$contractFileId) {
            return null;
        }

        $contractFile = ContractFile::find($contractFileId);
        if (!$contractFile || !$contractFile->file_path) {
            return $contractFile;
        }

        $currentPath = (string) $contractFile->file_path;
        if (Storage::disk('public')->exists($currentPath)) {
            return $contractFile;
        }

        if (!Storage::disk('local')->exists($currentPath)) {
            return $contractFile;
        }

        $extension = pathinfo($contractFile->file_name ?: $currentPath, PATHINFO_EXTENSION) ?: 'pdf';
        $baseName = pathinfo($contractFile->file_name ?: 'عقد إيجار', PATHINFO_FILENAME) ?: 'عقد إيجار';
        $publicFileName = mr_contract_file_clean_segment($baseName) . '.' . strtolower($extension ?: 'pdf');
        $publicPath = 'contract-files/' . now()->format('Y/m') . '/' . $contractFile->id . '/' . $publicFileName;

        Storage::disk('public')->put($publicPath, Storage::disk('local')->get($currentPath));
        $contractFile->update(['file_path' => $publicPath]);

        return $contractFile->fresh(['contract.tenant', 'contract.unit.property.owner', 'tenant']);
    }
}

Route::post('/contract-files/extract', function (
    Request $request,
    GovernmentContractPdfExtractor $extractor,
    GovernmentContractImporter $importer,
    OfficialPaymentScheduleSynchronizer $paymentScheduleSynchronizer
) {
    mr_force_contract_upload_existing_target($request);

    /** @var ContractFileController $controller */
    $controller = app(ContractFileController::class);
    $response = $controller->extract($request, $extractor, $importer);

    if (!$request->boolean('apply') || $response->getStatusCode() < 200 || $response->getStatusCode() >= 300) {
        return $response;
    }

    $payload = json_decode($response->getContent() ?: '{}', true);
    if (!is_array($payload)) {
        return $response;
    }

    $contractFileId = isset($payload['contract_file']['id']) ? (int) $payload['contract_file']['id'] : null;
    $payments = $payload['extracted_data']['payments'] ?? [];
    $contractId = $payload['import_result']['contract']['id'] ?? null;

    mr_rename_contract_file_for_target($contractFileId, $contractId ? (int) $contractId : null, $request);

    $publishedContractFile = mr_publish_contract_file_for_download($contractFileId);
    if ($publishedContractFile) {
        $payload['contract_file'] = $publishedContractFile;
        $payload['contract_file']['file_url'] = $publishedContractFile->file_path ? url('/storage/' . $publishedContractFile->file_path) : null;
        $payload['contract_file']['download_url'] = $payload['contract_file']['file_url'];
    }

    if ($contractId && is_array($payments) && !empty($payments)) {
        $synced = $paymentScheduleSynchronizer->sync((int) $contractId, $payments);

        $payload['import_result']['payments_count'] = $synced;
        $payload['import_result']['payments_source'] = $payload['extracted_data']['payments_source'] ?? 'official_ejar_schedule';

        $freshContract = Contract::with(['tenant', 'unit.property.owner', 'payments' => function ($query) {
            $query->orderByRaw('COALESCE(sequence, 999999)')->orderBy('due_date')->orderBy('id');
        }])->find((int) $contractId);

        if ($freshContract) {
            $payload['import_result']['contract'] = $freshContract;
        }

        $payload['message'] = 'تم رفع العقد واستخراج بياناته وحفظها في السجلات، وتم اعتماد جدول الدفعات من ملف PDF الرسمي وربط العقد بالهدف الموجود مسبقًا دون إنشاء عقار أو وحدة.';
    }

    return response()->json($payload, $response->getStatusCode());
});
