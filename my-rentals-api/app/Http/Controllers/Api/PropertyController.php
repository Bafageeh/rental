<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Owner;
use App\Models\Property;
use App\Models\Unit;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PropertyController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $query = Property::with('owner')->withCount(['units', 'parkingSpots', 'expenses', 'files']);

        if ($oid = $request->input('owner_scope_id')) $query->where('owner_id', $oid);
        if ($s = $request->input('search')) {
            $query->where(fn ($q) => $q
                ->where('name', 'like', "%{$s}%")
                ->orWhere('city', 'like', "%{$s}%")
                ->orWhere('district', 'like', "%{$s}%")
                ->orWhere('deed_number', 'like', "%{$s}%"));
        }
        if ($t = $request->input('property_type')) $query->where('property_type', $t);
        if ($o = $request->input('owner_id')) $query->where('owner_id', $o);

        return $this->paginated($query->orderBy('id', 'desc')->paginate(min((int) $request->input('per_page', 25), 100)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'owner_id'            => ['nullable', 'integer', 'exists:owners,id'],
            'name'                => ['required', 'string', 'max:255'],
            'deed_number'         => ['nullable', 'string', 'max:255'],
            'city'                => ['nullable', 'string', 'max:255'],
            'district'            => ['nullable', 'string', 'max:255'],
            'address'             => ['nullable', 'string'],
            'national_short_address' => ['nullable', 'string', 'max:8', 'regex:/^[A-Za-z0-9]+$/'],
            'property_area'       => ['nullable', 'numeric', 'min:0'],
            'floors_count'        => ['nullable', 'integer', 'min:0'],
            'parking_spots_count' => ['nullable', 'integer', 'min:0'],
            'elevators_count'     => ['nullable', 'integer', 'min:0'],
            'property_type'       => ['nullable', 'string', 'in:building,apartment,villa,land,commercial,other'],
            'usage_type'          => ['nullable', 'string', 'in:residential,commercial,mixed'],
            'management_type'     => ['nullable', 'string', 'in:owned,managed'],
            'default_unit_number' => ['nullable', 'string', 'max:100'],
            'notes'               => ['nullable', 'string', 'max:2000'],
        ]);

        $ownerId      = $data['owner_id'] ?? $this->selfOwnerId();
        $propertyType = $data['property_type'] ?? 'building';

        $property = Property::create(array_merge($data, [
            'owner_id'      => $ownerId,
            'property_type' => $propertyType,
            'usage_type'    => $data['usage_type'] ?? 'residential',
            'management_type' => $data['management_type'] ?? 'owned',
            'floors_count'  => $data['floors_count'] ?? ($propertyType === 'apartment' ? 1 : 0),
        ]));

        $defaultUnit = null;
        if ($propertyType === 'apartment') {
            $defaultUnit = Unit::create([
                'property_id' => $property->id,
                'unit_number' => $data['default_unit_number'] ?? 'الشقة',
                'type'        => 'apartment',
                'status'      => 'available',
            ]);
        }

        return $this->created([
            'property'     => $property->load('owner'),
            'default_unit' => $defaultUnit,
        ], $propertyType === 'apartment' ? 'تم إضافة الشقة' : 'تم إضافة العقار');
    }

    public function show(Property $property): JsonResponse
    {
        return $this->success($property->load(['owner', 'units.childUnits', 'parkingSpots', 'expenses.category', 'files']));
    }

    public function update(Request $request, Property $property): JsonResponse
    {
        $data = $request->validate([
            'owner_id'        => ['sometimes', 'integer', 'exists:owners,id'],
            'name'            => ['sometimes', 'required', 'string', 'max:255'],
            'deed_number'     => ['nullable', 'string', 'max:255'],
            'city'            => ['nullable', 'string', 'max:255'],
            'district'        => ['nullable', 'string', 'max:255'],
            'address'         => ['nullable', 'string'],
            'national_short_address' => ['nullable', 'string', 'max:8', 'regex:/^[A-Za-z0-9]+$/'],
            'property_area'    => ['nullable', 'numeric', 'min:0'],
            'floors_count'    => ['nullable', 'integer', 'min:0'],
            'property_type'   => ['nullable', 'string', 'in:building,apartment,villa,land,commercial,other'],
            'usage_type'      => ['nullable', 'string', 'in:residential,commercial,mixed'],
            'management_type' => ['nullable', 'string', 'in:owned,managed'],
            'notes'           => ['nullable', 'string', 'max:2000'],
        ]);

        $property->update($data);
        return $this->success($property->fresh()->load('owner'), 'تم التحديث');
    }

    public function destroy(Property $property): JsonResponse
    {
        if ($property->units()->exists()) {
            return $this->error('لا يمكن حذف عقار يحتوي وحدات', 422);
        }
        $property->delete();
        return $this->success(null, 'تم الحذف');
    }

    private function selfOwnerId(): int
    {
        return Owner::firstOrCreate(['type' => 'self'], ['name' => 'أملاكي الخاصة'])->id;
    }
}
