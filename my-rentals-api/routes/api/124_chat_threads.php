<?php

use App\Models\Contract;
use App\Models\Tenant;
use App\Models\Unit;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (!function_exists('mr_chat_role')) {
    function mr_chat_role($user): string
    {
        if (!$user) return '';
        return method_exists($user, 'effectiveRole') ? $user->effectiveRole() : strtolower(trim((string) ($user->role ?? '')));
    }
}

if (!function_exists('mr_chat_is_manager')) {
    function mr_chat_is_manager($user): bool
    {
        return in_array(mr_chat_role($user), ['admin', 'manager', 'super_admin', 'owner'], true);
    }
}

if (!function_exists('mr_chat_ensure_schema')) {
    function mr_chat_ensure_schema(): void
    {
        if (!Schema::hasTable('chat_threads')) {
            Schema::create('chat_threads', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->nullable()->index();
                $table->unsignedBigInteger('contract_id')->nullable()->index();
                $table->unsignedBigInteger('property_id')->nullable()->index();
                $table->unsignedBigInteger('unit_id')->nullable()->index();
                $table->unsignedBigInteger('owner_id')->nullable()->index();
                $table->string('subject')->nullable();
                $table->string('status')->default('open')->index();
                $table->timestamp('last_message_at')->nullable()->index();
                $table->unsignedInteger('tenant_unread_count')->default(0);
                $table->unsignedInteger('manager_unread_count')->default(0);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('chat_messages')) {
            Schema::create('chat_messages', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('thread_id')->index();
                $table->unsignedBigInteger('sender_user_id')->nullable()->index();
                $table->string('sender_role', 30)->index();
                $table->text('body');
                $table->timestamp('read_at')->nullable()->index();
                $table->timestamps();
            });
        }
    }
}

if (!function_exists('mr_chat_active_contract_for_tenant')) {
    function mr_chat_active_contract_for_tenant(int $tenantId): ?Contract
    {
        if ($tenantId <= 0 || !Schema::hasTable('contracts')) return null;

        $query = Contract::with(['tenant', 'unit.property.owner'])->where('tenant_id', $tenantId);

        $active = (clone $query)
            ->whereIn('status', ['active', 'نشط'])
            ->orderByDesc('id')
            ->first();

        return $active ?: $query->orderByDesc('id')->first();
    }
}

