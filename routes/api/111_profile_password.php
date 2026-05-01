<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;

Route::post('/auth/change-password', function (Request $request) {
    $user = function_exists('my_rentals_current_user_for_scope')
        ? my_rentals_current_user_for_scope($request)
        : $request->user();

    if (!$user) {
        return response()->json([
            'message' => 'غير مصرح. الرجاء تسجيل الدخول مرة أخرى.',
        ], 401);
    }

    $data = $request->validate([
        'current_password' => ['required', 'string'],
        'password' => ['required', 'string', 'min:6', 'confirmed'],
    ], [
        'current_password.required' => 'الرقم السري الحالي مطلوب.',
        'password.required' => 'الرقم السري الجديد مطلوب.',
        'password.min' => 'الرقم السري الجديد يجب ألا يقل عن 6 أحرف.',
        'password.confirmed' => 'تأكيد الرقم السري غير مطابق.',
    ]);

    $modelUser = \App\Models\User::query()->find($user->id);

    if (!$modelUser) {
        return response()->json([
            'message' => 'المستخدم غير موجود.',
        ], 404);
    }

    if (!Hash::check($data['current_password'], $modelUser->password)) {
        return response()->json([
            'message' => 'الرقم السري الحالي غير صحيح.',
        ], 422);
    }

    $modelUser->forceFill([
        'password' => Hash::make($data['password']),
    ])->save();

    return response()->json([
        'status' => 'ok',
        'message' => 'تم تغيير الرقم السري بنجاح.',
    ]);
});
