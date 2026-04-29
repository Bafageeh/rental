<?php

/*
|--------------------------------------------------------------------------
| Property cascade delete route
|--------------------------------------------------------------------------
| The generic edit/delete-center route blocks property deletion when units are
| linked to the property. This route intentionally allows an admin to delete a
| property together with its linked units, contracts, payments, receipts,
| expenses, bills, files, inspections, and follow-up records.
*/

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

require_once base_path('app/Support/RelationManagerHelpers.php');

if (!function_exists('mrp_property_user')) {
    function mrp_property_user(Request $request)
    {
        if (function_exists('my_rentals_ed_current_user')) {
            return my_rentals_ed_current_user($request);
        }

        if (function_exists('my_rentals_current_user_for_scope')) {
            return my_rentals_current_user_for_scope($request);
        }

        return $request->user();
    }
}

if (!function_exists('mrp_property_admin')) {
    function mrp_property_admin($user): bool
    {
        if (!$user) return false;
        if (function_exists('my_rentals_ed_is_admin')) return my_rentals_ed_is_admin($user);
        if (function_exists('mr_user_is_admin')) return mr_user_is_admin($user);

        $role = method_exists($user, 'effectiveRole') ? $user->effectiveRole() : strtolower((string) ($user->role ?? ''));
        return in_array($role, ['admin', 'manager', 'super_admin'], true);
    }
}

if (!function_exists('mrp_ids')) {
    function mrp_ids(string $table, string $column, array $ids): array
    {
        if (!mr_has_table($table) || !mr_has_col($table, 'id') || !mr_has_col($table, $column) || count($ids) === 0) {
            return [];
        }

        return DB::table($table)
            ->whereIn($column, $ids)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
    }
}

if (!function_exists('mrp_count')) {
    function mrp_count(string $table, string $column, array $ids): int
    {
        if (!mr_has_table($table) || !mr_has_col($table, $column) || count($ids) === 0) return 0;
        return (int) DB::table($table)->whereIn($column, $ids)->count();
    }
}

if (!function_exists('mrp_merge_ids')) {
    function mrp_merge_ids(array ...$lists): array
    {
        $merged = [];
        foreach ($lists as $list) {
            foreach ($list as $id) {
                $id = (int) $id;
                if ($id > 0) $merged[] = $id;
            }
        }

        return array_values(array_unique($merged));
    }
}

if (!function_exists('mrp_contract_ids_for_property')) {
    function mrp_contract_ids_for_property(array $propertyIds, array $unitIds): array
    {
        if (!mr_has_table('contracts') || !mr_has_col('contracts', 'id')) {
            return [];
        }

        $query = DB::table('contracts');
        $hasWhere = false;

        if (mr_has_col('contracts', 'property_id') && count($propertyIds) > 0) {
            $query->whereIn('property_id', $propertyIds);
            $hasWhere = true;
        }

        if (mr_has_col('contracts', 'unit_id') && count($unitIds) > 0) {
            if ($hasWhere) {
                $query->orWhereIn('unit_id', $unitIds);
            } else {
                $query->whereIn('unit_id', $unitIds);
            }
            $hasWhere = true;
        }

        if (!$hasWhere) return [];

        return $query->pluck('id')->map(fn ($id) => (int) $id)->unique()->values()->all();
    }
}

if (!function_exists('mrp_entity_delete')) {
    function mrp_entity_delete(string $table, string $entityType, array $ids): int
    {
        if (!mr_has_table($table) || count($ids) === 0) return 0;
        if (!mr_has_col($table, 'entity_type') || !mr_has_col($table, 'entity_id')) return 0;

        $query = DB::table($table)
            ->whereIn('entity_id', $ids)
            ->whereIn('entity_type', [$entityType, ucfirst($entityType), $entityType . 's', ucfirst($entityType) . 's']);

        $count = (clone $query)->count();
        if ($count === 0) return 0;

        if (mr_has_col($table, 'deleted_at')) {
            $data = ['deleted_at' => now()];
            if (mr_has_col($table, 'updated_at')) $data['updated_at'] = now();
            $query->update($data);
        } else {
            $query->delete();
        }

        return $count;
    }
}

