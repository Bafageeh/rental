<?php

// Phase 2: extracted helper functions for RelationManagerHelpers.
// Functions stay guarded to support repeated Laravel/PHPUnit bootstraps.

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (!function_exists('mr_has_table')) {
    function mr_has_table(string $table): bool
    {
        try {
            return Schema::hasTable($table);
        } catch (Throwable $e) {
            return false;
        }
    }
}

if (!function_exists('mr_has_col')) {
    function mr_has_col(string $table, string $column): bool
    {
        try {
            return Schema::hasColumn($table, $column);
        } catch (Throwable $e) {
            return false;
        }
    }
}

if (!function_exists('mr_cols')) {
    function mr_cols(string $table, array $wanted): array
    {
        $cols = [];

        foreach ($wanted as $col) {
            if (mr_has_col($table, $col)) {
                $cols[] = $col;
            }
        }

        return array_values(array_unique($cols));
    }
}

if (!function_exists('mr_row_value')) {
    function mr_row_value($row, string $key)
    {
        if (is_array($row)) {
            return $row[$key] ?? null;
        }

        return $row->{$key} ?? null;
    }
}

if (!function_exists('mr_label')) {
    function mr_label($row, array $preferred, string $fallback): string
    {
        foreach ($preferred as $key) {
            $value = mr_row_value($row, $key);

            if ($value !== null && trim((string) $value) !== '') {
                return trim((string) $value);
            }
        }

        return $fallback;
    }
}

if (!function_exists('mr_set_if_column')) {
    function mr_set_if_column(array &$data, string $table, string $column, $value, bool $skipEmpty = false): void
    {
        if (!mr_has_col($table, $column)) {
            return;
        }

        if ($skipEmpty && ($value === null || $value === '')) {
            return;
        }

        $data[$column] = $value === '' ? null : $value;
    }
}

if (!function_exists('mr_touch_columns')) {
    function mr_touch_columns(array &$data, string $table, bool $creating = false): void
    {
        $now = now();

        if ($creating && mr_has_col($table, 'created_at')) {
            $data['created_at'] = $now;
        }

        if (mr_has_col($table, 'updated_at')) {
            $data['updated_at'] = $now;
        }
    }
}

if (!function_exists('mr_soft_or_hard_delete')) {
    function mr_soft_or_hard_delete(string $table, string $column, array $ids): int
    {
        if (!mr_has_table($table) || !mr_has_col($table, $column) || count($ids) === 0) {
            return 0;
        }

        $query = DB::table($table)->whereIn($column, $ids);
        $count = (clone $query)->count();

        if ($count === 0) {
            return 0;
        }

        if (mr_has_col($table, 'deleted_at')) {
            $data = ['deleted_at' => now()];

            if (mr_has_col($table, 'updated_at')) {
                $data['updated_at'] = now();
            }

            $query->update($data);
        } else {
            $query->delete();
        }

        return $count;
    }
}

if (!function_exists('mr_soft_or_hard_delete_by_id')) {
    function mr_soft_or_hard_delete_by_id(string $table, array $ids): int
    {
        return mr_soft_or_hard_delete($table, 'id', $ids);
    }
}

if (!function_exists('mr_owner_options')) {
    function mr_owner_options(?int $ownerScopeId = null): array
    {
        if (!mr_has_table('owners')) {
            return [];
        }

        $cols = mr_cols('owners', [
            'id',
            'name',
            'title',
            'full_name',
            'phone',
            'mobile',
            'email',
            'national_id',
            'deleted_at',
            'created_at',
        ]);

        if (!in_array('id', $cols, true)) {
            return [];
        }

        $query = DB::table('owners')->select($cols);

        if ($ownerScopeId !== null) {
            $query->where('id', $ownerScopeId);
        }

        if (in_array('deleted_at', $cols, true)) {
            $query->whereNull('deleted_at');
        }

        return $query
            ->orderBy('id', 'desc')
            ->limit(1000)
            ->get()
            ->map(function ($row) {
                $base = mr_label($row, ['name', 'title', 'full_name'], 'مالك #' . mr_row_value($row, 'id'));
                $phone = mr_row_value($row, 'phone') ?: mr_row_value($row, 'mobile');
                $label = $phone ? ($base . ' - ' . $phone) : $base;

                return [
                    'id' => (int) mr_row_value($row, 'id'),
                    'label' => $label,
                    'name' => $base,
                    'phone' => $phone,
                    'email' => mr_row_value($row, 'email'),
                    'national_id' => mr_row_value($row, 'national_id'),
                ];
            })
            ->values()
            ->all();
    }
}

