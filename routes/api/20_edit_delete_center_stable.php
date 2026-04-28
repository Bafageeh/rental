<?php

/*
|--------------------------------------------------------------------------
| Stable Edit/Delete Center routes
|--------------------------------------------------------------------------
| Loaded before the large legacy 19_receipts.php module so the scoped mobile
| endpoints are available even if the older edit/delete-center patch is absent
| or partially removed.
*/

if (!function_exists('my_rentals_ed_current_user')) {
    function my_rentals_ed_current_user(\Illuminate\Http\Request $request): ?\App\Models\User
    {
        $user = $request->user();

        if ($user instanceof \App\Models\User) {
            return $user;
        }

        $merged = $request->input('_auth_user');

        if ($merged instanceof \App\Models\User) {
            return $merged;
        }

        if (function_exists('my_rentals_current_user_for_scope')) {
            $scoped = my_rentals_current_user_for_scope($request);
            if ($scoped instanceof \App\Models\User) {
                return $scoped;
            }
        }

        if (function_exists('my_rentals_bearer_user')) {
            $bearer = my_rentals_bearer_user($request);
            if ($bearer instanceof \App\Models\User) {
                return $bearer;
            }
        }

        return null;
    }
}

if (!function_exists('my_rentals_ed_is_admin')) {
    function my_rentals_ed_is_admin(?\App\Models\User $user): bool
    {
        if (!$user) {
            return false;
        }

        if (method_exists($user, 'effectiveRole')) {
            $role = strtolower(trim((string) $user->effectiveRole()));
        } else {
            $role = strtolower(trim((string) ($user->role ?? 'owner')));
        }

        if (function_exists('my_rentals_is_admin_user')) {
            return my_rentals_is_admin_user($user);
        }

        return in_array($role, ['admin', 'manager', 'super_admin'], true);
    }
}