if (!function_exists('mrp_property_related_counts')) {
    function mrp_property_related_counts(int $propertyId): array
    {
        $propertyIds = [$propertyId];
        $unitIds = mrp_ids('units', 'property_id', $propertyIds);
        $contractIds = mrp_contract_ids_for_property($propertyIds, $unitIds);
        $paymentIds = mrp_ids('payments', 'contract_id', $contractIds);

        return [
            'units' => count($unitIds),
            'contracts' => count($contractIds),
            'payments' => count($paymentIds),
            'payment_receipts' => mrp_count('payment_receipts', 'payment_id', $paymentIds) + mrp_count('payment_receipts', 'contract_id', $contractIds),
            'contract_files' => mrp_count('contract_files', 'contract_id', $contractIds),
            'property_files' => mrp_count('property_files', 'property_id', $propertyIds) + mrp_count('files', 'property_id', $propertyIds),
            'parking_spots' => mrp_count('parking_spots', 'property_id', $propertyIds),
            'property_expenses' => mrp_count('property_expenses', 'property_id', $propertyIds),
            'utility_bills' => mrp_count('utility_bills', 'property_id', $propertyIds),
            'unit_inspections' => mrp_count('unit_inspections', 'property_id', $propertyIds) + mrp_count('unit_inspections', 'unit_id', $unitIds) + mrp_count('unit_inspections', 'contract_id', $contractIds),
            'follow_up_tasks' => mrp_count('follow_up_tasks', 'property_id', $propertyIds) + mrp_count('follow_up_tasks', 'unit_id', $unitIds) + mrp_count('follow_up_tasks', 'contract_id', $contractIds),
            'document_records' => mrp_count('document_records', 'property_id', $propertyIds) + mrp_count('document_records', 'unit_id', $unitIds) + mrp_count('document_records', 'contract_id', $contractIds) + mrp_entity_delete('__count_only__', 'property', []),
        ];
    }
}

if (!function_exists('mrp_property_blockers')) {
    function mrp_property_blockers(array $counts): array
    {
        $labels = [
            'units' => 'وحدة مرتبطة',
            'contracts' => 'عقد مرتبط',
            'payments' => 'دفعة مرتبطة',
            'payment_receipts' => 'سند قبض مرتبط',
            'contract_files' => 'ملف عقد مرتبط',
            'property_files' => 'ملف عقار مرتبط',
            'parking_spots' => 'موقف مرتبط',
            'property_expenses' => 'مصروف مرتبط',
            'utility_bills' => 'فاتورة خدمة مرتبطة',
            'unit_inspections' => 'معاينة مرتبطة',
            'follow_up_tasks' => 'مهمة متابعة مرتبطة',
            'document_records' => 'مستند مرتبط',
        ];

        $blockers = [];
        foreach ($counts as $key => $value) {
            if ((int) $value > 0) $blockers[] = 'يوجد ' . (int) $value . ' ' . ($labels[$key] ?? $key);
        }

        return $blockers;
    }
}