if (!function_exists('mr_chat_thread_from_contract')) {
    function mr_chat_thread_from_contract(Contract $contract): ?object
    {
        mr_chat_ensure_schema();

        $tenantId = (int) ($contract->tenant_id ?? 0);
        if ($tenantId <= 0) return null;

        $existing = DB::table('chat_threads')
            ->where('tenant_id', $tenantId)
            ->when($contract->id, fn ($q) => $q->where('contract_id', $contract->id))
            ->first();

        if ($existing) return $existing;

        $unit = $contract->unit;
        $property = $unit?->property;
        $ownerId = (int) ($property?->owner_id ?? $unit?->owner_id ?? 0) ?: null;
        $contractNo = $contract->government_contract_number ?: $contract->contract_number ?: $contract->id;

        $id = DB::table('chat_threads')->insertGetId([
            'tenant_id' => $tenantId,
            'contract_id' => $contract->id,
            'property_id' => $property?->id,
            'unit_id' => $unit?->id,
            'owner_id' => $ownerId,
            'subject' => 'محادثة العقد ' . $contractNo,
            'status' => 'open',
            'last_message_at' => now(),
            'tenant_unread_count' => 0,
            'manager_unread_count' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return DB::table('chat_threads')->where('id', $id)->first();
    }
}

if (!function_exists('mr_chat_serialize_thread')) {
    function mr_chat_serialize_thread(object $thread, $user = null): array
    {
        $tenant = $thread->tenant_id ? Tenant::find($thread->tenant_id) : null;
        $contract = $thread->contract_id ? Contract::find($thread->contract_id) : null;
        $unit = $thread->unit_id ? Unit::with('property.owner')->find($thread->unit_id) : null;
        $property = $unit?->property;
        $last = DB::table('chat_messages')->where('thread_id', $thread->id)->orderByDesc('id')->first();
        $role = mr_chat_role($user);

        return [
            'id' => (int) $thread->id,
            'tenant_id' => $thread->tenant_id ? (int) $thread->tenant_id : null,
            'contract_id' => $thread->contract_id ? (int) $thread->contract_id : null,
            'property_id' => $thread->property_id ? (int) $thread->property_id : null,
            'unit_id' => $thread->unit_id ? (int) $thread->unit_id : null,
            'owner_id' => $thread->owner_id ? (int) $thread->owner_id : null,
            'subject' => $thread->subject ?: 'محادثة',
            'status' => $thread->status ?: 'open',
            'tenant_name' => $tenant?->name ?: 'مستأجر',
            'tenant_phone' => $tenant?->phone,
            'contract_number' => $contract?->government_contract_number ?: $contract?->contract_number,
            'property_name' => $property?->name,
            'unit_number' => $unit?->unit_number,
            'owner_name' => $property?->owner?->name,
            'last_message' => $last?->body,
            'last_message_at' => $thread->last_message_at ?: $last?->created_at,
            'unread_count' => $role === 'tenant' ? (int) ($thread->tenant_unread_count ?? 0) : (int) ($thread->manager_unread_count ?? 0),
            'created_at' => $thread->created_at,
            'updated_at' => $thread->updated_at,
        ];
    }
}

if (!function_exists('mr_chat_authorize_thread')) {
    function mr_chat_authorize_thread(object $thread, $user): bool
    {
        $role = mr_chat_role($user);

        if (in_array($role, ['admin', 'manager', 'super_admin'], true)) return true;

        if ($role === 'tenant') {
            return (int) ($user->tenant_id ?? 0) > 0 && (int) $thread->tenant_id === (int) $user->tenant_id;
        }

        if ($role === 'owner') {
            return (int) ($user->owner_id ?? 0) > 0 && (int) $thread->owner_id === (int) $user->owner_id;
        }

        return false;
    }
}

Route::middleware(['auth.api'])->prefix('chat')->group(function () {
    Route::get('/threads', function (Request $request) {
        mr_chat_ensure_schema();

        $user = $request->user();
        $role = mr_chat_role($user);

        if ($role === 'tenant') {
            $tenantId = (int) ($user->tenant_id ?? 0);
            if ($tenantId > 0 && !DB::table('chat_threads')->where('tenant_id', $tenantId)->exists()) {
                $contract = mr_chat_active_contract_for_tenant($tenantId);
                if ($contract) mr_chat_thread_from_contract($contract);
            }
        }

        $query = DB::table('chat_threads');
        if ($role === 'tenant') {
            $query->where('tenant_id', (int) ($user->tenant_id ?? 0));
        } elseif ($role === 'owner') {
            $query->where('owner_id', (int) ($user->owner_id ?? 0));
        } elseif (!in_array($role, ['admin', 'manager', 'super_admin'], true)) {
            return response()->json(['status' => 'error', 'message' => 'غير مصرح'], 403);
        }

        $threads = $query
            ->orderByRaw('COALESCE(last_message_at, updated_at) DESC')
            ->limit(100)
            ->get()
            ->map(fn ($thread) => mr_chat_serialize_thread($thread, $user))
            ->values();

        return response()->json(['status' => 'ok', 'data' => ['threads' => $threads]]);
    });

    Route::post('/threads', function (Request $request) {
        mr_chat_ensure_schema();

        $user = $request->user();
        $role = mr_chat_role($user);
        $contract = null;

        if ($role === 'tenant') {
            $tenantId = (int) ($user->tenant_id ?? 0);
            $contract = mr_chat_active_contract_for_tenant($tenantId);
        } else {
            $contractId = (int) $request->input('contract_id', 0);
            $tenantId = (int) $request->input('tenant_id', 0);
            if ($contractId > 0) {
                $contract = Contract::with(['tenant', 'unit.property.owner'])->find($contractId);
            } elseif ($tenantId > 0) {
                $contract = mr_chat_active_contract_for_tenant($tenantId);
            }
        }

        if (!$contract) {
            return response()->json(['status' => 'error', 'message' => 'لا يوجد عقد نشط لإنشاء المحادثة.'], 404);
        }

        $thread = mr_chat_thread_from_contract($contract);
        if (!$thread || !mr_chat_authorize_thread($thread, $user)) {
            return response()->json(['status' => 'error', 'message' => 'غير مصرح بفتح هذه المحادثة.'], 403);
        }

        return response()->json(['status' => 'ok', 'data' => ['thread' => mr_chat_serialize_thread($thread, $user)]]);
    });

    Route::get('/threads/{thread}/messages', function (Request $request, int $thread) {
        mr_chat_ensure_schema();

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

        $messages = DB::table('chat_messages')
            ->where('thread_id', $thread)
            ->orderBy('id')
            ->get()
            ->map(function ($message) use ($user, $role) {
                return [
                    'id' => (int) $message->id,
                    'thread_id' => (int) $message->thread_id,
                    'sender_user_id' => $message->sender_user_id ? (int) $message->sender_user_id : null,
                    'sender_role' => $message->sender_role,
                    'body' => $message->body,
                    'is_mine' => $message->sender_role === $role && (int) $message->sender_user_id === (int) $user->id,
                    'read_at' => $message->read_at,
                    'created_at' => $message->created_at,
                ];
            })
            ->values();

        return response()->json([
            'status' => 'ok',
            'data' => [
                'thread' => mr_chat_serialize_thread(DB::table('chat_threads')->where('id', $thread)->first(), $user),
                'messages' => $messages,
            ],
        ]);
    });

    Route::post('/threads/{thread}/messages', function (Request $request, int $thread) {
        mr_chat_ensure_schema();

        $data = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
        ]);

        $user = $request->user();
        $threadRow = DB::table('chat_threads')->where('id', $thread)->first();
        if (!$threadRow) return response()->json(['status' => 'error', 'message' => 'المحادثة غير موجودة.'], 404);
        if (!mr_chat_authorize_thread($threadRow, $user)) return response()->json(['status' => 'error', 'message' => 'غير مصرح.'], 403);

        $role = mr_chat_role($user) === 'tenant' ? 'tenant' : 'manager';
        $body = trim((string) $data['body']);

        $messageId = DB::table('chat_messages')->insertGetId([
            'thread_id' => $thread,
            'sender_user_id' => $user->id,
            'sender_role' => $role,
            'body' => $body,
            'read_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('chat_threads')->where('id', $thread)->update([
            'last_message_at' => now(),
            $role === 'tenant' ? 'manager_unread_count' : 'tenant_unread_count' => DB::raw(($role === 'tenant' ? 'manager_unread_count' : 'tenant_unread_count') . ' + 1'),
            'updated_at' => now(),
        ]);

        $message = DB::table('chat_messages')->where('id', $messageId)->first();

        return response()->json([
            'status' => 'ok',
            'message' => 'تم إرسال الرسالة',
            'data' => [
                'message' => [
                    'id' => (int) $message->id,
                    'thread_id' => (int) $message->thread_id,
                    'sender_user_id' => (int) $message->sender_user_id,
                    'sender_role' => $message->sender_role,
                    'body' => $message->body,
                    'is_mine' => true,
                    'created_at' => $message->created_at,
                ],
            ],
        ]);
    });
});
