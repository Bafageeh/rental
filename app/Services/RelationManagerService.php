<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RelationManagerService
{
    public function options(Request $request)
    {
        $ownerScopeId = mr_request_owner_scope_id($request);

        if ($ownerScopeId === 0) {
            return mr_owner_scope_forbidden_response();
        }

        return response()->json(mr_relation_options_array($ownerScopeId));
    }

    public function createProperty(Request $request)
    {
        if (!mr_has_table('properties')) {
            return response()->json(['message' => 'جدول العقارات غير موجود'], 422);
        }

        $ownerScopeId = mr_request_owner_scope_id($request);

        if ($ownerScopeId === 0) {
            return mr_owner_scope_forbidden_response();
        }

        if ($ownerScopeId !== null) {
            $request->merge(['owner_id' => $ownerScopeId]);
        }

        $ownerId = $request->input('owner_id');
        $title = trim((string) ($request->input('title') ?: $request->input('name') ?: ''));

        if (!$ownerId) {
            return response()->json(['message' => 'يجب اختيار المالك'], 422);
        }

        if (mr_has_table('owners') && !DB::table('owners')->where('id', $ownerId)->exists()) {
            return response()->json(['message' => 'المالك غير موجود'], 404);
        }

        if ($title === '') {
            return response()->json(['message' => 'يجب كتابة اسم أو عنوان العقار'], 422);
        }

        $data = [];
        mr_set_if_column($data, 'properties', 'owner_id', $ownerId);
        mr_set_if_column($data, 'properties', 'title', $title);
        mr_set_if_column($data, 'properties', 'name', $title);
        mr_set_if_column($data, 'properties', 'property_name', $title);
        mr_set_if_column($data, 'properties', 'property_type', $request->input('property_type'), true);
        mr_set_if_column($data, 'properties', 'management_type', $request->input('management_type'), true);
        mr_set_if_column($data, 'properties', 'city', $request->input('city'), true);
        mr_set_if_column($data, 'properties', 'district', $request->input('district'), true);
        mr_set_if_column($data, 'properties', 'address', $request->input('address'), true);
        mr_set_if_column($data, 'properties', 'deed_number', $request->input('deed_number'), true);
        mr_set_if_column($data, 'properties', 'floors_count', $request->input('floors_count'), true);
        mr_set_if_column($data, 'properties', 'parking_spots_count', $request->input('parking_spots_count'), true);
        mr_touch_columns($data, 'properties', true);

        $id = DB::table('properties')->insertGetId($data);

        return response()->json([
            'message' => 'تم إنشاء العقار وربطه بالمالك',
            'id' => $id,
            'options' => mr_relation_options_array($ownerScopeId),
        ]);
    }

    public function createUnit(Request $request)
    {
        if (!mr_has_table('units')) {
            return response()->json(['message' => 'جدول الوحدات غير موجود'], 422);
        }

        $ownerScopeId = mr_request_owner_scope_id($request);

        if ($ownerScopeId === 0) {
            return mr_owner_scope_forbidden_response();
        }

        if ($ownerScopeId !== null) {
            $request->merge(['owner_id' => $ownerScopeId]);
        }

        $ownerId = $request->input('owner_id');
        $propertyId = $request->input('property_id');
        $unitScope = $request->input('unit_scope') ?: ($propertyId ? 'property' : 'owner');
        $unitNumber = trim((string) ($request->input('unit_number') ?: $request->input('title') ?: $request->input('name') ?: ''));

        if (!$ownerId) {
            return response()->json(['message' => 'يجب اختيار المالك'], 422);
        }

        if (mr_has_table('owners') && !DB::table('owners')->where('id', $ownerId)->exists()) {
            return response()->json(['message' => 'المالك غير موجود'], 404);
        }

        if ($unitScope === 'property') {
            if (!$propertyId) {
                return response()->json(['message' => 'يجب اختيار العقار إذا كانت الوحدة داخل عقار/عمارة'], 422);
            }

            if (mr_has_table('properties')) {
                $property = DB::table('properties')->where('id', $propertyId)->first();

                if (!$property) {
                    return response()->json(['message' => 'العقار غير موجود'], 404);
                }

                if (isset($property->owner_id) && (string) $property->owner_id !== (string) $ownerId) {
                    return response()->json(['message' => 'العقار المختار لا يتبع المالك المحدد'], 422);
                }
            }
        } else {
            $propertyId = null;
            $unitScope = 'owner';
        }

        if ($unitNumber === '') {
            return response()->json(['message' => 'يجب كتابة رقم الوحدة'], 422);
        }

        $data = [];
        mr_set_if_column($data, 'units', 'property_id', $propertyId);
        mr_set_if_column($data, 'units', 'owner_id', $ownerId);
        mr_set_if_column($data, 'units', 'unit_scope', $unitScope);
        mr_set_if_column($data, 'units', 'unit_number', $unitNumber);
        mr_set_if_column($data, 'units', 'title', $unitNumber);
        mr_set_if_column($data, 'units', 'name', $unitNumber);
        mr_set_if_column($data, 'units', 'type', $request->input('type'), true);
        mr_set_if_column($data, 'units', 'status', $request->input('status'), true);
        mr_set_if_column($data, 'units', 'floor', $request->input('floor'), true);
        mr_set_if_column($data, 'units', 'rent_amount', $request->input('rent_amount'), true);
        mr_set_if_column($data, 'units', 'rooms_count', $request->input('rooms_count'), true);
        mr_set_if_column($data, 'units', 'bathrooms_count', $request->input('bathrooms_count'), true);
        mr_set_if_column($data, 'units', 'notes', $request->input('notes'), true);
        mr_touch_columns($data, 'units', true);

        $id = DB::table('units')->insertGetId($data);

        return response()->json([
            'message' => 'تم إنشاء الوحدة وربطها بالمالك',
            'id' => $id,
            'options' => mr_relation_options_array($ownerScopeId),
        ]);
    }

    public function cleanupOrphanProperties()
    {
        if (!mr_has_table('properties') || !mr_has_col('properties', 'owner_id')) {
            return response()->json(['message' => 'لا يوجد حقل مالك في جدول العقارات', 'deleted' => ['properties' => 0]]);
        }

        $query = DB::table('properties')->where(function ($q) {
            $q->whereNull('owner_id')->orWhere('owner_id', '')->orWhere('owner_id', 0);
        });

        if (mr_has_table('owners')) {
            $ownerIds = DB::table('owners')->pluck('id')->map(fn($v) => (string) $v)->all();

            if (count($ownerIds) > 0) {
                $query->orWhere(function ($q) use ($ownerIds) {
                    $q->whereNotNull('owner_id')->where('owner_id', '!=', '')->whereNotIn('owner_id', $ownerIds);
                });
            }
        }

        $propertyIds = $query->pluck('id')->map(fn($v) => (int) $v)->all();
        $deleted = mr_delete_properties_cascade($propertyIds);

        return response()->json([
            'message' => 'تم حذف العقارات التي ليس لها مالك',
            'deleted' => $deleted,
            'options' => mr_relation_options_array(),
        ]);
    }

    public function deleteOwnerCascade(Request $request, $ownerId = null)
    {
        $ownerId = $ownerId ?: $request->input('owner_id');

        if (!$ownerId || !mr_has_table('owners') || !DB::table('owners')->where('id', $ownerId)->exists()) {
            return response()->json(['message' => 'المالك غير موجود'], 404);
        }

        $propertyIds = [];
        if (mr_has_table('properties') && mr_has_col('properties', 'owner_id')) {
            $propertyIds = DB::table('properties')->where('owner_id', $ownerId)->pluck('id')->map(fn($v) => (int) $v)->all();
        }

        $deleted = mr_delete_properties_cascade($propertyIds);

        if (mr_has_table('units') && mr_has_col('units', 'owner_id')) {
            $directUnitIds = DB::table('units')
                ->where('owner_id', $ownerId)
                ->where(function ($q) {
                    $q->whereNull('property_id')->orWhere('property_id', '')->orWhere('property_id', 0);
                })
                ->pluck('id')
                ->map(fn($v) => (int) $v)
                ->all();

            $deleted['direct_units'] = mr_soft_or_hard_delete_by_id('units', $directUnitIds);
        }

        foreach (['owner_bank_accounts', 'owner_payouts'] as $table) {
            mr_soft_or_hard_delete($table, 'owner_id', [(int) $ownerId]);
        }

        mr_soft_or_hard_delete_by_id('owners', [(int) $ownerId]);

        return response()->json([
            'message' => 'تم حذف المالك وجميع عقاراته ووحداته المرتبطة',
            'deleted' => $deleted,
            'options' => mr_relation_options_array(),
        ]);
    }
}
