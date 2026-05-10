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

    $ownerIds = collect();

    if (!empty($user->owner_id)) {
        $ownerIds->push((int) $user->owner_id);
    }

    if (Schema::hasTable('owners')) {
        $owners = DB::table('owners');
        $owners->where(function ($ownerQuery) use ($user) {
            $hasCondition = false;

            if (!empty($user->email) && Schema::hasColumn('owners', 'email')) {
                $ownerQuery->orWhere('email', $user->email);
                $hasCondition = true;
            }

            if (!empty($user->id)) {
                if (Schema::hasColumn('owners', 'user_id')) {
                    $ownerQuery->orWhere('user_id', $user->id);
                    $hasCondition = true;
                }

                if (Schema::hasColumn('owners', 'account_user_id')) {
                    $ownerQuery->orWhere('account_user_id', $user->id);
                    $hasCondition = true;
                }
            }

            if (!empty($user->name) && Schema::hasColumn('owners', 'name')) {
                $ownerQuery->orWhere('name', $user->name);
                $hasCondition = true;
            }

            if (!$hasCondition) {
                $ownerQuery->whereRaw('1 = 0');
            }
        });

        $ownerIds = $ownerIds->merge($owners->pluck('id'));

        $role = method_exists($user, 'effectiveRole') ? $user->effectiveRole() : (string) ($user->role ?? '');
        $isAdmin = in_array($role, ['admin', 'manager', 'super_admin'], true);

        if ($isAdmin && $ownerIds->isEmpty()) {
            $selfOwners = DB::table('owners')->where(function ($ownerQuery) {
                $hasCondition = false;

                if (Schema::hasColumn('owners', 'type')) {
                    $ownerQuery->orWhere('type', 'self');
                    $hasCondition = true;
                }

                if (Schema::hasColumn('owners', 'name')) {
                    $ownerQuery
                        ->orWhere('name', 'like', '%احمد%')
                        ->orWhere('name', 'like', '%أحمد%')
                        ->orWhere('name', 'like', '%املاكي%')
                        ->orWhere('name', 'like', '%أملاكي%');
                    $hasCondition = true;
                }

                if (!$hasCondition) {
                    $ownerQuery->whereRaw('1 = 0');
                }
            });

            $ownerIds = $ownerIds->merge($selfOwners->pluck('id'));
        }
    }

    $ownerIds = $ownerIds
        ->filter(fn ($id) => !empty($id))
        ->map(fn ($id) => (int) $id)
        ->unique()
        ->values();

    if ($ownerIds->isEmpty()) {
        return collect();
    }

    return \App\Models\Property::query()
        ->with(['owner'])
        ->withCount(['units'])
        ->whereIn('owner_id', $ownerIds->all())
        ->orderBy('id', 'desc')
        ->get();
});
