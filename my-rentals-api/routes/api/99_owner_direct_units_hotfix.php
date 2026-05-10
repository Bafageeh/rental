<?php

// Hotfix: include direct owner units (units.owner_id + unit_scope=owner) in owner lists and scoped unit lists.

use App\Models\Contract;
use App\Models\Owner;
use App\Models\Property;
use App\Models\Unit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (!function_exists('mrdu_has_table')) {
    function mrdu_has_table(string $table): bool
    {
        try {
            return Schema::hasTable($table);
        } catch (Throwable $e) {
            return false;
        }
    }
}

if (!function_exists('mrdu_has_col')) {
    function mrdu_has_col(string $table, string $column): bool
    {
        try {
            return Schema::hasColumn($table, $column);
        } catch (Throwable $e) {
            return false;
        }
    }
}

if (!function_exists('mrdu_owner_property_ids')) {
    function mrdu_owner_property_ids($ownerId)
    {
        if (!mrdu_has_table('properties') || !mrdu_has_col('properties', 'owner_id')) {
            return collect();
        }

        return Property::query()
            ->where('owner_id', $ownerId)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();
    }
}

if (!function_exists('mrdu_unit_query_for_owner')) {
    function mrdu_unit_query_for_owner($ownerId)
    {
        $query = Unit::query();

        if (!mrdu_has_table('units')) {
            return $query->whereRaw('1 = 0');
        }

        $propertyIds = mrdu_owner_property_ids($ownerId);
        $canUseOwnerId = mrdu_has_col('units', 'owner_id');
        $canUsePropertyId = mrdu_has_col('units', 'property_id') && $propertyIds->isNotEmpty();

        if (!$canUseOwnerId && !$canUsePropertyId) {
            return $query->whereRaw('1 = 0');
        }

        return $query->where(function ($q) use ($ownerId, $propertyIds, $canUseOwnerId, $canUsePropertyId) {
            $applied = false;

            if ($canUseOwnerId) {
                $q->where('owner_id', $ownerId);
                $applied = true;
            }

            if ($canUsePropertyId) {
                if ($applied) {
                    $q->orWhereIn('property_id', $propertyIds);
                } else {
                    $q->whereIn('property_id', $propertyIds);
                }
            }
        });
    }
}

if (!function_exists('mrdu_units_count_for_owner')) {
    function mrdu_units_count_for_owner($ownerId): int
    {
        return (int) mrdu_unit_query_for_owner($ownerId)->count();
    }
}

if (!function_exists('mrdu_unit_ids_for_owner')) {
    function mrdu_unit_ids_for_owner($ownerId)
    {
        return mrdu_unit_query_for_owner($ownerId)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();
    }
}

if (!function_exists('mrdu_contracts_count_for_owner')) {
    function mrdu_contracts_count_for_owner($ownerId): int
    {
        if (!mrdu_has_table('contracts') || !mrdu_has_col('contracts', 'unit_id')) {
            return 0;
        }

        $unitIds = mrdu_unit_ids_for_owner($ownerId);

        if ($unitIds->isEmpty()) {
            return 0;
        }

        return (int) Contract::query()->whereIn('unit_id', $unitIds)->count();
    }
}

if (!function_exists('mrdu_attach_owner_counts')) {
    function mrdu_attach_owner_counts($owner)
    {
        $owner->units_count = mrdu_units_count_for_owner($owner->id);
        $owner->contracts_count = mrdu_contracts_count_for_owner($owner->id);
        $owner->has_rental_assets = ((int) ($owner->properties_count ?? 0)) > 0 || $owner->units_count > 0 || $owner->contracts_count > 0;

        return $owner;
    }
}

if (!function_exists('mrdu_current_user')) {
    function mrdu_current_user(Request $request)
    {
        if (function_exists('my_rentals_current_user_for_scope')) {
            return my_rentals_current_user_for_scope($request);
        }

        if (function_exists('my_rentals_bearer_user')) {
            return my_rentals_bearer_user($request);
        }

        return $request->user();
    }
}

if (!function_exists('mrdu_is_admin_user')) {
    function mrdu_is_admin_user($user): bool
    {
        if (function_exists('my_rentals_is_admin_user')) {
            return my_rentals_is_admin_user($user);
        }

        $role = strtolower((string) ($user->role ?? ''));
        return in_array($role, ['admin', 'manager', 'super_admin'], true);
    }
}

Route::get('/owners', function () {
    return Owner::withCount('properties')
        ->orderBy('type')
        ->orderBy('name')
        ->get()
        ->map(fn ($owner) => mrdu_attach_owner_counts($owner))
        ->values();
});

Route::get('/my/owners', function (Request $request) {
    $user = mrdu_current_user($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $query = Owner::withCount('properties')
        ->orderBy('type')
        ->orderBy('name');

    if (!mrdu_is_admin_user($user)) {
        if (empty($user->owner_id)) {
            return collect();
        }

        $query->where('id', $user->owner_id);
    }

    return $query->get()
        ->map(fn ($owner) => mrdu_attach_owner_counts($owner))
        ->values();
});

Route::get('/my/units', function (Request $request) {
    $user = mrdu_current_user($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $query = Unit::with(['property.owner', 'parentUnit']);

    if (!mrdu_is_admin_user($user)) {
        if (empty($user->owner_id)) {
            return collect();
        }

        $propertyIds = mrdu_owner_property_ids($user->owner_id);
        $canUseOwnerId = mrdu_has_col('units', 'owner_id');
        $canUsePropertyId = mrdu_has_col('units', 'property_id') && $propertyIds->isNotEmpty();

        if (!$canUseOwnerId && !$canUsePropertyId) {
            return collect();
        }

        $query->where(function ($q) use ($user, $propertyIds, $canUseOwnerId, $canUsePropertyId) {
            $applied = false;

            if ($canUseOwnerId) {
                $q->where('owner_id', $user->owner_id);
                $applied = true;
            }

            if ($canUsePropertyId) {
                if ($applied) {
                    $q->orWhereIn('property_id', $propertyIds);
                } else {
                    $q->whereIn('property_id', $propertyIds);
                }
            }
        });
    }

    if ($request->filled('owner_id')) {
        $ownerId = (int) $request->input('owner_id');
        $propertyIds = mrdu_owner_property_ids($ownerId);
        $canUseOwnerId = mrdu_has_col('units', 'owner_id');
        $canUsePropertyId = mrdu_has_col('units', 'property_id') && $propertyIds->isNotEmpty();

        $query->where(function ($q) use ($ownerId, $propertyIds, $canUseOwnerId, $canUsePropertyId) {
            $applied = false;

            if ($canUseOwnerId) {
                $q->where('owner_id', $ownerId);
                $applied = true;
            }

            if ($canUsePropertyId) {
                if ($applied) {
                    $q->orWhereIn('property_id', $propertyIds);
                } else {
                    $q->whereIn('property_id', $propertyIds);
                }
            }
        });
    }

    if ($request->filled('property_id') && mrdu_has_col('units', 'property_id')) {
        $query->where('property_id', $request->integer('property_id'));
    }

    return $query
        ->orderBy('id', 'desc')
        ->get();
});
