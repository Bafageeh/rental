<?php

use App\Http\Controllers\Api\ContractFileController;
use App\Models\Contract;
use App\Services\GovernmentContractImporter;
use App\Services\GovernmentContractPdfExtractor;
use App\Services\OfficialPaymentScheduleSynchronizer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Contract PDF extraction guard
|--------------------------------------------------------------------------
| This route is intentionally loaded before routes/api/00_core.php because
| Laravel uses the first matching route. It lets the existing controller do
| the upload/extract/import work, then forces the database payments to match
| the official PDF payment table shown in the preview.
*/

Route::post('/contract-files/extract', function (
    Request $request,
    GovernmentContractPdfExtractor $extractor,
    GovernmentContractImporter $importer,
    OfficialPaymentScheduleSynchronizer $paymentScheduleSynchronizer
) {
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

    $payments = $payload['extracted_data']['payments'] ?? [];
    $contractId = $payload['import_result']['contract']['id'] ?? null;

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

        $payload['message'] = 'تم رفع العقد واستخراج بياناته وحفظها في السجلات، وتم اعتماد جدول الدفعات من ملف PDF الرسمي.';
    }

    return response()->json($payload, $response->getStatusCode());
});