if (!function_exists('mrp_delete_property_cascade')) {
    function mrp_delete_property_cascade(int $propertyId): array
    {
        $propertyIds = [$propertyId];
        $unitIds = mrp_ids('units', 'property_id', $propertyIds);
        $contractIds = mrp_contract_ids_for_property($propertyIds, $unitIds);
        $paymentIds = mrp_ids('payments', 'contract_id', $contractIds);
        $deleted = [];

        DB::transaction(function () use ($propertyIds, $unitIds, $contractIds, $paymentIds, &$deleted) {
            // Child rows of payments/contracts first.
            $deleted['payment_receipts_by_payment'] = mr_soft_or_hard_delete('payment_receipts', 'payment_id', $paymentIds);
            $deleted['payment_receipts_by_contract'] = mr_soft_or_hard_delete('payment_receipts', 'contract_id', $contractIds);
            $deleted['contract_files'] = mr_soft_or_hard_delete('contract_files', 'contract_id', $contractIds);

            // Optional records linked to contracts, units, or properties.
            foreach (['follow_up_tasks', 'document_records', 'unit_inspections', 'maintenance_requests'] as $table) {
                $deleted[$table . '_by_contract'] = mr_soft_or_hard_delete($table, 'contract_id', $contractIds);
                $deleted[$table . '_by_unit'] = mr_soft_or_hard_delete($table, 'unit_id', $unitIds);
                $deleted[$table . '_by_property'] = mr_soft_or_hard_delete($table, 'property_id', $propertyIds);
            }

            $deleted['document_records_entity_property'] = mrp_entity_delete('document_records', 'property', $propertyIds);
            $deleted['document_records_entity_unit'] = mrp_entity_delete('document_records', 'unit', $unitIds);
            $deleted['document_records_entity_contract'] = mrp_entity_delete('document_records', 'contract', $contractIds);

            // Property-level supporting data.
            $deleted['property_expenses'] = mr_soft_or_hard_delete('property_expenses', 'property_id', $propertyIds);
            $deleted['utility_bills'] = mr_soft_or_hard_delete('utility_bills', 'property_id', $propertyIds);
            $deleted['parking_spots'] = mr_soft_or_hard_delete('parking_spots', 'property_id', $propertyIds);
            $deleted['property_files'] = mr_soft_or_hard_delete('property_files', 'property_id', $propertyIds);
            $deleted['files'] = mr_soft_or_hard_delete('files', 'property_id', $propertyIds);

            // Main records.
            $deleted['payments'] = mr_soft_or_hard_delete('payments', 'contract_id', $contractIds);
            $deleted['contracts'] = mr_soft_or_hard_delete_by_id('contracts', $contractIds);
            $deleted['units'] = mr_soft_or_hard_delete_by_id('units', $unitIds);
            $deleted['properties'] = mr_soft_or_hard_delete_by_id('properties', $propertyIds);
        });

        return $deleted;
    }
}

if (!function_exists('mrp_property_delete_response')) {
    function mrp_property_delete_response(int $propertyId, Request $request)
    {
        $user = mrp_property_user($request);
        if (!mrp_property_admin($user)) {
            return response()->json(['message' => 'الحذف متاح للمدير فقط.'], 403);
        }

        if (!mr_has_table('properties') || !DB::table('properties')->where('id', $propertyId)->exists()) {
            return response()->json(['message' => 'العقار غير موجود أو تم حذفه مسبقًا.'], 404);
        }

        $counts = mrp_property_related_counts($propertyId);
        $blockers = mrp_property_blockers($counts);

        if ($request->boolean('preview_only')) {
            return response()->json([
                'status' => 'ok',
                'message' => $blockers ? 'هذا العقار يحتوي على ارتباطات.' : 'لا توجد ارتباطات تمنع حذف العقار.',
                'blockers' => $blockers,
                'related_counts' => $counts,
                'cascade_available' => true,
            ]);
        }

        $deleted = mrp_delete_property_cascade($propertyId);

        return response()->json([
            'status' => 'ok',
            'message' => $blockers ? 'تم حذف العقار مع ارتباطاته: ' . implode('، ', $blockers) : 'تم حذف العقار بنجاح.',
            'deleted_counts' => $deleted,
            'related_counts_before_delete' => $counts,
        ]);
    }
}

Route::post('/edit-delete-center/properties/{propertyId}/delete', fn (int $propertyId, Request $request) => mrp_property_delete_response($propertyId, $request));
Route::post('/my/edit-delete-center/properties/{propertyId}/delete', fn (int $propertyId, Request $request) => mrp_property_delete_response($propertyId, $request));
