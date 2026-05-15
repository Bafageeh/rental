<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Priority deed extractor route
|--------------------------------------------------------------------------
| This file is loaded before the general deed routes. Register the upload
| endpoint here first, then delegate to the fixed visual/field extractor.
*/

if (!function_exists('priority_deed_route_handle')) {
    function priority_deed_route_handle(Request $request)
    {
        $fixedExtractor = __DIR__ . '/106_deed_398490000202_fields.php';
        if (is_file($fixedExtractor)) {
            require_once $fixedExtractor;
        }

        if (function_exists('deed398_handle')) {
            return deed398_handle($request);
        }

        $fallback = __DIR__ . '/104_property_deed_upsert_and_qr.php';
        if (is_file($fallback)) {
            require_once $fallback;
        }

        if (function_exists('deed_up_handle')) {
            return deed_up_handle($request);
        }

        return response()->json([
            'status' => 'error',
            'message' => 'تعذر تحميل معالج الصكوك.',
        ], 500);
    }
}

Route::post('/property-deeds/extract', fn(Request $request) => priority_deed_route_handle($request));
Route::post('/my/property-deeds/extract', fn(Request $request) => priority_deed_route_handle($request));