if (!function_exists('my_rentals_ed_model_map')) {
    function my_rentals_ed_model_map(): array
    {
        return [
            'owners' => [
                'label' => 'الملاك',
                'model' => \App\Models\Owner::class,
                'table' => 'owners',
                'title_fields' => ['name', 'phone', 'email'],
                'search_fields' => ['name', 'phone', 'email', 'national_id'],
                'editable' => ['name', 'phone', 'email', 'national_id', 'notes'],
                'scope' => 'owner',
                'danger_delete_if_related' => true,
            ],
            'properties' => [
                'label' => 'العقارات',
                'model' => \App\Models\Property::class,
                'table' => 'properties',
                'title_fields' => ['name', 'title', 'city', 'district'],
                'search_fields' => ['name', 'title', 'city', 'district', 'address', 'deed_number'],
                'editable' => ['owner_id', 'name', 'title', 'deed_number', 'city', 'district', 'address', 'national_short_address', 'property_area', 'floors_count', 'parking_spots_count', 'elevators_count', 'property_type', 'usage_type', 'management_type', 'notes'],
                'scope' => 'property',
                'danger_delete_if_related' => true,
            ],
            'units' => [
                'label' => 'الوحدات',
                'model' => \App\Models\Unit::class,
                'table' => 'units',
                'title_fields' => ['unit_number', 'floor', 'status'],
                'search_fields' => ['unit_number', 'floor', 'type', 'status'],
                'editable' => ['property_id', 'parent_unit_id', 'unit_number', 'floor', 'type', 'is_subdivided', 'rooms_count', 'bathrooms_count', 'has_kitchen', 'kitchen_type', 'is_kitchen_installed', 'has_living_room', 'is_rooftop', 'orientation', 'rent_amount', 'status', 'notes'],
                'scope' => 'unit',
                'danger_delete_if_related' => true,
            ],
            'tenants' => [
                'label' => 'المستأجرون',
                'model' => \App\Models\Tenant::class,
                'table' => 'tenants',
                'title_fields' => ['name', 'phone', 'national_id'],
                'search_fields' => ['name', 'phone', 'email', 'national_id'],
                'editable' => ['name', 'phone', 'email', 'national_id', 'nationality', 'notes'],
                'scope' => 'tenant',
                'danger_delete_if_related' => true,
            ],
            'contracts' => [
                'label' => 'العقود',
                'model' => \App\Models\Contract::class,
                'table' => 'contracts',
                'title_fields' => ['contract_number', 'government_contract_number', 'status'],
                'search_fields' => ['contract_number', 'government_contract_number', 'status'],
                'editable' => ['tenant_id', 'unit_id', 'contract_number', 'government_contract_number', 'start_date', 'end_date', 'rent_amount', 'parking_fee', 'services_fee', 'deposit_amount', 'payment_cycle', 'status', 'notes'],
                'scope' => 'contract',
                'danger_delete_if_related' => true,
            ],
            'payments' => [
                'label' => 'الدفعات',
                'model' => \App\Models\Payment::class,
                'table' => 'payments',
                'title_fields' => ['amount', 'due_date', 'status'],
                'search_fields' => ['status', 'notes'],
                'editable' => ['contract_id', 'amount', 'due_date', 'paid_date', 'status', 'notes'],
                'scope' => 'payment',
                'danger_delete_if_related' => false,
            ],
            'payment_receipts' => [
                'label' => 'سندات القبض',
                'model' => class_exists(\App\Models\PaymentReceipt::class) ? \App\Models\PaymentReceipt::class : null,
                'table' => 'payment_receipts',
                'title_fields' => ['amount', 'received_date', 'method'],
                'search_fields' => ['method', 'reference_number', 'notes'],
                'editable' => ['payment_id', 'contract_id', 'tenant_id', 'amount', 'received_date', 'method', 'reference_number', 'notes'],
                'scope' => 'payment_receipt',
                'danger_delete_if_related' => false,
            ],
            'property_expenses' => [
                'label' => 'مصروفات العقارات',
                'model' => class_exists(\App\Models\PropertyExpense::class) ? \App\Models\PropertyExpense::class : null,
                'table' => 'property_expenses',
                'title_fields' => ['title', 'amount', 'expense_date'],
                'search_fields' => ['title', 'description', 'notes'],
                'editable' => ['property_id', 'category_id', 'title', 'amount', 'expense_date', 'description', 'notes'],
                'scope' => 'property_expense',
                'danger_delete_if_related' => false,
            ],
            'utility_bills' => [
                'label' => 'فواتير الخدمات',
                'model' => class_exists(\App\Models\UtilityBill::class) ? \App\Models\UtilityBill::class : null,
                'table' => 'utility_bills',
                'title_fields' => ['bill_type', 'amount', 'due_date'],
                'search_fields' => ['bill_type', 'provider', 'bill_number', 'status', 'notes'],
                'editable' => ['property_id', 'bill_type', 'provider', 'bill_number', 'amount', 'bill_date', 'due_date', 'paid_date', 'status', 'notes'],
                'scope' => 'utility_bill',
                'danger_delete_if_related' => false,
            ],
            'document_records' => [
                'label' => 'المستندات',
                'model' => class_exists(\App\Models\DocumentRecord::class) ? \App\Models\DocumentRecord::class : null,
                'table' => 'document_records',
                'title_fields' => ['title', 'document_type', 'status'],
                'search_fields' => ['title', 'document_type', 'document_number', 'status', 'notes'],
                'editable' => ['entity_type', 'entity_id', 'title', 'document_type', 'document_number', 'issue_date', 'expiry_date', 'status', 'notes'],
                'scope' => 'document_record',
                'danger_delete_if_related' => false,
            ],
            'follow_up_tasks' => [
                'label' => 'المتابعات والمهام',
                'model' => class_exists(\App\Models\FollowUpTask::class) ? \App\Models\FollowUpTask::class : null,
                'table' => 'follow_up_tasks',
                'title_fields' => ['title', 'priority', 'status'],
                'search_fields' => ['title', 'task_type', 'priority', 'status', 'notes'],
                'editable' => ['title', 'task_type', 'priority', 'status', 'due_date', 'completed_at', 'property_id', 'unit_id', 'tenant_id', 'contract_id', 'assigned_to_name', 'notes'],
                'scope' => 'follow_up_task',
                'danger_delete_if_related' => false,
            ],
            'owner_payouts' => [
                'label' => 'حوالات الملاك',
                'model' => class_exists(\App\Models\OwnerPayout::class) ? \App\Models\OwnerPayout::class : null,
                'table' => 'owner_payouts',
                'title_fields' => ['amount', 'payout_date', 'status'],
                'search_fields' => ['method', 'reference_number', 'status', 'notes'],
                'editable' => ['owner_id', 'owner_bank_account_id', 'amount', 'payout_date', 'period_start', 'period_end', 'method', 'reference_number', 'status', 'notes'],
                'scope' => 'owner_payout',
                'danger_delete_if_related' => false,
            ],
            'owner_bank_accounts' => [
                'label' => 'حسابات الملاك البنكية',
                'model' => class_exists(\App\Models\OwnerBankAccount::class) ? \App\Models\OwnerBankAccount::class : null,
                'table' => 'owner_bank_accounts',
                'title_fields' => ['bank_name', 'account_name', 'iban'],
                'search_fields' => ['bank_name', 'account_name', 'iban', 'account_number', 'notes'],
                'editable' => ['owner_id', 'bank_name', 'account_name', 'iban', 'account_number', 'is_default', 'is_active', 'notes'],
                'scope' => 'owner_bank_account',
                'danger_delete_if_related' => false,
            ],
            'unit_inspections' => [
                'label' => 'معاينات الوحدات',
                'model' => class_exists(\App\Models\UnitInspection::class) ? \App\Models\UnitInspection::class : null,
                'table' => 'unit_inspections',
                'title_fields' => ['inspection_type', 'inspection_date', 'status'],
                'search_fields' => ['inspection_type', 'status', 'inspector_name', 'damage_notes', 'notes'],
                'editable' => ['property_id', 'unit_id', 'tenant_id', 'contract_id', 'inspection_type', 'status', 'inspection_date', 'inspector_name', 'electricity_meter_reading', 'water_meter_reading', 'keys_count', 'walls_ok', 'doors_ok', 'windows_ok', 'plumbing_ok', 'electricity_ok', 'ac_ok', 'kitchen_ok', 'bathrooms_ok', 'cleanliness_ok', 'damage_notes', 'estimated_repair_cost', 'recommendations', 'notes'],
                'scope' => 'unit_inspection',
                'danger_delete_if_related' => false,
            ],
            'service_providers' => [
                'label' => 'مقدمو الخدمة',
                'model' => class_exists(\App\Models\ServiceProvider::class) ? \App\Models\ServiceProvider::class : null,
                'table' => 'service_providers',
                'title_fields' => ['name', 'provider_type', 'phone'],
                'search_fields' => ['name', 'provider_type', 'phone', 'email', 'city', 'district', 'notes'],
                'editable' => ['name', 'provider_type', 'phone', 'alternate_phone', 'email', 'city', 'district', 'address', 'default_visit_fee', 'rating', 'is_preferred', 'is_active', 'notes'],
                'scope' => 'global',
                'danger_delete_if_related' => false,
            ],
        ];
    }
}

