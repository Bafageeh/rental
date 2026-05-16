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
use Illuminate\Support\Facades\Storage;

/*
|--------------------------------------------------------------------------
| Property Files & Unit Media
|--------------------------------------------------------------------------
*/

if (!function_exists('mr_file_storage_path')) {
    function mr_file_storage_path(?string $path): ?string
    {
        if (!$path) {
            return null;
        }

        $path = trim(str_replace('\\\\', '/', $path));
        $path = preg_replace('#^https?://[^/]+/#i', '', $path) ?: $path;
        $path = preg_replace('#^api/file-download/[^/]+/\d+$#', '', $path) ?: $path;
        $path = preg_replace('#^/?storage/#', '', $path) ?: $path;
        $path = preg_replace('#^/?app/public/#', '', $path) ?: $path;
        $path = preg_replace('#^/?app/private/#', '', $path) ?: $path;
        $path = preg_replace('#^/?app/#', '', $path) ?: $path;
        $path = preg_replace('#^/?public/#', '', $path) ?: $path;
        $path = ltrim($path, '/');

        try {
            $decoded = rawurldecode($path);
            if ($decoded !== '') {
                $path = $decoded;
            }
        } catch (Throwable $e) {
            // Keep original path when decoding fails.
        }

        return $path ?: null;
    }
}

if (!function_exists('mr_file_path_variants')) {
    function mr_file_path_variants(?string $path): array
    {
        $normalizedPath = mr_file_storage_path($path);
        if (!$normalizedPath) {
            return [];
        }

        $variants = [
            $normalizedPath,
            str_replace('contract-files/', 'contract_files/', $normalizedPath),
            str_replace('contract_files/', 'contract-files/', $normalizedPath),
            str_replace('property-files/', 'property_files/', $normalizedPath),
            str_replace('property_files/', 'property-files/', $normalizedPath),
            str_replace('unit-media/', 'unit_media/', $normalizedPath),
            str_replace('unit_media/', 'unit-media/', $normalizedPath),
        ];

        $basename = basename($normalizedPath);
        if ($basename && $basename !== $normalizedPath) {
            $variants[] = 'contract_files/' . $basename;
            $variants[] = 'contract-files/' . $basename;
            $variants[] = 'property-files/' . $basename;
            $variants[] = 'unit-media/' . $basename;
        }

        return array_values(array_unique(array_filter($variants)));
    }
}

if (!function_exists('mr_file_download_url')) {
    function mr_file_download_url(string $type, int $id): string
    {
        return url('/api/file-download/' . $type . '/' . $id);
    }
}

if (!function_exists('mr_download_absolute_file')) {
    function mr_download_absolute_file(string $absolutePath, ?string $downloadName = null, ?string $mimeType = null)
    {
        $name = $downloadName ?: basename($absolutePath);
        $headers = [];
        if ($mimeType) {
            $headers['Content-Type'] = $mimeType;
        }

        return response()->download($absolutePath, $name, $headers);
    }
}

if (!function_exists('mr_find_file_by_basename')) {
    function mr_find_file_by_basename(?string $path): ?string
    {
        $normalizedPath = mr_file_storage_path($path);
        if (!$normalizedPath) {
            return null;
        }

        $basename = basename($normalizedPath);
        if (!$basename) {
            return null;
        }

        $roots = [
            storage_path('app/public'),
            storage_path('app/private'),
            storage_path('app'),
        ];

        foreach ($roots as $root) {
            if (!is_dir($root)) {
                continue;
            }

            try {
                $iterator = new RecursiveIteratorIterator(
                    new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
                    RecursiveIteratorIterator::SELF_FIRST
                );

                foreach ($iterator as $fileInfo) {
                    if (!$fileInfo->isFile()) {
                        continue;
                    }
                    if ($fileInfo->getFilename() === $basename) {
                        return $fileInfo->getPathname();
                    }
                }
            } catch (Throwable $e) {
                continue;
            }
        }

        return null;
    }
}

if (!function_exists('mr_file_response')) {
    function mr_file_response(?string $path, ?string $downloadName = null, ?string $mimeType = null)
    {
        $variants = mr_file_path_variants($path);
        if (empty($variants)) {
            return response()->json(['message' => 'لا يوجد مسار ملف محفوظ.'], 404);
        }

        foreach (['public', 'local'] as $disk) {
            foreach ($variants as $candidatePath) {
                if (Storage::disk($disk)->exists($candidatePath)) {
                    $name = $downloadName ?: basename($candidatePath);
                    $headers = [];
                    if ($mimeType) {
                        $headers['Content-Type'] = $mimeType;
                    }
                    return Storage::disk($disk)->download($candidatePath, $name, $headers);
                }
            }
        }

        foreach ($variants as $candidatePath) {
            foreach ([
                storage_path('app/public/' . $candidatePath),
                storage_path('app/private/' . $candidatePath),
                storage_path('app/' . $candidatePath),
                public_path('storage/' . $candidatePath),
            ] as $absolutePath) {
                if (is_file($absolutePath)) {
                    return mr_download_absolute_file($absolutePath, $downloadName, $mimeType);
                }
            }
        }

        $foundByName = mr_find_file_by_basename($path);
        if ($foundByName && is_file($foundByName)) {
            return mr_download_absolute_file($foundByName, $downloadName, $mimeType);
        }

        return response()->json([
            'message' => 'الملف غير موجود على التخزين.',
            'checked' => $variants,
        ], 404);
    }
}

Route::get('/file-download/contract/{file}', function (\App\Models\ContractFile $file) {
    return mr_file_response($file->file_path, $file->file_name ?: 'contract.pdf', $file->mime_type ?: $file->file_type ?: 'application/pdf');
});

Route::get('/file-download/property/{file}', function (\App\Models\PropertyFile $file) {
    return mr_file_response($file->file_path, $file->file_name ?: 'property-file', $file->file_type ?: null);
});

Route::get('/file-download/unit-media/{media}', function (\App\Models\UnitMedia $media) {
    return mr_file_response($media->file_path, $media->file_name ?: 'unit-media', $media->file_type ?: null);
});

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
            $file->file_url = $file->file_path ? mr_file_download_url('contract', (int) $file->id) : null;
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
            $file->file_url = $file->file_path ? mr_file_download_url('property', (int) $file->id) : null;
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
            $media->file_url = $media->file_path ? mr_file_download_url('unit-media', (int) $media->id) : null;
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