<?php

/*
|--------------------------------------------------------------------------
| Confirmed cascade delete for properties and units
|--------------------------------------------------------------------------
| These routes are loaded before the old property delete and the generic
| edit/delete-center routes. They preview all related records first, then only
| perform cascade deletion when the client sends force=true.
*/

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

require_once base_path('app/Support/RelationManagerHelpers.php');

if (!function_exists('mrcd_user')) {
    function mrcd_user(Request $request)
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

if (!function_exists('mrcd_is_admin')) {
    function mrcd_is_admin($user): bool
    {
        if (!$user) return false;
        if (function_exists('my_rentals_ed_is_admin')) return my_rentals_ed_is_admin($user);
        if (function_exists('mr_user_is_admin')) return mr_user_is_admin($user);

        $role = method_exists($user, 'effectiveRole') ? $user->effectiveRole() : strtolower((string) ($user->role ?? ''));
        return in_array($role, ['admin', 'manager', 'super_admin'], true);
    }
}

if (!function_exists('mrcd_ids')) {
    function mrcd_ids(string $table, string $column, array $ids): array
    {
        if (!mr_has_table($table) || !mr_has_col($table, 'id') || !mr_has_col($table, $column) || count($ids) === 0) {
            return [];
        }

        return DB::table($table)
            ->whereIn($column, $ids)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values()
            ->all();
    }
}

if (!function_exists('mrcd_count')) {
    function mrcd_count(string $table, string $column, array $ids): int
    {
        if (!mr_has_table($table) || !mr_has_col($table, $column) || count($ids) === 0) return 0;
        return (int) DB::table($table)->whereIn($column, $ids)->count();
    }
}

if (!function_exists('mrcd_delete_by_entity')) {
    function mrcd_delete_by_entity(string $table, string $entityType, array $ids): int
    {
        if (!mr_has_table($table) || count($ids) === 0) return 0;
        if (!mr_has_col($table, 'entity_type') || !mr_has_col($table, 'entity_id')) return 0;

        $types = [$entityType, ucfirst($entityType), $entityType . 's', ucfirst($entityType) . 's'];
        $query = DB::table($table)->whereIn('entity_id', $ids)->whereIn('entity_type', $types);
        $count = (int) (clone $query)->count();

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

if (!function_exists('mrcd_contract_ids')) {
    function mrcd_contract_ids(array $propertyIds = [], array $unitIds = []): array
    {
        if (!mr_has_table('contracts') || !mr_has_col('contracts', 'id')) return [];

        $query = DB::table('contracts');
        $hasWhere = false;

        if (count($propertyIds) > 0 && mr_has_col('contracts', 'property_id')) {
            $query->whereIn('property_id', $propertyIds);
            $hasWhere = true;
        }

        if (count($unitIds) > 0 && mr_has_col('contracts', 'unit_id')) {
            $hasWhere ? $query->orWhereIn('unit_id', $unitIds) : $query->whereIn('unit_id', $unitIds);
            $hasWhere = true;
        }

        if (!$hasWhere) return [];

        return $query->pluck('id')->map(fn ($id) => (int) $id)->unique()->values()->all();
    }
}

if (!function_exists('mrcd_child_unit_ids')) {
    function mrcd_child_unit_ids(array $unitIds): array
    {
        if (!mr_has_table('units') || !mr_has_col('units', 'parent_unit_id') || count($unitIds) === 0) return [];

        $all = array_values(array_unique(array_map('intval', $unitIds)));
        $cursor = $all;

        while (count($cursor) > 0) {
            $children = DB::table('units')
                ->whereIn('parent_unit_id', $cursor)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->filter(fn ($id) => $id > 0 && !in_array($id, $all, true))
                ->values()
                ->all();

            if (count($children) === 0) break;
            $all = array_values(array_unique(array_merge($all, $children)));
            $cursor = $children;
        }

        return $all;
    }
}

if (!function_exists('mrcd_related_counts')) {
    function mrcd_related_counts(string $resource, int $id): array
    {
        $propertyIds = $resource === 'properties' ? [$id] : [];
        $unitIds = $resource === 'properties'
            ? mrcd_ids('units', 'property_id', $propertyIds)
            : mrcd_child_unit_ids([$id]);
        $contractIds = mrcd_contract_ids($propertyIds, $unitIds);
        $paymentIds = mrcd_ids('payments', 'contract_id', $contractIds);

        $counts = [
            'units' => $resource === 'properties' ? count($unitIds) : max(0, count($unitIds) - 1),
            'contracts' => count($contractIds),
            'payments' => count($paymentIds),
            'payment_receipts' => mrcd_count('payment_receipts', 'payment_id', $paymentIds) + mrcd_count('payment_receipts', 'contract_id', $contractIds),
            'contract_files' => mrcd_count('contract_files', 'contract_id', $contractIds),
            'property_files' => mrcd_count('property_files', 'property_id', $propertyIds) + mrcd_count('files', 'property_id', $propertyIds),
            'unit_files' => mrcd_count('unit_files', 'unit_id', $unitIds) + mrcd_count('files', 'unit_id', $unitIds),
            'parking_spots' => mrcd_count('parking_spots', 'property_id', $propertyIds) + mrcd_count('parking_spots', 'unit_id', $unitIds),
            'property_expenses' => mrcd_count('property_expenses', 'property_id', $propertyIds),
            'utility_bills' => mrcd_count('utility_bills', 'property_id', $propertyIds) + mrcd_count('utility_bills', 'unit_id', $unitIds),
            'unit_inspections' => mrcd_count('unit_inspections', 'property_id', $propertyIds) + mrcd_count('unit_inspections', 'unit_id', $unitIds) + mrcd_count('unit_inspections', 'contract_id', $contractIds),
            'follow_up_tasks' => mrcd_count('follow_up_tasks', 'property_id', $propertyIds) + mrcd_count('follow_up_tasks', 'unit_id', $unitIds) + mrcd_count('follow_up_tasks', 'contract_id', $contractIds),
            'maintenance_requests' => mrcd_count('maintenance_requests', 'property_id', $propertyIds) + mrcd_count('maintenance_requests', 'unit_id', $unitIds) + mrcd_count('maintenance_requests', 'contract_id', $contractIds),
            'document_records' => mrcd_count('document_records', 'property_id', $propertyIds) + mrcd_count('document_records', 'unit_id', $unitIds) + mrcd_count('document_records', 'contract_id', $contractIds),
        ];

        if ($resource === 'units') unset($counts['property_files'], $counts['property_expenses']);
        return $counts;
    }
}

if (!function_exists('mrcd_blockers')) {
    function mrcd_blockers(array $counts): array
    {
        $labels = [
            'units' => 'وحدة فرعية مرتبطة',
            'contracts' => 'عقد مرتبط',
            'payments' => 'دفعة مرتبطة',
            'payment_receipts' => 'سند قبض مرتبط',
            'contract_files' => 'ملف عقد مرتبط',
            'property_files' => 'ملف عقار مرتبط',
            'unit_files' => 'ملف/وسائط وحدة مرتبطة',
            'parking_spots' => 'موقف مرتبط',
            'property_expenses' => 'مصروف مرتبط',
            'utility_bills' => 'فاتورة خدمة مرتبطة',
            'unit_inspections' => 'معاينة مرتبطة',
            'follow_up_tasks' => 'مهمة متابعة مرتبطة',
            'maintenance_requests' => 'طلب صيانة مرتبط',
            'document_records' => 'مستند مرتبط',
        ];

        $blockers = [];
        foreach ($counts as $key => $value) {
            if ((int) $value > 0) $blockers[] = 'يوجد ' . (int) $value . ' ' . ($labels[$key] ?? $key);
        }

        return $blockers;
    }
}

if (!function_exists('mrcd_delete_cascade')) {
    function mrcd_delete_cascade(string $resource, int $id): array
    {
        $propertyIds = $resource === 'properties' ? [$id] : [];
        $unitIds = $resource === 'properties'
            ? mrcd_ids('units', 'property_id', $propertyIds)
            : mrcd_child_unit_ids([$id]);
        $contractIds = mrcd_contract_ids($propertyIds, $unitIds);
        $paymentIds = mrcd_ids('payments', 'contract_id', $contractIds);
        $deleted = [];

        DB::transaction(function () use ($resource, $propertyIds, $unitIds, $contractIds, $paymentIds, &$deleted) {
            $deleted['payment_receipts_by_payment'] = mr_soft_or_hard_delete('payment_receipts', 'payment_id', $paymentIds);
            $deleted['payment_receipts_by_contract'] = mr_soft_or_hard_delete('payment_receipts', 'contract_id', $contractIds);
            $deleted['contract_files'] = mr_soft_or_hard_delete('contract_files', 'contract_id', $contractIds);

            foreach (['follow_up_tasks', 'document_records', 'unit_inspections', 'maintenance_requests'] as $table) {
                $deleted[$table . '_by_contract'] = mr_soft_or_hard_delete($table, 'contract_id', $contractIds);
                $deleted[$table . '_by_unit'] = mr_soft_or_hard_delete($table, 'unit_id', $unitIds);
                $deleted[$table . '_by_property'] = mr_soft_or_hard_delete($table, 'property_id', $propertyIds);
            }

            $deleted['document_records_entity_property'] = mrcd_delete_by_entity('document_records', 'property', $propertyIds);
            $deleted['document_records_entity_unit'] = mrcd_delete_by_entity('document_records', 'unit', $unitIds);
            $deleted['document_records_entity_contract'] = mrcd_delete_by_entity('document_records', 'contract', $contractIds);

            $deleted['utility_bills_by_property'] = mr_soft_or_hard_delete('utility_bills', 'property_id', $propertyIds);
            $deleted['utility_bills_by_unit'] = mr_soft_or_hard_delete('utility_bills', 'unit_id', $unitIds);
            $deleted['parking_spots_by_property'] = mr_soft_or_hard_delete('parking_spots', 'property_id', $propertyIds);
            $deleted['parking_spots_by_unit'] = mr_soft_or_hard_delete('parking_spots', 'unit_id', $unitIds);
            $deleted['unit_files'] = mr_soft_or_hard_delete('unit_files', 'unit_id', $unitIds);
            $deleted['files_by_unit'] = mr_soft_or_hard_delete('files', 'unit_id', $unitIds);

            if ($resource === 'properties') {
                $deleted['property_expenses'] = mr_soft_or_hard_delete('property_expenses', 'property_id', $propertyIds);
                $deleted['property_files'] = mr_soft_or_hard_delete('property_files', 'property_id', $propertyIds);
                $deleted['files_by_property'] = mr_soft_or_hard_delete('files', 'property_id', $propertyIds);
            }

            $deleted['payments'] = mr_soft_or_hard_delete('payments', 'contract_id', $contractIds);
            $deleted['contracts'] = mr_soft_or_hard_delete_by_id('contracts', $contractIds);
            $deleted['units'] = mr_soft_or_hard_delete_by_id('units', $unitIds);

            if ($resource === 'properties') {
                $deleted['properties'] = mr_soft_or_hard_delete_by_id('properties', $propertyIds);
            }
        });

        return $deleted;
    }
}

if (!function_exists('mrcd_delete_response')) {
    function mrcd_delete_response(string $resource, int $id, Request $request)
    {
        $user = mrcd_user($request);
        if (!mrcd_is_admin($user)) {
            return response()->json(['message' => 'الحذف متاح للمدير فقط.'], 403);
        }

        $table = $resource === 'properties' ? 'properties' : 'units';
        $singular = $resource === 'properties' ? 'العقار' : 'الوحدة';
        if (!mr_has_table($table) || !DB::table($table)->where('id', $id)->exists()) {
            return response()->json(['message' => $singular . ' غير موجودة أو تم حذفها مسبقًا.'], 404);
        }

        $counts = mrcd_related_counts($resource, $id);
        $blockers = mrcd_blockers($counts);

        if ($request->boolean('preview_only')) {
            return response()->json([
                'status' => 'ok',
                'message' => $blockers ? $singular . ' تحتوي على ارتباطات.' : 'لا توجد ارتباطات تمنع الحذف.',
                'blockers' => $blockers,
                'related_counts' => $counts,
                'cascade_available' => true,
                'requires_confirmation' => count($blockers) > 0,
            ]);
        }

        if ($blockers && !$request->boolean('force')) {
            return response()->json([
                'message' => 'يوجد ارتباطات مرتبطة. راجع التفاصيل ثم أكد الحذف.',
                'blockers' => $blockers,
                'related_counts' => $counts,
                'cascade_available' => true,
                'requires_confirmation' => true,
            ], 409);
        }

        $deleted = mrcd_delete_cascade($resource, $id);

        return response()->json([
            'status' => 'ok',
            'message' => $blockers
                ? 'تم حذف ' . $singular . ' مع كل الارتباطات التابعة لها.'
                : 'تم حذف ' . $singular . ' بنجاح.',
            'deleted_counts' => $deleted,
            'related_counts_before_delete' => $counts,
        ]);
    }
}

Route::post('/edit-delete-center/properties/{propertyId}/delete', fn (int $propertyId, Request $request) => mrcd_delete_response('properties', $propertyId, $request));
Route::post('/my/edit-delete-center/properties/{propertyId}/delete', fn (int $propertyId, Request $request) => mrcd_delete_response('properties', $propertyId, $request));
Route::post('/edit-delete-center/units/{unitId}/delete', fn (int $unitId, Request $request) => mrcd_delete_response('units', $unitId, $request));
Route::post('/my/edit-delete-center/units/{unitId}/delete', fn (int $unitId, Request $request) => mrcd_delete_response('units', $unitId, $request));
