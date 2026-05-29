<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (!function_exists('mrc_expiry_mark_expired_contracts')) {
    function mrc_expiry_mark_expired_contracts(): void
    {
        if (!Schema::hasTable('contracts')) return;
        DB::table('contracts')
            ->whereNotNull('end_date')
            ->whereDate('end_date', '<', now()->toDateString())
            ->whereNotIn('status', ['ended', 'cancelled', 'canceled'])
            ->update(['status' => 'ended', 'updated_at' => now()]);
    }
}

if (!function_exists('mrc_expiry_sync_unit_statuses')) {
    function mrc_expiry_sync_unit_statuses(): void
    {
        if (!Schema::hasTable('units') || !Schema::hasTable('contracts')) return;
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
                    $q->whereNull('end_date')->orWhereDate('end_date', '>=', now()->toDateString());
                })
                ->whereNotIn('status', ['ended', 'cancelled', 'canceled'])
                ->exists();
            if (!$hasActiveContract) {
                DB::table('units')->where('id', $unitId)->update(['status' => 'available', 'updated_at' => now()]);
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
    return response()->json(['status' => 'ok']);
});

Route::get('/my/contracts/refresh-expiry-status', function () {
    mrc_expiry_apply_rule();
    return response()->json(['status' => 'ok']);
});

mrc_expiry_apply_rule();

$overdueFormulaRoute = __DIR__ . '/117_contract_overdue_formula.php';
if (is_file($overdueFormulaRoute)) {
    require_once $overdueFormulaRoute;
}
