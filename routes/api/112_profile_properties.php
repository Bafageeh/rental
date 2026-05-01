<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

Route::get('/profile/properties', function (Request $request) {
    $user = function_exists('my_rentals_current_user_for_scope')
        ? my_rentals_current_user_for_scope($request)
        : $request->user();

    if (!$user) {
        return response()->json([
            'message' => 'غير مصرح. الرجاء تسجيل الدخول مرة أخرى.',
        ], 401);
    }

    $query = \App\Models\Property::query()
        ->with(['owner'])
        ->withCount(['units'])
        ->orderBy('id', 'desc');

    if (!empty($user->owner_id)) {
        $query->where('owner_id', $user->owner_id);
    } else {
        $ownerIds = collect();

        if (Schema::hasTable('owners')) {
            $owners = DB::table('owners');

            $owners->where(function ($ownerQuery) use ($user) {
                if (!empty($user->email) && Schema::hasColumn('owners', 'email')) {
                    $ownerQuery->orWhere('email', $user->email);
                }

                if (!empty($user->name)) {
                    $ownerQuery->orWhere('name', $user->name);
                    $ownerQuery->orWhere('name', 'like', '%' . $user->name . '%');
                }

                $ownerQuery->orWhere('name', 'أملاكي الخاصة');
            });

            $ownerIds = $owners->pluck('id');
        }

        if ($ownerIds->isNotEmpty()) {
            $query->whereIn('owner_id', $ownerIds->all());
        } elseif (Schema::hasColumn('properties', 'management_type')) {
            $query->where('management_type', 'owned');
        } else {
            $query->whereRaw('1 = 0');
        }
    }

    return $query->get();
});
