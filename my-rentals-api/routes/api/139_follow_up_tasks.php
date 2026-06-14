<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (is_file(__DIR__ . '/130_manager_data_scope.php')) require_once __DIR__ . '/130_manager_data_scope.php';

if (!function_exists('mr_followups_ensure_schema')) {
    function mr_followups_ensure_schema(): void
    {
        if (!Schema::hasTable('follow_up_tasks')) {
            Schema::create('follow_up_tasks', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('manager_id')->nullable()->index();
                $table->unsignedBigInteger('owner_id')->nullable()->index();
                $table->unsignedBigInteger('property_id')->nullable()->index();
                $table->unsignedBigInteger('unit_id')->nullable()->index();
                $table->unsignedBigInteger('tenant_id')->nullable()->index();
                $table->unsignedBigInteger('contract_id')->nullable()->index();
                $table->unsignedBigInteger('created_by')->nullable()->index();
                $table->string('title');
                $table->string('task_type')->default('general')->index();
                $table->string('priority')->default('normal')->index();
                $table->string('status')->default('open')->index();
                $table->date('due_date')->nullable()->index();
                $table->string('assigned_to_name')->nullable();
                $table->text('notes')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();
            });
            return;
        }

        Schema::table('follow_up_tasks', function (Blueprint $table) {
            foreach ([
                'manager_id', 'owner_id', 'property_id', 'unit_id', 'tenant_id', 'contract_id', 'created_by'
            ] as $column) {
                if (!Schema::hasColumn('follow_up_tasks', $column)) $table->unsignedBigInteger($column)->nullable()->index();
            }
            if (!Schema::hasColumn('follow_up_tasks', 'title')) $table->string('title')->nullable();
            if (!Schema::hasColumn('follow_up_tasks', 'task_type')) $table->string('task_type')->default('general')->index();
            if (!Schema::hasColumn('follow_up_tasks', 'priority')) $table->string('priority')->default('normal')->index();
            if (!Schema::hasColumn('follow_up_tasks', 'status')) $table->string('status')->default('open')->index();
            if (!Schema::hasColumn('follow_up_tasks', 'due_date')) $table->date('due_date')->nullable()->index();
            if (!Schema::hasColumn('follow_up_tasks', 'assigned_to_name')) $table->string('assigned_to_name')->nullable();
            if (!Schema::hasColumn('follow_up_tasks', 'notes')) $table->text('notes')->nullable();
            if (!Schema::hasColumn('follow_up_tasks', 'completed_at')) $table->timestamp('completed_at')->nullable();
            if (!Schema::hasColumn('follow_up_tasks', 'created_at')) $table->timestamp('created_at')->nullable();
            if (!Schema::hasColumn('follow_up_tasks', 'updated_at')) $table->timestamp('updated_at')->nullable();
        });
    }
}

if (!function_exists('mr_followups_role')) {
    function mr_followups_role($user): string
    {
        return $user ? (function_exists('mr_manager_scope_role') ? mr_manager_scope_role($user) : strtolower(trim((string) ($user->role ?? '')))) : '';
    }
}

if (!function_exists('mr_followups_is_admin')) {
    function mr_followups_is_admin($user): bool
    {
        return in_array(mr_followups_role($user), ['admin', 'super_admin'], true) || (bool) ($user->is_admin ?? false);
    }
}

if (!function_exists('mr_followups_manager_id')) {
    function mr_followups_manager_id(Request $request): ?int
    {
        $user = $request->user();
        if (!$user) return null;
        if (mr_followups_role($user) === 'manager') return (int) $user->id;
        if (!empty($user->manager_id)) return (int) $user->manager_id;
        if (!empty($user->owner_id) && Schema::hasTable('owners') && Schema::hasColumn('owners', 'manager_id')) {
            $managerId = DB::table('owners')->where('id', (int) $user->owner_id)->value('manager_id');
            return $managerId ? (int) $managerId : null;
        }
        return null;
    }
}

if (!function_exists('mr_followups_owner_ids')) {
    function mr_followups_owner_ids(Request $request): array
    {
        $user = $request->user();
        if (mr_followups_is_admin($user)) return Schema::hasTable('owners') ? DB::table('owners')->pluck('id')->map(fn ($id) => (int) $id)->all() : [];
        if (mr_followups_role($user) === 'manager' && function_exists('mr_manager_scope_owner_ids')) return mr_manager_scope_owner_ids($request);
        return !empty($user?->owner_id) ? [(int) $user->owner_id] : [];
    }
}

