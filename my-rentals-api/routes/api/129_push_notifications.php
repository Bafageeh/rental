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

if (!function_exists('mr_push_entity_user_ids')) {
    function mr_push_entity_user_ids(string $role, int $entityId): array
    {
        if ($entityId <= 0 || !Schema::hasTable('users')) return [];

        $role = mr_push_normalized_role((object) ['role' => $role]);
        $column = $role === 'owner' ? 'owner_id' : ($role === 'tenant' ? 'tenant_id' : null);
        if (!$column || !Schema::hasColumn('users', $column)) return [];

        return DB::table('users')
            ->select('id', 'role', 'status', $column)
            ->where($column, $entityId)
            ->get()
            ->filter(fn ($user) => mr_push_normalized_role($user) === $role && mr_push_user_is_active($user))
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
    }
}

if (!function_exists('mr_push_money')) {
    function mr_push_money($amount): string
    {
        $value = is_numeric($amount) ? (float) $amount : (float) str_replace(',', '', (string) ($amount ?? 0));
        return number_format($value, 2) . ' ر.س';
    }
}

if (!function_exists('mr_push_payment_context')) {
    function mr_push_payment_context($payment): ?object
    {
        $paymentId = is_object($payment) ? (int) ($payment->id ?? 0) : (int) $payment;
        if ($paymentId <= 0 || !Schema::hasTable('payments')) return null;

        return DB::table('payments')
            ->leftJoin('contracts', 'contracts.id', '=', 'payments.contract_id')
            ->leftJoin('tenants', 'tenants.id', '=', 'contracts.tenant_id')
            ->leftJoin('units', 'units.id', '=', 'contracts.unit_id')
            ->leftJoin('properties', 'properties.id', '=', 'units.property_id')
            ->leftJoin('owners', 'owners.id', '=', 'properties.owner_id')
            ->where('payments.id', $paymentId)
            ->select([
                'payments.id as payment_id',
                'payments.amount',
                Schema::hasColumn('payments', 'paid_amount') ? 'payments.paid_amount' : DB::raw('NULL as paid_amount'),
                'payments.due_date',
                'payments.status',
                'contracts.id as contract_id',
                'contracts.contract_number',
                'contracts.government_contract_number',
                'tenants.id as tenant_id',
                'tenants.name as tenant_name',
                'units.id as unit_id',
                'units.unit_number',
                'properties.id as property_id',
                'properties.name as property_name',
                'owners.id as owner_id',
                'owners.name as owner_name',
            ])
            ->first();
    }
}

if (!function_exists('mr_push_notify_tenant_payment_changed')) {
    function mr_push_notify_tenant_payment_changed($payment, string $action = 'updated'): void
    {
        $ctx = mr_push_payment_context($payment);
        if (!$ctx || (int) ($ctx->tenant_id ?? 0) <= 0) return;

        $userIds = mr_push_entity_user_ids('tenant', (int) $ctx->tenant_id);
        if (empty($userIds)) return;

        $amount = $ctx->paid_amount !== null && (float) $ctx->paid_amount > 0 ? $ctx->paid_amount : $ctx->amount;
        $title = $action === 'paid' ? 'تم تسجيل دفعة إيجار' : 'تم تحديث دفعات عقدك';
        $body = ($action === 'paid' ? 'تم تسجيل دفعة بقيمة ' : 'تم تعديل بيانات دفعة بقيمة ')
            . mr_push_money($amount)
            . ' لعقار ' . (($ctx->property_name ?? '') ?: 'العقار')
            . (($ctx->unit_number ?? '') ? ' - وحدة ' . $ctx->unit_number : '');

        mr_push_send_to_users($userIds, $title, $body, [
            'type' => 'tenant_payment_update',
            'route' => 'tenant-payments',
            'payment_id' => (int) $ctx->payment_id,
            'contract_id' => (int) ($ctx->contract_id ?? 0),
            'tenant_id' => (int) $ctx->tenant_id,
        ]);
    }
}

if (!function_exists('mr_push_notify_owner_rent_payment')) {
    function mr_push_notify_owner_rent_payment($payment): void
    {
        $ctx = mr_push_payment_context($payment);
        if (!$ctx || (int) ($ctx->owner_id ?? 0) <= 0) return;

        $userIds = mr_push_entity_user_ids('owner', (int) $ctx->owner_id);
        if (empty($userIds)) return;

        $amount = $ctx->paid_amount !== null && (float) $ctx->paid_amount > 0 ? $ctx->paid_amount : $ctx->amount;
        $body = 'تم تسجيل دفعة إيجارية بقيمة ' . mr_push_money($amount)
            . ' من ' . (($ctx->tenant_name ?? '') ?: 'مستأجر')
            . ' — ' . (($ctx->property_name ?? '') ?: 'عقار')
            . (($ctx->unit_number ?? '') ? ' / وحدة ' . $ctx->unit_number : '');

        mr_push_send_to_users($userIds, 'دفعة إيجارية جديدة', $body, [
            'type' => 'owner_rent_payment',
            'route' => 'owner-statement',
            'payment_id' => (int) $ctx->payment_id,
            'contract_id' => (int) ($ctx->contract_id ?? 0),
            'owner_id' => (int) $ctx->owner_id,
        ]);
    }
}

