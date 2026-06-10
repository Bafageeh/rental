<?php

use App\Http\Controllers\Api\TenantReportController;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

$mrPushNotificationRoutes = __DIR__ . '/129_push_notifications.php';
if (is_file($mrPushNotificationRoutes)) require_once $mrPushNotificationRoutes;

if (!defined('MR_PUSH_CHAT_DB_LISTENER_REGISTERED')) {
    define('MR_PUSH_CHAT_DB_LISTENER_REGISTERED', true);

    DB::listen(function ($query) {
        try {
            if (!function_exists('mr_push_send_chat_message_notification')) return;

            $sql = strtolower((string) ($query->sql ?? ''));
            if (!str_contains($sql, 'insert into') || !str_contains($sql, 'chat_messages')) return;

            $bindings = $query->bindings ?? [];
            if (!is_array($bindings) || count($bindings) < 4) return;

            $threadId = (int) ($bindings[0] ?? 0);
            $senderUserId = (int) ($bindings[1] ?? 0);
            $senderRole = (string) ($bindings[2] ?? '');
            $body = (string) ($bindings[3] ?? '');

            if ($threadId <= 0 || $senderUserId <= 0 || $senderRole === 'system') return;

            $threadRow = DB::table('chat_threads')->where('id', $threadId)->first();
            $sender = DB::table('users')->where('id', $senderUserId)->first();
            if (!$threadRow || !$sender) return;

            $message = (object) [
                'id' => 0,
                'thread_id' => $threadId,
                'sender_user_id' => $senderUserId,
                'sender_role' => $senderRole,
                'body' => $body,
            ];

            mr_push_send_chat_message_notification($threadRow, $sender, $message, $body);
        } catch (Throwable $e) {
            report($e);
        }
    });
}

Route::middleware(['auth.api'])->group(function () {
    Route::get('api/tenant/reports', [TenantReportController::class, 'show']);
});
