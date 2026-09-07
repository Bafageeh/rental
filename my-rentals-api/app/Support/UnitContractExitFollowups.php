<?php

namespace App\Support;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Throwable;

class UnitContractExitFollowups
{
    public const TABLE = 'unit_contract_exit_followups';

    public static function ensureSchema(): void
    {
        if (!Schema::hasTable(self::TABLE)) {
            Schema::create(self::TABLE, function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('manager_id')->nullable()->index();
                $table->unsignedBigInteger('owner_id')->nullable()->index();
                $table->unsignedBigInteger('property_id')->nullable()->index();
                $table->unsignedBigInteger('unit_id')->index();
                $table->unsignedBigInteger('contract_id')->index();
                $table->unsignedBigInteger('tenant_id')->nullable()->index();
                $table->string('decision', 40)->nullable()->index();
                $table->unsignedBigInteger('responded_by')->nullable()->index();
                $table->timestamp('responded_at')->nullable();
                $table->timestamp('last_notified_at')->nullable()->index();
                $table->timestamps();
                $table->unique(['unit_id', 'contract_id'], 'unit_contract_exit_unique');
            });

            return;
        }

        $columns = [
            'manager_id' => fn (Blueprint $table) => $table->unsignedBigInteger('manager_id')->nullable()->index(),
            'owner_id' => fn (Blueprint $table) => $table->unsignedBigInteger('owner_id')->nullable()->index(),
            'property_id' => fn (Blueprint $table) => $table->unsignedBigInteger('property_id')->nullable()->index(),
            'unit_id' => fn (Blueprint $table) => $table->unsignedBigInteger('unit_id')->nullable()->index(),
            'contract_id' => fn (Blueprint $table) => $table->unsignedBigInteger('contract_id')->nullable()->index(),
            'tenant_id' => fn (Blueprint $table) => $table->unsignedBigInteger('tenant_id')->nullable()->index(),
            'decision' => fn (Blueprint $table) => $table->string('decision', 40)->nullable()->index(),
            'responded_by' => fn (Blueprint $table) => $table->unsignedBigInteger('responded_by')->nullable()->index(),
            'responded_at' => fn (Blueprint $table) => $table->timestamp('responded_at')->nullable(),
            'last_notified_at' => fn (Blueprint $table) => $table->timestamp('last_notified_at')->nullable()->index(),
            'created_at' => fn (Blueprint $table) => $table->timestamp('created_at')->nullable(),
            'updated_at' => fn (Blueprint $table) => $table->timestamp('updated_at')->nullable(),
        ];

