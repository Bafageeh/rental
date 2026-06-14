<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;

if (!function_exists('mr_service_providers_require_manager')) {
    function mr_service_providers_require_manager(Request $request): int
    {
        $user = $request->user();
        $role = function_exists('mr_manager_scope_role') ? mr_manager_scope_role($user) : strtolower(trim((string) ($user->role ?? '')));
        $managerId = (int) ($user->id ?? 0);

        if ($role !== 'manager' || $managerId <= 0) {
            abort(response()->json([
                'status' => 'error',
                'message' => 'هذه الخدمة مخصصة لمدير العقارات فقط.',
            ], 403));
        }

        return $managerId;
    }
}

if (!function_exists('mr_service_providers_add_column')) {
    function mr_service_providers_add_column(string $tableName, string $columnName, Closure $definition): void
    {
        if (Schema::hasTable($tableName) && !Schema::hasColumn($tableName, $columnName)) {
            Schema::table($tableName, function (Blueprint $table) use ($definition) {
                $definition($table);
            });
        }
    }
}

if (!function_exists('mr_service_providers_ensure_schema')) {
    function mr_service_providers_ensure_schema(): void
    {
        if (!Schema::hasTable('service_providers')) {
            Schema::create('service_providers', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('manager_id')->nullable()->index();
                $table->string('name');
                $table->string('provider_type')->default('general')->index();
                $table->string('phone')->nullable();
                $table->string('alternate_phone')->nullable();
                $table->string('email')->nullable();
                $table->string('city')->nullable();
                $table->string('district')->nullable();
                $table->string('address')->nullable();
                $table->decimal('default_visit_fee', 12, 2)->default(0);
                $table->unsignedTinyInteger('rating')->nullable();
                $table->boolean('is_preferred')->default(false)->index();
                $table->boolean('is_active')->default(true)->index();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        mr_service_providers_add_column('service_providers', 'manager_id', fn (Blueprint $table) => $table->unsignedBigInteger('manager_id')->nullable()->index());
        mr_service_providers_add_column('service_providers', 'provider_type', fn (Blueprint $table) => $table->string('provider_type')->default('general')->index());
        mr_service_providers_add_column('service_providers', 'alternate_phone', fn (Blueprint $table) => $table->string('alternate_phone')->nullable());
        mr_service_providers_add_column('service_providers', 'email', fn (Blueprint $table) => $table->string('email')->nullable());
        mr_service_providers_add_column('service_providers', 'city', fn (Blueprint $table) => $table->string('city')->nullable());
        mr_service_providers_add_column('service_providers', 'district', fn (Blueprint $table) => $table->string('district')->nullable());
        mr_service_providers_add_column('service_providers', 'address', fn (Blueprint $table) => $table->string('address')->nullable());
        mr_service_providers_add_column('service_providers', 'default_visit_fee', fn (Blueprint $table) => $table->decimal('default_visit_fee', 12, 2)->default(0));
        mr_service_providers_add_column('service_providers', 'rating', fn (Blueprint $table) => $table->unsignedTinyInteger('rating')->nullable());
        mr_service_providers_add_column('service_providers', 'is_preferred', fn (Blueprint $table) => $table->boolean('is_preferred')->default(false)->index());
        mr_service_providers_add_column('service_providers', 'is_active', fn (Blueprint $table) => $table->boolean('is_active')->default(true)->index());
        mr_service_providers_add_column('service_providers', 'notes', fn (Blueprint $table) => $table->text('notes')->nullable());

        if (!Schema::hasTable('maintenance_requests')) {
            Schema::create('maintenance_requests', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('manager_id')->nullable()->index();
                $table->string('title')->nullable();
                $table->string('priority')->default('normal')->index();
                $table->string('status')->default('open')->index();
                $table->date('request_date')->nullable();
                $table->date('scheduled_date')->nullable();
                $table->unsignedBigInteger('property_id')->nullable()->index();
                $table->unsignedBigInteger('unit_id')->nullable()->index();
                $table->unsignedBigInteger('tenant_id')->nullable()->index();
                $table->unsignedBigInteger('service_provider_id')->nullable()->index();
                $table->decimal('estimated_cost', 12, 2)->nullable();
                $table->decimal('actual_cost', 12, 2)->nullable();
                $table->text('description')->nullable();
                $table->timestamps();
            });
        }

        mr_service_providers_add_column('maintenance_requests', 'manager_id', fn (Blueprint $table) => $table->unsignedBigInteger('manager_id')->nullable()->index());
        mr_service_providers_add_column('maintenance_requests', 'service_provider_id', fn (Blueprint $table) => $table->unsignedBigInteger('service_provider_id')->nullable()->index());
        mr_service_providers_add_column('maintenance_requests', 'priority', fn (Blueprint $table) => $table->string('priority')->default('normal')->index());
        mr_service_providers_add_column('maintenance_requests', 'status', fn (Blueprint $table) => $table->string('status')->default('open')->index());
        mr_service_providers_add_column('maintenance_requests', 'request_date', fn (Blueprint $table) => $table->date('request_date')->nullable());
        mr_service_providers_add_column('maintenance_requests', 'scheduled_date', fn (Blueprint $table) => $table->date('scheduled_date')->nullable());
        mr_service_providers_add_column('maintenance_requests', 'property_id', fn (Blueprint $table) => $table->unsignedBigInteger('property_id')->nullable()->index());
        mr_service_providers_add_column('maintenance_requests', 'unit_id', fn (Blueprint $table) => $table->unsignedBigInteger('unit_id')->nullable()->index());
        mr_service_providers_add_column('maintenance_requests', 'tenant_id', fn (Blueprint $table) => $table->unsignedBigInteger('tenant_id')->nullable()->index());
        mr_service_providers_add_column('maintenance_requests', 'estimated_cost', fn (Blueprint $table) => $table->decimal('estimated_cost', 12, 2)->nullable());
        mr_service_providers_add_column('maintenance_requests', 'actual_cost', fn (Blueprint $table) => $table->decimal('actual_cost', 12, 2)->nullable());
        mr_service_providers_add_column('maintenance_requests', 'description', fn (Blueprint $table) => $table->text('description')->nullable());
    }
}

if (!function_exists('mr_service_provider_payload')) {
    function mr_service_provider_payload(Request $request, int $managerId): array
    {
        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:255'],
            'provider_type' => ['nullable', 'string', 'max:50'],
            'phone' => ['nullable', 'string', 'max:50'],
            'alternate_phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'city' => ['nullable', 'string', 'max:120'],
            'district' => ['nullable', 'string', 'max:120'],
            'address' => ['nullable', 'string', 'max:255'],
            'default_visit_fee' => ['nullable', 'numeric', 'min:0'],
            'rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'is_preferred' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string'],
        ]);

        if ($validator->fails()) {
            abort(response()->json([
                'message' => 'تحقق من بيانات مقدم الخدمة.',
                'errors' => $validator->errors(),
            ], 422));
        }

        $data = $validator->validated();
        return [
            'manager_id' => $managerId,
            'name' => trim((string) $data['name']),
            'provider_type' => $data['provider_type'] ?? 'general',
            'phone' => $data['phone'] ?? null,
            'alternate_phone' => $data['alternate_phone'] ?? null,
            'email' => $data['email'] ?? null,
            'city' => $data['city'] ?? null,
            'district' => $data['district'] ?? null,
            'address' => $data['address'] ?? null,
            'default_visit_fee' => (float) ($data['default_visit_fee'] ?? 0),
            'rating' => $data['rating'] ?? null,
            'is_preferred' => (bool) ($data['is_preferred'] ?? false),
            'is_active' => array_key_exists('is_active', $data) ? (bool) $data['is_active'] : true,
            'notes' => $data['notes'] ?? null,
            'updated_at' => now(),
        ];
    }
}

