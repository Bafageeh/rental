<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (!function_exists('mrr_has_table')) {
    function mrr_has_table(string $table): bool
    {
        try {
            return Schema::hasTable($table);
        } catch (Throwable $e) {
            return false;
        }
    }
}

if (!function_exists('mrr_has_col')) {
    function mrr_has_col(string $table, string $column): bool
    {
        try {
            return Schema::hasColumn($table, $column);
        } catch (Throwable $e) {
            return false;
        }
    }
}

if (!function_exists('mrr_columns')) {
    function mrr_columns(string $table): array
    {
        try {
            return Schema::getColumnListing($table);
        } catch (Throwable $e) {
            return [];
        }
    }
}

if (!function_exists('mrr_entity_table')) {
    function mrr_entity_table(string $entity): ?string
    {
        $key = strtolower(trim($entity));
        $key = str_replace(['-', '_'], '', $key);

        $map = [
            'owner' => 'owners',
            'owners' => 'owners',
            'مالك' => 'owners',
            'property' => 'properties',
            'properties' => 'properties',
            'building' => 'properties',
            'عقار' => 'properties',
            'unit' => 'units',
            'units' => 'units',
            'وحدة' => 'units',
            'tenant' => 'tenants',
            'tenants' => 'tenants',
            'مستأجر' => 'tenants',
            'contract' => 'contracts',
            'contracts' => 'contracts',
            'عقد' => 'contracts',
        ];

        return $map[$key] ?? null;
    }
}

if (!function_exists('mrr_table_entity')) {
    function mrr_table_entity(string $table): string
    {
        return [
            'owners' => 'owner',
            'properties' => 'property',
            'units' => 'unit',
            'tenants' => 'tenant',
            'contracts' => 'contract',
            'payments' => 'payment',
            'property_expenses' => 'expense',
            'expenses' => 'expense',
        ][$table] ?? rtrim($table, 's');
    }
}

if (!function_exists('mrr_ar_entity_title')) {
    function mrr_ar_entity_title(string $entity): string
    {
        return [
            'owner' => 'المالك',
            'property' => 'العقار',
            'unit' => 'الوحدة',
            'tenant' => 'المستأجر',
            'contract' => 'العقد',
            'payment' => 'الدفعة',
            'expense' => 'المصروف',
        ][$entity] ?? 'السجل';
    }
}

if (!function_exists('mrr_row_value')) {
    function mrr_row_value($row, string $key)
    {
        if (!$row) {
            return null;
        }
        if (is_array($row)) {
            return $row[$key] ?? null;
        }
        return $row->{$key} ?? null;
    }
}

if (!function_exists('mrr_clean_value')) {
    function mrr_clean_value($value)
    {
        if ($value === null) {
            return null;
        }
        if (is_bool($value)) {
            return $value ? 'نعم' : 'لا';
        }
        if (is_numeric($value) && (string) (int) $value === (string) $value) {
            return $value;
        }
        $text = trim((string) $value);
        return $text === '' ? null : $text;
    }
}

if (!function_exists('mrr_label')) {
    function mrr_label($row, array $preferred, string $fallback): string
    {
        foreach ($preferred as $field) {
            $value = mrr_clean_value(mrr_row_value($row, $field));
            if ($value !== null && $value !== '') {
                return (string) $value;
            }
        }
        return $fallback;
    }
}

if (!function_exists('mrr_select_cols')) {
    function mrr_select_cols(string $table, array $wanted): array
    {
        $columns = [];
        foreach ($wanted as $column) {
            if (mrr_has_col($table, $column)) {
                $columns[] = $column;
            }
        }
        return array_values(array_unique($columns));
    }
}

if (!function_exists('mrr_apply_active_scope')) {
    function mrr_apply_active_scope($query, string $table)
    {
        if (mrr_has_col($table, 'deleted_at')) {
            $query->whereNull('deleted_at');
        }
        return $query;
    }
}

if (!function_exists('mrr_find')) {
    function mrr_find(string $table, $id)
    {
        if (!mrr_has_table($table) || !mrr_has_col($table, 'id')) {
            return null;
        }
        $query = DB::table($table)->where('id', $id);
        mrr_apply_active_scope($query, $table);
        return $query->first();
    }
}

