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

    $role = method_exists($user, 'effectiveRole') ? $user->effectiveRole() : strtolower((string) ($user->role ?? ''));
    $isAdmin = in_array($role, ['admin', 'manager', 'super_admin'], true);
    $ownerIds = collect();

    // شاشة عقاراتي تعرض عقارات مالك الحساب الحالي فقط.
    // للأدمن الذي لا يملك owner_id مباشر، نعرض فقط مالك النظام الافتراضي type=self حتى تظهر عقارات الأدمن اليدوية.
    if (!empty($user->owner_id)) {
        $ownerIds->push((int) $user->owner_id);
    }

    if (Schema::hasTable('owners')) {
        $owners = DB::table('owners');
        $owners->where(function ($ownerQuery) use ($user) {
            $hasCondition = false;

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

            if (!$hasCondition) {
                $ownerQuery->whereRaw('1 = 0');
            }
        });

        $ownerIds = $ownerIds->merge($owners->pluck('id'));

        if ($isAdmin && $ownerIds->isEmpty() && Schema::hasColumn('owners', 'type')) {
            $ownerIds = $ownerIds->merge(
                DB::table('owners')
                    ->where('type', 'self')
                    ->pluck('id')
            );
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