if (!function_exists('mr_service_providers_query')) {
    function mr_service_providers_query(int $managerId)
    {
        return DB::table('service_providers')
            ->where('manager_id', $managerId)
            ->orderByDesc('is_active')
            ->orderByDesc('is_preferred')
            ->orderBy('name');
    }
}

if (!function_exists('mr_service_provider_find_or_abort')) {
    function mr_service_provider_find_or_abort(int $id, int $managerId)
    {
        $provider = DB::table('service_providers')->where('id', $id)->where('manager_id', $managerId)->first();
        if (!$provider) {
            abort(response()->json(['message' => 'مقدم الخدمة غير موجود أو لا يتبع مدير العقارات.'], 404));
        }
        return $provider;
    }
}

if (!function_exists('mr_service_providers_open_requests_query')) {
    function mr_service_providers_open_requests_query(int $managerId)
    {
        $query = DB::table('maintenance_requests as mr')
            ->leftJoin('properties as p', 'p.id', '=', 'mr.property_id')
            ->leftJoin('units as u', 'u.id', '=', 'mr.unit_id')
            ->leftJoin('tenants as t', 't.id', '=', 'mr.tenant_id')
            ->leftJoin('service_providers as sp', 'sp.id', '=', 'mr.service_provider_id')
            ->where('mr.manager_id', $managerId)
            ->whereNotIn('mr.status', ['closed', 'done', 'completed', 'cancelled', 'ملغي', 'مغلقة', 'منتهية'])
            ->orderByRaw("case when mr.service_provider_id is null then 0 else 1 end")
            ->orderByDesc('mr.id');

        return $query->select([
            'mr.id', 'mr.title', 'mr.priority', 'mr.status', 'mr.request_date', 'mr.scheduled_date',
            'mr.property_id', 'mr.unit_id', 'mr.tenant_id', 'mr.service_provider_id',
            'mr.estimated_cost', 'mr.actual_cost', 'mr.description',
            DB::raw('p.name as property_name'),
            DB::raw('u.unit_number as unit_number'),
            DB::raw('t.name as tenant_name'),
            DB::raw('sp.name as service_provider_name'),
        ]);
    }
}