if (!function_exists('mr_property_options')) {
    function mr_property_options(?int $ownerScopeId = null): array
    {
        if (!mr_has_table('properties')) {
            return [];
        }

        $cols = mr_cols('properties', [
            'id',
            'owner_id',
            'title',
            'name',
            'property_name',
            'city',
            'district',
            'address',
            'property_type',
            'management_type',
            'deed_number',
            'deleted_at',
            'created_at',
        ]);

        if (!in_array('id', $cols, true)) {
            return [];
        }

        $query = DB::table('properties')->select($cols);

        if ($ownerScopeId !== null) {
            if (in_array('owner_id', $cols, true)) {
                $query->where('owner_id', $ownerScopeId);
            } else {
                $query->whereRaw('1 = 0');
            }
        }

        if (in_array('deleted_at', $cols, true)) {
            $query->whereNull('deleted_at');
        }

        return $query
            ->orderBy('id', 'desc')
            ->limit(1500)
            ->get()
            ->map(function ($row) {
                $base = mr_label($row, ['title', 'name', 'property_name', 'address'], 'عقار #' . mr_row_value($row, 'id'));
                $district = mr_row_value($row, 'district');
                $city = mr_row_value($row, 'city');
                $suffix = trim(implode(' - ', array_filter([$city, $district])));
                $label = $suffix ? ($base . ' - ' . $suffix) : $base;

                return [
                    'id' => (int) mr_row_value($row, 'id'),
                    'label' => $label,
                    'title' => $base,
                    'owner_id' => mr_row_value($row, 'owner_id'),
                    'city' => $city,
                    'district' => $district,
                    'address' => mr_row_value($row, 'address'),
                    'property_type' => mr_row_value($row, 'property_type'),
                    'management_type' => mr_row_value($row, 'management_type'),
                    'deed_number' => mr_row_value($row, 'deed_number'),
                ];
            })
            ->values()
            ->all();
    }
}

if (!function_exists('mr_unit_options')) {
    function mr_unit_options(?int $ownerScopeId = null): array
    {
        if (!mr_has_table('units')) {
            return [];
        }

        $cols = mr_cols('units', [
            'id',
            'property_id',
            'owner_id',
            'unit_scope',
            'title',
            'name',
            'unit_number',
            'floor',
            'type',
            'status',
            'rent_amount',
            'deleted_at',
            'created_at',
        ]);

        if (!in_array('id', $cols, true)) {
            return [];
        }

        $query = DB::table('units')->select($cols);

        if ($ownerScopeId !== null) {
            $unitIds = mr_owned_unit_ids($ownerScopeId);
            $query->whereIn('id', count($unitIds) > 0 ? $unitIds : [-1]);
        }

        if (in_array('deleted_at', $cols, true)) {
            $query->whereNull('deleted_at');
        }

        return $query
            ->orderBy('id', 'desc')
            ->limit(2000)
            ->get()
            ->map(function ($row) {
                $base = mr_label($row, ['unit_number', 'title', 'name'], 'وحدة #' . mr_row_value($row, 'id'));
                $floor = mr_row_value($row, 'floor');
                $label = $floor ? ($base . ' - الدور ' . $floor) : $base;

                return [
                    'id' => (int) mr_row_value($row, 'id'),
                    'label' => $label,
                    'title' => $base,
                    'property_id' => mr_row_value($row, 'property_id'),
                    'owner_id' => mr_row_value($row, 'owner_id'),
                    'unit_scope' => mr_row_value($row, 'unit_scope') ?: (mr_row_value($row, 'property_id') ? 'property' : 'owner'),
                    'floor' => $floor,
                    'type' => mr_row_value($row, 'type'),
                    'status' => mr_row_value($row, 'status'),
                    'rent_amount' => mr_row_value($row, 'rent_amount'),
                ];
            })
            ->values()
            ->all();
    }
}

if (!function_exists('mr_tenant_options')) {
    function mr_tenant_options(?int $ownerScopeId = null): array
    {
        if (!mr_has_table('tenants')) {
            return [];
        }

        $cols = mr_cols('tenants', ['id', 'name', 'full_name', 'phone', 'mobile', 'email', 'deleted_at']);

        if (!in_array('id', $cols, true)) {
            return [];
        }

        $query = DB::table('tenants')->select($cols);

        if ($ownerScopeId !== null) {
            $tenantIds = mr_owned_tenant_ids($ownerScopeId);
            $query->whereIn('id', count($tenantIds) > 0 ? $tenantIds : [-1]);
        }

        if (in_array('deleted_at', $cols, true)) {
            $query->whereNull('deleted_at');
        }

        return $query->orderBy('id', 'desc')->limit(1500)->get()->map(function ($row) {
            $base = mr_label($row, ['name', 'full_name'], 'مستأجر #' . mr_row_value($row, 'id'));
            $phone = mr_row_value($row, 'phone') ?: mr_row_value($row, 'mobile');

            return [
                'id' => (int) mr_row_value($row, 'id'),
                'label' => $phone ? ($base . ' - ' . $phone) : $base,
                'name' => $base,
                'phone' => $phone,
                'email' => mr_row_value($row, 'email'),
            ];
        })->values()->all();
    }
}

