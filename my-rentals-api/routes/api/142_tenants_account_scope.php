<?php

use App\Models\Tenant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (is_file(__DIR__ . '/130_manager_data_scope.php')) require_once __DIR__ . '/130_manager_data_scope.php';

if (!function_exists('mr_tenants_current_account_query')) {
    function mr_tenants_current_account_query(Request $request)
    {
        $query = Tenant::withCount(['contracts', 'contractFiles']);
        $user = $request->user();
        $role = function_exists('mr_manager_scope_role') ? mr_manager_scope_role($user) : strtolower(trim((string) ($user->role ?? '')));

        if ($role === 'manager') {
            $managerId = (int) ($user->id ?? 0);
            $query->where(function ($q) use ($managerId) {
                if (Schema::hasColumn('tenants', 'manager_id')) {
                    $q->where('tenants.manager_id', $managerId);
                }

                $q->orWhereHas('contracts', function ($contractQuery) use ($managerId) {
                    if (Schema::hasColumn('contracts', 'manager_id')) {
                        $contractQuery->where('contracts.manager_id', $managerId);
                    }

                    $contractQuery->orWhereHas('unit', function ($unitQuery) use ($managerId) {
                        if (Schema::hasColumn('units', 'manager_id')) {
                            $unitQuery->where('units.manager_id', $managerId);
                        }

                        $unitQuery->orWhereHas('property', function ($propertyQuery) use ($managerId) {
                            if (Schema::hasColumn('properties', 'manager_id')) {
                                $propertyQuery->where('properties.manager_id', $managerId);
                            }

                            $propertyQuery->orWhereHas('owner', function ($ownerQuery) use ($managerId) {
                                if (Schema::hasColumn('owners', 'manager_id')) {
                                    $ownerQuery->where('owners.manager_id', $managerId);
                                } else {
                                    $ownerQuery->whereRaw('1 = 0');
                                }
                            });
                        });
                    });
                });
            });
        } elseif ($role === 'owner') {
            $ownerId = (int) ($user->owner_id ?? 0);
            if ($ownerId > 0) {
                $query->whereHas('contracts.unit.property', fn ($propertyQuery) => $propertyQuery->where('owner_id', $ownerId));
            } else {
                $query->whereRaw('1 = 0');
            }
        }

        if ($request->filled('search')) {
            $term = trim((string) $request->input('search'));
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', "%{$term}%")
                    ->orWhere('phone', 'like', "%{$term}%")
                    ->orWhere('national_id', 'like', "%{$term}%");
            });
        }

        return $query;
    }
}

if (!function_exists('mr_tenants_current_account_index')) {
    function mr_tenants_current_account_index(Request $request)
    {
        return mr_tenants_current_account_query($request)
            ->orderBy('id', 'desc')
            ->get();
    }
}

Route::get('/tenants', fn (Request $request) => mr_tenants_current_account_index($request));
Route::get('/my/tenants', fn (Request $request) => mr_tenants_current_account_index($request));
