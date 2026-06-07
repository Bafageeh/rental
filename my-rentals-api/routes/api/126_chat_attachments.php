<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

if (!function_exists('mr_chat_ensure_attachments_schema')) {
    function mr_chat_ensure_attachments_schema(): void
    {
        mr_chat_ensure_schema();

        if (!Schema::hasTable('chat_attachments')) {
            Schema::create('chat_attachments', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('thread_id')->index();
                $table->unsignedBigInteger('message_id')->nullable()->index();
                $table->unsignedBigInteger('sender_user_id')->nullable()->index();
                $table->string('sender_role', 30)->index();
                $table->string('original_name')->nullable();
                $table->string('file_name')->nullable();
                $table->string('file_path');
                $table->string('mime_type')->nullable();
                $table->unsignedBigInteger('file_size')->nullable();
                $table->string('file_kind', 30)->default('file')->index();
                $table->timestamps();
            });
        }
    }
}

if (!function_exists('mr_chat_file_kind')) {
    function mr_chat_file_kind(?string $mimeType, ?string $name = null): string
    {
        $mime = strtolower((string) $mimeType);
        $ext = strtolower(pathinfo((string) $name, PATHINFO_EXTENSION));
        if (str_starts_with($mime, 'image/') || in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif'], true)) return 'image';
        if ($mime === 'application/pdf' || $ext === 'pdf') return 'pdf';
        if (str_contains($mime, 'word') || in_array($ext, ['doc', 'docx'], true)) return 'document';
        if (str_contains($mime, 'excel') || str_contains($mime, 'spreadsheet') || in_array($ext, ['xls', 'xlsx'], true)) return 'spreadsheet';
        return 'file';
    }
}

if (!function_exists('mr_chat_serialize_attachment')) {
    function mr_chat_serialize_attachment(object $attachment): array
    {
        $path = ltrim((string) $attachment->file_path, '/');
        return [
            'id' => (int) $attachment->id,
            'thread_id' => (int) $attachment->thread_id,
            'message_id' => $attachment->message_id ? (int) $attachment->message_id : null,
            'original_name' => $attachment->original_name ?: $attachment->file_name ?: 'ملف',
            'file_name' => $attachment->file_name ?: basename($path),
            'file_path' => $path,
            'mime_type' => $attachment->mime_type,
            'file_size' => $attachment->file_size ? (int) $attachment->file_size : null,
            'file_kind' => $attachment->file_kind ?: mr_chat_file_kind($attachment->mime_type, $attachment->original_name),
            'url' => asset('storage/' . $path),
            'download_url' => url('/api/chat/attachments/' . $attachment->id . '/download'),
            'created_at' => $attachment->created_at,
        ];
    }
}

if (!function_exists('mr_chat_messages_with_attachments')) {
    function mr_chat_messages_with_attachments(int $thread, $user): array
    {
        $role = mr_chat_role($user) === 'tenant' ? 'tenant' : 'manager';
        $messageRows = DB::table('chat_messages')->where('thread_id', $thread)->orderBy('id')->get();
        $messageIds = $messageRows->pluck('id')->map(fn ($id) => (int) $id)->all();

        $attachmentsByMessage = collect();
        if (!empty($messageIds) && Schema::hasTable('chat_attachments')) {
            $attachmentsByMessage = DB::table('chat_attachments')
                ->whereIn('message_id', $messageIds)
                ->orderBy('id')
                ->get()
                ->groupBy('message_id');
        }

        return $messageRows->map(function ($message) use ($user, $role, $attachmentsByMessage) {
            $attachments = $attachmentsByMessage->get($message->id, collect())->map(fn ($a) => mr_chat_serialize_attachment($a))->values();
            return [
                'id' => (int) $message->id,
                'thread_id' => (int) $message->thread_id,
                'sender_user_id' => $message->sender_user_id ? (int) $message->sender_user_id : null,
                'sender_role' => $message->sender_role,
                'body' => $message->body,
                'is_system' => $message->sender_role === 'system',
                'is_mine' => $message->sender_role === $role && (int) $message->sender_user_id === (int) $user->id,
                'read_at' => $message->read_at,
                'created_at' => $message->created_at,
                'attachments' => $attachments,
                'has_attachments' => $attachments->count() > 0,
            ];
        })->values()->all();
    }
}

Route::prefix('chat')->group(function () {
    Route::get('/threads/{thread}/messages-v2', function (Request $request, int $thread) {
        mr_chat_ensure_attachments_schema();

        $user = $request->user();
        $threadRow = DB::table('chat_threads')->where('id', $thread)->first();
        if (!$threadRow) return response()->json(['status' => 'error', 'message' => 'المحادثة غير موجودة.'], 404);
        if (!mr_chat_authorize_thread($threadRow, $user)) return response()->json(['status' => 'error', 'message' => 'غير مصرح.'], 403);

        $role = mr_chat_role($user) === 'tenant' ? 'tenant' : 'manager';
        DB::table('chat_messages')
            ->where('thread_id', $thread)
            ->where('sender_role', '<>', $role)
            ->whereNull('read_at')
            ->update(['read_at' => now(), 'updated_at' => now()]);

        DB::table('chat_threads')->where('id', $thread)->update([
            $role === 'tenant' ? 'tenant_unread_count' : 'manager_unread_count' => 0,
            'updated_at' => now(),
        ]);

        return response()->json([
            'status' => 'ok',
            'data' => [
                'thread' => mr_chat_serialize_thread(DB::table('chat_threads')->where('id', $thread)->first(), $user),
                'messages' => mr_chat_messages_with_attachments($thread, $user),
            ],
        ]);
    });

    Route::post('/threads/{thread}/attachments', function (Request $request, int $thread) {
        mr_chat_ensure_attachments_schema();

        $data = $request->validate([
            'file' => ['required', 'file', 'max:15360', 'mimes:jpg,jpeg,png,webp,gif,pdf,doc,docx,xls,xlsx,txt,csv'],
            'body' => ['nullable', 'string', 'max:2000'],
        ]);

        $user = $request->user();
        $threadRow = DB::table('chat_threads')->where('id', $thread)->first();
        if (!$threadRow) return response()->json(['status' => 'error', 'message' => 'المحادثة غير موجودة.'], 404);
        if (!mr_chat_authorize_thread($threadRow, $user)) return response()->json(['status' => 'error', 'message' => 'غير مصرح.'], 403);

        $role = mr_chat_role($user) === 'tenant' ? 'tenant' : 'manager';
        if ($role === 'tenant' && ($threadRow->status ?? 'open') === 'closed') {
            return response()->json(['status' => 'error', 'message' => 'المحادثة مغلقة. لا يمكن إرسال مرفقات إلا بعد إعادة فتحها من الإدارة.'], 422);
        }

        $file = $request->file('file');
        $originalName = $file->getClientOriginalName() ?: 'attachment';
        $extension = strtolower($file->getClientOriginalExtension() ?: $file->guessExtension() ?: 'bin');
        $fileName = now()->format('Ymd_His') . '_' . Str::random(12) . '.' . $extension;
        $dir = 'chat_attachments/' . $thread;
        $path = $file->storeAs($dir, $fileName, 'public');
        $mime = $file->getClientMimeType() ?: $file->getMimeType();
        $kind = mr_chat_file_kind($mime, $originalName);
        $body = trim((string) ($data['body'] ?? ''));
        if ($body === '') {
            $body = $kind === 'image' ? 'أرسل صورة' : 'أرسل ملف: ' . $originalName;
        }

        $messageId = DB::table('chat_messages')->insertGetId([
            'thread_id' => $thread,
            'sender_user_id' => $user->id,
            'sender_role' => $role,
            'body' => $body,
            'read_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $attachmentId = DB::table('chat_attachments')->insertGetId([
            'thread_id' => $thread,
            'message_id' => $messageId,
            'sender_user_id' => $user->id,
            'sender_role' => $role,
            'original_name' => $originalName,
            'file_name' => $fileName,
            'file_path' => $path,
            'mime_type' => $mime,
            'file_size' => $file->getSize(),
            'file_kind' => $kind,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('chat_threads')->where('id', $thread)->update([
            'last_message_at' => now(),
            $role === 'tenant' ? 'manager_unread_count' : 'tenant_unread_count' => DB::raw(($role === 'tenant' ? 'manager_unread_count' : 'tenant_unread_count') . ' + 1'),
            'updated_at' => now(),
        ]);

        $message = DB::table('chat_messages')->where('id', $messageId)->first();
        $attachment = DB::table('chat_attachments')->where('id', $attachmentId)->first();

        return response()->json([
            'status' => 'ok',
            'message' => 'تم إرسال المرفق',
            'data' => [
                'message' => [
                    'id' => (int) $message->id,
                    'thread_id' => (int) $message->thread_id,
                    'sender_user_id' => (int) $message->sender_user_id,
                    'sender_role' => $message->sender_role,
                    'body' => $message->body,
                    'is_mine' => true,
                    'is_system' => false,
                    'read_at' => $message->read_at,
                    'created_at' => $message->created_at,
                    'attachments' => [mr_chat_serialize_attachment($attachment)],
                    'has_attachments' => true,
                ],
            ],
        ]);
    });

    Route::get('/attachments/{attachment}/download', function (Request $request, int $attachment) {
        mr_chat_ensure_attachments_schema();

        $row = DB::table('chat_attachments')->where('id', $attachment)->first();
        if (!$row) return response()->json(['status' => 'error', 'message' => 'المرفق غير موجود.'], 404);

        $threadRow = DB::table('chat_threads')->where('id', $row->thread_id)->first();
        if (!$threadRow || !mr_chat_authorize_thread($threadRow, $request->user())) {
            return response()->json(['status' => 'error', 'message' => 'غير مصرح.'], 403);
        }

        if (!Storage::disk('public')->exists($row->file_path)) {
            return response()->json(['status' => 'error', 'message' => 'الملف غير موجود على التخزين.'], 404);
        }

        return Storage::disk('public')->download($row->file_path, $row->original_name ?: $row->file_name, $row->mime_type ? ['Content-Type' => $row->mime_type] : []);
    });
});
