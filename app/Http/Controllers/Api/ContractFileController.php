<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContractFile;
use App\Models\Owner;
use App\Services\GovernmentContractImporter;
use App\Services\GovernmentContractPdfExtractor;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

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

            $contractFile->update([
                'extraction_status' => 'processed',
                'extracted_data' => $data,
            ]);

            $importResult = null;

            if ($request->boolean('apply')) {
                $forcedOwner = $request->integer('owner_id')
                    ? Owner::find($request->integer('owner_id'))
                    : null;

                $importResult = $importer->import($data, $forcedOwner);

                $contractFile->update([
                    'tenant_id' => $importResult['tenant']->id ?? $contractFile->tenant_id,
                    'contract_id' => $importResult['contract']->id ?? $contractFile->contract_id,
                ]);
            }

            return response()->json([
                'status' => 'ok',
                'message' => $request->boolean('apply')
                    ? 'تم رفع العقد واستخراج البيانات وتحديث السجلات'
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
}