if (!function_exists('mr_contract_options')) {
    function mr_contract_options(?int $ownerScopeId = null): array
    {
        if (!mr_has_table('contracts')) {
            return [];
        }

        $cols = mr_cols('contracts', ['id', 'contract_number', 'government_contract_number', 'property_id', 'unit_id', 'tenant_id', 'status', 'deleted_at']);

        if (!in_array('id', $cols, true)) {
            return [];
        }

        $query = DB::table('contracts')->select($cols);

        if ($ownerScopeId !== null) {
            $contractIds = mr_owned_contract_ids($ownerScopeId);
            $query->whereIn('id', count($contractIds) > 0 ? $contractIds : [-1]);
        }

        if (in_array('deleted_at', $cols, true)) {
            $query->whereNull('deleted_at');
        }

        return $query->orderBy('id', 'desc')->limit(1500)->get()->map(function ($row) {
            $base = mr_label($row, ['contract_number', 'government_contract_number'], 'عقد #' . mr_row_value($row, 'id'));

            return [
                'id' => (int) mr_row_value($row, 'id'),
                'label' => $base,
                'contract_number' => mr_row_value($row, 'contract_number'),
                'government_contract_number' => mr_row_value($row, 'government_contract_number'),
                'property_id' => mr_row_value($row, 'property_id'),
                'unit_id' => mr_row_value($row, 'unit_id'),
                'tenant_id' => mr_row_value($row, 'tenant_id'),
                'status' => mr_row_value($row, 'status'),
            ];
        })->values()->all();
    }
}

if (!function_exists('mr_relation_options_array')) {
    function mr_relation_options_array(?int $ownerScopeId = null): array
    {
        return [
            'owners' => mr_owner_options($ownerScopeId),
            'properties' => mr_property_options($ownerScopeId),
            'units' => mr_unit_options($ownerScopeId),
            'tenants' => mr_tenant_options($ownerScopeId),
            'contracts' => mr_contract_options($ownerScopeId),
        ];
    }
}


if (!function_exists('mr_user_is_admin')) {
    function mr_user_is_admin($user): bool
    {
        if (!$user) {
            return false;
        }

        $role = method_exists($user, 'effectiveRole')
            ? $user->effectiveRole()
            : strtolower(trim((string) ($user->role ?? 'admin')));

        return in_array($role, ['admin', 'manager', 'super_admin'], true);
    }
}

if (!function_exists('mr_request_owner_scope_id')) {
    function mr_request_owner_scope_id(Request $request): ?int
    {
        $user = $request->user();

        if (!$user || mr_user_is_admin($user)) {
            return null;
        }

        $ownerId = (int) ($user->owner_id ?? 0);

        return $ownerId > 0 ? $ownerId : 0;
    }
}

if (!function_exists('mr_owner_scope_forbidden_response')) {
    function mr_owner_scope_forbidden_response()
    {
        return response()->json([
            'status' => 'error',
            'message' => 'هذا الإجراء غير متاح لهذا الحساب أو خارج نطاق المالك المرتبط به.',
        ], 403);
    }
}

