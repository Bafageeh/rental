<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/unit-listings', function (Request $request) {
    return response()->json([]);
});

Route::get('/my/unit-listings', function (Request $request) {
    return response()->json([]);
});

Route::get('/unit-inspections', function (Request $request) {
    return response()->json([]);
});

Route::get('/my/unit-inspections', function (Request $request) {
    return response()->json([]);
});
