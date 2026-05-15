<?php

// PHASE2_ROUTE_MODULES: generated from routes/api.php on 2026-04-27-083758.
// Section: Property Files & Unit Media

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ContractFileController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\OwnerDashboardController;
use App\Models\Contract;
use App\Models\Owner;
use App\Models\Payment;
use App\Models\Property;
use App\Models\Tenant;
use App\Models\Unit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

/*
|--------------------------------------------------------------------------
| Property Files & Unit Media
|--------------------------------------------------------------------------
*/

Route::get('/contract-files', function (Request $request) {
    $query = \App\Models\ContractFile::with(['contract.tenant', 'contract.unit.property.owner', 'tenant']);

    if ($request->filled('contract_id')) {
        $query->where('contract_id', $request->integer('contract_id'));
    }

    if ($request->filled('unit_id')) {
        $query->whereHas('contract', function ($contractQuery) use ($request) {
            $contractQuery->where('unit_id', $request->integer('unit_id'));
        });
    }

    if ($request->filled('property_id')) {
        $query->whereHas('contract.unit', function ($unitQuery) use ($request) {
            $unitQuery->where('property_id', $request->integer('property_id'));
        });
    }

    if ($request->filled('owner_id')) {
        $query->whereHas('contract.unit.property', function ($propertyQuery) use ($request) {
            $propertyQuery->where('owner_id', $request->integer('owner_id'));
        });
    }

    return $query->orderBy('id', 'desc')
        ->get()
        ->map(function ($file) {
            $file->file_url = $file->file_path ? url('/storage/' . $file->file_path) : null;
            $file->download_url = $file->file_url;
            return $file;
        });
});

Route::get('/property-files', function (Request $request) {
    $query = \App\Models\PropertyFile::with(['property.owner']);

    if ($request->filled('owner_id')) {
        $query->whereHas('property', function ($propertyQuery) use ($request) {
            $propertyQuery->where('owner_id', $request->integer('owner_id'));
        });
    }

    if ($request->filled('property_id')) {
        $query->where('property_id', $request->integer('property_id'));
    }

    return $query->orderBy('id', 'desc')
        ->get()
        ->map(function ($file) {
            $file->file_url = $file->file_path ? url('/storage/' . $file->file_path) : null;
            return $file;
        });
});

Route::post('/property-files', function (Request $request) {
    $data = $request->validate([
        'owner_id' => ['nullable', 'integer', 'exists:owners,id'],
        'property_id' => ['required', 'integer', 'exists:properties,id'],
        'file' => ['required', 'file', 'max:20480'],
        'category' => ['nullable', 'string', 'max:100'],
        'notes' => ['nullable', 'string'],
    ]);

    if (!empty($data['owner_id'])) {
        $belongsToOwner = Property::where('id', $data['property_id'])
            ->where('owner_id', $data['owner_id'])
            ->exists();

        if (!$belongsToOwner) {
            return response()->json([
                'message' => 'العقار المختار لا يتبع هذا المالك',
            ], 422);
        }
    }

    $uploaded = $request->file('file');
    $path = $uploaded->store('property-files', 'public');

    $file = \App\Models\PropertyFile::create([
        'property_id' => $data['property_id'],
        'file_name' => $uploaded->getClientOriginalName(),
        'file_path' => $path,
        'file_type' => $uploaded->getClientMimeType(),
        'file_size' => $uploaded->getSize(),
        'category' => $data['category'] ?? 'official',
        'notes' => $data['notes'] ?? null,
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم رفع ملف العقار بنجاح',
        'file' => $file->fresh()->load(['property.owner']),
    ], 201);
});

Route::get('/unit-media', function (Request $request) {
    $query = \App\Models\UnitMedia::with(['unit.property.owner']);

    if ($request->filled('owner_id')) {
        $query->whereHas('unit.property', function ($propertyQuery) use ($request) {
            $propertyQuery->where('owner_id', $request->integer('owner_id'));
        });
    }

    if ($request->filled('unit_id')) {
        $query->where('unit_id', $request->integer('unit_id'));
    }

    if ($request->filled('property_id')) {
        $query->whereHas('unit', function ($unitQuery) use ($request) {
            $unitQuery->where('property_id', $request->integer('property_id'));
        });
    }

    return $query->orderBy('id', 'desc')
        ->get()
        ->map(function ($media) {
            $media->file_url = $media->file_path ? url('/storage/' . $media->file_path) : null;
            return $media;
        });
});

Route::post('/unit-media', function (Request $request) {
    $data = $request->validate([
        'owner_id' => ['nullable', 'integer', 'exists:owners,id'],
        'unit_id' => ['required', 'integer', 'exists:units,id'],
        'file' => ['required', 'file', 'max:51200'],
        'media_type' => ['nullable', 'string', 'max:50'],
        'notes' => ['nullable', 'string'],
    ]);

    if (!empty($data['owner_id'])) {
        $belongsToOwner = Unit::where('id', $data['unit_id'])
            ->whereHas('property', function ($propertyQuery) use ($data) {
                $propertyQuery->where('owner_id', $data['owner_id']);
            })
            ->exists();

        if (!$belongsToOwner) {
            return response()->json([
                'message' => 'الوحدة المختارة لا تتبع هذا المالك',
            ], 422);
        }
    }

    $uploaded = $request->file('file');
    $path = $uploaded->store('unit-media', 'public');

    $media = \App\Models\UnitMedia::create([
        'unit_id' => $data['unit_id'],
        'file_name' => $uploaded->getClientOriginalName(),
        'file_path' => $path,
        'file_type' => $uploaded->getClientMimeType(),
        'file_size' => $uploaded->getSize(),
        'media_type' => $data['media_type'] ?? 'photo',
        'notes' => $data['notes'] ?? null,
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم رفع وسائط الوحدة بنجاح',
        'media' => $media->fresh()->load(['unit.property.owner']),
    ], 201);
});