if (!function_exists('mrr_label_for')) {
    function mrr_label_for(string $table, $row): string
    {
        $id = mrr_row_value($row, 'id');
        if ($table === 'owners') {
            return mrr_label($row, ['name', 'full_name', 'title', 'owner_name'], 'مالك #' . $id);
        }
        if ($table === 'properties') {
            return mrr_label($row, ['title', 'name', 'property_name', 'address', 'deed_number'], 'عقار #' . $id);
        }
        if ($table === 'units') {
            return mrr_label($row, ['unit_number', 'title', 'name'], 'وحدة #' . $id);
        }
        if ($table === 'tenants') {
            return mrr_label($row, ['name', 'full_name', 'tenant_name'], 'مستأجر #' . $id);
        }
        if ($table === 'contracts') {
            return mrr_label($row, ['government_contract_number', 'contract_number', 'title', 'name'], 'عقد #' . $id);
        }
        if ($table === 'payments') {
            return mrr_label($row, ['title', 'payment_number', 'due_date'], 'دفعة #' . $id);
        }
        return mrr_label($row, ['title', 'name', 'label'], 'سجل #' . $id);
    }
}

if (!function_exists('mrr_find_label')) {
    function mrr_find_label(?string $table, $id): ?string
    {
        if (!$table || $id === null || $id === '') {
            return null;
        }
        $row = mrr_find($table, $id);
        return $row ? mrr_label_for($table, $row) : null;
    }
}

if (!function_exists('mrr_translate_value')) {
    function mrr_translate_value(string $field, $value)
    {
        if ($value === null || $value === '') {
            return null;
        }

        $text = trim((string) $value);
        $map = [
            'active' => 'نشط',
            'inactive' => 'غير نشط',
            'rented' => 'مؤجرة',
            'available' => 'متاحة',
            'vacant' => 'شاغرة',
            'maintenance' => 'صيانة',
            'managed' => 'إدارة للغير',
            'owned' => 'مملوك',
            'building' => 'عمارة',
            'apartment' => 'شقة',
            'villa' => 'فيلا',
            'owner' => 'وحدة خاصة بالمالك',
            'property' => 'وحدة تحت عقار/عمارة',
            'paid' => 'مدفوعة',
            'due' => 'مستحقة',
            'overdue' => 'متأخرة',
            'cancelled' => 'ملغاة',
            'expired' => 'منتهي',
            'draft' => 'مسودة',
            'monthly' => 'شهري',
            'quarterly' => 'ربع سنوي',
            'semi_annual' => 'نصف سنوي',
            'annual' => 'سنوي',
            'government_pdf' => 'عقد حكومي PDF',
        ];

        if (array_key_exists(strtolower($text), $map)) {
            return $map[strtolower($text)];
        }

        if (in_array(strtolower($text), ['true', '1'], true) && preg_match('/^(has_|is_|can_|allow_|with_)/', $field)) {
            return 'نعم';
        }
        if (in_array(strtolower($text), ['false', '0'], true) && preg_match('/^(has_|is_|can_|allow_|with_)/', $field)) {
            return 'لا';
        }

        return $value;
    }
}

if (!function_exists('mrr_field_label')) {
    function mrr_field_label(string $field, ?string $table = null): string
    {
        if ($table === 'properties' && $field === 'name') {
            return 'اسم العقار';
        }

        $map = [
            'id' => 'المعرف',
            'owner_id' => 'اسم المالك',
            'property_id' => 'العقار',
            'unit_id' => 'الوحدة',
            'tenant_id' => 'المستأجر',
            'contract_id' => 'العقد',
            'name' => 'الاسم',
            'full_name' => 'الاسم الكامل',
            'title' => 'العنوان',
            'property_name' => 'اسم العقار',
            'unit_number' => 'رقم الوحدة',
            'contract_number' => 'رقم العقد',
            'government_contract_number' => 'رقم العقد الحكومي',
            'phone' => 'الجوال',
            'mobile' => 'الجوال',
            'email' => 'البريد الإلكتروني',
            'national_id' => 'رقم الهوية',
            'nationality' => 'الجنسية',
            'city' => 'المدينة',
            'district' => 'الحي',
            'address' => 'العنوان',
            'national_short_address' => 'العنوان الوطني المختصر',
            'property_area' => 'مساحة العقار',
            'deed_number' => 'رقم الصك',
            'property_type' => 'نوع العقار',
            'management_type' => 'نوع الإدارة',
            'unit_scope' => 'نوع الوحدة',
            'status' => 'الحالة',
            'type' => 'النوع',
            'floor' => 'الدور',
            'area' => 'المساحة',
            'rooms_count' => 'عدد الغرف',
            'bathrooms_count' => 'عدد دورات المياه',
            'has_kitchen' => 'المطبخ مركب',
            'has_living_room' => 'توجد صالة',
            'rent_amount' => 'قيمة الإيجار',
            'parking_fee' => 'رسوم الموقف',
            'services_fee' => 'رسوم الخدمات',
            'deposit_amount' => 'مبلغ التأمين',
            'total_contract_value' => 'إجمالي قيمة العقد',
            'payment_cycle' => 'دورة السداد',
            'start_date' => 'بداية العقد',
            'end_date' => 'نهاية العقد',
            'due_date' => 'تاريخ الاستحقاق',
            'paid_date' => 'تاريخ السداد',
            'amount' => 'المبلغ',
            'notes' => 'ملاحظات',
            'source' => 'المصدر',
            'created_at' => 'تاريخ الإنشاء',
            'updated_at' => 'آخر تحديث',
        ];

        if (isset($map[$field])) {
            return $map[$field];
        }

        $field = str_replace('_', ' ', $field);
        return $field;
    }
}

