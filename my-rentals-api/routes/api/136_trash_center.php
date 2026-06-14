<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (is_file(__DIR__ . '/130_manager_data_scope.php')) require_once __DIR__ . '/130_manager_data_scope.php';

if (!function_exists('mr_trash_center_ensure_schema')) {
    function mr_trash_center_ensure_schema(): void
    {
        if (!Schema::hasTable('deleted_records')) {
            Schema::create('deleted_records', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('manager_id')->nullable()->index();
                $table->unsignedBigInteger('owner_id')->nullable()->index();
                $table->unsignedBigInteger('user_id')->nullable()->index();
                $table->string('deleted_by_name')->nullable();
                $table->string('resource')->nullable()->index();
                $table->string('resource_label')->nullable();
                $table->string('table_name')->index();
                $table->unsignedBigInteger('record_id')->nullable()->index();
                $table->string('record_title')->nullable();
                $table->json('payload')->nullable();
                $table->json('metadata')->nullable();
                $table->string('status')->default('deleted')->index();
                $table->timestamp('deleted_at')->nullable()->index();
                $table->timestamp('restored_at')->nullable();
                $table->text('restore_error')->nullable();
                $table->timestamps();
            });
            return;
        }

        Schema::table('deleted_records', function (Blueprint $table) {
            if (!Schema::hasColumn('deleted_records', 'manager_id')) $table->unsignedBigInteger('manager_id')->nullable()->index();
            if (!Schema::hasColumn('deleted_records', 'owner_id')) $table->unsignedBigInteger('owner_id')->nullable()->index();
            if (!Schema::hasColumn('deleted_records', 'user_id')) $table->unsignedBigInteger('user_id')->nullable()->index();
            if (!Schema::hasColumn('deleted_records', 'deleted_by_name')) $table->string('deleted_by_name')->nullable();
            if (!Schema::hasColumn('deleted_records', 'resource')) $table->string('resource')->nullable()->index();
            if (!Schema::hasColumn('deleted_records', 'resource_label')) $table->string('resource_label')->nullable();
            if (!Schema::hasColumn('deleted_records', 'table_name')) $table->string('table_name')->nullable()->index();
            if (!Schema::hasColumn('deleted_records', 'record_id')) $table->unsignedBigInteger('record_id')->nullable()->index();
            if (!Schema::hasColumn('deleted_records', 'record_title')) $table->string('record_title')->nullable();
            if (!Schema::hasColumn('deleted_records', 'payload')) $table->json('payload')->nullable();
            if (!Schema::hasColumn('deleted_records', 'metadata')) $table->json('metadata')->nullable();
            if (!Schema::hasColumn('deleted_records', 'status')) $table->string('status')->default('deleted')->index();
            if (!Schema::hasColumn('deleted_records', 'deleted_at')) $table->timestamp('deleted_at')->nullable()->index();
            if (!Schema::hasColumn('deleted_records', 'restored_at')) $table->timestamp('restored_at')->nullable();
            if (!Schema::hasColumn('deleted_records', 'restore_error')) $table->text('restore_error')->nullable();
            if (!Schema::hasColumn('deleted_records', 'created_at')) $table->timestamp('created_at')->nullable();
            if (!Schema::hasColumn('deleted_records', 'updated_at')) $table->timestamp('updated_at')->nullable();
        });
    }
}

if (!function_exists('mr_trash_center_role')) {
    function mr_trash_center_role($user): string
    {
        if (!$user) return '';
        return function_exists('mr_manager_scope_role') ? mr_manager_scope_role($user) : strtolower(trim((string) ($user->role ?? '')));
    }
}

if (!function_exists('mr_trash_center_is_admin')) {
    function mr_trash_center_is_admin($user): bool
    {
        $role = mr_trash_center_role($user);
        return in_array($role, ['admin', 'super_admin'], true) || (bool) ($user->is_admin ?? false);
    }
}

