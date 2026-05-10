<?php

/*
|--------------------------------------------------------------------------
| Property parking count hotfix
|--------------------------------------------------------------------------
| The properties table has a real column named parking_spots_count.
| Using withCount('parkingSpots') creates an Eloquent attribute with the same
| name and overwrites the stored total with the number of parking spot rows.
| This hotfix aliases the relation count so the mobile app receives the stored
| parking_spots_count value entered in create/edit screens.
*/

use App\Models\Property;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

if (!function_exists('mrpc_property_base_query')) {
    function mrpc_property_base_query()
    {
        return Property::with(['owner'])
            ->withCount([
                'units',
                'parkingSpots as used_parking_spots_count',
                'expenses',
                'files',
            ]);
    }
}

if (!function_exists('mrpc_apply_property_filters')) {
    function mrpc_apply_property_filters($query, Request $request)
    {
        if ($request->filled('owner_id')) {
            $query->where('owner_id', $request->integer('owner_id'));
        }

        if ($request->filled('property_id')) {
            $query->where('id', $request->integer('property_id'));
        }

        return $query;
    }
}

Route::get('/properties', function (Request $request) {
    $query = mrpc_property_base_query();
    mrpc_apply_property_filters($query, $request);

    return $query->orderBy('id', 'desc')->get();
});

Route::get('/my/properties', function (Request $request) {
    $user = function_exists('mrdu_current_user')
        ? mrdu_current_user($request)
        : (function_exists('my_rentals_current_user_for_scope') ? my_rentals_current_user_for_scope($request) : $request->user());

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $query = mrpc_property_base_query()->orderBy('id', 'desc');

    $isAdmin = function_exists('mrdu_is_admin_user')
        ? mrdu_is_admin_user($user)
        : (function_exists('my_rentals_is_admin_user') ? my_rentals_is_admin_user($user) : true);

    $wantsAll = $request->boolean('all')
        || $request->boolean('admin_all')
        || $request->query('scope') === 'all';

    if (!$isAdmin) {
        if (empty($user->owner_id)) {
            return collect();
        }

        $query->where('owner_id', $user->owner_id);
    } elseif (!$wantsAll && !$request->filled('owner_id') && !$request->filled('property_id') && !empty($user->owner_id)) {
        // مهم لشاشة بروفايل/عقاراتي القديمة التي كانت تستدعي /my/properties بدون بارامترات:
        // اعرض فقط العقارات المباشرة بمالك الحساب الحالي، ولا تعرض عقارات أملاكي الخاصة أو ملاك آخرين.
        $query->where('owner_id', $user->owner_id);
    }

    mrpc_apply_property_filters($query, $request);

    return $query->get();
});
