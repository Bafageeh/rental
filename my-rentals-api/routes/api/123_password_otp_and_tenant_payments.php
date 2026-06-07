<?php

use App\Http\Controllers\Api\PasswordOtpController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/password/otp/request', [PasswordOtpController::class, 'requestOtp']);
Route::post('/auth/password/otp/verify', [PasswordOtpController::class, 'verifyOtp']);
Route::post('/auth/password/reset', [PasswordOtpController::class, 'resetPassword']);

Route::middleware(['auth.api'])->group(function () {
    Route::get('/tenant/payments', [PasswordOtpController::class, 'tenantPayments']);
});
