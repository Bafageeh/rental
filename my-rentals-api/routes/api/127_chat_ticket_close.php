<?php

use App\Models\Contract;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::prefix('chat')->group(function () {
    Route::post('/threads', function (Request $request) {
        mr_chat_ensure_schema();

        $data = $request->validate([
            'contract_id' => ['nullable'],
            'tenant_id' => ['nullable'],
            'request_type' => ['nullable', 'string', 'in:general,maintenance,payment,contract'],
            'priority' => ['nullable', 'string', 'in:normal,important,urgent'],
            'force_new' => ['nullable'],
        ]);

        $user = $request->user();
        $role = mr_chat_role($user);
        $contract = null;

        if ($role === 'tenant') {
            $contract = mr_chat_active_contract_for_tenant((int) ($user->tenant_id ?? 0));
        } else {
            $contractId = (int) ($data['contract_id'] ?? 0);
            $tenantId = (int) ($data['tenant_id'] ?? 0);
            if ($contractId > 0) {
                $contract = Contract::with(['tenant', 'unit.property.owner'])->find($contractId);
            } elseif ($tenantId > 0) {
                $contract = mr_chat_active_contract_for_tenant($tenantId);
            }
        }

        if (!$contract) {
            return response()->json(['status' => 'error', 'message' => 'لا يوجد عقد نشط لإنشاء التذكرة.'], 404);
        }

        $unit = $contract->unit;
        $property = $unit?->property;
        $ownerId = (int) ($property?->owner_id ?? $unit?->owner_id ?? 0) ?: null;

        if ($role === 'owner' && (int) ($user->owner_id ?? 0) !== (int) $ownerId) {
            return response()->json(['status' => 'error', 'message' => 'غير مصرح بفتح تذكرة لهذا العقار.'], 403);
        }

        if (!in_array($role, ['tenant', 'owner', 'admin', 'manager', 'super_admin'], true)) {
            return response()->json(['status' => 'error', 'message' => 'غير مصرح.'], 403);
        }

        $requestType = in_array(($data['request_type'] ?? 'general'), ['general', 'maintenance', 'payment', 'contract'], true) ? $data['request_type'] : 'general';
        $priority = ($role === 'tenant' && in_array(($data['priority'] ?? 'normal'), ['normal', 'important', 'urgent'], true)) ? $data['priority'] : 'normal';
        $forceNew = filter_var($data['force_new'] ?? false, FILTER_VALIDATE_BOOLEAN);

        if (!$forceNew) {
            $existing = DB::table('chat_threads')
                ->where('tenant_id', $contract->tenant_id)
                ->where('contract_id', $contract->id)
                ->where('status', '<>', 'closed')
                ->orderByDesc('id')
                ->first();
            if ($existing && mr_chat_authorize_thread($existing, $user)) {
                return response()->json(['status' => 'ok', 'data' => ['thread' => mr_chat_serialize_thread($existing, $user)]]);
            }
        }

        $contractNo = $contract->government_contract_number ?: $contract->contract_number ?: $contract->id;
        $threadId = DB::table('chat_threads')->insertGetId([
            'tenant_id' => $contract->tenant_id,
            'contract_id' => $contract->id,
            'property_id' => $property?->id,
            'unit_id' => $unit?->id,
            'owner_id' => $ownerId,
            'subject' => 'تذكرة ' . mr_chat_request_type_label($requestType) . ' - العقد ' . $contractNo,
            'status' => 'open',
            'request_type' => $requestType,
            'priority' => $priority,
            'status_updated_at' => now(),
            'closed_at' => null,
            'closed_by_user_id' => null,
            'last_message_at' => now(),
            'tenant_unread_count' => 0,
            'manager_unread_count' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        mr_chat_system_message($threadId, 'تم فتح تذكرة جديدة: ' . mr_chat_request_type_label($requestType));

        return response()->json([
            'status' => 'ok',
            'message' => 'تم فتح تذكرة جديدة',
            'data' => [
                'thread' => mr_chat_serialize_thread(DB::table('chat_threads')->where('id', $threadId)->first(), $user),
            ],
        ]);
    });

    Route::post('/threads/{thread}/meta', function (Request $request, int $thread) {
        mr_chat_ensure_schema();

        $data = $request->validate([
            'status' => ['nullable', 'string', 'in:open,in_progress,closed'],
            'request_type' => ['nullable', 'string', 'in:general,maintenance,payment,contract'],
            'priority' => ['nullable', 'string', 'in:normal,important,urgent'],
        ]);

        $user = $request->user();
        $threadRow = DB::table('chat_threads')->where('id', $thread)->first();
        if (!$threadRow) {
            return response()->json(['status' => 'error', 'message' => 'التذكرة غير موجودة.'], 404);
        }
        if (!mr_chat_authorize_thread($threadRow, $user)) {
            return response()->json(['status' => 'error', 'message' => 'غير مصرح.'], 403);
        }

        $role = mr_chat_role($user);
        $isManager = mr_chat_is_manager($user);
        $updates = ['updated_at' => now()];
        $systemMessages = [];

        if (array_key_exists('request_type', $data) && $data['request_type'] !== ($threadRow->request_type ?? 'general')) {
            if (($threadRow->status ?? 'open') === 'closed' && !$isManager) {
                return response()->json(['status' => 'error', 'message' => 'التذكرة مغلقة ولا يمكن تعديل نوع الطلب.'], 422);
            }
            $updates['request_type'] = $data['request_type'];
            $systemMessages[] = 'تم تغيير نوع الطلب إلى: ' . mr_chat_request_type_label($data['request_type']);
        }

        if (array_key_exists('priority', $data) && $data['priority'] !== ($threadRow->priority ?? 'normal')) {
            if ($role !== 'tenant') {
                return response()->json(['status' => 'error', 'message' => 'الأولوية يحددها المستأجر فقط.'], 403);
            }
            if (($threadRow->status ?? 'open') === 'closed') {
                return response()->json(['status' => 'error', 'message' => 'التذكرة مغلقة ولا يمكن تعديل الأولوية.'], 422);
            }
            $updates['priority'] = $data['priority'];
            $systemMessages[] = 'تم تغيير الأولوية إلى: ' . mr_chat_priority_label($data['priority']);
        }

        if (array_key_exists('status', $data) && $data['status'] !== ($threadRow->status ?? 'open')) {
            if (!$isManager) {
                return response()->json(['status' => 'error', 'message' => 'تغيير حالة التذكرة مخصص للإدارة فقط.'], 403);
            }
            $updates['status'] = $data['status'];
            $updates['status_updated_at'] = now();
            if ($data['status'] === 'closed') {
                $updates['closed_at'] = now();
                $updates['closed_by_user_id'] = $user->id;
            } else {
                $updates['closed_at'] = null;
                $updates['closed_by_user_id'] = null;
            }
            $systemMessages[] = 'تم تغيير حالة التذكرة إلى: ' . mr_chat_status_label($data['status']);
        }

        if (count($updates) > 1) {
            DB::table('chat_threads')->where('id', $thread)->update($updates);
            foreach ($systemMessages as $message) {
                mr_chat_system_message($thread, $message);
            }
        }

        return response()->json([
            'status' => 'ok',
            'message' => 'تم تحديث بيانات التذكرة',
            'data' => [
                'thread' => mr_chat_serialize_thread(DB::table('chat_threads')->where('id', $thread)->first(), $user),
            ],
        ]);
    });

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

            $roleText = mr_chat_role($user) === 'tenant' ? 'المستأجر' : 'الإدارة';
            mr_chat_system_message($thread, 'تم إغلاق التذكرة بواسطة ' . $roleText . '.');
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
