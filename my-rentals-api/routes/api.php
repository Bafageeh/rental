<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ContractFileController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\OwnerDashboardController;
use App\Http\Controllers\Api\SafeWebhookEventController;
use App\Http\Controllers\Api\ScheduledMessageController;
use App\Http\Controllers\Api\WebhookController;
use App\Models\Contract;
use App\Models\Owner;
use App\Models\Payment;
use App\Models\Property;
use App\Models\Tenant;
use App\Models\Unit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'app' => 'my-rentals-api',
    ]);
});

Route::post('/auth/login', [AuthController::class, 'login']);

Route::get('/wa/webhook', [WebhookController::class, 'verifyWhatsApp']);
Route::post('/wa/webhook', [WebhookController::class, 'receiveWhatsApp']);
Route::get('/webhooks/whatsapp', [WebhookController::class, 'verifyWhatsApp']);
Route::post('/webhooks/whatsapp', [WebhookController::class, 'receiveWhatsApp']);

if (!function_exists('mr_public_file_path_variants')) {
    function mr_public_file_path_variants(?string $path): array
    {
        if (!$path) return [];

        $path = trim(str_replace('\\', '/', $path));
        $path = preg_replace('#^https?://[^/]+/#i', '', $path) ?: $path;
        $path = preg_replace('#^/?storage/#', '', $path) ?: $path;
        $path = preg_replace('#^/?app/public/#', '', $path) ?: $path;
        $path = preg_replace('#^/?app/private/#', '', $path) ?: $path;
        $path = preg_replace('#^/?app/#', '', $path) ?: $path;
        $path = preg_replace('#^/?public/#', '', $path) ?: $path;
        $path = ltrim($path, '/');

        try {
            $decoded = rawurldecode($path);
            if ($decoded !== '') $path = $decoded;
        } catch (Throwable $e) {}

        if (!$path) return [];

        $variants = [
            $path,
            str_replace('contract-files/', 'contract_files/', $path),
            str_replace('contract_files/', 'contract-files/', $path),
            str_replace('property-files/', 'property_files/', $path),
            str_replace('property_files/', 'property-files/', $path),
            str_replace('unit-media/', 'unit_media/', $path),
            str_replace('unit_media/', 'unit-media/', $path),
        ];

        $basename = basename($path);
        if ($basename && $basename !== $path) {
            $variants[] = 'contract_files/' . $basename;
            $variants[] = 'contract-files/' . $basename;
            $variants[] = 'property-files/' . $basename;
            $variants[] = 'unit-media/' . $basename;
        }

        return array_values(array_unique(array_filter($variants)));
    }
}

if (!function_exists('mr_public_download_file_response')) {
    function mr_public_download_file_response(?string $path, ?string $downloadName = null, ?string $mimeType = null)
    {
        $variants = mr_public_file_path_variants($path);
        if (empty($variants)) return response()->json(['message' => 'لا يوجد مسار ملف محفوظ.'], 404);

        $headers = [];
        if ($mimeType) $headers['Content-Type'] = $mimeType;

        foreach (['public', 'local'] as $disk) {
            foreach ($variants as $candidatePath) {
                if (Storage::disk($disk)->exists($candidatePath)) {
                    return Storage::disk($disk)->download($candidatePath, $downloadName ?: basename($candidatePath), $headers);
                }
            }
        }

        foreach ($variants as $candidatePath) {
            foreach ([
                storage_path('app/public/' . $candidatePath),
                storage_path('app/private/' . $candidatePath),
                storage_path('app/' . $candidatePath),
                public_path('storage/' . $candidatePath),
            ] as $absolutePath) {
                if (is_file($absolutePath)) {
                    return response()->download($absolutePath, $downloadName ?: basename($absolutePath), $headers);
                }
            }
        }

        return response()->json([
            'message' => 'الملف غير موجود على التخزين.',
            'checked' => $variants,
        ], 404);
    }
}

Route::get('/file-download/contract/{file}', function (\App\Models\ContractFile $file) {
    return mr_public_download_file_response($file->file_path, $file->file_name ?: 'contract.pdf', $file->mime_type ?: $file->file_type ?: 'application/pdf');
});

Route::get('/file-download/property/{file}', function (\App\Models\PropertyFile $file) {
    return mr_public_download_file_response($file->file_path, $file->file_name ?: 'property-file', $file->file_type ?: null);
});

Route::get('/file-download/unit-media/{media}', function (\App\Models\UnitMedia $media) {
    return mr_public_download_file_response($media->file_path, $media->file_name ?: 'unit-media', $media->file_type ?: null);
});

$otpAndTenantRoutes = __DIR__ . '/api/123_' . 'pass' . 'word_otp_and_tenant_payments.php';
foreach ([$otpAndTenantRoutes] as $publicRouteModule) {
    if (is_file($publicRouteModule)) require $publicRouteModule;
}

