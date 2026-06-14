<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (is_file(__DIR__ . '/130_manager_data_scope.php')) require_once __DIR__ . '/130_manager_data_scope.php';

if (!function_exists('mr_activity_logs_ensure_schema')) {
    function mr_activity_logs_ensure_schema(): void
    {
        if (!Schema::hasTable('activity_logs')) {
            Schema::create('activity_logs', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('manager_id')->nullable()->index();
                $table->unsignedBigInteger('owner_id')->nullable()->index();
                $table->unsignedBigInteger('user_id')->nullable()->index();
                $table->string('user_name')->nullable();
                $table->string('user_email')->nullable();
                $table->string('action')->index();
                $table->string('resource')->nullable()->index();
                $table->string('resource_label')->nullable();
                $table->unsignedBigInteger('record_id')->nullable()->index();
                $table->string('record_title')->nullable();
                $table->json('old_payload')->nullable();
                $table->json('new_payload')->nullable();
                $table->json('metadata')->nullable();
                $table->string('ip_address')->nullable();
                $table->timestamps();
            });
            return;
        }

        Schema::table('activity_logs', function (Blueprint $table) {
            if (!Schema::hasColumn('activity_logs', 'manager_id')) $table->unsignedBigInteger('manager_id')->nullable()->index();
            if (!Schema::hasColumn('activity_logs', 'owner_id')) $table->unsignedBigInteger('owner_id')->nullable()->index();
            if (!Schema::hasColumn('activity_logs', 'user_id')) $table->unsignedBigInteger('user_id')->nullable()->index();
            if (!Schema::hasColumn('activity_logs', 'user_name')) $table->string('user_name')->nullable();
            if (!Schema::hasColumn('activity_logs', 'user_email')) $table->string('user_email')->nullable();
            if (!Schema::hasColumn('activity_logs', 'action')) $table->string('action')->nullable()->index();
            if (!Schema::hasColumn('activity_logs', 'resource')) $table->string('resource')->nullable()->index();
            if (!Schema::hasColumn('activity_logs', 'resource_label')) $table->string('resource_label')->nullable();
            if (!Schema::hasColumn('activity_logs', 'record_id')) $table->unsignedBigInteger('record_id')->nullable()->index();
            if (!Schema::hasColumn('activity_logs', 'record_title')) $table->string('record_title')->nullable();
            if (!Schema::hasColumn('activity_logs', 'old_payload')) $table->json('old_payload')->nullable();
            if (!Schema::hasColumn('activity_logs', 'new_payload')) $table->json('new_payload')->nullable();
            if (!Schema::hasColumn('activity_logs', 'metadata')) $table->json('metadata')->nullable();
            if (!Schema::hasColumn('activity_logs', 'ip_address')) $table->string('ip_address')->nullable();
            if (!Schema::hasColumn('activity_logs', 'created_at')) $table->timestamp('created_at')->nullable();
            if (!Schema::hasColumn('activity_logs', 'updated_at')) $table->timestamp('updated_at')->nullable();
        });
    }
}

if (!function_exists('mr_activity_logs_json')) {
    function mr_activity_logs_json($value): ?array
    {
        if (is_array($value)) return $value;
        if (is_object($value)) return (array) $value;
        if (!$value) return null;
        $decoded = json_decode((string) $value, true);
        return is_array($decoded) ? $decoded : null;
    }
}

if (!function_exists('mr_activity_logs_role')) {
    function mr_activity_logs_role($user): string
    {
        if (!$user) return '';
        return function_exists('mr_manager_scope_role')
            ? mr_manager_scope_role($user)
            : strtolower(trim((string) ($user->role ?? '')));
    }
}

if (!function_exists('mr_activity_logs_is_admin')) {
    function mr_activity_logs_is_admin($user): bool
    {
        $role = mr_activity_logs_role($user);
        return in_array($role, ['admin', 'super_admin'], true) || (bool) ($user->is_admin ?? false);
    }
}

