<?php

// PHASE2_ROUTE_MODULES: generated from routes/api.php on 2026-04-27-083758.
// Section: Payment Receipts / Partial Collections

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ContractFileController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\OwnerDashboardController;
use App\Models\Contract;
use App\Models\Owner;
use App\Models\Payment;
use App\Models\Property;
use App\Models\Tenant;
use App\Models\Unit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

// PHASE3_MY_EDIT_DELETE_CENTER_COMPAT_BEGIN
/*
|--------------------------------------------------------------------------
| Phase 3 compatibility: scoped Edit/Delete Center routes
|--------------------------------------------------------------------------
| Mobile now calls /api/my/edit-delete-center/* for scoped reads.
| These routes are intentionally registered late so they win over any older
| duplicate route definitions in this large legacy route module.
*/

if (!function_exists('my_rentals_phase3_ed_current_user')) {
    function my_rentals_phase3_ed_current_user(\Illuminate\Http\Request $request): ?\App\Models\User
    {
        if (function_exists('my_rentals_ed_lookup_current_user')) {
            return my_rentals_ed_lookup_current_user($request);
        }

        if (function_exists('my_rentals_ed_current_user')) {
            return my_rentals_ed_current_user($request);
        }

        if (function_exists('my_rentals_current_user_for_scope')) {
            return my_rentals_current_user_for_scope($request);
        }

        if (function_exists('my_rentals_bearer_user')) {
            return my_rentals_bearer_user($request);
        }

        return null;
    }
}

if (!function_exists('my_rentals_phase3_forward_edit_delete_center')) {
    function my_rentals_phase3_forward_edit_delete_center(string $resource, int $id, string $action, \Illuminate\Http\Request $request)
    {
        $server = [];

        if ($request->header('Authorization')) {
            $server['HTTP_AUTHORIZATION'] = $request->header('Authorization');
        }

        if ($request->header('X-Api-Token')) {
            $server['HTTP_X_API_TOKEN'] = $request->header('X-Api-Token');
        }

        $internalRequest = \Illuminate\Http\Request::create(
            '/api/edit-delete-center/' . $resource . '/' . $id . '/' . $action,
            'POST',
            $request->all(),
            [],
            [],
            $server
        );

        $internalRequest->headers->set('Accept', 'application/json');

        try {
            return app('router')->getRoutes()->match($internalRequest)->run();
        } catch (\Symfony\Component\HttpKernel\Exception\NotFoundHttpException $e) {
            return response()->json([
                'message' => 'مسار مركز التعديل والحذف الأساسي غير موجود.',
            ], 404);
        }
    }
}

Route::get('/my/edit-delete-center/resources', function (\Illuminate\Http\Request $request) {
    $user = my_rentals_phase3_ed_current_user($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    if (!function_exists('my_rentals_ed_model_map') || !function_exists('my_rentals_ed_existing_fields')) {
        return response()->json(['message' => 'يجب تثبيت مركز التعديل والحذف أولاً.'], 422);
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

Route::get('/my/edit-delete-center/lookups', function (\Illuminate\Http\Request $request) {
    $user = my_rentals_phase3_ed_current_user($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    if (!function_exists('my_rentals_ed_lookup_payload')) {
        return response()->json(['message' => 'يجب تثبيت مركز التعديل والحذف أولاً.'], 422);
    }

    return my_rentals_ed_lookup_payload($user);
});

Route::get('/my/edit-delete-center/{resource}', function (string $resource, \Illuminate\Http\Request $request) {
    $user = my_rentals_phase3_ed_current_user($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    foreach (['my_rentals_ed_resource_config', 'my_rentals_ed_apply_scope', 'my_rentals_ed_existing_fields', 'my_rentals_ed_item_payload'] as $requiredFunction) {
        if (!function_exists($requiredFunction)) {
            return response()->json(['message' => 'يجب تثبيت مركز التعديل والحذف أولاً.'], 422);
        }
    }

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
});

Route::post('/my/edit-delete-center/{resource}/{id}/update', function (string $resource, int $id, \Illuminate\Http\Request $request) {
    return my_rentals_phase3_forward_edit_delete_center($resource, $id, 'update', $request);
});

Route::post('/my/edit-delete-center/{resource}/{id}/archive', function (string $resource, int $id, \Illuminate\Http\Request $request) {
    return my_rentals_phase3_forward_edit_delete_center($resource, $id, 'archive', $request);
});

Route::post('/my/edit-delete-center/{resource}/{id}/delete', function (string $resource, int $id, \Illuminate\Http\Request $request) {
    return my_rentals_phase3_forward_edit_delete_center($resource, $id, 'delete', $request);
});
// PHASE3_MY_EDIT_DELETE_CENTER_COMPAT_END