if (!function_exists('my_rentals_ed_resource_config')) {
    function my_rentals_ed_resource_config(string $resource): ?array
    {
        $map = my_rentals_ed_model_map();
        $config = $map[$resource] ?? null;

        if (!$config || empty($config['model']) || !class_exists($config['model'])) {
            return null;
        }

        if (!\Illuminate\Support\Facades\Schema::hasTable($config['table'])) {
            return null;
        }

        return $config;
    }
}

if (!function_exists('my_rentals_ed_existing_fields')) {
    function my_rentals_ed_existing_fields(array $config, array $fields): array
    {
        return array_values(array_filter($fields, fn ($field) => \Illuminate\Support\Facades\Schema::hasColumn($config['table'], $field)));
    }
}

if (!function_exists('my_rentals_ed_scope_ids')) {
    function my_rentals_ed_scope_ids(?\App\Models\User $user): array
    {
        $isAdmin = my_rentals_ed_is_admin($user);

        if (!$user) {
            $propertyIds = collect();
        } elseif ($isAdmin) {
            $propertyIds = \App\Models\Property::pluck('id');
        } elseif ($user->owner_id) {
            $propertyIds = \App\Models\Property::where('owner_id', $user->owner_id)->pluck('id');
        } else {
            $propertyIds = collect();
        }

        $unitIds = \App\Models\Unit::whereIn('property_id', $propertyIds)->pluck('id');
        $contractIds = \App\Models\Contract::whereIn('unit_id', $unitIds)->pluck('id');
        $tenantIds = \App\Models\Contract::whereIn('id', $contractIds)->whereNotNull('tenant_id')->pluck('tenant_id')->unique()->values();

        return [
            'is_admin' => $isAdmin,
            'property_ids' => $propertyIds,
            'unit_ids' => $unitIds,
            'contract_ids' => $contractIds,
            'tenant_ids' => $tenantIds,
            'owner_id' => $user?->owner_id,
        ];
    }
}

