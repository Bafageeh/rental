<?php

use App\Models\ContractFile;
use App\Models\PropertyFile;
use App\Models\UnitMedia;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

Route::get('/', function () {
    return view('welcome');
});

if (!function_exists('mr_web_file_path_variants')) {
    function mr_web_file_path_variants(?string $path): array
    {
        if (!$path) {
            return [];
        }

        $path = trim(str_replace('\\\\', '/', $path));
        $path = preg_replace('#^https?://[^/]+/#i', '', $path) ?: $path;
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
            // keep original path
        }

        if (!$path) {
            return [];
        }

        $variants = [
            $path,
            str_replace('contract-files/', 'contract_files/', $path),
            str_replace('contract_files/', 'contract-files/', $path),
            str_replace('property-files/', 'property_files/', $path),
            str_replace('property_files/', 'property-files/', $path),
            str_replace('unit-media/', 'unit_media/', $path),
            str_replace('unit_media/', 'unit-media/', $path),
        ];

        $basename = basename($path);
        if ($basename && $basename !== $path) {
            $variants[] = 'contract_files/' . $basename;
            $variants[] = 'contract-files/' . $basename;
            $variants[] = 'property-files/' . $basename;
            $variants[] = 'unit-media/' . $basename;
        }

        return array_values(array_unique(array_filter($variants)));
    }
}

if (!function_exists('mr_web_download_file')) {
    function mr_web_download_file(?string $path, ?string $downloadName = null, ?string $mimeType = null)
    {
        $variants = mr_web_file_path_variants($path);
        if (empty($variants)) {
            return response('لا يوجد مسار ملف محفوظ.', 404);
        }

        $headers = [];
        if ($mimeType) {
            $headers['Content-Type'] = $mimeType;
        }

        foreach (['public', 'local'] as $disk) {
            foreach ($variants as $candidatePath) {
                if (Storage::disk($disk)->exists($candidatePath)) {
                    return Storage::disk($disk)->download($candidatePath, $downloadName ?: basename($candidatePath), $headers);
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
                    return response()->download($absolutePath, $downloadName ?: basename($absolutePath), $headers);
                }
            }
        }

        return response('الملف غير موجود على التخزين.', 404);
    }
}

Route::get('/file-download/contract/{file}', function (ContractFile $file) {
    return mr_web_download_file($file->file_path, $file->file_name ?: 'contract.pdf', $file->mime_type ?: $file->file_type ?: 'application/pdf');
});

Route::get('/file-download/property/{file}', function (PropertyFile $file) {
    return mr_web_download_file($file->file_path, $file->file_name ?: 'property-file', $file->file_type ?: null);
});

Route::get('/file-download/unit-media/{media}', function (UnitMedia $media) {
    return mr_web_download_file($media->file_path, $media->file_name ?: 'unit-media', $media->file_type ?: null);
});