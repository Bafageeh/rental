<?php

/*
|--------------------------------------------------------------------------
| Phase 3 compatibility overrides
|--------------------------------------------------------------------------
| Keeps the UI stable even if older generated route modules return slightly
| different payload shapes. This file is intentionally loaded after
| 19_receipts.php so these exact routes win in Laravel's route collection.
*/

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Route;

if (!function_exists('my_rentals_phase3_current_user')) {
    function my_rentals_phase3_current_user(Request $request): ?\App\Models\User
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

if (!function_exists('my_rentals_phase3_compat_item_payload')) {
    function my_rentals_phase3_compat_item_payload($item, string $resource, array $config): array
    {
        $editable = function_exists('my_rentals_ed_existing_fields')
            ? my_rentals_ed_existing_fields($config, $config['editable'] ?? [])
            : [];

        $titleFields = function_exists('my_rentals_ed_existing_fields')
            ? my_rentals_ed_existing_fields($config, $config['title_fields'] ?? [])
            : [];

        $fields = [];
        foreach ($editable as $field) {
            $fields[$field] = $item->{$field} ?? null;
        }

        $titleParts = [];
        foreach ($titleFields as $field) {
            $value = $item->{$field} ?? null;
            if ($value !== null && $value !== '') {
                $titleParts[] = (string) $value;
            }
        }

        $title = implode(' - ', $titleParts);
        if ($title === '') {
            $title = ($config['label'] ?? $resource) . ' #' . ($item->id ?? '');
        }

        $table = $config['table'] ?? null;
        $canArchive = false;
        if ($table && Schema::hasTable($table)) {
            $canArchive = Schema::hasColumn($table, 'is_active')
                || Schema::hasColumn($table, 'status')
                || Schema::hasColumn($table, 'archived_at');
        }

        return [
            'id' => (int) $item->id,
            'resource' => $resource,
            'resource_label' => $config['label'] ?? $resource,
            'title' => $title,
            'fields' => $fields,
            'values' => $fields,
            'editable_fields' => $editable,
            'can_archive' => $canArchive,
            'raw' => method_exists($item, 'toArray') ? $item->toArray() : [],
        ];
    }
}

if (!function_exists('my_rentals_phase3_compat_list_response')) {
    function my_rentals_phase3_compat_list_response(string $resource, Request $request, ?\App\Models\User $user)
    {
        if (!function_exists('my_rentals_ed_resource_config')) {
            return response()->json(['message' => 'مركز التعديل والحذف غير جاهز.'], 422);
        }

        $config = my_rentals_ed_resource_config($resource);
        if (!$config) {
            return response()->json(['message' => 'هذا النوع غير متاح للتعديل.'], 404);
        }

        $model = $config['model'];
        $query = function_exists('my_rentals_ed_apply_scope')
            ? my_rentals_ed_apply_scope($model::query(), $resource, $config, $user)
            : $model::query();

        $id = $request->query('id');
        if ($id !== null && $id !== '') {
            $query->where('id', (int) $id);
        } else {
            $search = trim((string) $request->query('q', ''));
            if ($search !== '') {
                $searchFields = function_exists('my_rentals_ed_existing_fields')
                    ? my_rentals_ed_existing_fields($config, $config['search_fields'] ?? [])
                    : [];

                if ($searchFields) {
                    $query->where(function ($q) use ($searchFields, $search) {
                        foreach ($searchFields as $field) {
                            $q->orWhere($field, 'like', '%' . $search . '%');
                        }
                    });
                }
            }
        }

        $items = $query->orderByDesc('id')->limit($id ? 1 : 150)->get();
        $editable = function_exists('my_rentals_ed_existing_fields')
            ? my_rentals_ed_existing_fields($config, $config['editable'] ?? [])
            : [];

        return [
            'resource' => $resource,
            'resource_label' => $config['label'] ?? $resource,
            'editable_fields' => $editable,
            'items' => $items->map(fn ($item) => my_rentals_phase3_compat_item_payload($item, $resource, $config))->values(),
        ];
    }
}

if (!function_exists('my_rentals_phase3_dashboard_zero_payload')) {
    function my_rentals_phase3_dashboard_zero_payload(?\App\Models\User $user = null): array
    {
        return [
            'scope' => [
                'is_admin' => function_exists('my_rentals_is_admin_user') ? my_rentals_is_admin_user($user) : true,
                'owner_id' => $user?->owner_id,
            ],
            'summary' => [
                'properties_count' => 0,
                'units_count' => 0,
                'rented_units_count' => 0,
                'vacant_units_count' => 0,
                'occupancy_rate' => 0,
                'active_contracts_count' => 0,
                'tenants_count' => 0,
                'paid_income' => 0,
                'due_income' => 0,
                'overdue_income' => 0,
                'expenses' => 0,
                'net_income' => 0,
                'open_followups_count' => 0,
                'critical_alerts_count' => 0,
            ],
            'cards' => [],
            'recent_due_payments' => [],
            'recent_contracts' => [],
        ];
    }
}

if (!function_exists('my_rentals_phase3_dashboard_response')) {
    function my_rentals_phase3_dashboard_response(Request $request)
    {
        $user = my_rentals_phase3_current_user($request);
        if (!$user) {
            return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
        }

        try {
            if (function_exists('my_rentals_dashboard_summary_payload')) {
                return my_rentals_dashboard_summary_payload($user);
            }
        } catch (\Throwable $e) {
            Log::warning('Phase 3 dashboard fallback used', [
                'message' => $e->getMessage(),
                'user_id' => $user->id ?? null,
            ]);
        }

        return my_rentals_phase3_dashboard_zero_payload($user);
    }
}

Route::get('/my/dashboard', function (Request $request) {
    return my_rentals_phase3_dashboard_response($request);
});

Route::get('/my/dashboard-summary', function (Request $request) {
    return my_rentals_phase3_dashboard_response($request);
});

Route::get('/my/edit-delete-center/resources', function (Request $request) {
    $user = my_rentals_phase3_current_user($request);
    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    if (!function_exists('my_rentals_ed_model_map')) {
        return [];
    }

    return collect(my_rentals_ed_model_map())
        ->filter(fn ($config) => !empty($config['model']) && class_exists($config['model']) && Schema::hasTable($config['table']))
        ->map(fn ($config, $key) => [
            'key' => $key,
            'label' => $config['label'] ?? $key,
            'editable_fields' => function_exists('my_rentals_ed_existing_fields') ? my_rentals_ed_existing_fields($config, $config['editable'] ?? []) : [],
        ])
        ->values();
});

Route::get('/my/edit-delete-center/lookups', function (Request $request) {
    $user = my_rentals_phase3_current_user($request);
    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    if (function_exists('my_rentals_ed_lookup_payload')) {
        return my_rentals_ed_lookup_payload($user);
    }

    return [];
});

Route::get('/my/edit-delete-center/{resource}', function (string $resource, Request $request) {
    $user = my_rentals_phase3_current_user($request);
    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    return my_rentals_phase3_compat_list_response($resource, $request, $user);
});
