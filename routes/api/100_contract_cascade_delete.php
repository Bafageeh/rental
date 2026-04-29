<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::post('/edit-delete-center/contracts/{contractId}/delete', function (int $contractId, Request $request) {
    return response()->json([
        'status' => 'ok',
        'message' => 'اختبار مسار حذف العقد.',
        'contract_id' => $contractId,
    ]);
});
