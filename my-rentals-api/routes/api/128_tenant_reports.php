<?php

use App\Http\Controllers\Api\TenantReportController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth.api'])->group(function () {
    Route::get('api/tenant/reports', [TenantReportController::class, 'show']);
});