if (!function_exists('mr_service_providers_data_response')) {
    function mr_service_providers_data_response(Request $request)
    {
        mr_service_providers_ensure_schema();
        $managerId = mr_service_providers_require_manager($request);

        $providers = mr_service_providers_query($managerId)->get()->map(function ($provider) {
            $openRequestsCount = DB::table('maintenance_requests')
                ->where('service_provider_id', $provider->id)
                ->where('manager_id', $provider->manager_id)
                ->whereNotIn('status', ['closed', 'done', 'completed', 'cancelled', 'ملغي', 'مغلقة', 'منتهية'])
                ->count();

            $provider->maintenance_requests_count = DB::table('maintenance_requests')->where('service_provider_id', $provider->id)->where('manager_id', $provider->manager_id)->count();
            $provider->open_maintenance_requests_count = $openRequestsCount;
            return $provider;
        });

        $maintenanceRequests = mr_service_providers_open_requests_query($managerId)->limit(50)->get();

        return response()->json([
            'providers' => $providers,
            'maintenance_requests' => $maintenanceRequests,
        ]);
    }
}

foreach (['/service-providers/data', '/my/service-providers/data'] as $path) {
    Route::get($path, function (Request $request) {
        return mr_service_providers_data_response($request);
    });
}

Route::post('/service-providers', function (Request $request) {
    mr_service_providers_ensure_schema();
    $managerId = mr_service_providers_require_manager($request);
    $payload = mr_service_provider_payload($request, $managerId);
    $payload['created_at'] = now();

    $id = DB::table('service_providers')->insertGetId($payload);

    return response()->json([
        'message' => 'تم إضافة مقدم الخدمة بنجاح.',
        'data' => DB::table('service_providers')->where('id', $id)->first(),
    ], 201);
});

Route::post('/service-providers/{provider}/update', function (Request $request, $provider) {
    mr_service_providers_ensure_schema();
    $managerId = mr_service_providers_require_manager($request);
    $id = (int) $provider;
    mr_service_provider_find_or_abort($id, $managerId);

    $payload = mr_service_provider_payload($request, $managerId);
    DB::table('service_providers')->where('id', $id)->where('manager_id', $managerId)->update($payload);

    return response()->json([
        'message' => 'تم تحديث مقدم الخدمة.',
        'data' => DB::table('service_providers')->where('id', $id)->first(),
    ]);
});

Route::post('/service-providers/{provider}/toggle-active', function (Request $request, $provider) {
    mr_service_providers_ensure_schema();
    $managerId = mr_service_providers_require_manager($request);
    $item = mr_service_provider_find_or_abort((int) $provider, $managerId);

    DB::table('service_providers')->where('id', $item->id)->where('manager_id', $managerId)->update([
        'is_active' => !$item->is_active,
        'updated_at' => now(),
    ]);

    return response()->json(['message' => 'تم تحديث حالة مقدم الخدمة.']);
});

Route::post('/service-providers/{provider}/toggle-preferred', function (Request $request, $provider) {
    mr_service_providers_ensure_schema();
    $managerId = mr_service_providers_require_manager($request);
    $item = mr_service_provider_find_or_abort((int) $provider, $managerId);

    DB::table('service_providers')->where('id', $item->id)->where('manager_id', $managerId)->update([
        'is_preferred' => !$item->is_preferred,
        'updated_at' => now(),
    ]);

    return response()->json(['message' => 'تم تحديث تفضيل مقدم الخدمة.']);
});

Route::post('/maintenance-requests/{requestId}/assign-provider', function (Request $request, $requestId) {
    mr_service_providers_ensure_schema();
    $managerId = mr_service_providers_require_manager($request);
    $maintenanceId = (int) $requestId;

    $maintenance = DB::table('maintenance_requests')->where('id', $maintenanceId)->where('manager_id', $managerId)->first();
    if (!$maintenance) {
        return response()->json(['message' => 'طلب الصيانة غير موجود أو لا يتبع مدير العقارات.'], 404);
    }

    $providerId = $request->input('service_provider_id');
    $providerId = $providerId === null || $providerId === '' ? null : (int) $providerId;

    if ($providerId !== null) {
        mr_service_provider_find_or_abort($providerId, $managerId);
    }

    DB::table('maintenance_requests')->where('id', $maintenanceId)->where('manager_id', $managerId)->update([
        'service_provider_id' => $providerId,
        'updated_at' => now(),
    ]);

    return response()->json(['message' => 'تم ربط مقدم الخدمة بطلب الصيانة.']);
});
