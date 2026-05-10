<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Unit;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UnitController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $query = Unit::with(['property.owner', 'parentUnit']);

        if ($oid = $request->input('owner_scope_id'))
            $query->whereHas('property', fn ($q) => $q->where('owner_id', $oid));
        if ($pid = $request->input('property_id')) $query->where('property_id', $pid);
        if ($st  = $request->input('status'))       $query->where('status', $st);
        if ($s   = $request->input('search'))
            $query->where(fn ($q) => $q
                ->where('unit_number', 'like', "%{$s}%")
                ->orWhereHas('property', fn ($p) => $p->where('name', 'like', "%{$s}%")));

        return $this->paginated($query->orderBy('id', 'desc')->paginate(min((int) $request->input('per_page', 25), 100)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'property_id'        => ['required', 'integer', 'exists:properties,id'],
            'parent_unit_id'     => ['nullable', 'integer', 'exists:units,id'],
            'unit_number'        => ['required', 'string', 'max:100'],
            'floor'              => ['nullable', 'string', 'max:100'],
            'type'               => ['nullable', 'string', 'in:apartment,studio,room,shop,office,warehouse,other'],
            'is_subdivided'      => ['nullable', 'boolean'],
            'rooms_count'        => ['nullable', 'integer', 'min:0'],
            'bathrooms_count'    => ['nullable', 'integer', 'min:0'],
            'has_kitchen'        => ['nullable', 'boolean'],
            'has_living_room'    => ['nullable', 'boolean'],
            'is_rooftop'         => ['nullable', 'boolean'],
            'orientation'        => ['nullable', 'string', 'max:50'],
            'rent_amount'        => ['nullable', 'numeric', 'min:0'],
            'status'             => ['nullable', 'string', 'in:available,rented,maintenance,reserved'],
            'notes'              => ['nullable', 'string', 'max:2000'],
        ]);

        $unit = Unit::create(array_merge(['type' => 'apartment', 'status' => 'available', 'rent_amount' => 0], $data));
        return $this->created($unit->load(['property.owner', 'parentUnit']), 'تمت إضافة الوحدة');
    }

    public function show(Unit $unit): JsonResponse
    {
        return $this->success($unit->load(['property.owner', 'parentUnit', 'childUnits']));
    }

    public function update(Request $request, Unit $unit): JsonResponse
    {
        $data = $request->validate([
            'unit_number'     => ['sometimes', 'required', 'string', 'max:100'],
            'floor'           => ['nullable', 'string', 'max:100'],
            'type'            => ['nullable', 'string', 'in:apartment,studio,room,shop,office,warehouse,other'],
            'rooms_count'     => ['nullable', 'integer', 'min:0'],
            'bathrooms_count' => ['nullable', 'integer', 'min:0'],
            'has_kitchen'     => ['nullable', 'boolean'],
            'has_living_room' => ['nullable', 'boolean'],
            'rent_amount'     => ['nullable', 'numeric', 'min:0'],
            'status'          => ['nullable', 'string', 'in:available,rented,maintenance,reserved'],
            'notes'           => ['nullable', 'string', 'max:2000'],
        ]);

        $unit->update($data);
        return $this->success($unit->fresh()->load('property.owner'), 'تم التحديث');
    }

    public function destroy(Unit $unit): JsonResponse
    {
        if (\App\Models\Contract::where('unit_id', $unit->id)->where('status', 'active')->exists())
            return $this->error('لا يمكن حذف وحدة لها عقود نشطة', 422);

        $unit->delete();
        return $this->success(null, 'تم الحذف');
    }
}
