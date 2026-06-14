<?php

use App\Models\Contract;
use App\Models\Owner;
use App\Models\Payment;
use App\Models\Property;
use App\Models\Tenant;
use App\Models\Unit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

if (is_file(__DIR__ . '/130_manager_data_scope.php')) require_once __DIR__ . '/130_manager_data_scope.php';
if (is_file(__DIR__ . '/132_targeted_lifecycle_push_observers.php')) require_once __DIR__ . '/132_targeted_lifecycle_push_observers.php';
if (is_file(__DIR__ . '/132_payment_update_push_listener.php')) require_once __DIR__ . '/132_payment_update_push_listener.php';

Route::get('/owners', function (Request $request) {
    $query = Owner::withCount('properties');
    mr_manager_scope_apply($query, 'owners', $request);

    return $query->orderBy('type')->orderBy('name')->get()->map(function ($owner) {
        $owner->units_count = Unit::whereHas('property', fn ($q) => $q->where('owner_id', $owner->id))->count();
        $owner->contracts_count = Contract::whereHas('unit.property', fn ($q) => $q->where('owner_id', $owner->id))->count();
        $owner->has_rental_assets = ($owner->properties_count ?? 0) > 0 || $owner->units_count > 0 || $owner->contracts_count > 0;
        return $owner;
    });
});

Route::post('/owners', function (Request $request) {
    $data = $request->validate([
        'name' => ['required', 'string', 'max:255'],
        'phone' => ['nullable', 'string', 'max:50'],
        'email' => ['nullable', 'email', 'max:255'],
        'national_id' => ['required', 'string', 'max:50'],
        'type' => ['nullable', 'string', 'max:50'],
        'notes' => ['nullable', 'string'],
    ], ['national_id.required' => 'رقم هوية المالك مطلوب لإنشاء حساب دخول تلقائي.']);

    $owner = Owner::create([
        'name' => $data['name'],
        'phone' => $data['phone'] ?? null,
        'email' => $data['email'] ?? null,
        'national_id' => trim((string) $data['national_id']),
        'type' => $data['type'] ?? 'external',
        'notes' => $data['notes'] ?? null,
    ]);
    mr_manager_scope_set_record('owners', $owner->id, $request);

    $account = null;
    $accountMessage = null;
    if (function_exists('my_rentals_create_or_link_owner_account')) {
        [$account, $accountMessage] = my_rentals_create_or_link_owner_account($owner->fresh());
    }

    return response()->json([
        'status' => 'ok',
        'message' => 'تم إضافة المالك بنجاح',
        'owner' => $owner->fresh(),
        'account' => $account,
        'account_message' => $accountMessage,
    ], 201);
});

Route::get('/properties', function (Request $request) {
    $query = Property::with(['owner'])->withCount(['units', 'parkingSpots', 'expenses', 'files']);
    mr_manager_scope_apply($query, 'properties', $request);

    if ($request->filled('owner_id')) {
        mr_manager_scope_abort_unless_record('owners', $request->integer('owner_id'), $request);
        $query->where('owner_id', $request->integer('owner_id'));
    }

    if ($request->filled('property_id')) $query->where('id', $request->integer('property_id'));

    return $query->orderBy('id', 'desc')->get();
});

