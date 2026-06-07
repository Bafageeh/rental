<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            $otpRoutes = base_path('routes/api/123_password_otp_and_tenant_payments.php');
            if (is_file($otpRoutes)) {
                Route::group([], $otpRoutes);
            }
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'auth.api'     => \App\Http\Middleware\AuthenticateApi::class,
            'owner.scope'  => \App\Http\Middleware\OwnerScope::class,
            'admin.only'   => \App\Http\Middleware\AdminOnly::class,
            'api.scope'    => \App\Http\Middleware\EnforceApiAccessScope::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