if (!function_exists('my_rentals_ed_apply_scope')) {
    function my_rentals_ed_apply_scope($query, string $resource, array $config, ?\App\Models\User $user)
    {
        if (!$user || my_rentals_ed_is_admin($user)) {
            return $query;
        }

        $scope = my_rentals_ed_scope_ids($user);
        $table = $config['table'];

        if ($resource === 'owners') {
            return $query->where('id', $scope['owner_id'] ?: 0);
        }

        if (\Illuminate\Support\Facades\Schema::hasColumn($table, 'owner_id')) {
            return $query->where('owner_id', $scope['owner_id'] ?: 0);
        }

        if (\Illuminate\Support\Facades\Schema::hasColumn($table, 'property_id')) {
            return $query->whereIn('property_id', $scope['property_ids']);
        }

        if (\Illuminate\Support\Facades\Schema::hasColumn($table, 'unit_id')) {
            return $query->whereIn('unit_id', $scope['unit_ids']);
        }

        if (\Illuminate\Support\Facades\Schema::hasColumn($table, 'contract_id')) {
            return $query->whereIn('contract_id', $scope['contract_ids']);
        }

        if (\Illuminate\Support\Facades\Schema::hasColumn($table, 'tenant_id')) {
            return $query->whereIn('tenant_id', $scope['tenant_ids']);
        }

        return $query->whereRaw('1 = 0');
    }
}

if (!function_exists('my_rentals_ed_item_payload')) {
    function my_rentals_ed_item_payload($item, string $resource, array $config): array
    {
        $editable = my_rentals_ed_existing_fields($config, $config['editable']);
        $titleFields = my_rentals_ed_existing_fields($config, $config['title_fields']);
        $values = [];
        $titleParts = [];

        foreach ($editable as $field) {
            $values[$field] = $item->{$field};
        }

        foreach ($titleFields as $field) {
            $value = $item->{$field} ?? null;
            if ($value !== null && $value !== '') {
                $titleParts[] = (string) $value;
            }
        }

        $title = implode(' - ', $titleParts);
        if ($title === '') {
            $title = ($config['label'] ?? $resource) . ' #' . $item->id;
        }

        return [
            'id' => $item->id,
            'resource' => $resource,
            'resource_label' => $config['label'],
            'title' => $title,
            'values' => $values,
            'raw' => $item->toArray(),
        ];
    }
}

if (!function_exists('my_rentals_ed_cast_value')) {
    function my_rentals_ed_cast_value(string $table, string $field, mixed $value): mixed
    {
        if ($value === '') {
            return null;
        }

        if (!\Illuminate\Support\Facades\Schema::hasColumn($table, $field)) {
            return $value;
        }

        $type = \Illuminate\Support\Facades\Schema::getColumnType($table, $field);

        return match ($type) {
            'integer', 'bigint', 'smallint' => $value === null ? null : (int) $value,
            'float', 'double', 'decimal' => $value === null ? null : (float) $value,
            'boolean' => filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? (bool) $value,
            default => $value,
        };
    }
}

if (!function_exists('my_rentals_ed_relationship_blockers')) {
    function my_rentals_ed_relationship_blockers(string $resource, $item): array
    {
        $id = (int) $item->id;
        $blockers = [];

        $count = function (string $model, string $field) use ($id): int {
            return class_exists($model) ? $model::where($field, $id)->count() : 0;
        };

        if ($resource === 'owners') {
            $n = $count(\App\Models\Property::class, 'owner_id');
            if ($n > 0) $blockers[] = "يوجد {$n} عقار مرتبط";
        }
        if ($resource === 'properties') {
            $n = $count(\App\Models\Unit::class, 'property_id');
            if ($n > 0) $blockers[] = "يوجد {$n} وحدة مرتبطة";
        }
        if ($resource === 'units') {
            $n = $count(\App\Models\Contract::class, 'unit_id');
            if ($n > 0) $blockers[] = "يوجد {$n} عقد مرتبط";
        }
        if ($resource === 'tenants') {
            $n = $count(\App\Models\Contract::class, 'tenant_id');
            if ($n > 0) $blockers[] = "يوجد {$n} عقد مرتبط";
        }
        if ($resource === 'contracts') {
            $n = $count(\App\Models\Payment::class, 'contract_id');
            if ($n > 0) $blockers[] = "يوجد {$n} دفعة مرتبطة";
        }

        return $blockers;
    }
}