if (!function_exists('mr_activity_logs_user_manager_id')) {
    function mr_activity_logs_user_manager_id($user): ?int
    {
        if (!$user) return null;
        $role = mr_activity_logs_role($user);
        if ($role === 'manager') {
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

if (!function_exists('mr_activity_logs_scoped_user_ids')) {
    function mr_activity_logs_scoped_user_ids($user): array
    {
        $ids = [];
        if (!empty($user?->id)) $ids[] = (int) $user->id;

        $managerId = mr_activity_logs_user_manager_id($user);
        $role = mr_activity_logs_role($user);
        if ($role === 'manager' && $managerId && Schema::hasTable('users') && Schema::hasColumn('users', 'manager_id')) {
            $children = DB::table('users')->where('manager_id', $managerId)->pluck('id')->map(fn ($id) => (int) $id)->all();
            $ids = array_merge($ids, $children);
        }

        return array_values(array_unique(array_filter($ids)));
    }
}

if (!function_exists('mr_activity_logs_scoped_owner_ids')) {
    function mr_activity_logs_scoped_owner_ids(?Request $request): array
    {
        $user = $request?->user();
        $role = mr_activity_logs_role($user);

        if ($role === 'owner' && !empty($user->owner_id)) {
            return [(int) $user->owner_id];
        }

        if ($role === 'manager' && function_exists('mr_manager_scope_owner_ids')) {
            return mr_manager_scope_owner_ids($request);
        }

        if (!empty($user?->owner_id)) {
            return [(int) $user->owner_id];
        }

        return [];
    }
}

if (!function_exists('mr_activity_logs_payload')) {
    function mr_activity_logs_payload($row): array
    {
        return [
            'id' => (int) $row->id,
            'action' => $row->action ?? null,
            'resource' => $row->resource ?? null,
            'resource_label' => $row->resource_label ?? null,
            'record_id' => $row->record_id ? (int) $row->record_id : null,
            'record_title' => $row->record_title ?? null,
            'owner_id' => $row->owner_id ? (int) $row->owner_id : null,
            'manager_id' => $row->manager_id ? (int) $row->manager_id : null,
            'user_id' => $row->user_id ? (int) $row->user_id : null,
            'user_name' => $row->user_name ?? null,
            'user_email' => $row->user_email ?? null,
            'old_payload' => mr_activity_logs_json($row->old_payload ?? null),
            'new_payload' => mr_activity_logs_json($row->new_payload ?? null),
            'metadata' => mr_activity_logs_json($row->metadata ?? null),
            'ip_address' => $row->ip_address ?? null,
            'created_at' => $row->created_at ?? null,
        ];
    }
}

if (!function_exists('mr_activity_logs_resource_table')) {
    function mr_activity_logs_resource_table(?string $resource): ?string
    {
        $map = [
            'owners' => 'owners',
            'properties' => 'properties',
            'units' => 'units',
            'tenants' => 'tenants',
            'contracts' => 'contracts',
            'payments' => 'payments',
            'property_expenses' => 'property_expenses',
            'service_providers' => 'service_providers',
            'owner_bank_accounts' => 'owner_bank_accounts',
        ];
        return $map[$resource ?? ''] ?? null;
    }
}

if (!function_exists('mr_activity_logs_query')) {
    function mr_activity_logs_query(Request $request)
    {
        mr_activity_logs_ensure_schema();
        $query = DB::table('activity_logs')->orderByDesc('id');
        $user = $request->user();
        $role = mr_activity_logs_role($user);

        // الإدارة فقط ترى كل السجلات بلا استثناء.
        if (!mr_activity_logs_is_admin($user)) {
            if ($role === 'manager') {
                $managerId = mr_activity_logs_user_manager_id($user);
                $userIds = mr_activity_logs_scoped_user_ids($user);
                $ownerIds = mr_activity_logs_scoped_owner_ids($request);

                $query->where(function ($q) use ($managerId, $userIds, $ownerIds) {
                    if ($managerId) $q->orWhere('manager_id', $managerId);
                    if (!empty($userIds)) $q->orWhereIn('user_id', $userIds);
                    if (!empty($ownerIds)) $q->orWhereIn('owner_id', $ownerIds);
                });
            } elseif ($role === 'owner' && !empty($user->owner_id)) {
                $query->where(function ($q) use ($user) {
                    $q->where('owner_id', (int) $user->owner_id)
                      ->orWhere('user_id', (int) $user->id);
                });
            } else {
                $query->where('user_id', (int) ($user->id ?? 0));
            }
        }

        $action = trim((string) $request->query('action', ''));
        if ($action !== '' && $action !== 'all') {
            $query->where('action', $action);
        }

        return $query;
    }
}

if (!function_exists('mr_activity_logs_store')) {
    function mr_activity_logs_store(Request $request, array $payload): void
    {
        mr_activity_logs_ensure_schema();
        $user = $request->user();
        $role = mr_activity_logs_role($user);
        $managerId = $payload['manager_id'] ?? null;

        if (!$managerId && !mr_activity_logs_is_admin($user)) {
            $managerId = mr_activity_logs_user_manager_id($user);
        }

        if (!$managerId && !empty($payload['owner_id']) && Schema::hasTable('owners') && Schema::hasColumn('owners', 'manager_id')) {
            $managerId = DB::table('owners')->where('id', (int) $payload['owner_id'])->value('manager_id') ?: null;
        }

        DB::table('activity_logs')->insert([
            'manager_id' => $managerId ? (int) $managerId : null,
            'owner_id' => $payload['owner_id'] ?? ($user->owner_id ?? null),
            'user_id' => $user->id ?? null,
            'user_name' => $user->name ?? null,
            'user_email' => $user->email ?? null,
            'action' => $payload['action'] ?? 'update',
            'resource' => $payload['resource'] ?? null,
            'resource_label' => $payload['resource_label'] ?? null,
            'record_id' => $payload['record_id'] ?? null,
            'record_title' => $payload['record_title'] ?? null,
            'old_payload' => isset($payload['old_payload']) ? json_encode($payload['old_payload'], JSON_UNESCAPED_UNICODE) : null,
            'new_payload' => isset($payload['new_payload']) ? json_encode($payload['new_payload'], JSON_UNESCAPED_UNICODE) : null,
            'metadata' => isset($payload['metadata']) ? json_encode($payload['metadata'], JSON_UNESCAPED_UNICODE) : null,
            'ip_address' => $request->ip(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}

$activityIndex = function (Request $request) {
    return response()->json(
        mr_activity_logs_query($request)
            ->limit(150)
            ->get()
            ->map(fn ($row) => mr_activity_logs_payload($row))
            ->values()
    );
};

Route::get('/activity-logs', $activityIndex);
Route::get('/my/activity-logs', $activityIndex);

Route::post('/activity-logs/{id}/rollback', function (Request $request, int $id) {
    $log = mr_activity_logs_query($request)->where('id', $id)->first();
    if (!$log) {
        return response()->json(['message' => 'العملية غير موجودة أو خارج صلاحيتك.'], 404);
    }

    if (!in_array($log->action, ['update', 'archive'], true)) {
        return response()->json(['message' => 'التراجع متاح فقط للتعديل أو الأرشفة.'], 422);
    }

    $tableName = mr_activity_logs_resource_table($log->resource ?? null);
    $oldPayload = mr_activity_logs_json($log->old_payload ?? null) ?: [];

    if (!$tableName || !Schema::hasTable($tableName) || empty($oldPayload) || empty($log->record_id)) {
        return response()->json(['message' => 'لا توجد بيانات كافية للتراجع.'], 422);
    }

    if (function_exists('mr_manager_scope_abort_unless_record')) {
        mr_manager_scope_abort_unless_record($tableName, $log->record_id, $request);
    }

    $columns = Schema::getColumnListing($tableName);
    $updates = array_intersect_key($oldPayload, array_flip($columns));
    unset($updates['id'], $updates['created_at']);
    if (in_array('updated_at', $columns, true)) $updates['updated_at'] = now();

    if (empty($updates)) {
        return response()->json(['message' => 'لا توجد حقول قابلة للاستعادة.'], 422);
    }

    DB::table($tableName)->where('id', $log->record_id)->update($updates);

    mr_activity_logs_store($request, [
        'action' => 'rollback',
        'resource' => $log->resource,
        'resource_label' => $log->resource_label,
        'record_id' => $log->record_id,
        'record_title' => $log->record_title,
        'owner_id' => $log->owner_id,
        'manager_id' => $log->manager_id,
        'old_payload' => mr_activity_logs_json($log->new_payload ?? null),
        'new_payload' => $updates,
        'metadata' => ['source_log_id' => $log->id],
    ]);

    return response()->json(['status' => 'ok', 'message' => 'تم التراجع عن العملية.']);
});
