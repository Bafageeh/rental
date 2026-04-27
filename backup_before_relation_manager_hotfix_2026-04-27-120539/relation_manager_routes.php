<?php

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
    function mr_owner_options(): array
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
    function mr_property_options(): array
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
    function mr_unit_options(): array
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
    function mr_tenant_options(): array
    {
        if (!mr_has_table('tenants')) {
            return [];
        }

        $cols = mr_cols('tenants', ['id', 'name', 'full_name', 'phone', 'mobile', 'email', 'deleted_at']);

        if (!in_array('id', $cols, true)) {
            return [];
        }

        $query = DB::table('tenants')->select($cols);

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
    function mr_contract_options(): array
    {
        if (!mr_has_table('contracts')) {
            return [];
        }

        $cols = mr_cols('contracts', ['id', 'contract_number', 'government_contract_number', 'property_id', 'unit_id', 'tenant_id', 'status', 'deleted_at']);

        if (!in_array('id', $cols, true)) {
            return [];
        }

        $query = DB::table('contracts')->select($cols);

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
    function mr_relation_options_array(): array
    {
        return [
            'owners' => mr_owner_options(),
            'properties' => mr_property_options(),
            'units' => mr_unit_options(),
            'tenants' => mr_tenant_options(),
            'contracts' => mr_contract_options(),
        ];
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

$relationOptionsHandler = function () {
    return response()->json(mr_relation_options_array());
};

$createPropertyHandler = function (Request $request) {
    if (!mr_has_table('properties')) {
        return response()->json(['message' => 'جدول العقارات غير موجود'], 422);
    }

    $ownerId = $request->input('owner_id');
    $title = trim((string) ($request->input('title') ?: $request->input('name') ?: ''));

    if (!$ownerId) {
        return response()->json(['message' => 'يجب اختيار المالك'], 422);
    }

    if (mr_has_table('owners') && !DB::table('owners')->where('id', $ownerId)->exists()) {
        return response()->json(['message' => 'المالك غير موجود'], 404);
    }

    if ($title === '') {
        return response()->json(['message' => 'يجب كتابة اسم أو عنوان العقار'], 422);
    }

    $data = [];
    mr_set_if_column($data, 'properties', 'owner_id', $ownerId);
    mr_set_if_column($data, 'properties', 'title', $title);
    mr_set_if_column($data, 'properties', 'name', $title);
    mr_set_if_column($data, 'properties', 'property_name', $title);
    mr_set_if_column($data, 'properties', 'property_type', $request->input('property_type'), true);
    mr_set_if_column($data, 'properties', 'management_type', $request->input('management_type'), true);
    mr_set_if_column($data, 'properties', 'city', $request->input('city'), true);
    mr_set_if_column($data, 'properties', 'district', $request->input('district'), true);
    mr_set_if_column($data, 'properties', 'address', $request->input('address'), true);
    mr_set_if_column($data, 'properties', 'deed_number', $request->input('deed_number'), true);
    mr_set_if_column($data, 'properties', 'floors_count', $request->input('floors_count'), true);
    mr_set_if_column($data, 'properties', 'parking_spots_count', $request->input('parking_spots_count'), true);
    mr_touch_columns($data, 'properties', true);

    $id = DB::table('properties')->insertGetId($data);

    return response()->json(['message' => 'تم إنشاء العقار وربطه بالمالك', 'id' => $id, 'options' => mr_relation_options_array()]);
};

$createUnitHandler = function (Request $request) {
    if (!mr_has_table('units')) {
        return response()->json(['message' => 'جدول الوحدات غير موجود'], 422);
    }

    $ownerId = $request->input('owner_id');
    $propertyId = $request->input('property_id');
    $unitScope = $request->input('unit_scope') ?: ($propertyId ? 'property' : 'owner');
    $unitNumber = trim((string) ($request->input('unit_number') ?: $request->input('title') ?: $request->input('name') ?: ''));

    if (!$ownerId) {
        return response()->json(['message' => 'يجب اختيار المالك'], 422);
    }

    if (mr_has_table('owners') && !DB::table('owners')->where('id', $ownerId)->exists()) {
        return response()->json(['message' => 'المالك غير موجود'], 404);
    }

    if ($unitScope === 'property') {
        if (!$propertyId) {
            return response()->json(['message' => 'يجب اختيار العقار إذا كانت الوحدة داخل عقار/عمارة'], 422);
        }

        if (mr_has_table('properties')) {
            $property = DB::table('properties')->where('id', $propertyId)->first();

            if (!$property) {
                return response()->json(['message' => 'العقار غير موجود'], 404);
            }

            if (isset($property->owner_id) && (string) $property->owner_id !== (string) $ownerId) {
                return response()->json(['message' => 'العقار المختار لا يتبع المالك المحدد'], 422);
            }
        }
    } else {
        $propertyId = null;
        $unitScope = 'owner';
    }

    if ($unitNumber === '') {
        return response()->json(['message' => 'يجب كتابة رقم الوحدة'], 422);
    }

    $data = [];
    mr_set_if_column($data, 'units', 'property_id', $propertyId);
    mr_set_if_column($data, 'units', 'owner_id', $ownerId);
    mr_set_if_column($data, 'units', 'unit_scope', $unitScope);
    mr_set_if_column($data, 'units', 'unit_number', $unitNumber);
    mr_set_if_column($data, 'units', 'title', $unitNumber);
    mr_set_if_column($data, 'units', 'name', $unitNumber);
    mr_set_if_column($data, 'units', 'type', $request->input('type'), true);
    mr_set_if_column($data, 'units', 'status', $request->input('status'), true);
    mr_set_if_column($data, 'units', 'floor', $request->input('floor'), true);
    mr_set_if_column($data, 'units', 'rent_amount', $request->input('rent_amount'), true);
    mr_set_if_column($data, 'units', 'rooms_count', $request->input('rooms_count'), true);
    mr_set_if_column($data, 'units', 'bathrooms_count', $request->input('bathrooms_count'), true);
    mr_set_if_column($data, 'units', 'notes', $request->input('notes'), true);
    mr_touch_columns($data, 'units', true);

    $id = DB::table('units')->insertGetId($data);

    return response()->json(['message' => 'تم إنشاء الوحدة وربطها بالمالك', 'id' => $id, 'options' => mr_relation_options_array()]);
};

$cleanupOrphansHandler = function () {
    if (!mr_has_table('properties') || !mr_has_col('properties', 'owner_id')) {
        return response()->json(['message' => 'لا يوجد حقل مالك في جدول العقارات', 'deleted' => ['properties' => 0]]);
    }

    $query = DB::table('properties')->where(function ($q) {
        $q->whereNull('owner_id')->orWhere('owner_id', '')->orWhere('owner_id', 0);
    });

    if (mr_has_table('owners')) {
        $ownerIds = DB::table('owners')->pluck('id')->map(fn($v) => (string) $v)->all();

        if (count($ownerIds) > 0) {
            $query->orWhere(function ($q) use ($ownerIds) {
                $q->whereNotNull('owner_id')->where('owner_id', '!=', '')->whereNotIn('owner_id', $ownerIds);
            });
        }
    }

    $propertyIds = $query->pluck('id')->map(fn($v) => (int) $v)->all();
    $deleted = mr_delete_properties_cascade($propertyIds);

    return response()->json([
        'message' => 'تم حذف العقارات التي ليس لها مالك',
        'deleted' => $deleted,
        'options' => mr_relation_options_array(),
    ]);
};

$deleteOwnerCascadeHandler = function (Request $request, $ownerId = null) {
    $ownerId = $ownerId ?: $request->input('owner_id');

    if (!$ownerId || !mr_has_table('owners') || !DB::table('owners')->where('id', $ownerId)->exists()) {
        return response()->json(['message' => 'المالك غير موجود'], 404);
    }

    $propertyIds = [];
    if (mr_has_table('properties') && mr_has_col('properties', 'owner_id')) {
        $propertyIds = DB::table('properties')->where('owner_id', $ownerId)->pluck('id')->map(fn($v) => (int) $v)->all();
    }

    $deleted = mr_delete_properties_cascade($propertyIds);

    if (mr_has_table('units') && mr_has_col('units', 'owner_id')) {
        $directUnitIds = DB::table('units')
            ->where('owner_id', $ownerId)
            ->where(function ($q) {
                $q->whereNull('property_id')->orWhere('property_id', '')->orWhere('property_id', 0);
            })
            ->pluck('id')
            ->map(fn($v) => (int) $v)
            ->all();

        $deleted['direct_units'] = mr_soft_or_hard_delete_by_id('units', $directUnitIds);
    }

    foreach (['owner_bank_accounts', 'owner_payouts'] as $table) {
        mr_soft_or_hard_delete($table, 'owner_id', [(int) $ownerId]);
    }

    mr_soft_or_hard_delete_by_id('owners', [(int) $ownerId]);

    return response()->json([
        'message' => 'تم حذف المالك وجميع عقاراته ووحداته المرتبطة',
        'deleted' => $deleted,
        'options' => mr_relation_options_array(),
    ]);
};

Route::get('/relation-manager/options', $relationOptionsHandler);
Route::get('/my/relation-manager/options', $relationOptionsHandler);

Route::post('/relation-manager/create-property', $createPropertyHandler);
Route::post('/my/relation-manager/create-property', $createPropertyHandler);

Route::post('/relation-manager/create-unit', $createUnitHandler);
Route::post('/my/relation-manager/create-unit', $createUnitHandler);

Route::post('/relation-manager/cleanup-orphan-properties', $cleanupOrphansHandler);
Route::post('/my/relation-manager/cleanup-orphan-properties', $cleanupOrphansHandler);

Route::post('/relation-manager/delete-owner-cascade/{ownerId?}', $deleteOwnerCascadeHandler);
Route::post('/my/relation-manager/delete-owner-cascade/{ownerId?}', $deleteOwnerCascadeHandler);