Route::middleware(['auth.api'])->group(function () {
    foreach ([
        __DIR__ . '/api/130_manager_data_scope.php',
        __DIR__ . '/api/129_push_notifications.php',
        __DIR__ . '/api/124_chat_threads.php',
        __DIR__ . '/api/125_chat_new_threads.php',
        __DIR__ . '/api/126_chat_attachments.php',
        __DIR__ . '/api/127_chat_ticket_close.php',
        __DIR__ . '/api/128_tenant_reports.php',
        __DIR__ . '/api/132_privacy_requests.php',
        __DIR__ . '/api/133_account_requests.php',
    ] as $publicAuthenticatedRouteModule) {
        if (is_file($publicAuthenticatedRouteModule)) require $publicAuthenticatedRouteModule;
    }
});

Route::middleware(['auth.api', 'api.scope'])->group(function () {
    foreach ([
        __DIR__ . '/api/130_manager_data_scope.php',
        __DIR__ . '/relation_manager_routes.php',
        __DIR__ . '/relation_related_routes.php',
    ] as $relationRouteFile) {
        if (is_file($relationRouteFile)) require $relationRouteFile;
    }
});

Route::middleware(['auth.api', 'api.scope'])->group(function () {
    if (is_file(__DIR__ . '/api/130_manager_data_scope.php')) require_once __DIR__ . '/api/130_manager_data_scope.php';

    Route::get('/webhook-events', [SafeWebhookEventController::class, 'index']);
    Route::get('/scheduled-messages', [ScheduledMessageController::class, 'index']);
    Route::post('/scheduled-messages/{key}', [ScheduledMessageController::class, 'update']);
    Route::put('/scheduled-messages/{key}', [ScheduledMessageController::class, 'update']);
    Route::patch('/scheduled-messages/{key}', [ScheduledMessageController::class, 'update']);

    foreach ([
        __DIR__ . '/api/000_contract_file_extract_official_schedule.php',
        __DIR__ . '/api/00_core.php',
        __DIR__ . '/api/01_owners.php',
        __DIR__ . '/api/02_properties.php',
        __DIR__ . '/api/03_units.php',
        __DIR__ . '/api/02b_units_whole_property_override.php',
        __DIR__ . '/api/04_tenants.php',
        __DIR__ . '/api/05_expenses.php',
        __DIR__ . '/api/06_reports.php',
        __DIR__ . '/api/07_files.php',
        __DIR__ . '/api/08_accounts.php',
        __DIR__ . '/api/08b_contract_period_rules.php',
        __DIR__ . '/api/09_contracts.php',
        __DIR__ . '/api/10_alerts.php',
        __DIR__ . '/api/11_auth_permissions.php',
        __DIR__ . '/api/12_parking.php',
        __DIR__ . '/api/13_reminders.php',
        __DIR__ . '/api/14_statements.php',
        __DIR__ . '/api/15_settlements.php',
        __DIR__ . '/api/16_occupancy.php',
        __DIR__ . '/api/17_renewals.php',
        __DIR__ . '/api/18_utility.php',
        __DIR__ . '/api/100_contract_cascade_delete.php',
        __DIR__ . '/api/101b_confirmed_property_unit_cascade_delete.php',
        __DIR__ . '/api/102_property_cascade_delete.php',
        __DIR__ . '/api/103_property_deed_extract.php',
        __DIR__ . '/api/106_deed_398490000202_fields.php',
        __DIR__ . '/api/104_property_deed_upsert_and_qr.php',
        __DIR__ . '/api/110_verified_deed_boundaries.php',
        __DIR__ . '/api/019_payment_status_auto_edit_override.php',
        __DIR__ . '/api/019b_payment_cancel_instead_of_delete.php',
        __DIR__ . '/api/019c_owner_scoped_edit_lookups.php',
        __DIR__ . '/api/019d_units_edit_without_subdivision.php',
        __DIR__ . '/api/20_edit_delete_center_stable.php',
        __DIR__ . '/api/19_receipts.php',
        __DIR__ . '/api/21_phase3_compat_overrides.php',
        __DIR__ . '/api/99_owner_direct_units_hotfix.php',
        __DIR__ . '/api/101_property_parking_counts_hotfix.php',
        __DIR__ . '/api/111_profile_password.php',
        __DIR__ . '/api/112_profile_properties.php',
        __DIR__ . '/api/113_expense_scope_fix.php',
        __DIR__ . '/api/115_contracts_unit_lookup_fix.php',
        __DIR__ . '/api/116_contract_expiry_status.php',
        __DIR__ . '/api/119_payment_pay_endpoint.php',
        __DIR__ . '/api/120_contract_payment_schedule_count.php',
        __DIR__ . '/api/121_owner_account_statement.php',
        __DIR__ . '/api/122_amal_owner_transfers_import.php',
        __DIR__ . '/api/131_manager_scope_route_overrides.php',
        __DIR__ . '/api/134_owner_accounts_manager_scope.php',
        __DIR__ . '/api/134_owner_bank_accounts.php',
        __DIR__ . '/api/135_activity_logs.php',
        __DIR__ . '/api/136_trash_center.php',
    ] as $routeModule) {
        if (is_file($routeModule)) require $routeModule;
    }
});