if (!function_exists('my_rentals_ed_lookup_option')) {
    function my_rentals_ed_lookup_option($id, string $label, array $extra = []): array
    {
        return array_merge(['id' => $id, 'label' => $label], $extra);
    }
}

if (!function_exists('my_rentals_ed_lookup_payload')) {
    function my_rentals_ed_lookup_payload(?\App\Models\User $user = null): array
    {
        $scope = my_rentals_ed_scope_ids($user);
        $isAdmin = $scope['is_admin'];

        $owners = \App\Models\Owner::query();
        if (!$isAdmin) {
            $owners->where('id', $scope['owner_id'] ?: 0);
        }

        $properties = \App\Models\Property::query();
        if (!$isAdmin) {
            $properties->whereIn('id', $scope['property_ids']);
        }

        $units = \App\Models\Unit::query();
        if (!$isAdmin) {
            $units->whereIn('id', $scope['unit_ids']);
        }

        $tenants = \App\Models\Tenant::query();
        if (!$isAdmin) {
            $tenants->whereIn('id', $scope['tenant_ids']);
        }

        $contracts = \App\Models\Contract::query();
        if (!$isAdmin) {
            $contracts->whereIn('id', $scope['contract_ids']);
        }

        return [
            'owners' => $owners->orderBy('name')->limit(500)->get()->map(fn ($item) => my_rentals_ed_lookup_option($item->id, $item->name ?: ('مالك #' . $item->id)))->values(),
            'properties' => $properties->orderBy('id')->limit(500)->get()->map(fn ($item) => my_rentals_ed_lookup_option($item->id, ($item->name ?? $item->title ?? ('عقار #' . $item->id))))->values(),
            'units' => $units->orderBy('id')->limit(800)->get()->map(fn ($item) => my_rentals_ed_lookup_option($item->id, 'وحدة ' . ($item->unit_number ?: $item->id), ['property_id' => $item->property_id]))->values(),
            'tenants' => $tenants->orderBy('name')->limit(800)->get()->map(fn ($item) => my_rentals_ed_lookup_option($item->id, ($item->name ?: ('مستأجر #' . $item->id))))->values(),
            'contracts' => $contracts->orderByDesc('id')->limit(800)->get()->map(fn ($item) => my_rentals_ed_lookup_option($item->id, 'عقد ' . ($item->contract_number ?: $item->id), ['unit_id' => $item->unit_id, 'tenant_id' => $item->tenant_id]))->values(),
        ];
    }
}

if (!function_exists('my_rentals_ed_save_activity')) {
    function my_rentals_ed_save_activity(?\App\Models\User $user, string $action, string $resource, int $recordId, array $before = [], array $after = []): void
    {
        if (!class_exists(\App\Models\ActivityLog::class) || !\Illuminate\Support\Facades\Schema::hasTable('activity_logs')) {
            return;
        }

        try {
            \App\Models\ActivityLog::create([
                'user_id' => $user?->id,
                'owner_id' => $user?->owner_id,
                'action' => $action,
                'resource' => $resource,
                'record_id' => $recordId,
                'before_data' => $before ? json_encode($before, JSON_UNESCAPED_UNICODE) : null,
                'after_data' => $after ? json_encode($after, JSON_UNESCAPED_UNICODE) : null,
            ]);
        } catch (\Throwable $e) {
            // Do not break the edit/delete flow because of optional audit logging.
        }
    }
}