if (!function_exists('mrr_relation_table_for_field')) {
    function mrr_relation_table_for_field(string $field): ?string
    {
        return [
            'owner_id' => 'owners',
            'property_id' => 'properties',
            'unit_id' => 'units',
            'tenant_id' => 'tenants',
            'contract_id' => 'contracts',
        ][$field] ?? null;
    }
}

if (!function_exists('mrr_public_fields')) {
    function mrr_public_fields(string $table, $row): array
    {
        if (!$row) {
            return [];
        }

        $skip = [
            'deleted_at', 'password', 'remember_token', 'api_token', 'token', 'otp',
            'raw_text', 'raw_json', 'extracted_data', 'payload', 'metadata',
            'location_lat', 'location_lng', 'national_address',
        ];

        $fields = [];
        $data = (array) $row;

        foreach ($data as $key => $value) {
            if (in_array($key, $skip, true)) {
                continue;
            }

            if ($key === 'id') {
                continue;
            }

            $display = null;
            $relationTable = mrr_relation_table_for_field($key);
            if ($relationTable) {
                $display = mrr_find_label($relationTable, $value) ?: ($value ? ('#' . $value) : null);
            } else {
                $display = mrr_translate_value($key, $value);
            }

            if ($display === null || $display === '') {
                continue;
            }

            $fields[] = [
                'key' => $key,
                'label' => mrr_field_label($key, $table),
                'value' => $display,
                'raw_value' => $value,
                'is_relation' => (bool) $relationTable,
            ];
        }

        return array_slice($fields, 0, 80);
    }
}

