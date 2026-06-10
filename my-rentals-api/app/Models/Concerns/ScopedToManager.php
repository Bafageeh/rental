<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;

trait ScopedToManager
{
    protected static function bootScopedToManager(): void
    {
        static::addGlobalScope('manager_data_scope', function (Builder $builder) {
            $user = Auth::user();
            if (! $user) return;

            $role = method_exists($user, 'effectiveRole')
                ? $user->effectiveRole()
                : strtolower(trim((string) ($user->role ?? '')));

            if ($role !== 'manager') return;

            $model = $builder->getModel();
            $table = $model->getTable();

            if (Schema::hasTable($table) && Schema::hasColumn($table, 'manager_id')) {
                $builder->where($table . '.manager_id', (int) $user->id);
            }
        });

        static::creating(function ($model) {
            $user = Auth::user();
            if (! $user) return;

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