if (!function_exists('mr_trash_center_user_manager_id')) {
    function mr_trash_center_user_manager_id($user): ?int
    {
        if (!$user) return null;
        if (mr_trash_center_role($user) === 'manager') {
            $id = (int) ($user->id ?? 0);
            return $id > 0 ? $id : null;
        }
        if (Schema::hasTable('users') && Schema::hasColumn('users', 'manager_id') && !empty($user->manager_id)) {
            return (int) $user->manager_id;
        }
        if (!empty($user->owner_id) && Schema::hasTable('owners') && Schema::hasColumn('owners', 'manager_id')) {
            $managerId = DB::table('owners')->where('id', (int) $user->owner_id)->value('manager_id');
            return $managerId ? (int) $managerId : null;
        }
        return null;
    }
}

if (!function_exists('mr_trash_center_owner_ids')) {
    function mr_trash_center_owner_ids(?Request $request): array
    {
        $user = $request?->user();
        $role = mr_trash_center_role($user);
        if ($role === 'owner' && !empty($user->owner_id)) return [(int) $user->owner_id];
        if ($role === 'manager' && function_exists('mr_manager_scope_owner_ids')) return mr_manager_scope_owner_ids($request);
        if (!empty($user?->owner_id)) return [(int) $user->owner_id];
        return [];
    }
}

if (!function_exists('mr_trash_center_json')) {
    function mr_trash_center_json($value): ?array
    {
        if (is_array($value)) return $value;
        if (is_object($value)) return (array) $value;
        if (!$value) return null;
        $decoded = json_decode((string) $value, true);
        return is_array($decoded) ? $decoded : null;
    }
}

if (!function_exists('mr_trash_center_resource_map')) {
    function mr_trash_center_resource_map(): array
    {
        return [
            'owners' => ['resource' => 'owners', 'label' => 'الملاك', 'model' => \App\Models\Owner::class, 'title' => ['name', 'phone']],
            'properties' => ['resource' => 'properties', 'label' => 'العقارات', 'model' => \App\Models\Property::class, 'title' => ['name', 'title', 'city']],
            'units' => ['resource' => 'units', 'label' => 'الوحدات', 'model' => \App\Models\Unit::class, 'title' => ['unit_number', 'type', 'status']],
            'tenants' => ['resource' => 'tenants', 'label' => 'المستأجرون', 'model' => \App\Models\Tenant::class, 'title' => ['name', 'phone']],
            'contracts' => ['resource' => 'contracts', 'label' => 'العقود', 'model' => \App\Models\Contract::class, 'title' => ['contract_number', 'government_contract_number', 'status']],
            'payments' => ['resource' => 'payments', 'label' => 'الدفعات', 'model' => \App\Models\Payment::class, 'title' => ['amount', 'due_date', 'status']],
            'property_expenses' => ['resource' => 'property_expenses', 'label' => 'المصاريف', 'model' => class_exists(\App\Models\PropertyExpense::class) ? \App\Models\PropertyExpense::class : null, 'title' => ['title', 'amount', 'expense_date']],
            'owner_bank_accounts' => ['resource' => 'owner_bank_accounts', 'label' => 'الحسابات البنكية', 'model' => null, 'title' => ['bank_name', 'account_name', 'iban']],
            'service_providers' => ['resource' => 'service_providers', 'label' => 'مقدمو الخدمة', 'model' => class_exists(\App\Models\ServiceProvider::class) ? \App\Models\ServiceProvider::class : null, 'title' => ['name', 'provider_type', 'phone']],
        ];
    }
}

if (!function_exists('mr_trash_center_config_for_model')) {
    function mr_trash_center_config_for_model($model): ?array
    {
        if (!$model || !method_exists($model, 'getTable')) return null;
        return mr_trash_center_resource_map()[$model->getTable()] ?? null;
    }
}

