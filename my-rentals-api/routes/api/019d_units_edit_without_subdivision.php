<?php

use App\Models\Property;
use App\Models\Unit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

if (!function_exists('my_rentals_unit_edit_fields_without_subdivision')) {
    function my_rentals_unit_edit_fields_without_subdivision(): array
    {
        return [
            'property_id', 'unit_number', 'floor', 'type',
            'rooms_count', 'bathrooms_count',
            'has_kitchen', 'kitchen_type', 'is_kitchen_installed',
            'has_living_room', 'is_rooftop', 'orientation',
            'rent_amount', 'status', 'notes',
        ];
    }
}

if (!function_exists('my_rentals_unit_edit_payload_without_subdivision')) {
    function my_rentals_unit_edit_payload_without_subdivision(Unit $unit): array
    {
        $fields = [];
        foreach (my_rentals_unit_edit_fields_without_subdivision() as $field) {
            $fields[$field] = $unit->{$field};
        }

        $title = implode(' - ', array_filter([
            $unit->unit_number,
            $unit->floor,
            $unit->status,
        ], fn ($value) => $value !== null && $value !== ''));

        return [
            'id' => $unit->id,
            'resource' => 'units',
            'resource_label' => 'الوحدات',
            'title' => $title ?: ('وحدة #' . $unit->id),
            'fields' => $fields,
            'values' => $fields,
            'raw' => $unit->toArray(),
            'editable_fields' => my_rentals_unit_edit_fields_without_subdivision(),
            'can_archive' => false,
        ];
    }
}

if (!function_exists('my_rentals_unit_edit_response_without_subdivision')) {
    function my_rentals_unit_edit_response_without_subdivision(Request $request)
    {
        $user = $request->user() ?: $request->input('_auth_user');
        $role = $user && method_exists($user, 'effectiveRole')
            ? strtolower(trim((string) $user->effectiveRole()))
            : strtolower(trim((string) ($user->role ?? 'owner')));
        $isAdmin = in_array($role, ['admin', 'manager', 'super_admin'], true);

        $query = Unit::query();

        if (!$isAdmin) {
            $propertyIds = Property::where('owner_id', $user?->owner_id ?: 0)->pluck('id');
            $query->whereIn('property_id', $propertyIds);
        }

        $id = $request->query('id');
        if ($id !== null && $id !== '') {
            $query->where('id', (int) $id);
        }

        $items = $query->orderByDesc('id')->limit($id ? 1 : 150)->get();

        return response()->json([
            'resource' => 'units',
            'resource_label' => 'الوحدات',
            'editable_fields' => my_rentals_unit_edit_fields_without_subdivision(),
            'items' => $items->map(fn (Unit $unit) => my_rentals_unit_edit_payload_without_subdivision($unit))->values(),
        ]);
    }
}

Route::get('/edit-delete-center/units', fn (Request $request) => my_rentals_unit_edit_response_without_subdivision($request));
Route::get('/my/edit-delete-center/units', fn (Request $request) => my_rentals_unit_edit_response_without_subdivision($request));
