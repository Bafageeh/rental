<?php

namespace App\Providers;

use App\Models\WebhookEvent;
use App\Observers\WebhookEventObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        WebhookEvent::observe(WebhookEventObserver::class);
    }
}
