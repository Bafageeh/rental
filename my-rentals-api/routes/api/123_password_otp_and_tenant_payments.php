<?php

use App\Http\Controllers\Api\PasswordOtpController;
use Illuminate\Support\Facades\Route;

Route::post('api/auth/password/otp/request', [PasswordOtpController::class, 'requestOtp']);
Route::post('api/auth/password/otp/verify', [PasswordOtpController::class, 'verifyOtp']);
Route::post('api/auth/password/reset', [PasswordOtpController::class, 'resetPassword']);

Route::middleware(['auth.api'])->group(function () {
    Route::get('api/tenant/payments', [PasswordOtpController::class, 'tenantPayments']);
});
