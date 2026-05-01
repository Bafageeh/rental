<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/profile/properties', function (Request $request) {
    $user = function_exists('my_rentals_current_user_for_scope')
        ? my_rentals_current_user_for_scope($request)
        : $request->user();

    if (!$user) {
        return response()->json([
            'message' => 'غير مصرح. الرجاء تسجيل الدخول مرة أخرى.',
        ], 401);
    }

    $ownerId = (int) ($user->owner_id ?? 0);

    if ($ownerId <= 0) {
        return collect();
    }

    return \App\Models\Property::query()
        ->with(['owner'])
        ->withCount(['units'])
        ->where('owner_id', $ownerId)
        ->orderBy('id', 'desc')
        ->get();
});