if (!function_exists('mrr_item')) {
    function mrr_item(string $table, $row): array
    {
        $entity = mrr_table_entity($table);
        $id = (int) mrr_row_value($row, 'id');
        $title = mrr_label_for($table, $row);
        $subtitleParts = [];
        $badge = null;
        $meta = [];

        if ($table === 'properties') {
            $owner = mrr_find_label('owners', mrr_row_value($row, 'owner_id'));
            $place = trim(implode(' - ', array_filter([mrr_row_value($row, 'city'), mrr_row_value($row, 'district')])));
            $subtitleParts = array_values(array_filter([$owner, $place]));
            $badge = mrr_translate_value('property_type', mrr_row_value($row, 'property_type')) ?: mrr_translate_value('management_type', mrr_row_value($row, 'management_type'));
            $meta = array_values(array_filter([
                mrr_row_value($row, 'deed_number') ? ('الصك: ' . mrr_row_value($row, 'deed_number')) : null,
                $place,
            ]));
        } elseif ($table === 'units') {
            $property = mrr_find_label('properties', mrr_row_value($row, 'property_id'));
            $owner = mrr_find_label('owners', mrr_row_value($row, 'owner_id'));
            $subtitleParts = array_values(array_filter([$property ?: $owner, mrr_row_value($row, 'floor') ? ('الدور ' . mrr_row_value($row, 'floor')) : null]));
            $badge = mrr_translate_value('status', mrr_row_value($row, 'status')) ?: mrr_translate_value('unit_scope', mrr_row_value($row, 'unit_scope'));
            $meta = array_values(array_filter([
                mrr_row_value($row, 'rooms_count') ? ('غرف: ' . mrr_row_value($row, 'rooms_count')) : null,
                mrr_row_value($row, 'rent_amount') ? ('الإيجار: ' . mrr_row_value($row, 'rent_amount')) : null,
            ]));
        } elseif ($table === 'contracts') {
            $tenant = mrr_find_label('tenants', mrr_row_value($row, 'tenant_id'));
            $unit = mrr_find_label('units', mrr_row_value($row, 'unit_id'));
            $property = mrr_find_label('properties', mrr_row_value($row, 'property_id'));
            $subtitleParts = array_values(array_filter([$tenant, $unit ?: $property]));
            $badge = mrr_translate_value('status', mrr_row_value($row, 'status'));
            $meta = array_values(array_filter([
                mrr_row_value($row, 'start_date') ? ('من ' . mrr_row_value($row, 'start_date')) : null,
                mrr_row_value($row, 'end_date') ? ('إلى ' . mrr_row_value($row, 'end_date')) : null,
            ]));
        } elseif ($table === 'tenants') {
            $subtitleParts = array_values(array_filter([mrr_row_value($row, 'phone') ?: mrr_row_value($row, 'mobile'), mrr_row_value($row, 'email')]));
            $badge = mrr_translate_value('status', mrr_row_value($row, 'status'));
        } elseif ($table === 'owners') {
            $subtitleParts = array_values(array_filter([mrr_row_value($row, 'phone') ?: mrr_row_value($row, 'mobile'), mrr_row_value($row, 'email')]));
            $badge = mrr_translate_value('status', mrr_row_value($row, 'status'));
        } else {
            $subtitleParts = array_values(array_filter([mrr_row_value($row, 'notes'), mrr_row_value($row, 'created_at')]));
            $badge = mrr_translate_value('status', mrr_row_value($row, 'status'));
        }

        return [
            'id' => $id,
            'entity' => $entity,
            'entity_title' => mrr_ar_entity_title($entity),
            'title' => $title,
            'subtitle' => implode(' • ', $subtitleParts),
            'badge' => $badge,
            'meta' => $meta,
            'route' => '/' . $entity . '/' . $id,
        ];
    }
}

if (!function_exists('mrr_list')) {
    function mrr_list(string $table, callable $where, int $limit = 100): array
    {
        if (!mrr_has_table($table) || !mrr_has_col($table, 'id')) {
            return [];
        }
        $query = DB::table($table);
        mrr_apply_active_scope($query, $table);
        $where($query);
        if (mrr_has_col($table, 'created_at')) {
            $query->orderBy('created_at', 'desc');
        } else {
            $query->orderBy('id', 'desc');
        }
        return $query->limit($limit)->get()->map(fn ($row) => mrr_item($table, $row))->values()->all();
    }
}