if (!function_exists('my_rentals_ed_list_response')) {
    function my_rentals_ed_list_response(string $resource, \Illuminate\Http\Request $request, ?\App\Models\User $user)
    {
        $config = my_rentals_ed_resource_config($resource);

        if (!$config) {
            return response()->json(['message' => 'هذا النوع غير متاح للتعديل.'], 404);
        }

        $model = $config['model'];
        $query = my_rentals_ed_apply_scope($model::query(), $resource, $config, $user);

        $id = $request->query('id');
        if ($id !== null && $id !== '') {
            $query->where('id', (int) $id);
        } else {
            $search = trim((string) $request->query('q', ''));
            if ($search !== '') {
                $searchFields = my_rentals_ed_existing_fields($config, $config['search_fields']);
                $query->where(function ($q) use ($searchFields, $search) {
                    foreach ($searchFields as $field) {
                        $q->orWhere($field, 'like', '%' . $search . '%');
                    }
                });
            }
        }

        $items = $query->orderByDesc('id')->limit($id ? 1 : 150)->get();

        return [
            'resource' => $resource,
            'resource_label' => $config['label'],
            'editable_fields' => my_rentals_ed_existing_fields($config, $config['editable']),
            'items' => $items->map(fn ($item) => my_rentals_ed_item_payload($item, $resource, $config))->values(),
        ];
    }
}

if (!function_exists('my_rentals_ed_update_response')) {
    function my_rentals_ed_update_response(string $resource, int $id, \Illuminate\Http\Request $request, ?\App\Models\User $user)
    {
        $config = my_rentals_ed_resource_config($resource);

        if (!$config) {
            return response()->json(['message' => 'هذا النوع غير متاح للتعديل.'], 404);
        }

        $model = $config['model'];
        $item = my_rentals_ed_apply_scope($model::query(), $resource, $config, $user)->where('id', $id)->first();

        if (!$item) {
            return response()->json(['message' => 'السجل غير موجود أو خارج صلاحياتك.'], 404);
        }

        $payload = $request->input('fields', $request->all());
        unset($payload['_auth_user']);
        $editable = my_rentals_ed_existing_fields($config, $config['editable']);
        $updates = [];

        foreach ($editable as $field) {
            if (array_key_exists($field, $payload)) {
                $updates[$field] = my_rentals_ed_cast_value($config['table'], $field, $payload[$field]);
            }
        }

        if (!$updates) {
            return response()->json(['message' => 'لا توجد حقول قابلة للتحديث.'], 422);
        }

        if (!my_rentals_ed_is_admin($user) && array_key_exists('owner_id', $updates)) {
            $updates['owner_id'] = $user?->owner_id;
        }

        $before = $item->toArray();
        $item->fill($updates);
        $item->save();
        $fresh = $item->fresh();

        my_rentals_ed_save_activity($user, 'update', $resource, $id, $before, $fresh?->toArray() ?? []);

        return [
            'message' => 'تم التحديث بنجاح.',
            'item' => my_rentals_ed_item_payload($fresh, $resource, $config),
        ];
    }
}

if (!function_exists('my_rentals_ed_archive_response')) {
    function my_rentals_ed_archive_response(string $resource, int $id, \Illuminate\Http\Request $request, ?\App\Models\User $user)
    {
        $config = my_rentals_ed_resource_config($resource);

        if (!$config) {
            return response()->json(['message' => 'هذا النوع غير متاح للأرشفة.'], 404);
        }

        $model = $config['model'];
        $item = my_rentals_ed_apply_scope($model::query(), $resource, $config, $user)->where('id', $id)->first();

        if (!$item) {
            return response()->json(['message' => 'السجل غير موجود أو خارج صلاحياتك.'], 404);
        }

        $before = $item->toArray();
        $table = $config['table'];

        if (\Illuminate\Support\Facades\Schema::hasColumn($table, 'is_active')) {
            $item->is_active = false;
        } elseif (\Illuminate\Support\Facades\Schema::hasColumn($table, 'status')) {
            $item->status = 'archived';
        } elseif (\Illuminate\Support\Facades\Schema::hasColumn($table, 'archived_at')) {
            $item->archived_at = now();
        } else {
            return response()->json(['message' => 'لا يوجد حقل أرشفة مناسب لهذا السجل.'], 422);
        }

        $item->save();
        $fresh = $item->fresh();

        my_rentals_ed_save_activity($user, 'archive', $resource, $id, $before, $fresh?->toArray() ?? []);

        return [
            'message' => 'تمت الأرشفة بنجاح.',
            'item' => my_rentals_ed_item_payload($fresh, $resource, $config),
        ];
    }
}

