<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

require_once __DIR__ . '/105_visual_deed_rule.php';
require_once __DIR__ . '/107_visual_deed_model_parser.php';

Route::post('/property-deeds/extract', function (Request $request) {
    return deed_visual_handle_v2($request);
});

Route::post('/my/property-deeds/extract', function (Request $request) {
    return deed_visual_handle_v2($request);
});