Route::post('/properties', function (Request $request) {
    $data = $request->validate([
        'owner_id' => ['nullable', 'integer', 'exists:owners,id'],
        'name' => ['required', 'string', 'max:255'],
        'deed_number' => ['nullable', 'string', 'max:255'],
        'city' => ['nullable', 'string', 'max:255'],
        'district' => ['nullable', 'string', 'max:255'],
        'address' => ['nullable', 'string'],
        'property_area' => ['nullable', 'numeric', 'min:0'],
        'floors_count' => ['nullable', 'integer', 'min:0'],
        'parking_spots_count' => ['nullable', 'integer', 'min:0'],
        'elevators_count' => ['nullable', 'integer', 'min:0'],
        'rooms_count' => ['nullable', 'integer', 'min:0'],
        'bathrooms_count' => ['nullable', 'integer', 'min:0'],
        'property_type' => ['nullable', 'string', 'max:100'],
        'usage_type' => ['nullable', 'string', 'max:100'],
        'management_type' => ['nullable', 'string', 'max:100'],
        'default_unit_number' => ['nullable', 'string', 'max:100'],
        'notes' => ['nullable', 'string'],
    ]);

    $ownerId = $data['owner_id'] ?? null;
    if ($ownerId) mr_manager_scope_abort_unless_record('owners', $ownerId, $request);

    if (!$ownerId) {
        $self = Owner::where('type', 'self');
        mr_manager_scope_apply($self, 'owners', $request);
        $ownerId = $self->value('id');
        if (!$ownerId) {
            $owner = Owner::create(['name' => 'أملاكي الخاصة', 'type' => 'self']);
            mr_manager_scope_set_record('owners', $owner->id, $request);
            $ownerId = $owner->id;
        }
    }

    $propertyType = $data['property_type'] ?? 'building';
    $property = Property::create([
        'owner_id' => $ownerId,
        'name' => $data['name'],
        'deed_number' => $data['deed_number'] ?? null,
        'city' => $data['city'] ?? null,
        'district' => $data['district'] ?? null,
        'address' => $data['address'] ?? null,
        'property_area' => $data['property_area'] ?? null,
        'floors_count' => $data['floors_count'] ?? ($propertyType === 'apartment' ? 1 : 0),
        'parking_spots_count' => $data['parking_spots_count'] ?? 0,
        'elevators_count' => $data['elevators_count'] ?? 0,
        'property_type' => $propertyType,
        'usage_type' => $data['usage_type'] ?? 'residential',
        'management_type' => $data['management_type'] ?? 'owned',
        'notes' => $data['notes'] ?? null,
    ]);
    mr_manager_scope_set_record('properties', $property->id, $request);

    $defaultUnit = null;
    if ($propertyType === 'apartment') {
        $defaultUnit = Unit::firstOrCreate(
            ['property_id' => $property->id, 'unit_number' => $data['default_unit_number'] ?? 'الشقة'],
            ['floor' => null, 'type' => 'apartment', 'is_subdivided' => false, 'rooms_count' => $data['rooms_count'] ?? 0, 'bathrooms_count' => $data['bathrooms_count'] ?? 0, 'rent_amount' => 0, 'status' => 'available']
        );
        mr_manager_scope_set_record('units', $defaultUnit->id, $request);
    }

    return response()->json(['status' => 'ok', 'message' => 'تم إضافة العقار بنجاح', 'property' => $property->fresh()->load('owner'), 'default_unit' => $defaultUnit], 201);
});

Route::get('/properties/{property}', function (Request $request, Property $property) {
    mr_manager_scope_abort_unless_record('properties', $property->id, $request);
    return $property->load(['owner', 'units.childUnits', 'units.contracts', 'parkingSpots', 'expenses.category', 'files']);
});

Route::get('/units', function (Request $request) {
    $query = Unit::with(['property.owner', 'parentUnit']);
    mr_manager_scope_apply($query, 'units', $request);

    if ($request->filled('owner_id')) {
        mr_manager_scope_abort_unless_record('owners', $request->integer('owner_id'), $request);
        $query->whereHas('property', fn ($q) => $q->where('owner_id', $request->integer('owner_id')));
    }
    if ($request->filled('property_id')) {
        mr_manager_scope_abort_unless_record('properties', $request->integer('property_id'), $request);
        $query->where('property_id', $request->integer('property_id'));
    }

    return $query->orderBy('id', 'desc')->get();
});

