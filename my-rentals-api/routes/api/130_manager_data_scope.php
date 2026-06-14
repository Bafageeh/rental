<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

if (!function_exists('mr_manager_scope_ensure_schema')) {
    function mr_manager_scope_ensure_schema(): void
    {
        foreach ([
            'owners', 'properties', 'units', 'tenants', 'contracts', 'payments',
            'property_expenses', 'parking_spots', 'contract_files', 'property_files', 'unit_media',
            'owner_transfers', 'owner_settlements', 'owner_bank_accounts', 'chat_threads', 'chat_messages',
            'service_providers', 'maintenance_requests',
        ] as $tableName) {
            if (Schema::hasTable($tableName) && !Schema::hasColumn($tableName, 'manager_id')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->unsignedBigInteger('manager_id')->nullable()->index();
                });
            }
        }

        if (Schema::hasTable('users') && !Schema::hasColumn('users', 'manager_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->unsignedBigInteger('manager_id')->nullable()->index();
            });
        }
    }
}

if (!function_exists('mr_manager_scope_role')) {
    function mr_manager_scope_role($user): string
    {
        if (!$user) return '';
        $role = method_exists($user, 'effectiveRole') ? $user->effectiveRole() : ($user->role ?? '');
        return strtolower(trim((string) $role));
    }
}

if (!function_exists('mr_manager_scope_id')) {
    function mr_manager_scope_id(?Request $request = null): ?int
    {
        $user = $request?->user() ?: request()?->user();
        if (!$user || mr_manager_scope_role($user) !== 'manager') return null;
        $id = (int) ($user->id ?? 0);
        return $id > 0 ? $id : null;
    }
}

if (!function_exists('mr_manager_scope_is_manager')) {
    function mr_manager_scope_is_manager(?Request $request = null): bool
    {
        return mr_manager_scope_id($request) !== null;
    }
}

if (!function_exists('mr_manager_scope_apply')) {
    function mr_manager_scope_apply($query, string $tableName, ?Request $request = null)
    {
        mr_manager_scope_ensure_schema();
        $managerId = mr_manager_scope_id($request);
        if ($managerId && Schema::hasTable($tableName) && Schema::hasColumn($tableName, 'manager_id')) {
            $query->where($tableName . '.manager_id', $managerId);
        }
        return $query;
    }
}

if (!function_exists('mr_manager_scope_set_record')) {
    function mr_manager_scope_set_record(string $tableName, $id, ?Request $request = null): void
    {
        mr_manager_scope_ensure_schema();
        $managerId = mr_manager_scope_id($request);
        $id = (int) $id;
        if ($managerId && $id > 0 && Schema::hasTable($tableName) && Schema::hasColumn($tableName, 'manager_id')) {
            DB::table($tableName)->where('id', $id)->update(['manager_id' => $managerId, 'updated_at' => now()]);
        }
    }
}

if (!function_exists('mr_manager_scope_payload')) {
    function mr_manager_scope_payload(array $payload, string $tableName, ?Request $request = null): array
    {
        mr_manager_scope_ensure_schema();
        $managerId = mr_manager_scope_id($request);
        if ($managerId && Schema::hasTable($tableName) && Schema::hasColumn($tableName, 'manager_id')) {
            $payload['manager_id'] = $managerId;
        }
        return $payload;
    }
}

if (!function_exists('mr_manager_scope_record_exists')) {
    function mr_manager_scope_record_exists(string $tableName, $id, ?Request $request = null): bool
    {
        mr_manager_scope_ensure_schema();
        $id = (int) $id;
        if ($id <= 0 || !Schema::hasTable($tableName)) return false;
        $query = DB::table($tableName)->where('id', $id);
        mr_manager_scope_apply($query, $tableName, $request);
        return $query->exists();
    }
}

if (!function_exists('mr_manager_scope_forbidden_response')) {
    function mr_manager_scope_forbidden_response()
    {
        return response()->json([
            'status' => 'error',
            'message' => 'هذا السجل لا يتبع مدير العقارات المسجل دخوله.',
        ], 403);
    }
}

if (!function_exists('mr_manager_scope_abort_unless_record')) {
    function mr_manager_scope_abort_unless_record(string $tableName, $id, ?Request $request = null): void
    {
        if (mr_manager_scope_is_manager($request) && !mr_manager_scope_record_exists($tableName, $id, $request)) {
            abort(mr_manager_scope_forbidden_response());
        }
    }
}

if (!function_exists('mr_manager_scope_owner_ids')) {
    function mr_manager_scope_owner_ids(?Request $request = null): array
    {
        if (!Schema::hasTable('owners')) return [];
        $query = DB::table('owners')->select('id');
        mr_manager_scope_apply($query, 'owners', $request);
        return $query->pluck('id')->map(fn ($id) => (int) $id)->all();
    }
}

if (!function_exists('mr_manager_scope_property_ids')) {
    function mr_manager_scope_property_ids(?Request $request = null): array
    {
        if (!Schema::hasTable('properties')) return [];
        $query = DB::table('properties')->select('id');
        mr_manager_scope_apply($query, 'properties', $request);
        return $query->pluck('id')->map(fn ($id) => (int) $id)->all();
    }
}

if (!function_exists('mr_manager_scope_unit_ids')) {
    function mr_manager_scope_unit_ids(?Request $request = null): array
    {
        if (!Schema::hasTable('units')) return [];
        $query = DB::table('units')->select('id');
        mr_manager_scope_apply($query, 'units', $request);
        return $query->pluck('id')->map(fn ($id) => (int) $id)->all();
    }
}

if (!function_exists('mr_manager_scope_tenant_ids')) {
    function mr_manager_scope_tenant_ids(?Request $request = null): array
    {
        if (!Schema::hasTable('tenants')) return [];
        $query = DB::table('tenants')->select('id');
        mr_manager_scope_apply($query, 'tenants', $request);
        return $query->pluck('id')->map(fn ($id) => (int) $id)->all();
    }
}

mr_manager_scope_ensure_schema();
