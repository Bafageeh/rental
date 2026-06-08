<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::prefix('chat')->group(function () {
    Route::post('/threads/{thread}/close', function (Request $request, int $thread) {
        mr_chat_ensure_schema();

        $user = $request->user();
        $threadRow = DB::table('chat_threads')->where('id', $thread)->first();
        if (!$threadRow) {
            return response()->json(['status' => 'error', 'message' => 'التذكرة غير موجودة.'], 404);
        }
        if (!mr_chat_authorize_thread($threadRow, $user)) {
            return response()->json(['status' => 'error', 'message' => 'غير مصرح.'], 403);
        }

        if (($threadRow->status ?? 'open') !== 'closed') {
            DB::table('chat_threads')->where('id', $thread)->update([
                'status' => 'closed',
                'status_updated_at' => now(),
                'closed_at' => now(),
                'closed_by_user_id' => $user->id,
                'updated_at' => now(),
            ]);

            $role = mr_chat_role($user) === 'tenant' ? 'المستأجر' : 'الإدارة';
            mr_chat_system_message($thread, 'تم إغلاق التذكرة بواسطة ' . $role . '.');
        }

        return response()->json([
            'status' => 'ok',
            'message' => 'تم إغلاق التذكرة',
            'data' => [
                'thread' => mr_chat_serialize_thread(DB::table('chat_threads')->where('id', $thread)->first(), $user),
            ],
        ]);
    });
});
