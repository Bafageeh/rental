<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

require_once base_path('app/Support/RelationManagerHelpers.php');

if (!function_exists('mrc_contract_user')) {
    function mrc_contract_user(Request $request)
    {
        if (function_exists('my_rentals_ed_current_user')) {
            return my_rentals_ed_current_user($request);
        }
        return $request->user();
    }
}

if (!function_exists('mrc_contract_admin')) {
    function mrc_contract_admin($user): bool
    {
        if (!$user) return false;
        if (function_exists('my_rentals_ed_is_admin')) return my_rentals_ed_is_admin($user);
        if (function_exists('mr_user_is_admin')) return mr_user_is_admin($user);
        $role = method_exists($user, 'effectiveRole') ? $user->effectiveRole() : strtolower((string) ($user->role ?? ''));
        return in_array($role, ['admin', 'manager', 'super_admin'], true);
    }
}

if (!function_exists('mrc_contract_count')) {
    function mrc_contract_count(string $table, string $column, array $ids): int
    {
        if (!function_exists('mr_has_table') || !mr_has_table($table) || !mr_has_col($table, $column) || count($ids) === 0) return 0;
        return (int) DB::table($table)->whereIn($column, $ids)->count();
    }
}

if (!function_exists('mrc_contract_payment_ids')) {
    function mrc_contract_payment_ids(int $contractId): array
    {
        if (!function_exists('mr_has_table') || !mr_has_table('payments') || !mr_has_col('payments', 'contract_id')) return [];
        return DB::table('payments')->where('contract_id', $contractId)->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
    }
}

if (!function_exists('mrc_contract_details')) {
    function mrc_contract_details(int $contractId): array
    {
        $paymentIds = mrc_contract_payment_ids($contractId);
        $receiptCount = mrc_contract_count('payment_receipts', 'contract_id', [$contractId]);
        if (count($paymentIds) > 0) {
            $receiptCount += mrc_contract_count('payment_receipts', 'payment_id', $paymentIds);
        }

        $counts = [
            'payments' => count($paymentIds),
            'payment_receipts' => $receiptCount,
            'contract_files' => mrc_contract_count('contract_files', 'contract_id', [$contractId]),
            'follow_up_tasks' => mrc_contract_count('follow_up_tasks', 'contract_id', [$contractId]),
            'document_records' => mrc_contract_count('document_records', 'contract_id', [$contractId]),
            'unit_inspections' => mrc_contract_count('unit_inspections', 'contract_id', [$contractId]),
        ];

        $labels = [
            'payments' => 'دفعات مرتبطة',
            'payment_receipts' => 'سندات قبض مرتبطة',
            'contract_files' => 'ملفات عقد مرفوعة',
            'follow_up_tasks' => 'مهام متابعة مرتبطة',
            'document_records' => 'مستندات مرتبطة',
            'unit_inspections' => 'معاينات وحدة مرتبطة',
        ];

        $blockers = [];
        foreach ($counts as $key => $value) {
            if ((int) $value > 0) $blockers[] = 'يوجد ' . (int) $value . ' ' . ($labels[$key] ?? $key);
        }

        return [$counts, $blockers, $paymentIds];
    }
}

if (!function_exists('mrc_contract_response')) {
    function mrc_contract_response(int $contractId, Request $request)
    {
        $user = mrc_contract_user($request);
        if (!mrc_contract_admin($user)) {
            return response()->json(['message' => 'الحذف متاح للمدير فقط.'], 403);
        }

        if (!mr_has_table('contracts') || !DB::table('contracts')->where('id', $contractId)->exists()) {
            return response()->json(['message' => 'العقد غير موجود أو تم حذفه مسبقًا.'], 404);
        }

        [$counts, $blockers, $paymentIds] = mrc_contract_details($contractId);

        if ($request->boolean('preview_only')) {
            return response()->json([
                'status' => 'ok',
                'message' => $blockers ? 'هذا العقد يحتوي على ارتباطات.' : 'لا توجد ارتباطات تمنع حذف العقد.',
                'blockers' => $blockers,
                'related_counts' => $counts,
                'cascade_available' => true,
            ]);
        }

        $contract = DB::table('contracts')->where('id', $contractId)->first();
        $unitId = $contract->unit_id ?? null;
        $done = [];

        DB::transaction(function () use ($contractId, $paymentIds, $unitId, &$done) {
            $done['payment_receipts_by_payment'] = mr_soft_or_hard_delete('payment_receipts', 'payment_id', $paymentIds);
            $done['payment_receipts_by_contract'] = mr_soft_or_hard_delete('payment_receipts', 'contract_id', [$contractId]);
            $done['contract_files'] = mr_soft_or_hard_delete('contract_files', 'contract_id', [$contractId]);
            $done['follow_up_tasks'] = mr_soft_or_hard_delete('follow_up_tasks', 'contract_id', [$contractId]);
            $done['document_records'] = mr_soft_or_hard_delete('document_records', 'contract_id', [$contractId]);
            $done['unit_inspections'] = mr_soft_or_hard_delete('unit_inspections', 'contract_id', [$contractId]);
            $done['payments'] = mr_soft_or_hard_delete('payments', 'contract_id', [$contractId]);
            $done['contracts'] = mr_soft_or_hard_delete_by_id('contracts', [$contractId]);

            if ($unitId && mr_has_table('units') && mr_has_col('units', 'status')) {
                $active = mr_has_table('contracts') && mr_has_col('contracts', 'unit_id') && mr_has_col('contracts', 'status')
                    ? DB::table('contracts')->where('unit_id', $unitId)->where('status', 'active')->count()
                    : 0;
                if ((int) $active === 0) DB::table('units')->where('id', $unitId)->update(['status' => 'available']);
            }
        });

        return response()->json([
            'status' => 'ok',
            'message' => $blockers ? 'تم حذف العقد مع ارتباطاته: ' . implode('، ', $blockers) : 'تم حذف العقد بنجاح.',
            'deleted_counts' => $done,
            'related_counts_before_delete' => $counts,
        ]);
    }
}

Route::post('/edit-delete-center/contracts/{contractId}/delete', fn (int $contractId, Request $request) => mrc_contract_response($contractId, $request));
Route::post('/my/edit-delete-center/contracts/{contractId}/delete', fn (int $contractId, Request $request) => mrc_contract_response($contractId, $request));