if (!function_exists('mr_trash_center_title')) {
    function mr_trash_center_title(array $payload, array $config): string
    {
        $parts = [];
        foreach (($config['title'] ?? []) as $field) {
            $value = $payload[$field] ?? null;
            if ($value !== null && $value !== '') $parts[] = (string) $value;
        }
        return $parts ? implode(' - ', array_slice($parts, 0, 3)) : (($config['label'] ?? 'سجل') . ' #' . ($payload['id'] ?? ''));
    }
}

if (!function_exists('mr_trash_center_infer_owner_id')) {
    function mr_trash_center_infer_owner_id(array $payload, string $tableName): ?int
    {
        if (!empty($payload['owner_id'])) return (int) $payload['owner_id'];
        if ($tableName === 'owners' && !empty($payload['id'])) return (int) $payload['id'];
        if (!empty($payload['property_id']) && Schema::hasTable('properties')) {
            $ownerId = DB::table('properties')->where('id', (int) $payload['property_id'])->value('owner_id');
            if ($ownerId) return (int) $ownerId;
        }
        if (!empty($payload['unit_id']) && Schema::hasTable('units') && Schema::hasTable('properties')) {
            $propertyId = DB::table('units')->where('id', (int) $payload['unit_id'])->value('property_id');
            if ($propertyId) {
                $ownerId = DB::table('properties')->where('id', (int) $propertyId)->value('owner_id');
                if ($ownerId) return (int) $ownerId;
            }
        }
        if ($tableName === 'units' && !empty($payload['property_id']) && Schema::hasTable('properties')) {
            $ownerId = DB::table('properties')->where('id', (int) $payload['property_id'])->value('owner_id');
            if ($ownerId) return (int) $ownerId;
        }
        if ($tableName === 'contracts' && !empty($payload['unit_id']) && Schema::hasTable('units') && Schema::hasTable('properties')) {
            $propertyId = DB::table('units')->where('id', (int) $payload['unit_id'])->value('property_id');
            if ($propertyId) {
                $ownerId = DB::table('properties')->where('id', (int) $propertyId)->value('owner_id');
                if ($ownerId) return (int) $ownerId;
            }
        }
        if ($tableName === 'payments' && !empty($payload['contract_id']) && Schema::hasTable('contracts') && Schema::hasTable('units') && Schema::hasTable('properties')) {
            $unitId = DB::table('contracts')->where('id', (int) $payload['contract_id'])->value('unit_id');
            if ($unitId) {
                $propertyId = DB::table('units')->where('id', (int) $unitId)->value('property_id');
                if ($propertyId) {
                    $ownerId = DB::table('properties')->where('id', (int) $propertyId)->value('owner_id');
                    if ($ownerId) return (int) $ownerId;
                }
            }
        }
        if ($tableName === 'tenants' && !empty($payload['id']) && Schema::hasTable('contracts') && Schema::hasTable('units') && Schema::hasTable('properties')) {
            $unitId = DB::table('contracts')->where('tenant_id', (int) $payload['id'])->orderByDesc('id')->value('unit_id');
            if ($unitId) {
                $propertyId = DB::table('units')->where('id', (int) $unitId)->value('property_id');
                if ($propertyId) {
                    $ownerId = DB::table('properties')->where('id', (int) $propertyId)->value('owner_id');
                    if ($ownerId) return (int) $ownerId;
                }
            }
        }
        return null;
    }
}

if (!function_exists('mr_trash_center_manager_id_from_owner')) {
    function mr_trash_center_manager_id_from_owner(?int $ownerId, $user): ?int
    {
        if (mr_trash_center_role($user) === 'manager') return (int) $user->id;
        if ($ownerId && Schema::hasTable('owners') && Schema::hasColumn('owners', 'manager_id')) {
            $managerId = DB::table('owners')->where('id', $ownerId)->value('manager_id');
            if ($managerId) return (int) $managerId;
        }
        return mr_trash_center_user_manager_id($user);
    }
}