if (!function_exists('mr_followups_property_ids')) {
    function mr_followups_property_ids(Request $request, array $ownerIds): array
    {
        if (!Schema::hasTable('properties')) return [];
        $user = $request->user();
        if (mr_followups_is_admin($user)) return DB::table('properties')->pluck('id')->map(fn ($id) => (int) $id)->all();
        if (mr_followups_role($user) === 'manager' && function_exists('mr_manager_scope_property_ids')) return mr_manager_scope_property_ids($request);
        if ($ownerIds && Schema::hasColumn('properties', 'owner_id')) return DB::table('properties')->whereIn('owner_id', $ownerIds)->pluck('id')->map(fn ($id) => (int) $id)->all();
        return [];
    }
}

if (!function_exists('mr_followups_unit_ids')) {
    function mr_followups_unit_ids(Request $request, array $propertyIds): array
    {
        if (!Schema::hasTable('units')) return [];
        $user = $request->user();
        if (mr_followups_is_admin($user)) return DB::table('units')->pluck('id')->map(fn ($id) => (int) $id)->all();
        if (mr_followups_role($user) === 'manager' && function_exists('mr_manager_scope_unit_ids')) return mr_manager_scope_unit_ids($request);
        if ($propertyIds && Schema::hasColumn('units', 'property_id')) return DB::table('units')->whereIn('property_id', $propertyIds)->pluck('id')->map(fn ($id) => (int) $id)->all();
        return [];
    }
}

if (!function_exists('mr_followups_contract_ids')) {
    function mr_followups_contract_ids(Request $request, array $unitIds): array
    {
        if (!Schema::hasTable('contracts')) return [];
        $user = $request->user();
        $query = DB::table('contracts');
        if (mr_followups_is_admin($user)) return $query->pluck('id')->map(fn ($id) => (int) $id)->all();
        if (mr_followups_role($user) === 'manager' && Schema::hasColumn('contracts', 'manager_id')) {
            $managerId = mr_followups_manager_id($request);
            if ($managerId) $query->where('manager_id', $managerId);
        } elseif ($unitIds && Schema::hasColumn('contracts', 'unit_id')) {
            $query->whereIn('unit_id', $unitIds);
        } else {
            $query->whereRaw('1 = 0');
        }
        return $query->pluck('id')->map(fn ($id) => (int) $id)->all();
    }
}

if (!function_exists('mr_followups_allowed_ids')) {
    function mr_followups_allowed_ids(Request $request): array
    {
        $ownerIds = mr_followups_owner_ids($request);
        $propertyIds = mr_followups_property_ids($request, $ownerIds);
        $unitIds = mr_followups_unit_ids($request, $propertyIds);
        $contractIds = mr_followups_contract_ids($request, $unitIds);
        return compact('ownerIds', 'propertyIds', 'unitIds', 'contractIds');
    }
}

if (!function_exists('mr_followups_infer_owner_from_property')) {
    function mr_followups_infer_owner_from_property(?int $propertyId): ?int
    {
        if (!$propertyId || !Schema::hasTable('properties') || !Schema::hasColumn('properties', 'owner_id')) return null;
        $ownerId = DB::table('properties')->where('id', $propertyId)->value('owner_id');
        return $ownerId ? (int) $ownerId : null;
    }
}

if (!function_exists('mr_followups_infer_from_unit')) {
    function mr_followups_infer_from_unit(?int $unitId): array
    {
        if (!$unitId || !Schema::hasTable('units')) return [null, null];
        $unit = DB::table('units')->where('id', $unitId)->first();
        $propertyId = $unit && !empty($unit->property_id) ? (int) $unit->property_id : null;
        return [$propertyId, mr_followups_infer_owner_from_property($propertyId)];
    }
}

if (!function_exists('mr_followups_infer_from_contract')) {
    function mr_followups_infer_from_contract(?int $contractId): array
    {
        if (!$contractId || !Schema::hasTable('contracts')) return [null, null, null, null];
        $contract = DB::table('contracts')->where('id', $contractId)->first();
        if (!$contract) return [null, null, null, null];
        $unitId = !empty($contract->unit_id) ? (int) $contract->unit_id : null;
        [$propertyId, $ownerId] = mr_followups_infer_from_unit($unitId);
        $tenantId = !empty($contract->tenant_id) ? (int) $contract->tenant_id : null;
        return [$unitId, $propertyId, $ownerId, $tenantId];
    }
}