if (!function_exists('my_rentals_ed_delete_response')) {
    function my_rentals_ed_delete_response(string $resource, int $id, \Illuminate\Http\Request $request, ?\App\Models\User $user)
    {
        if (!my_rentals_ed_is_admin($user)) {
            return response()->json(['message' => 'الحذف متاح للمدير فقط.'], 403);
        }

        $config = my_rentals_ed_resource_config($resource);

        if (!$config) {
            return response()->json(['message' => 'هذا النوع غير متاح للحذف.'], 404);
        }

        $model = $config['model'];
        $item = my_rentals_ed_apply_scope($model::query(), $resource, $config, $user)->where('id', $id)->first();

        if (!$item) {
            return response()->json(['message' => 'السجل غير موجود أو خارج صلاحياتك.'], 404);
        }

        $blockers = !empty($config['danger_delete_if_related']) ? my_rentals_ed_relationship_blockers($resource, $item) : [];
        if ($blockers) {
            return response()->json([
                'message' => 'لا يمكن حذف السجل لوجود بيانات مرتبطة.',
                'blockers' => $blockers,
            ], 409);
        }

        $before = $item->toArray();
        $item->delete();

        my_rentals_ed_save_activity($user, 'delete', $resource, $id, $before, []);

        return ['message' => 'تم الحذف بنجاح.'];
    }
}

Route::get('/edit-delete-center/resources', function () {
    $map = my_rentals_ed_model_map();

    return collect($map)
        ->filter(fn ($config) => !empty($config['model']) && class_exists($config['model']) && \Illuminate\Support\Facades\Schema::hasTable($config['table']))
        ->map(fn ($config, $key) => [
            'key' => $key,
            'label' => $config['label'],
            'editable_fields' => my_rentals_ed_existing_fields($config, $config['editable']),
        ])
        ->values();
});

Route::get('/my/edit-delete-center/resources', function (\Illuminate\Http\Request $request) {
    $user = my_rentals_ed_current_user($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $map = my_rentals_ed_model_map();

    return collect($map)
        ->filter(fn ($config) => !empty($config['model']) && class_exists($config['model']) && \Illuminate\Support\Facades\Schema::hasTable($config['table']))
        ->map(fn ($config, $key) => [
            'key' => $key,
            'label' => $config['label'],
            'editable_fields' => my_rentals_ed_existing_fields($config, $config['editable']),
        ])
        ->values();
});

Route::get('/edit-delete-center/lookups', function () {
    return my_rentals_ed_lookup_payload(null);
});

Route::get('/my/edit-delete-center/lookups', function (\Illuminate\Http\Request $request) {
    $user = my_rentals_ed_current_user($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    return my_rentals_ed_lookup_payload($user);
});

Route::get('/edit-delete-center/{resource}', function (string $resource, \Illuminate\Http\Request $request) {
    return my_rentals_ed_list_response($resource, $request, null);
});

Route::get('/my/edit-delete-center/{resource}', function (string $resource, \Illuminate\Http\Request $request) {
    $user = my_rentals_ed_current_user($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    return my_rentals_ed_list_response($resource, $request, $user);
});

Route::post('/edit-delete-center/{resource}/{id}/update', function (string $resource, int $id, \Illuminate\Http\Request $request) {
    return my_rentals_ed_update_response($resource, $id, $request, my_rentals_ed_current_user($request));
});

Route::post('/my/edit-delete-center/{resource}/{id}/update', function (string $resource, int $id, \Illuminate\Http\Request $request) {
    $user = my_rentals_ed_current_user($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    return my_rentals_ed_update_response($resource, $id, $request, $user);
});

Route::post('/edit-delete-center/{resource}/{id}/archive', function (string $resource, int $id, \Illuminate\Http\Request $request) {
    return my_rentals_ed_archive_response($resource, $id, $request, my_rentals_ed_current_user($request));
});

Route::post('/my/edit-delete-center/{resource}/{id}/archive', function (string $resource, int $id, \Illuminate\Http\Request $request) {
    $user = my_rentals_ed_current_user($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    return my_rentals_ed_archive_response($resource, $id, $request, $user);
});

Route::post('/edit-delete-center/{resource}/{id}/delete', function (string $resource, int $id, \Illuminate\Http\Request $request) {
    return my_rentals_ed_delete_response($resource, $id, $request, my_rentals_ed_current_user($request));
});

Route::post('/my/edit-delete-center/{resource}/{id}/delete', function (string $resource, int $id, \Illuminate\Http\Request $request) {
    $user = my_rentals_ed_current_user($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    return my_rentals_ed_delete_response($resource, $id, $request, $user);
});
