<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (!function_exists('mr_push_ensure_schema')) {
    function mr_push_ensure_schema(): void
    {
        if (!Schema::hasTable('user_push_tokens')) {
            Schema::create('user_push_tokens', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id')->index();
                $table->string('token', 500)->unique();
                $table->string('platform', 40)->nullable()->index();
                $table->string('device_name')->nullable();
                $table->timestamp('last_seen_at')->nullable()->index();
                $table->timestamps();
            });

            return;
        }

        foreach ([
            'user_id' => fn (Blueprint $table) => $table->unsignedBigInteger('user_id')->nullable()->index(),
            'token' => fn (Blueprint $table) => $table->string('token', 500)->nullable()->index(),
            'platform' => fn (Blueprint $table) => $table->string('platform', 40)->nullable()->index(),
            'device_name' => fn (Blueprint $table) => $table->string('device_name')->nullable(),
            'last_seen_at' => fn (Blueprint $table) => $table->timestamp('last_seen_at')->nullable()->index(),
        ] as $column => $callback) {
            if (!Schema::hasColumn('user_push_tokens', $column)) {
                Schema::table('user_push_tokens', $callback);
            }
        }
    }
}

if (!function_exists('mr_push_normalized_role')) {
    function mr_push_normalized_role($user): string
    {
        if (!$user) return '';
        if (is_object($user) && method_exists($user, 'effectiveRole')) {
            return strtolower(trim((string) $user->effectiveRole()));
        }

        $role = strtolower(trim((string) ($user->role ?? '')));
        $role = str_replace(['-', ' '], '_', $role);

        return match ($role) {
            '', 'null' => 'admin',
            'admin', 'administrator', 'مدير', 'المدير', 'ادمن', 'أدمن', 'إدمن', 'مشرف', 'مشرف_عام' => 'admin',
            'superadmin', 'super_admin', 'system_admin', 'مدير_عام', 'المدير_العام' => 'super_admin',
            'manager', 'agent', 'property_manager', 'مدير_العقارات', 'وكيل', 'مسؤول' => 'manager',
            'owner', 'landlord', 'مالك', 'المالك' => 'owner',
            'tenant', 'renter', 'lessee', 'مستاجر', 'مستأجر', 'المستاجر', 'المستأجر' => 'tenant',
            default => $role,
        };
    }
}

if (!function_exists('mr_push_user_is_active')) {
    function mr_push_user_is_active($user): bool
    {
        $status = strtolower(trim((string) ($user->status ?? '')));
        return !in_array($status, ['inactive', 'disabled', 'blocked', 'suspended', 'deleted', 'محظور', 'موقوف', 'معطل'], true);
    }
}

if (!function_exists('mr_push_chat_recipient_user_ids')) {
    function mr_push_chat_recipient_user_ids(object $threadRow, $sender): array
    {
        if (!Schema::hasTable('users')) return [];

        $senderId = (int) ($sender->id ?? 0);
        $senderRole = function_exists('mr_chat_role') ? mr_chat_role($sender) : mr_push_normalized_role($sender);
        $senderRole = $senderRole === 'tenant' ? 'tenant' : mr_push_normalized_role($sender);
        $threadTenantId = (int) ($threadRow->tenant_id ?? 0);
        $threadOwnerId = (int) ($threadRow->owner_id ?? 0);
        $users = DB::table('users')->select('id', 'role', 'owner_id', 'tenant_id', 'status')->get();
        $ids = [];

        foreach ($users as $candidate) {
            $candidateId = (int) ($candidate->id ?? 0);
            if ($candidateId <= 0 || $candidateId === $senderId || !mr_push_user_is_active($candidate)) {
                continue;
            }

            $candidateRole = mr_push_normalized_role($candidate);

            if ($senderRole === 'tenant') {
                $isAdminOrManager = in_array($candidateRole, ['admin', 'manager', 'super_admin'], true);
                $isThreadOwner = $threadOwnerId > 0 && $candidateRole === 'owner' && (int) ($candidate->owner_id ?? 0) === $threadOwnerId;

                if ($isAdminOrManager || $isThreadOwner) {
                    $ids[] = $candidateId;
                }

                continue;
            }

            if ($threadTenantId > 0 && $candidateRole === 'tenant' && (int) ($candidate->tenant_id ?? 0) === $threadTenantId) {
                $ids[] = $candidateId;
            }
        }

        return array_values(array_unique($ids));
    }
}

