<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

Route::post('/privacy/account-deletion-request', function (Request $request) {
    $user = $request->user();
    Storage::disk('local')->append('privacy/account_requests.jsonl', json_encode([
        'created_at' => now()->toIso8601String(),
        'user_id' => $user?->id,
        'role' => $user?->role,
        'source' => $request->input('source', 'mobile_app'),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    return response()->json([
        'message' => 'تم استلام الطلب وسيتم مراجعته من الدعم الفني.',
        'data' => ['status' => 'received'],
    ]);
});