Route::post('/units', function (Request $request) {
    $data = $request->validate([
        'property_id' => ['required', 'integer', 'exists:properties,id'],
        'parent_unit_id' => ['nullable', 'integer', 'exists:units,id'],
        'unit_number' => ['required', 'string', 'max:100'],
        'floor' => ['nullable', 'string', 'max:100'],
        'type' => ['nullable', 'string', 'max:100'],
        'rent_amount' => ['nullable', 'numeric', 'min:0'],
        'status' => ['nullable', 'string', 'max:50'],
        'notes' => ['nullable', 'string'],
    ]);
    mr_manager_scope_abort_unless_record('properties', $data['property_id'], $request);
    if (!empty($data['parent_unit_id'])) mr_manager_scope_abort_unless_record('units', $data['parent_unit_id'], $request);

    $unit = Unit::create([
        'property_id' => $data['property_id'],
        'parent_unit_id' => $data['parent_unit_id'] ?? null,
        'unit_number' => $data['unit_number'],
        'floor' => $data['floor'] ?? null,
        'type' => $data['type'] ?? 'apartment',
        'rent_amount' => $data['rent_amount'] ?? 0,
        'status' => $data['status'] ?? 'available',
        'notes' => $data['notes'] ?? null,
    ]);
    mr_manager_scope_set_record('units', $unit->id, $request);

    return response()->json(['status' => 'ok', 'message' => 'تم إضافة الوحدة بنجاح', 'unit' => $unit->fresh()->load(['property.owner', 'parentUnit'])], 201);
});

Route::get('/tenants', function (Request $request) {
    $query = Tenant::withCount(['contracts', 'contractFiles']);
    mr_manager_scope_apply($query, 'tenants', $request);
    return $query->orderBy('id', 'desc')->get();
});

Route::post('/tenants', function (Request $request) {
    $data = $request->validate([
        'name' => ['required', 'string', 'max:255'],
        'phone' => ['nullable', 'string', 'max:50'],
        'email' => ['nullable', 'email', 'max:255'],
        'national_id' => ['nullable', 'string', 'max:50'],
        'nationality' => ['nullable', 'string', 'max:100'],
        'address' => ['nullable', 'string'],
        'notes' => ['nullable', 'string'],
    ]);
    $tenant = Tenant::create([
        'name' => $data['name'], 'phone' => $data['phone'] ?? null, 'email' => $data['email'] ?? null,
        'national_id' => $data['national_id'] ?? null, 'nationality' => $data['nationality'] ?? null,
        'address' => $data['address'] ?? null, 'notes' => $data['notes'] ?? null,
    ]);
    mr_manager_scope_set_record('tenants', $tenant->id, $request);
    return response()->json(['status' => 'ok', 'message' => 'تم إضافة المستأجر بنجاح', 'tenant' => $tenant->fresh()], 201);
});

Route::get('/contracts', function (Request $request) {
    $query = Contract::with(['tenant', 'unit.property.owner', 'parkingSpot', 'files', 'payments' => fn ($q) => $q->orderBy('due_date')]);
    mr_manager_scope_apply($query, 'contracts', $request);

    if ($request->filled('property_id')) {
        mr_manager_scope_abort_unless_record('properties', $request->integer('property_id'), $request);
        $query->whereHas('unit', fn ($q) => $q->where('property_id', $request->integer('property_id')));
    }
    if ($request->filled('unit_id')) {
        mr_manager_scope_abort_unless_record('units', $request->integer('unit_id'), $request);
        $query->where('unit_id', $request->integer('unit_id'));
    }

    return $query->orderBy('id', 'desc')->get();
});

Route::get('/contracts/{contract}', function (Request $request, Contract $contract) {
    mr_manager_scope_abort_unless_record('contracts', $contract->id, $request);
    $loaded = $contract->load(['tenant', 'unit.property.owner', 'parkingSpot', 'files', 'payments' => fn ($q) => $q->orderBy('due_date')->orderBy('id')]);
    return function_exists('mr_contract_apply_running_payment_status') ? mr_contract_apply_running_payment_status($loaded) : $loaded;
});

Route::get('/payments', function (Request $request) {
    $query = Payment::with(['contract.tenant', 'contract.unit.property.owner']);
    mr_manager_scope_apply($query, 'payments', $request);
    return $query->orderBy('due_date')->get();
});

if (is_file(__DIR__ . '/132_edit_delete_center_compact_expenses.php')) require __DIR__ . '/132_edit_delete_center_compact_expenses.php';