if (!function_exists('mrr_related_sections')) {
    function mrr_related_sections(string $entity, int $id): array
    {
        $sections = [];

        if ($entity === 'owner') {
            if (mrr_has_table('properties') && mrr_has_col('properties', 'owner_id')) {
                $properties = mrr_list('properties', fn ($q) => $q->where('owner_id', $id));
                $sections[] = ['key' => 'owner_properties', 'title' => 'العقارات التابعة لهذا المالك', 'entity' => 'property', 'count' => count($properties), 'items' => $properties];
            }

            if (mrr_has_table('units') && mrr_has_col('units', 'owner_id')) {
                $units = mrr_list('units', function ($q) use ($id) {
                    $q->where('owner_id', $id);
                    if (mrr_has_col('units', 'unit_scope')) {
                        $q->where(function ($qq) {
                            $qq->where('unit_scope', 'owner')->orWhereNull('property_id')->orWhere('property_id', 0);
                        });
                    } elseif (mrr_has_col('units', 'property_id')) {
                        $q->where(function ($qq) {
                            $qq->whereNull('property_id')->orWhere('property_id', 0);
                        });
                    }
                });
                $sections[] = ['key' => 'owner_direct_units', 'title' => 'الوحدات الخاصة بالمالك', 'entity' => 'unit', 'count' => count($units), 'items' => $units];
            }
        }

        if ($entity === 'property') {
            $unitIds = [];
            if (mrr_has_table('units') && mrr_has_col('units', 'property_id')) {
                $units = mrr_list('units', fn ($q) => $q->where('property_id', $id));
                $sections[] = ['key' => 'property_units', 'title' => 'الوحدات التابعة لهذا العقار', 'entity' => 'unit', 'count' => count($units), 'items' => $units];
                $unitIds = array_map(fn ($row) => (int) $row['id'], $units);
            }

            if (mrr_has_table('contracts')) {
                $contracts = mrr_list('contracts', function ($q) use ($id, $unitIds) {
                    $has = false;
                    if (mrr_has_col('contracts', 'property_id')) {
                        $q->where('property_id', $id);
                        $has = true;
                    }
                    if (count($unitIds) > 0 && mrr_has_col('contracts', 'unit_id')) {
                        if ($has) {
                            $q->orWhereIn('unit_id', $unitIds);
                        } else {
                            $q->whereIn('unit_id', $unitIds);
                        }
                    }
                });
                $sections[] = ['key' => 'property_contracts', 'title' => 'العقود المرتبطة بهذا العقار', 'entity' => 'contract', 'count' => count($contracts), 'items' => $contracts];
            }
        }

        if ($entity === 'unit') {
            if (mrr_has_table('contracts') && mrr_has_col('contracts', 'unit_id')) {
                $contracts = mrr_list('contracts', fn ($q) => $q->where('unit_id', $id));
                $sections[] = ['key' => 'unit_contracts', 'title' => 'العقود التابعة لهذه الوحدة', 'entity' => 'contract', 'count' => count($contracts), 'items' => $contracts];
            }
        }

        if ($entity === 'tenant') {
            if (mrr_has_table('contracts') && mrr_has_col('contracts', 'tenant_id')) {
                $contracts = mrr_list('contracts', fn ($q) => $q->where('tenant_id', $id));
                $sections[] = ['key' => 'tenant_contracts', 'title' => 'عقود هذا المستأجر', 'entity' => 'contract', 'count' => count($contracts), 'items' => $contracts];
            }
        }

        if ($entity === 'contract') {
            if (mrr_has_table('payments') && mrr_has_col('payments', 'contract_id')) {
                $payments = mrr_list('payments', fn ($q) => $q->where('contract_id', $id));
                $sections[] = ['key' => 'contract_payments', 'title' => 'دفعات هذا العقد', 'entity' => 'payment', 'count' => count($payments), 'items' => $payments];
            }
        }

        return $sections;
    }
}

if (!function_exists('mrr_relation_links')) {
    function mrr_relation_links(string $table, $row): array
    {
        $links = [];
        foreach (['owner_id', 'property_id', 'unit_id', 'tenant_id', 'contract_id'] as $field) {
            $relationTable = mrr_relation_table_for_field($field);
            $value = mrr_row_value($row, $field);
            $label = mrr_find_label($relationTable, $value);
            if ($label) {
                $links[] = [
                    'field' => $field,
                    'label' => mrr_field_label($field),
                    'entity' => mrr_table_entity($relationTable),
                    'id' => (int) $value,
                    'title' => $label,
                    'route' => '/' . mrr_table_entity($relationTable) . '/' . (int) $value,
                ];
            }
        }
        return $links;
    }
}

$myRentalsRelatedHandler = function (string $entity, $id) {
    $table = mrr_entity_table($entity);
    if (!$table || !mrr_has_table($table)) {
        return response()->json(['message' => 'نوع السجل غير معروف أو الجدول غير موجود'], 404);
    }

    $record = mrr_find($table, $id);
    if (!$record) {
        return response()->json(['message' => 'السجل غير موجود'], 404);
    }

    $entityKey = mrr_table_entity($table);
    $title = mrr_label_for($table, $record);
    $fields = mrr_public_fields($table, $record);
    $sections = mrr_related_sections($entityKey, (int) $id);
    $links = mrr_relation_links($table, $record);

    return response()->json([
        'entity' => $entityKey,
        'entity_title' => mrr_ar_entity_title($entityKey),
        'id' => (int) $id,
        'title' => $title,
        'fields' => $fields,
        'sections' => $sections,
        'links' => $links,
        'counts' => collect($sections)->mapWithKeys(fn ($section) => [$section['key'] => $section['count']])->all(),
    ]);
};

Route::get('/relation-manager/related/{entity}/{id}', $myRentalsRelatedHandler);
Route::get('/my/relation-manager/related/{entity}/{id}', $myRentalsRelatedHandler);