if (!function_exists('mr_followups_apply_scope')) {
    function mr_followups_apply_scope($query, Request $request)
    {
        $user = $request->user();
        if (mr_followups_is_admin($user)) return $query;
        $ids = mr_followups_allowed_ids($request);
        $managerId = mr_followups_manager_id($request);
        return $query->where(function ($q) use ($ids, $managerId, $user) {
            if ($managerId) $q->orWhere('follow_up_tasks.manager_id', $managerId);
            if ($ids['ownerIds']) $q->orWhereIn('follow_up_tasks.owner_id', $ids['ownerIds']);
            if ($ids['propertyIds']) $q->orWhereIn('follow_up_tasks.property_id', $ids['propertyIds']);
            if ($ids['unitIds']) $q->orWhereIn('follow_up_tasks.unit_id', $ids['unitIds']);
            if ($ids['contractIds']) $q->orWhereIn('follow_up_tasks.contract_id', $ids['contractIds']);
            if (!empty($user?->id)) $q->orWhere('follow_up_tasks.created_by', (int) $user->id);
        });
    }
}

if (!function_exists('mr_followups_payload')) {
    function mr_followups_payload($row): array
    {
        return [
            'id' => (int) $row->id,
            'property_id' => $row->property_id ? (int) $row->property_id : null,
            'unit_id' => $row->unit_id ? (int) $row->unit_id : null,
            'tenant_id' => $row->tenant_id ? (int) $row->tenant_id : null,
            'contract_id' => $row->contract_id ? (int) $row->contract_id : null,
            'title' => $row->title,
            'task_type' => $row->task_type ?: 'general',
            'priority' => $row->priority ?: 'normal',
            'status' => $row->status ?: 'open',
            'due_date' => $row->due_date,
            'completed_at' => $row->completed_at,
            'assigned_to_name' => $row->assigned_to_name,
            'notes' => $row->notes,
            'property' => $row->property_id ? ['id' => (int) $row->property_id, 'name' => $row->property_name, 'owner' => $row->owner_name ? ['name' => $row->owner_name] : null] : null,
            'unit' => $row->unit_id ? ['id' => (int) $row->unit_id, 'property_id' => $row->unit_property_id ? (int) $row->unit_property_id : $row->property_id, 'unit_number' => $row->unit_number] : null,
            'tenant' => $row->tenant_id ? ['id' => (int) $row->tenant_id, 'name' => $row->tenant_name, 'phone' => $row->tenant_phone] : null,
            'contract' => $row->contract_id ? ['id' => (int) $row->contract_id, 'contract_number' => $row->contract_number, 'government_contract_number' => $row->government_contract_number] : null,
        ];
    }
}

if (!function_exists('mr_followups_query')) {
    function mr_followups_query(Request $request)
    {
        mr_followups_ensure_schema();
        $query = DB::table('follow_up_tasks')
            ->leftJoin('properties', 'properties.id', '=', 'follow_up_tasks.property_id')
            ->leftJoin('owners', 'owners.id', '=', 'follow_up_tasks.owner_id')
            ->leftJoin('units', 'units.id', '=', 'follow_up_tasks.unit_id')
            ->leftJoin('tenants', 'tenants.id', '=', 'follow_up_tasks.tenant_id')
            ->leftJoin('contracts', 'contracts.id', '=', 'follow_up_tasks.contract_id')
            ->select([
                'follow_up_tasks.*', 'properties.name as property_name', 'owners.name as owner_name',
                'units.property_id as unit_property_id', 'units.unit_number as unit_number',
                'tenants.name as tenant_name', 'tenants.phone as tenant_phone',
                'contracts.contract_number', 'contracts.government_contract_number',
            ])
            ->orderByRaw("CASE WHEN follow_up_tasks.status = 'open' THEN 0 ELSE 1 END")
            ->orderByRaw("CASE follow_up_tasks.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END")
            ->orderByRaw('COALESCE(follow_up_tasks.due_date, follow_up_tasks.id) asc');
        return mr_followups_apply_scope($query, $request);
    }
}

$followupsIndex = function (Request $request) {
    return response()->json(mr_followups_query($request)->limit(200)->get()->map(fn ($row) => mr_followups_payload($row))->values());
};

