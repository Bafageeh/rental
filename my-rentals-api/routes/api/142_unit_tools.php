<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (is_file(__DIR__ . '/130_manager_data_scope.php')) require_once __DIR__ . '/130_manager_data_scope.php';

function mru_tools_scope_property_ids(Request $request): array
{
    if (!Schema::hasTable('properties')) return [];
    $user = $request->user();
    $role = $user && function_exists('mr_manager_scope_role') ? mr_manager_scope_role($user) : strtolower((string) ($user->role ?? ''));
    $isAdmin = in_array($role, ['admin', 'super_admin'], true) || (bool) ($user->is_admin ?? false);
    if ($isAdmin) return DB::table('properties')->pluck('id')->map(fn($id) => (int) $id)->all();
    if ($role === 'manager' && function_exists('mr_manager_scope_property_ids')) return mr_manager_scope_property_ids($request);
    if (!empty($user->owner_id) && Schema::hasColumn('properties', 'owner_id')) return DB::table('properties')->where('owner_id', $user->owner_id)->pluck('id')->map(fn($id) => (int) $id)->all();
    return [];
}

function mru_tools_money($v): float
{
    return is_numeric($v) ? (float) $v : 0.0;
}

$unitListings = function (Request $request) {
    $propertyIds = mru_tools_scope_property_ids($request);
    if (!$propertyIds || !Schema::hasTable('units')) return response()->json([]);
    $activeUnitIds = Schema::hasTable('contracts') ? DB::table('contracts')->whereIn('status', ['active', 'نشط'])->pluck('unit_id')->filter()->all() : [];
    $rows = DB::table('units as u')
        ->leftJoin('properties as p', 'p.id', '=', 'u.property_id')
        ->leftJoin('owners as o', 'o.id', '=', 'p.owner_id')
        ->whereIn('u.property_id', $propertyIds)
        ->when($activeUnitIds, fn($q) => $q->whereNotIn('u.id', $activeUnitIds))
        ->select(['u.*', 'p.id as property_id2', 'p.name as property_name', 'p.city', 'p.district', 'p.address', 'p.property_type', 'o.name as owner_name', 'o.phone as owner_phone'])
        ->orderBy('p.name')->orderBy('u.unit_number')->get();
    return response()->json($rows->map(function ($r) {
        $rent = mru_tools_money($r->rent_amount ?? 0);
        return [
            'id' => (int) $r->id,
            'unit_number' => $r->unit_number,
            'floor' => $r->floor,
            'type' => $r->type,
            'status' => $r->status,
            'rent_amount' => $rent,
            'rooms_count' => (int) ($r->rooms_count ?? 0),
            'bathrooms_count' => (int) ($r->bathrooms_count ?? 0),
            'has_kitchen' => (bool) ($r->has_kitchen ?? false),
            'kitchen_type' => $r->kitchen_type ?? null,
            'is_kitchen_installed' => isset($r->is_kitchen_installed) ? (bool) $r->is_kitchen_installed : null,
            'has_living_room' => (bool) ($r->has_living_room ?? false),
            'is_rooftop' => (bool) ($r->is_rooftop ?? false),
            'orientation' => $r->orientation ?? null,
            'listing_text' => "وحدة متاحة للإيجار\nالعقار: " . ($r->property_name ?: '-') . "\nالوحدة: " . ($r->unit_number ?: '-') . "\nالإيجار: " . number_format($rent, 0) . " ريال",
            'property' => ['id' => (int) ($r->property_id2 ?? $r->property_id), 'name' => $r->property_name, 'city' => $r->city, 'district' => $r->district, 'address' => $r->address, 'property_type' => $r->property_type, 'owner_name' => $r->owner_name, 'owner_phone' => $r->owner_phone],
        ];
    })->values());
};

$unitInspections = function (Request $request) {
    $propertyIds = mru_tools_scope_property_ids($request);
    if (!$propertyIds || !Schema::hasTable('unit_inspections')) return response()->json([]);
    return response()->json(DB::table('unit_inspections as i')
        ->leftJoin('properties as p', 'p.id', '=', 'i.property_id')
        ->leftJoin('owners as o', 'o.id', '=', 'p.owner_id')
        ->leftJoin('units as u', 'u.id', '=', 'i.unit_id')
        ->leftJoin('tenants as t', 't.id', '=', 'i.tenant_id')
        ->whereIn('i.property_id', $propertyIds)
        ->select(['i.*', 'p.name as property_name', 'o.name as owner_name', 'u.unit_number', 't.name as tenant_name'])
        ->orderByDesc('i.inspection_date')->orderByDesc('i.id')->get());
};

Route::get('/unit-listings', $unitListings);
Route::get('/my/unit-listings', $unitListings);
Route::get('/unit-inspections', $unitInspections);
Route::get('/my/unit-inspections', $unitInspections);
