<?php

namespace App\Providers;

use App\Models\WebhookEvent;
use App\Observers\WebhookEventObserver;
use App\Services\EnhancedGovernmentContractPdfExtractor;
use App\Services\GovernmentContractPdfExtractor;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(GovernmentContractPdfExtractor::class, EnhancedGovernmentContractPdfExtractor::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        WebhookEvent::observe(WebhookEventObserver::class);
    }
}