$followupsStore = function (Request $request) {
    mr_followups_ensure_schema();
    $title = trim((string) $request->input('title', ''));
    if ($title === '') return response()->json(['message' => 'عنوان المتابعة مطلوب.'], 422);

    $contractId = $request->filled('contract_id') ? (int) $request->input('contract_id') : null;
    $unitId = $request->filled('unit_id') ? (int) $request->input('unit_id') : null;
    $propertyId = $request->filled('property_id') ? (int) $request->input('property_id') : null;
    $tenantId = $request->filled('tenant_id') ? (int) $request->input('tenant_id') : null;
    $ownerId = null;

    if ($contractId) {
        [$contractUnitId, $contractPropertyId, $contractOwnerId, $contractTenantId] = mr_followups_infer_from_contract($contractId);
        $unitId = $unitId ?: $contractUnitId;
        $propertyId = $propertyId ?: $contractPropertyId;
        $ownerId = $contractOwnerId;
        $tenantId = $tenantId ?: $contractTenantId;
    }
    if (!$propertyId && $unitId) {
        [$unitPropertyId, $unitOwnerId] = mr_followups_infer_from_unit($unitId);
        $propertyId = $unitPropertyId;
        $ownerId = $ownerId ?: $unitOwnerId;
    }
    $ownerId = $ownerId ?: mr_followups_infer_owner_from_property($propertyId);

    $user = $request->user();
    $ids = mr_followups_allowed_ids($request);
    if (!mr_followups_is_admin($user)) {
        if ($ownerId && !in_array($ownerId, $ids['ownerIds'], true)) return response()->json(['message' => 'خارج صلاحيتك.'], 403);
        if ($propertyId && !in_array($propertyId, $ids['propertyIds'], true)) return response()->json(['message' => 'خارج صلاحيتك.'], 403);
        if ($unitId && !in_array($unitId, $ids['unitIds'], true)) return response()->json(['message' => 'خارج صلاحيتك.'], 403);
        if ($contractId && !in_array($contractId, $ids['contractIds'], true)) return response()->json(['message' => 'خارج صلاحيتك.'], 403);
    }

    $dueDate = null;
    $dueText = substr(trim((string) $request->input('due_date', '')), 0, 10);
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $dueText)) $dueDate = $dueText;

    $id = DB::table('follow_up_tasks')->insertGetId([
        'manager_id' => mr_followups_manager_id($request),
        'owner_id' => $ownerId,
        'property_id' => $propertyId,
        'unit_id' => $unitId,
        'tenant_id' => $tenantId,
        'contract_id' => $contractId,
        'created_by' => $user->id ?? null,
        'title' => $title,
        'task_type' => trim((string) $request->input('task_type', 'general')) ?: 'general',
        'priority' => trim((string) $request->input('priority', 'normal')) ?: 'normal',
        'status' => 'open',
        'due_date' => $dueDate,
        'assigned_to_name' => $request->input('assigned_to_name'),
        'notes' => $request->input('notes'),
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $row = mr_followups_query($request)->where('follow_up_tasks.id', $id)->first();
    return response()->json($row ? mr_followups_payload($row) : ['id' => $id], 201);
};

$followupsStatus = function (Request $request, int $id) {
    $status = strtolower(trim((string) $request->input('status', 'open')));
    if (!in_array($status, ['open', 'done', 'cancelled'], true)) return response()->json(['message' => 'حالة غير صحيحة.'], 422);
    $row = mr_followups_query($request)->where('follow_up_tasks.id', $id)->first();
    if (!$row) return response()->json(['message' => 'المتابعة غير موجودة أو خارج صلاحيتك.'], 404);
    DB::table('follow_up_tasks')->where('id', $id)->update(['status' => $status, 'completed_at' => $status === 'done' ? now() : null, 'updated_at' => now()]);
    return response()->json(['status' => 'ok']);
};

Route::get('/follow-up-tasks', $followupsIndex);
Route::get('/my/follow-up-tasks', $followupsIndex);
Route::post('/follow-up-tasks', $followupsStore);
Route::post('/my/follow-up-tasks', $followupsStore);
Route::post('/follow-up-tasks/{id}/status', $followupsStatus);
Route::post('/my/follow-up-tasks/{id}/status', $followupsStatus);

mr_followups_ensure_schema();
