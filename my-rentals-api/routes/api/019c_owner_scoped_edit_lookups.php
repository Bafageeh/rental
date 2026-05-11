<?php

use App\Models\Contract;
use App\Models\Owner;
use App\Models\Property;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

if (!function_exists('my_rentals_owner_scoped_lookup_user')) {
    function my_rentals_owner_scoped_lookup_user(Request $request): ?User
    {
        $user = $request->user();
        if ($user instanceof User) {
            return $user;
        }

        $merged = $request->input('_auth_user');
        if ($merged instanceof User) {
            return $merged;
        }

        if (function_exists('my_rentals_current_user_for_scope')) {
            $scoped = my_rentals_current_user_for_scope($request);
            if ($scoped instanceof User) {
                return $scoped;
            }
        }

        if (function_exists('my_rentals_bearer_user')) {
            $bearer = my_rentals_bearer_user($request);
            if ($bearer instanceof User) {
                return $bearer;
            }
        }

        return null;
    }
}

if (!function_exists('my_rentals_owner_scoped_lookup_is_admin')) {
    function my_rentals_owner_scoped_lookup_is_admin(?User $user): bool
    {
        if (!$user) {
            return false;
        }

        if (function_exists('my_rentals_is_admin_user')) {
            return my_rentals_is_admin_user($user);
        }

        $role = method_exists($user, 'effectiveRole')
            ? strtolower(trim((string) $user->effectiveRole()))
            : strtolower(trim((string) ($user->role ?? 'owner')));

        return in_array($role, ['admin', 'manager', 'super_admin'], true);
    }
}

if (!function_exists('my_rentals_owner_scoped_lookup_option')) {
    function my_rentals_owner_scoped_lookup_option($id, string $label, array $extra = []): array
    {
        return array_merge(['id' => $id, 'label' => $label], $extra);
    }
}

if (!function_exists('my_rentals_owner_id_from_edit_context')) {
    function my_rentals_owner_id_from_edit_context(Request $request, ?User $user, bool $isAdmin): ?int
    {
        if (!$isAdmin) {
            return $user?->owner_id ? (int) $user->owner_id : null;
        }

        $directOwnerId = $request->query('owner_id');
        if ($directOwnerId !== null && $directOwnerId !== '') {
            return (int) $directOwnerId;
        }

        $resource = trim((string) $request->query('resource', ''));
        $id = (int) $request->query('id', 0);

        if ($id <= 0) {
            return null;
        }

        if (in_array($resource, ['owners', 'owner'], true)) {
            return $id;
        }

        if (in_array($resource, ['properties', 'property'], true)) {
            return Property::where('id', $id)->value('owner_id') ?: null;
        }

        if (in_array($resource, ['units', 'unit'], true)) {
            $propertyId = Unit::where('id', $id)->value('property_id');
            return $propertyId ? (Property::where('id', $propertyId)->value('owner_id') ?: null) : null;
        }

        if (in_array($resource, ['contracts', 'contract'], true)) {
            $unitId = Contract::where('id', $id)->value('unit_id');
            if (!$unitId) {
                return null;
            }
            $propertyId = Unit::where('id', $unitId)->value('property_id');
            return $propertyId ? (Property::where('id', $propertyId)->value('owner_id') ?: null) : null;
        }

        return null;
    }
}

if (!function_exists('my_rentals_owner_scoped_edit_lookups')) {
    function my_rentals_owner_scoped_edit_lookups(Request $request)
    {
        $user = my_rentals_owner_scoped_lookup_user($request);
        $isAdmin = my_rentals_owner_scoped_lookup_is_admin($user);
        $contextOwnerId = my_rentals_owner_id_from_edit_context($request, $user, $isAdmin);

        $owners = Owner::query();
        if ($contextOwnerId) {
            $owners->where('id', $contextOwnerId);
        } elseif (!$isAdmin) {
            $owners->where('id', $user?->owner_id ?: 0);
        }

        $properties = Property::query();
        if ($contextOwnerId) {
            $properties->where('owner_id', $contextOwnerId);
        } elseif (!$isAdmin) {
            $properties->where('owner_id', $user?->owner_id ?: 0);
        }

        $propertyIds = (clone $properties)->pluck('id');

        $units = Unit::query();
        if ($contextOwnerId || !$isAdmin) {
            $units->whereIn('property_id', $propertyIds);
        }

        $unitIds = (clone $units)->pluck('id');

        $contracts = Contract::query();
        if ($contextOwnerId || !$isAdmin) {
            $contracts->whereIn('unit_id', $unitIds);
        }

        $tenantIds = (clone $contracts)->whereNotNull('tenant_id')->pluck('tenant_id')->unique()->values();

        $tenants = Tenant::query();
        if ($contextOwnerId || !$isAdmin) {
            $tenants->whereIn('id', $tenantIds);
        }

        return response()->json([
            'owners' => $owners->orderBy('name')->limit(500)->get()->map(fn ($item) => my_rentals_owner_scoped_lookup_option($item->id, $item->name ?: ('مالك #' . $item->id)))->values(),
            'properties' => $properties->orderBy('id')->limit(500)->get()->map(fn ($item) => my_rentals_owner_scoped_lookup_option($item->id, ($item->name ?? $item->title ?? ('عقار #' . $item->id)), ['owner_id' => $item->owner_id]))->values(),
            'units' => $units->orderBy('id')->limit(800)->get()->map(fn ($item) => my_rentals_owner_scoped_lookup_option($item->id, 'وحدة ' . ($item->unit_number ?: $item->id), ['property_id' => $item->property_id]))->values(),
            'tenants' => $tenants->orderBy('name')->limit(800)->get()->map(fn ($item) => my_rentals_owner_scoped_lookup_option($item->id, ($item->name ?: ('مستأجر #' . $item->id))))->values(),
            'contracts' => $contracts->orderByDesc('id')->limit(800)->get()->map(fn ($item) => my_rentals_owner_scoped_lookup_option($item->id, 'عقد ' . ($item->contract_number ?: $item->id), ['unit_id' => $item->unit_id, 'tenant_id' => $item->tenant_id]))->values(),
        ]);
    }
}

Route::get('/edit-delete-center/lookups', fn (Request $request) => my_rentals_owner_scoped_edit_lookups($request));
Route::get('/my/edit-delete-center/lookups', fn (Request $request) => my_rentals_owner_scoped_edit_lookups($request));