if (!function_exists('mr_push_notify_tenant_contract_renewed')) {
    function mr_push_notify_tenant_contract_renewed($contract): void
    {
        $contractId = is_object($contract) ? (int) ($contract->id ?? 0) : (int) $contract;
        if ($contractId <= 0 || !Schema::hasTable('contracts')) return;

        $ctx = DB::table('contracts')
            ->leftJoin('tenants', 'tenants.id', '=', 'contracts.tenant_id')
            ->leftJoin('units', 'units.id', '=', 'contracts.unit_id')
            ->leftJoin('properties', 'properties.id', '=', 'units.property_id')
            ->where('contracts.id', $contractId)
            ->select([
                'contracts.id as contract_id',
                'contracts.start_date',
                'contracts.end_date',
                'contracts.rent_amount',
                'tenants.id as tenant_id',
                'properties.name as property_name',
                'units.unit_number',
            ])
            ->first();

        if (!$ctx || (int) ($ctx->tenant_id ?? 0) <= 0) return;
        $userIds = mr_push_entity_user_ids('tenant', (int) $ctx->tenant_id);
        if (empty($userIds)) return;

        $body = 'تم تجديد عقدك لعقار ' . (($ctx->property_name ?? '') ?: 'العقار')
            . (($ctx->unit_number ?? '') ? ' - وحدة ' . $ctx->unit_number : '')
            . ' حتى تاريخ ' . (($ctx->end_date ?? '') ?: 'غير محدد') . '.';

        mr_push_send_to_users($userIds, 'تم تجديد العقد', $body, [
            'type' => 'tenant_contract_renewed',
            'route' => 'tenant-contract',
            'contract_id' => (int) $ctx->contract_id,
            'tenant_id' => (int) $ctx->tenant_id,
        ]);
    }
}

if (!function_exists('mr_push_notify_owner_expense')) {
    function mr_push_notify_owner_expense($expense): void
    {
        $expenseId = is_object($expense) ? (int) ($expense->id ?? 0) : (int) $expense;
        if ($expenseId <= 0 || !Schema::hasTable('property_expenses')) return;

        $ctx = DB::table('property_expenses')
            ->leftJoin('properties', 'properties.id', '=', 'property_expenses.property_id')
            ->leftJoin('units', 'units.id', '=', 'property_expenses.unit_id')
            ->leftJoin('expense_categories', 'expense_categories.id', '=', 'property_expenses.expense_category_id')
            ->where('property_expenses.id', $expenseId)
            ->select([
                'property_expenses.id as expense_id',
                'property_expenses.amount',
                'property_expenses.title',
                'properties.id as property_id',
                'properties.name as property_name',
                'properties.owner_id',
                'units.unit_number',
                'expense_categories.name as category_name',
            ])
            ->first();

        if (!$ctx || (int) ($ctx->owner_id ?? 0) <= 0) return;
        $userIds = mr_push_entity_user_ids('owner', (int) $ctx->owner_id);
        if (empty($userIds)) return;

        $label = $ctx->category_name ?: ($ctx->title ?: 'مصروف');
        $body = 'تم إضافة مصروف ' . $label . ' بقيمة ' . mr_push_money($ctx->amount)
            . ' على ' . (($ctx->property_name ?? '') ?: 'عقار')
            . (($ctx->unit_number ?? '') ? ' / وحدة ' . $ctx->unit_number : '');

        mr_push_send_to_users($userIds, 'مصروف جديد على عقارك', $body, [
            'type' => 'owner_expense_added',
            'route' => 'owner-statement',
            'expense_id' => (int) $ctx->expense_id,
            'owner_id' => (int) $ctx->owner_id,
            'property_id' => (int) ($ctx->property_id ?? 0),
        ]);
    }
}

if (!function_exists('mr_push_notify_owner_transfer')) {
    function mr_push_notify_owner_transfer(int $ownerId, $amount, ?int $transferId = null): void
    {
        if ($ownerId <= 0) return;
        $userIds = mr_push_entity_user_ids('owner', $ownerId);
        if (empty($userIds)) return;

        mr_push_send_to_users($userIds, 'تم تسجيل حوالة للمالك', 'تم تسجيل حوالة لك بقيمة ' . mr_push_money($amount) . '.', [
            'type' => 'owner_transfer_added',
            'route' => 'owner-statement',
            'owner_id' => $ownerId,
            'transfer_id' => $transferId,
        ]);
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
