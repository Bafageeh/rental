<?php

namespace App\Providers;

use App\Models\Contract;
use App\Models\Owner;
use App\Models\Payment;
use App\Models\Property;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\WebhookEvent;
use App\Observers\WebhookEventObserver;
use App\Services\EnhancedGovernmentContractImporter;
use App\Services\EnhancedGovernmentContractPdfExtractor;
use App\Services\GovernmentContractImporter;
use App\Services\GovernmentContractPdfExtractor;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(GovernmentContractPdfExtractor::class, EnhancedGovernmentContractPdfExtractor::class);
        $this->app->bind(GovernmentContractImporter::class, EnhancedGovernmentContractImporter::class);
    }

    public function boot(): void
    {
        WebhookEvent::observe(WebhookEventObserver::class);
        $this->applyManagerDataScopes();
    }

    private function applyManagerDataScopes(): void
    {
        foreach ([Owner::class, Property::class, Unit::class, Tenant::class, Contract::class, Payment::class] as $modelClass) {
            $modelClass::addGlobalScope('manager_data_scope', function (Builder $builder) {
                $user = Auth::user();
                if (!$user) return;

                $role = method_exists($user, 'effectiveRole')
                    ? $user->effectiveRole()
                    : strtolower(trim((string) ($user->role ?? '')));

                if ($role !== 'manager') return;

                $table = $builder->getModel()->getTable();
                if (Schema::hasTable($table) && Schema::hasColumn($table, 'manager_id')) {
                    $builder->where($table . '.manager_id', (int) $user->id);
                }
            });

            $modelClass::creating(function ($model) {
                $user = Auth::user();
                if (!$user) return;

                $role = method_exists($user, 'effectiveRole')
                    ? $user->effectiveRole()
                    : strtolower(trim((string) ($user->role ?? '')));

                if ($role !== 'manager') return;

                $table = $model->getTable();
                if (Schema::hasTable($table) && Schema::hasColumn($table, 'manager_id') && empty($model->manager_id)) {
                    $model->manager_id = (int) $user->id;
                }
            });
        }
    }
}