        foreach ($columns as $column => $definition) {
            if (!Schema::hasColumn(self::TABLE, $column)) {
                Schema::table(self::TABLE, $definition);
            }
        }
    }

    public static function today(): string
    {
        return now('Asia/Riyadh')->toDateString();
    }

    private static function closedStatuses(): array
    {
        return [
            'ended', 'expired', 'cancelled', 'canceled', 'terminated', 'closed',
            'منتهي', 'منتهٍ', 'ملغي', 'ملغى', 'مغلق',
        ];
    }

    private static function cancelledStatuses(): array
    {
        return ['cancelled', 'canceled', 'ملغي', 'ملغى'];
    }

    public static function activeContractForUnit(int $unitId): ?object
    {
        if ($unitId <= 0 || !Schema::hasTable('contracts')) return null;

        $today = self::today();
        $query = DB::table('contracts')->where('unit_id', $unitId);

        if (Schema::hasColumn('contracts', 'start_date')) {
            $query->where(function ($q) use ($today) {
                $q->whereNull('start_date')->orWhereDate('start_date', '<=', $today);
            });
        }

        if (Schema::hasColumn('contracts', 'end_date')) {
            $query->where(function ($q) use ($today) {
                $q->whereNull('end_date')->orWhereDate('end_date', '>=', $today);
            });
        }

        if (Schema::hasColumn('contracts', 'status')) {
            $query->where(function ($q) {
                $q->whereNull('status')->orWhereNotIn('status', self::closedStatuses());
            });
        }

        return $query->orderByDesc('id')->first();
    }

    public static function latestExpiredContractForUnit(int $unitId): ?object
    {
        if ($unitId <= 0 || !Schema::hasTable('contracts') || !Schema::hasColumn('contracts', 'end_date')) return null;

        $query = DB::table('contracts')
            ->where('unit_id', $unitId)
            ->whereNotNull('end_date')
            ->whereDate('end_date', '<', self::today());

        if (Schema::hasColumn('contracts', 'status')) {
            $query->where(function ($q) {
                $q->whereNull('status')->orWhereNotIn('status', self::cancelledStatuses());
            });
        }

        return $query->orderByDesc('end_date')->orderByDesc('id')->first();
    }

    public static function contextForContract(int $contractId): ?object
    {
        if ($contractId <= 0 || !Schema::hasTable('contracts') || !Schema::hasTable('units')) return null;

        $select = [
            'contracts.id as contract_id',
            'contracts.unit_id',
            'contracts.tenant_id',
            'contracts.end_date',
            'units.property_id',
            'units.unit_number',
        ];

        $select[] = Schema::hasColumn('contracts', 'manager_id') ? 'contracts.manager_id as contract_manager_id' : DB::raw('NULL as contract_manager_id');
        $select[] = Schema::hasColumn('units', 'manager_id') ? 'units.manager_id as unit_manager_id' : DB::raw('NULL as unit_manager_id');

        $query = DB::table('contracts')
            ->join('units', 'units.id', '=', 'contracts.unit_id')
            ->where('contracts.id', $contractId);

        if (Schema::hasTable('properties')) {
            $query->leftJoin('properties', 'properties.id', '=', 'units.property_id');
            $select[] = 'properties.owner_id';
            $select[] = 'properties.name as property_name';
            $select[] = Schema::hasColumn('properties', 'manager_id') ? 'properties.manager_id as property_manager_id' : DB::raw('NULL as property_manager_id');
        } else {
            $select[] = DB::raw('NULL as owner_id');
            $select[] = DB::raw('NULL as property_name');
            $select[] = DB::raw('NULL as property_manager_id');
        }

        if (Schema::hasTable('tenants')) {
            $query->leftJoin('tenants', 'tenants.id', '=', 'contracts.tenant_id');
            $select[] = 'tenants.name as tenant_name';
        } else {
            $select[] = DB::raw('NULL as tenant_name');
        }

        return $query->select($select)->first();
    }

    private static function managerIdFromContext(object $context): ?int
    {
        foreach (['contract_manager_id', 'unit_manager_id', 'property_manager_id'] as $key) {
            $value = (int) ($context->{$key} ?? 0);
            if ($value > 0) return $value;
        }
        return null;
    }

    public static function ensureForUnit(int $unitId): ?object
    {
        self::ensureSchema();

        if (self::activeContractForUnit($unitId)) return null;
        $contract = self::latestExpiredContractForUnit($unitId);
        if (!$contract) return null;

        $context = self::contextForContract((int) $contract->id);
        if (!$context) return null;

        $keys = [
            'unit_id' => $unitId,
            'contract_id' => (int) $contract->id,
        ];

        $values = [
            'manager_id' => self::managerIdFromContext($context),
            'owner_id' => !empty($context->owner_id) ? (int) $context->owner_id : null,
            'property_id' => !empty($context->property_id) ? (int) $context->property_id : null,
            'tenant_id' => !empty($context->tenant_id) ? (int) $context->tenant_id : null,
            'updated_at' => now(),
        ];

        $existing = DB::table(self::TABLE)->where($keys)->first();
        if ($existing) {
            DB::table(self::TABLE)->where('id', $existing->id)->update($values);
        } else {
            DB::table(self::TABLE)->insert(array_merge($keys, $values, [
                'decision' => null,
                'responded_by' => null,
                'responded_at' => null,
                'last_notified_at' => null,
                'created_at' => now(),
            ]));
        }

        return DB::table(self::TABLE)->where($keys)->first();
    }

    public static function statusForUnit(int $unitId): array
    {
        self::ensureSchema();

        $active = self::activeContractForUnit($unitId);
        if ($active) {
            return [
                'unit_id' => $unitId,
                'state' => 'active',
                'decision' => null,
                'contract_id' => (int) $active->id,
                'contract_end_date' => $active->end_date ?? null,
                'can_answer' => false,
            ];
        }

        $expired = self::latestExpiredContractForUnit($unitId);
        if (!$expired) {
            return [
                'unit_id' => $unitId,
                'state' => 'idle',
                'decision' => null,
                'contract_id' => null,
                'contract_end_date' => null,
                'can_answer' => false,
            ];
        }

        $row = self::ensureForUnit($unitId);
        $decision = trim((string) ($row->decision ?? ''));
        $state = in_array($decision, ['wants_renewal', 'vacated'], true) ? $decision : 'pending';

        return [
            'unit_id' => $unitId,
            'state' => $state,
            'decision' => $decision !== '' ? $decision : null,
            'contract_id' => (int) $expired->id,
            'contract_end_date' => $expired->end_date ?? null,
            'can_answer' => $state === 'pending',
            'responded_at' => $row->responded_at ?? null,
            'last_notified_at' => $row->last_notified_at ?? null,
        ];
    }

    public static function propertyStatuses(int $propertyId): array
    {
        if ($propertyId <= 0 || !Schema::hasTable('units')) return [];

        return DB::table('units')
            ->where('property_id', $propertyId)
            ->orderBy('id')
            ->pluck('id')
            ->map(fn ($id) => self::statusForUnit((int) $id))
            ->values()
            ->all();
    }

    public static function recordDecision(int $unitId, string $decision, int $respondedBy, ?int $contractId = null): array
    {
        if (!in_array($decision, ['wants_renewal', 'vacated'], true)) {
            throw new RuntimeException('الاختيار غير صالح.');
        }

        $active = self::activeContractForUnit($unitId);
        if ($active) return self::statusForUnit($unitId);

        $expired = self::latestExpiredContractForUnit($unitId);
        if (!$expired) throw new RuntimeException('لا يوجد عقد منتهٍ لهذه الوحدة يحتاج إلى إجابة.');

        if ($contractId && (int) $expired->id !== $contractId) {
            throw new RuntimeException('هذا التنبيه يخص عقدًا أقدم، وتم العثور على عقد أحدث للوحدة.');
        }

        $row = self::ensureForUnit($unitId);
        if (!$row) throw new RuntimeException('تعذر إنشاء متابعة انتهاء العقد.');

        DB::table(self::TABLE)->where('id', $row->id)->update([
            'decision' => $decision,
            'responded_by' => $respondedBy > 0 ? $respondedBy : null,
            'responded_at' => now(),
            'updated_at' => now(),
        ]);

        return self::statusForUnit($unitId);
    }

    public static function syncExpiredUnits(): void
    {
        self::ensureSchema();
        if (!Schema::hasTable('contracts') || !Schema::hasColumn('contracts', 'end_date')) return;

        $unitIds = DB::table('contracts')
            ->whereNotNull('unit_id')
            ->whereNotNull('end_date')
            ->whereDate('end_date', '<', self::today())
            ->pluck('unit_id')
            ->filter(fn ($id) => (int) $id > 0)
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        foreach ($unitIds as $unitId) {
            if (!self::activeContractForUnit($unitId)) self::ensureForUnit($unitId);
        }
    }

    private static function normalizedRole(object $user): string
    {
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

    private static function userIsActive(object $user): bool
    {
        $status = strtolower(trim((string) ($user->status ?? '')));
        return !in_array($status, ['inactive', 'disabled', 'blocked', 'suspended', 'deleted', 'محظور', 'موقوف', 'معطل'], true);
    }

    public static function recipientUserIds(object $followup): array
    {
        if (!Schema::hasTable('users')) return [];

        $managerId = (int) ($followup->manager_id ?? 0);
        $ownerId = (int) ($followup->owner_id ?? 0);
        $ids = [];

        foreach (DB::table('users')->get() as $user) {
            if (!self::userIsActive($user)) continue;

            $role = self::normalizedRole($user);
            $userId = (int) ($user->id ?? 0);
            if ($userId <= 0) continue;

            if (in_array($role, ['admin', 'super_admin'], true) || (bool) ($user->is_admin ?? false)) {
                $ids[] = $userId;
                continue;
            }

            if ($role === 'manager' && $managerId > 0 && ($userId === $managerId || (int) ($user->manager_id ?? 0) === $managerId)) {
                $ids[] = $userId;
                continue;
            }

            if ($role === 'owner' && $ownerId > 0 && (int) ($user->owner_id ?? 0) === $ownerId) {
                $ids[] = $userId;
            }
        }

        return array_values(array_unique($ids));
    }

    private static function sendPushToUsers(array $userIds, string $title, string $body, array $data): int
    {
        if (empty($userIds) || !Schema::hasTable('user_push_tokens')) return 0;

        try {
            $tokens = DB::table('user_push_tokens')
                ->whereIn('user_id', array_values(array_unique(array_map('intval', $userIds))))
                ->pluck('token')
                ->map(fn ($token) => trim((string) $token))
                ->filter(fn ($token) => str_starts_with($token, 'ExponentPushToken[') || str_starts_with($token, 'ExpoPushToken['))
                ->unique()
                ->values()
                ->all();

            if (empty($tokens)) return 0;

            foreach (array_chunk($tokens, 100) as $chunk) {
                $messages = array_map(fn (string $token) => [
                    'to' => $token,
                    'sound' => 'default',
                    'title' => $title,
                    'body' => $body,
                    'data' => $data,
                    'priority' => 'high',
                    'channelId' => 'tickets',
                    'categoryId' => 'contract_exit_decision',
                ], $chunk);

                Http::timeout(8)->post('https://exp.host/--/api/v2/push/send', $messages);
            }

            return count($tokens);
        } catch (Throwable $e) {
            report($e);
            return 0;
        }
    }

    public static function sendDailyReminders(): int
    {
        self::syncExpiredUnits();
        $today = self::today();
        $sentUnits = 0;

        $pendingRows = DB::table(self::TABLE)
            ->whereNull('decision')
            ->where(function ($q) use ($today) {
                $q->whereNull('last_notified_at')->orWhereDate('last_notified_at', '<', $today);
            })
            ->orderBy('id')
            ->get();

        foreach ($pendingRows as $row) {
            $unitId = (int) ($row->unit_id ?? 0);
            $contractId = (int) ($row->contract_id ?? 0);
            if ($unitId <= 0 || $contractId <= 0) continue;
            if (self::activeContractForUnit($unitId)) continue;

            $latestExpired = self::latestExpiredContractForUnit($unitId);
            if (!$latestExpired || (int) $latestExpired->id !== $contractId) continue;

            $context = self::contextForContract($contractId);
            if (!$context) continue;

            $propertyName = trim((string) ($context->property_name ?? '')) ?: 'العقار';
            $unitNumber = trim((string) ($context->unit_number ?? '')) ?: ('#' . $unitId);
            $tenantName = trim((string) ($context->tenant_name ?? ''));
            $body = 'انتهى عقد الوحدة ' . $unitNumber . ' في ' . $propertyName . ' ولا يوجد عقد نشط. هل المستأجر' . ($tenantName !== '' ? ' ' . $tenantName : '') . ' خرج أم يريد التجديد؟';

            $userIds = self::recipientUserIds($row);
            $tokenCount = self::sendPushToUsers($userIds, 'متابعة انتهاء العقد', $body, [
                'type' => 'contract_exit_decision',
                'route' => 'property',
                'property_id' => (int) ($context->property_id ?? 0),
                'unit_id' => $unitId,
                'contract_id' => $contractId,
            ]);

            if ($tokenCount > 0) {
                DB::table(self::TABLE)->where('id', $row->id)->update([
                    'last_notified_at' => now(),
                    'updated_at' => now(),
                ]);
                $sentUnits++;
            }
        }

        return $sentUnits;
    }
}