if (!function_exists('mr_owned_property_ids')) {
    function mr_owned_property_ids(int $ownerId): array
    {
        if ($ownerId <= 0 || !mr_has_table('properties') || !mr_has_col('properties', 'owner_id')) {
            return [];
        }

        $query = DB::table('properties')->where('owner_id', $ownerId);

        if (mr_has_col('properties', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        return $query->pluck('id')->map(fn($v) => (int) $v)->values()->all();
    }
}

if (!function_exists('mr_owned_unit_ids')) {
    function mr_owned_unit_ids(int $ownerId): array
    {
        if ($ownerId <= 0 || !mr_has_table('units') || !mr_has_col('units', 'id')) {
            return [];
        }

        $propertyIds = mr_owned_property_ids($ownerId);
        $query = DB::table('units')->where(function ($q) use ($ownerId, $propertyIds) {
            $hasScope = false;

            if (mr_has_col('units', 'owner_id')) {
                $q->where('owner_id', $ownerId);
                $hasScope = true;
            }

            if (count($propertyIds) > 0 && mr_has_col('units', 'property_id')) {
                $hasScope ? $q->orWhereIn('property_id', $propertyIds) : $q->whereIn('property_id', $propertyIds);
                $hasScope = true;
            }

            if (!$hasScope) {
                $q->whereRaw('1 = 0');
            }
        });

        if (mr_has_col('units', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        return $query->pluck('id')->map(fn($v) => (int) $v)->values()->all();
    }
}

if (!function_exists('mr_owned_contract_ids')) {
    function mr_owned_contract_ids(int $ownerId): array
    {
        if ($ownerId <= 0 || !mr_has_table('contracts') || !mr_has_col('contracts', 'id')) {
            return [];
        }

        $propertyIds = mr_owned_property_ids($ownerId);
        $unitIds = mr_owned_unit_ids($ownerId);

        $query = DB::table('contracts')->where(function ($q) use ($ownerId, $propertyIds, $unitIds) {
            $hasScope = false;

            if (mr_has_col('contracts', 'owner_id')) {
                $q->where('owner_id', $ownerId);
                $hasScope = true;
            }

            if (count($propertyIds) > 0 && mr_has_col('contracts', 'property_id')) {
                $hasScope ? $q->orWhereIn('property_id', $propertyIds) : $q->whereIn('property_id', $propertyIds);
                $hasScope = true;
            }

            if (count($unitIds) > 0 && mr_has_col('contracts', 'unit_id')) {
                $hasScope ? $q->orWhereIn('unit_id', $unitIds) : $q->whereIn('unit_id', $unitIds);
                $hasScope = true;
            }

            if (!$hasScope) {
                $q->whereRaw('1 = 0');
            }
        });

        if (mr_has_col('contracts', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        return $query->pluck('id')->map(fn($v) => (int) $v)->values()->all();
    }
}

if (!function_exists('mr_owned_tenant_ids')) {
    function mr_owned_tenant_ids(int $ownerId): array
    {
        if ($ownerId <= 0 || !mr_has_table('contracts') || !mr_has_col('contracts', 'tenant_id')) {
            return [];
        }

        $contractIds = mr_owned_contract_ids($ownerId);

        if (count($contractIds) === 0) {
            return [];
        }

        return DB::table('contracts')
            ->whereIn('id', $contractIds)
            ->whereNotNull('tenant_id')
            ->pluck('tenant_id')
            ->map(fn($v) => (int) $v)
            ->unique()
            ->values()
            ->all();
    }
}

if (!function_exists('mr_delete_properties_cascade')) {
    function mr_delete_properties_cascade(array $propertyIds): array
    {
        $propertyIds = array_values(array_unique(array_filter(array_map('intval', $propertyIds))));

        if (count($propertyIds) === 0) {
            return ['properties' => 0, 'units' => 0, 'contracts' => 0, 'other' => 0];
        }

        $unitIds = [];
        $contractIds = [];
        $other = 0;

        if (mr_has_table('units') && mr_has_col('units', 'property_id')) {
            $unitIds = DB::table('units')->whereIn('property_id', $propertyIds)->pluck('id')->map(fn($v) => (int) $v)->all();
        }

        if (mr_has_table('contracts')) {
            $q = DB::table('contracts');
            $hasWhere = false;

            if (mr_has_col('contracts', 'property_id')) {
                $q->whereIn('property_id', $propertyIds);
                $hasWhere = true;
            }

            if (count($unitIds) > 0 && mr_has_col('contracts', 'unit_id')) {
                if ($hasWhere) {
                    $q->orWhereIn('unit_id', $unitIds);
                } else {
                    $q->whereIn('unit_id', $unitIds);
                }

                $hasWhere = true;
            }

            if ($hasWhere) {
                $contractIds = $q->pluck('id')->map(fn($v) => (int) $v)->all();
            }
        }

        foreach (['payments', 'payment_receipts'] as $table) {
            if (count($contractIds) > 0) {
                $other += mr_soft_or_hard_delete($table, 'contract_id', $contractIds);
            }
        }

        foreach (['property_expenses', 'utility_bills', 'maintenance_requests', 'document_records', 'follow_up_tasks'] as $table) {
            $other += mr_soft_or_hard_delete($table, 'property_id', $propertyIds);
        }

        foreach (['unit_inspections', 'maintenance_requests', 'document_records', 'follow_up_tasks'] as $table) {
            if (count($unitIds) > 0) {
                $other += mr_soft_or_hard_delete($table, 'unit_id', $unitIds);
            }
        }

        $contracts = count($contractIds) > 0 ? mr_soft_or_hard_delete_by_id('contracts', $contractIds) : 0;
        $units = count($unitIds) > 0 ? mr_soft_or_hard_delete_by_id('units', $unitIds) : 0;
        $properties = mr_soft_or_hard_delete_by_id('properties', $propertyIds);

        return [
            'properties' => $properties,
            'units' => $units,
            'contracts' => $contracts,
            'other' => $other,
        ];
    }
}
