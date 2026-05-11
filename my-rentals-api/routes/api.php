<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ContractFileController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\OwnerDashboardController;
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

/*
|--------------------------------------------------------------------------
| Phase 1 security routes: relation manager
|--------------------------------------------------------------------------
| Important for PHPUnit:
| Use require, not require_once, and do not guard this block with constants.
| Laravel refreshes the app between tests inside the same PHP process.
*/
Route::middleware(['auth.api', 'api.scope'])->group(function () {
    foreach ([
        __DIR__ . '/relation_manager_routes.php',
        __DIR__ . '/relation_related_routes.php',
    ] as $relationRouteFile) {
        if (is_file($relationRouteFile)) {
            require $relationRouteFile;
        }
    }
});

// PHASE2_ROUTE_MODULES: api.php was split into routes/api/*.php for maintainability.
Route::middleware(['auth.api', 'api.scope'])->group(function () {
    Route::get('/webhook-events', [WebhookController::class, 'index']);
    Route::get('/scheduled-messages', [ScheduledMessageController::class, 'index']);
    Route::post('/scheduled-messages/{key}', [ScheduledMessageController::class, 'update']);
    Route::put('/scheduled-messages/{key}', [ScheduledMessageController::class, 'update']);
    Route::patch('/scheduled-messages/{key}', [ScheduledMessageController::class, 'update']);

    foreach ([
        // يجب تحميل هذا المسار قبل 00_core.php لأن Laravel يستخدم أول مسار مطابق لرفع العقد.
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
        // يجب تحميل قواعد فترات العقود قبل المسار العام حتى لا يمنع العقود التاريخية.
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
        // يجب تحميل تأكيد حذف العقار/الوحدة قبل المسارات العامة لأن Laravel يستخدم أول مسار مطابق.
        __DIR__ . '/api/101b_confirmed_property_unit_cascade_delete.php',
        __DIR__ . '/api/102_property_cascade_delete.php',
        __DIR__ . '/api/103_property_deed_extract.php',
        // صكوك خاصة يجب تسجيل مسارها قبل المسار العام حتى لا يلتقط المسار العام الطلب أولًا.
        __DIR__ . '/api/106_deed_398490000202_fields.php',
        __DIR__ . '/api/104_property_deed_upsert_and_qr.php',
        // يجب تحميل مسارات تعديل الدفعات قبل مركز التعديل العام لأن Laravel يستخدم أول مسار مطابق.
        __DIR__ . '/api/019_payment_status_auto_edit_override.php',
        // يجب تحميل إلغاء السداد قبل مركز الحذف العام حتى لا يحذف القسط فعليًا.
        __DIR__ . '/api/019b_payment_cancel_instead_of_delete.php',
        // يجب تحميل فلترة اختيارات التعديل حسب سياق المالك قبل مركز التعديل العام لأن Laravel يستخدم أول مسار مطابق.
        __DIR__ . '/api/019c_owner_scoped_edit_lookups.php',
        // يجب تحميل إخفاء حقول الوحدة المقسمة قبل مركز التعديل العام.
        __DIR__ . '/api/019d_units_edit_without_subdivision.php',
        __DIR__ . '/api/20_edit_delete_center_stable.php',
        __DIR__ . '/api/19_receipts.php',
        __DIR__ . '/api/21_phase3_compat_overrides.php',
        __DIR__ . '/api/99_owner_direct_units_hotfix.php',
        __DIR__ . '/api/101_property_parking_counts_hotfix.php',
        __DIR__ . '/api/111_profile_password.php',
        __DIR__ . '/api/112_profile_properties.php',
    ] as $routeModule) {
        if (is_file($routeModule)) {
            require $routeModule;
        }
    }
});