if (!function_exists('mr_push_compact_text')) {
    function mr_push_compact_text(?string $text, int $limit = 120): string
    {
        $clean = trim(preg_replace('/\s+/u', ' ', strip_tags((string) $text)) ?: '');
        if ($clean === '') return 'لديك رسالة جديدة في التذكرة';

        if (function_exists('mb_strlen') && function_exists('mb_substr')) {
            return mb_strlen($clean) > $limit ? mb_substr($clean, 0, $limit) . '…' : $clean;
        }

        return strlen($clean) > $limit ? substr($clean, 0, $limit) . '…' : $clean;
    }
}

if (!function_exists('mr_push_send_to_users')) {
    function mr_push_send_to_users(array $userIds, string $title, string $body, array $data = []): void
    {
        try {
            mr_push_ensure_schema();

            $userIds = array_values(array_unique(array_filter(array_map('intval', $userIds))));
            if (empty($userIds)) return;

            $tokens = DB::table('user_push_tokens')
                ->whereIn('user_id', $userIds)
                ->pluck('token')
                ->map(fn ($token) => trim((string) $token))
                ->filter(fn ($token) => str_starts_with($token, 'ExponentPushToken[') || str_starts_with($token, 'ExpoPushToken['))
                ->unique()
                ->values()
                ->all();

            if (empty($tokens)) return;

            foreach (array_chunk($tokens, 100) as $chunk) {
                $messages = array_map(function (string $token) use ($title, $body, $data) {
                    return [
                        'to' => $token,
                        'sound' => 'default',
                        'title' => $title,
                        'body' => $body,
                        'data' => $data,
                        'priority' => 'high',
                        'channelId' => 'tickets',
                    ];
                }, $chunk);

                Http::timeout(8)->post('https://exp.host/--/api/v2/push/send', $messages);
            }
        } catch (Throwable $e) {
            report($e);
        }
    }
}

if (!function_exists('mr_push_send_chat_message_notification')) {
    function mr_push_send_chat_message_notification(object $threadRow, $sender, object $message, string $body, array $extraData = []): void
    {
        $recipientUserIds = mr_push_chat_recipient_user_ids($threadRow, $sender);
        if (empty($recipientUserIds)) return;

        $threadId = (int) ($threadRow->id ?? $message->thread_id ?? 0);
        $messageId = (int) ($message->id ?? 0);
        $title = 'رسالة جديدة في التذكرة #' . $threadId;
        $summary = mr_push_compact_text($body);

        mr_push_send_to_users($recipientUserIds, $title, $summary, array_merge([
            'type' => 'ticket_message',
            'route' => 'chat-thread',
            'thread_id' => $threadId,
            'ticket_id' => $threadId,
            'message_id' => $messageId,
        ], $extraData));
    }
}

Route::post('/push-tokens', function (Request $request) {
    mr_push_ensure_schema();

    $data = $request->validate([
        'token' => ['required', 'string', 'max:500'],
        'platform' => ['nullable', 'string', 'max:40'],
        'device_name' => ['nullable', 'string', 'max:255'],
    ]);

    $user = $request->user();
    if (!$user?->id) {
        return response()->json(['status' => 'error', 'message' => 'غير مصرح'], 401);
    }

    DB::table('user_push_tokens')->updateOrInsert(
        ['token' => trim($data['token'])],
        [
            'user_id' => (int) $user->id,
            'platform' => $data['platform'] ?? null,
            'device_name' => $data['device_name'] ?? null,
            'last_seen_at' => now(),
            'updated_at' => now(),
            'created_at' => now(),
        ]
    );

    return response()->json(['status' => 'ok', 'message' => 'تم حفظ جهاز التنبيهات']);
});
