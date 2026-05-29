<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

/*
|--------------------------------------------------------------------------
| Contract expiry status rule
|--------------------------------------------------------------------------
| أي عقد تاريخ نهايته قبل تاريخ اليوم يعتبر منتهيًا وليس نشطًا.
| يتم تطبيق القاعدة على قاعدة البيانات قبل إرجاع العقود، حتى لا تظهر العقود
| المنتهية كنشطة في الشاشات والإحصائيات.
*/

if (!function_exists('mrc_expiry_mark_expired_contracts')) {
    function mrc_expiry_mark_expired_contracts(): void
    {
        if (!Schema::hasTable('contracts')) {
            return;
        }

        DB::table('contracts')
            ->whereNotNull('end_date')
            ->whereDate('end_date', '<', now()->toDateString())
            ->whereNotIn('status', ['ended', 'منتهي', 'cancelled', 'canceled', 'ملغي'])
            ->update([
                'status' => 'ended',
                'updated_at' => now(),
            ]);
    }
}

if (!function_exists('mrc_expiry_sync_unit_statuses')) {
    function mrc_expiry_sync_unit_statuses(): void
    {
        if (!Schema::hasTable('units') || !Schema::hasTable('contracts')) {
            return;
        }

        $expiredUnitIds = DB::table('contracts')
            ->whereNotNull('unit_id')
            ->whereNotNull('end_date')
            ->whereDate('end_date', '<', now()->toDateString())
            ->pluck('unit_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        foreach ($expiredUnitIds as $unitId) {
            $hasActiveContract = DB::table('contracts')
                ->where('unit_id', $unitId)
                ->where(function ($q) {
                    $q->whereNull('end_date')
                        ->orWhereDate('end_date', '>=', now()->toDateString());
                })
                ->whereNotIn('status', ['ended', 'منتهي', 'cancelled', 'canceled', 'ملغي'])
                ->exists();

            if (!$hasActiveContract) {
                DB::table('units')
                    ->where('id', $unitId)
                    ->update([
                        'status' => 'available',
                        'updated_at' => now(),
                    ]);
            }
        }
    }
}

if (!function_exists('mrc_expiry_apply_rule')) {
    function mrc_expiry_apply_rule(): void
    {
        mrc_expiry_mark_expired_contracts();
        mrc_expiry_sync_unit_statuses();
    }
}

Route::get('/contracts/refresh-expiry-status', function () {
    mrc_expiry_apply_rule();

    return response()->json([
        'status' => 'ok',
        'message' => 'تم تحديث حالات العقود المنتهية حسب تاريخ النهاية.',
    ]);
});

Route::get('/my/contracts/refresh-expiry-status', function () {
    mrc_expiry_apply_rule();

    return response()->json([
        'status' => 'ok',
        'message' => 'تم تحديث حالات العقود المنتهية حسب تاريخ النهاية.',
    ]);
});

// طبّق القاعدة عند تحميل هذا الملف حتى تستفيد كل المسارات التي تُحمّل بعده.
mrc_expiry_apply_rule();