if (!function_exists('mr_trash_center_store_deleted_model')) {
    function mr_trash_center_store_deleted_model($model): void
    {
        try {
            mr_trash_center_ensure_schema();
            $config = mr_trash_center_config_for_model($model);
            if (!$config) return;
            $user = request()?->user();
            $payload = method_exists($model, 'getAttributes') ? $model->getAttributes() : (array) $model;
            $tableName = method_exists($model, 'getTable') ? $model->getTable() : ($config['resource'] ?? '');
            $recordId = (int) ($payload['id'] ?? 0);
            $ownerId = mr_trash_center_infer_owner_id($payload, $tableName);
            $managerId = mr_trash_center_manager_id_from_owner($ownerId, $user);
            $exists = DB::table('deleted_records')
                ->where('table_name', $tableName)
                ->where('record_id', $recordId)
                ->where('status', 'deleted')
                ->exists();
            if ($exists) return;

            DB::table('deleted_records')->insert([
                'manager_id' => $managerId,
                'owner_id' => $ownerId,
                'user_id' => $user->id ?? null,
                'deleted_by_name' => $user->name ?? null,
                'resource' => $config['resource'] ?? $tableName,
                'resource_label' => $config['label'] ?? $tableName,
                'table_name' => $tableName,
                'record_id' => $recordId ?: null,
                'record_title' => mr_trash_center_title($payload, $config),
                'payload' => json_encode($payload, JSON_UNESCAPED_UNICODE),
                'metadata' => json_encode(['source' => 'model_deleting'], JSON_UNESCAPED_UNICODE),
                'status' => 'deleted',
                'deleted_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (Throwable $e) {
            report($e);
        }
    }
}

if (!function_exists('mr_trash_center_register_observers')) {
    function mr_trash_center_register_observers(): void
    {
        static $registered = false;
        if ($registered) return;
        $registered = true;
        foreach (mr_trash_center_resource_map() as $config) {
            $model = $config['model'] ?? null;
            if ($model && class_exists($model) && method_exists($model, 'deleting')) {
                $model::deleting(fn ($record) => mr_trash_center_store_deleted_model($record));
            }
        }
    }
}

if (!function_exists('mr_trash_center_apply_scope')) {
    function mr_trash_center_apply_scope($query, Request $request)
    {
        $user = $request->user();
        $role = mr_trash_center_role($user);
        if (mr_trash_center_is_admin($user)) return $query;
        if ($role === 'manager') {
            $managerId = mr_trash_center_user_manager_id($user);
            $ownerIds = mr_trash_center_owner_ids($request);
            return $query->where(function ($q) use ($managerId, $ownerIds, $user) {
                if ($managerId) $q->orWhere('manager_id', $managerId);
                if (!empty($ownerIds)) $q->orWhereIn('owner_id', $ownerIds);
                if (!empty($user?->id)) $q->orWhere('user_id', (int) $user->id);
            });
        }
        if ($role === 'owner' && !empty($user->owner_id)) {
            return $query->where(function ($q) use ($user) {
                $q->where('owner_id', (int) $user->owner_id)->orWhere('user_id', (int) $user->id);
            });
        }
        return $query->where('user_id', (int) ($user->id ?? 0));
    }
}

if (!function_exists('mr_trash_center_payload')) {
    function mr_trash_center_payload($row): array
    {
        return [
            'id' => (int) $row->id,
            'resource' => $row->resource ?? null,
            'resource_label' => $row->resource_label ?? null,
            'table_name' => $row->table_name ?? null,
            'record_id' => $row->record_id ? (int) $row->record_id : null,
            'record_title' => $row->record_title ?? null,
            'owner_id' => $row->owner_id ? (int) $row->owner_id : null,
            'deleted_by_name' => $row->deleted_by_name ?? null,
            'payload' => mr_trash_center_json($row->payload ?? null),
            'metadata' => mr_trash_center_json($row->metadata ?? null),
            'status' => $row->status ?? null,
            'deleted_at' => $row->deleted_at ?? null,
            'restored_at' => $row->restored_at ?? null,
            'restore_error' => $row->restore_error ?? null,
        ];
    }
}

if (!function_exists('mr_trash_center_query')) {
    function mr_trash_center_query(Request $request)
    {
        mr_trash_center_ensure_schema();
        $query = DB::table('deleted_records')->where('status', '!=', 'purged')->orderByDesc('id');
        return mr_trash_center_apply_scope($query, $request);
    }
}

$trashIndex = function (Request $request) {
    return response()->json(
        mr_trash_center_query($request)
            ->limit(150)
            ->get()
            ->map(fn ($row) => mr_trash_center_payload($row))
            ->values()
    );
};

Route::get('/trash-center/deleted-records', $trashIndex);
Route::get('/my/trash-center/deleted-records', $trashIndex);

$trashRestore = function (Request $request, int $id) {
    $record = mr_trash_center_query($request)->where('id', $id)->first();
    if (!$record) return response()->json(['message' => 'السجل غير موجود أو خارج صلاحيتك.'], 404);
    if (($record->status ?? '') === 'restored') return response()->json(['status' => 'ok', 'message' => 'السجل مستعاد مسبقًا.']);

    $payload = mr_trash_center_json($record->payload ?? null) ?: [];
    $table = (string) ($record->table_name ?? '');
    if (!$table || !Schema::hasTable($table) || empty($payload)) {
        return response()->json(['message' => 'لا توجد بيانات كافية للاستعادة.'], 422);
    }

    try {
        $columns = Schema::getColumnListing($table);
        $data = array_intersect_key($payload, array_flip($columns));
        if (!$data) throw new RuntimeException('لا توجد حقول قابلة للاستعادة.');

        $restoreId = (int) ($data['id'] ?? ($record->record_id ?? 0));
        if ($restoreId > 0 && in_array('id', $columns, true)) {
            if (DB::table($table)->where('id', $restoreId)->exists()) {
                throw new RuntimeException('رقم السجل الأصلي مستخدم حاليًا، لا يمكن الاستعادة التلقائية.');
            }
            $data['id'] = $restoreId;
        } else {
            unset($data['id']);
        }

        if (in_array('created_at', $columns, true) && empty($data['created_at'])) $data['created_at'] = now();
        if (in_array('updated_at', $columns, true)) $data['updated_at'] = now();

        DB::table($table)->insert($data);
        DB::table('deleted_records')->where('id', $record->id)->update([
            'status' => 'restored',
            'restored_at' => now(),
            'restore_error' => null,
            'updated_at' => now(),
        ]);

        return response()->json(['status' => 'ok', 'message' => 'تمت استعادة السجل.']);
    } catch (Throwable $e) {
        DB::table('deleted_records')->where('id', $record->id)->update([
            'restore_error' => $e->getMessage(),
            'updated_at' => now(),
        ]);
        return response()->json(['message' => 'تعذرت الاستعادة: ' . $e->getMessage()], 422);
    }
};

Route::post('/trash-center/deleted-records/{id}/restore', $trashRestore);
Route::post('/my/trash-center/deleted-records/{id}/restore', $trashRestore);

$trashPurge = function (Request $request, int $id) {
    $record = mr_trash_center_query($request)->where('id', $id)->first();
    if (!$record) return response()->json(['message' => 'السجل غير موجود أو خارج صلاحيتك.'], 404);
    DB::table('deleted_records')->where('id', $record->id)->update(['status' => 'purged', 'updated_at' => now()]);
    return response()->json(['status' => 'ok', 'message' => 'تم حذف نسخة السلة نهائيًا.']);
};

Route::post('/trash-center/deleted-records/{id}/purge', $trashPurge);
Route::post('/my/trash-center/deleted-records/{id}/purge', $trashPurge);

mr_trash_center_ensure_schema();
mr_trash_center_register_observers();
