<?php

namespace App\Http\Middleware;

use App\Models\Contract;
use App\Models\Property;
use App\Models\Unit;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\Response;

class EnforceApiAccessScope
{
    /**
     * يمنع حسابات الملاك من استخدام المسارات العامة غير المفلترة مثل /properties و /payments.
     * المسارات العامة تبقى للإدارة فقط، أما حساب المالك فيستخدم /my/* المفلترة حسب owner_id.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'status'  => 'error',
                'message' => 'يجب تسجيل الدخول للوصول',
            ], 401);
        }

        $isScopedOwnerPath = $request->is('api/my/*') || $request->is('my/*');
        $isAuthPath = $request->is('api/auth/*') || $request->is('auth/*');
        $isProfilePath = $request->is('api/profile/*') || $request->is('profile/*');

        if ($isScopedOwnerPath || $isAuthPath || $isProfilePath) {
            return $next($request);
        }

        $role = method_exists($user, 'effectiveRole')
            ? $user->effectiveRole()
            : strtolower(trim((string) ($user->role ?? 'owner')));

        if (in_array($role, ['admin', 'manager', 'super_admin'], true)) {
            return $next($request);
        }

        $ownerId = (int) ($user->owner_id ?? 0);

        // بعض شاشات الجوال القديمة ما زالت تستخدم مسارات عامة، لكنها تمرر unit_id/property_id.
        // نسمح بها فقط عند وجود فلتر يثبت أن السجل داخل نطاق مالك الحساب الحالي.
        if ($request->isMethod('get') && $ownerId > 0 && $this->isSafeScopedOwnerRead($request, $ownerId)) {
            return $next($request);
        }

        // شاشة تفاصيل العقار القديمة تستخدم /properties/{id}.
        // في بعض إصدارات Laravel تكون قيمة route('property') موديل Property بعد الربط التلقائي،
        // لذلك نقرأ المفتاح بأمان بدل تحويل كائن كامل إلى int حتى لا ينتج Server Error.
        if ($request->isMethod('get') && ($request->is('api/properties/*') || $request->is('properties/*'))) {
            $routeProperty = $request->route('property');
            $propertyId = $this->routeModelKey($routeProperty)
                ?? $this->positiveInt($request->segment($request->is('api/*') ? 3 : 2));

            if ($propertyId && $this->ownsProperty($propertyId, $ownerId)) {
                return $next($request);
            }
        }

        return response()->json([
            'status'  => 'error',
            'message' => 'هذا المسار عام وغير مفلتر. استخدم مسارات /my الخاصة بحسابك.',
        ], 403);
    }

    private function isSafeScopedOwnerRead(Request $request, int $ownerId): bool
    {
        $isRelationDetailsPath = $request->is('api/relation-manager/related/*') || $request->is('relation-manager/related/*');
        if ($isRelationDetailsPath) {
            // RelationRecordService يطبق mrr_request_owner_scope_id ويتحقق من ملكية السجل قبل عرض البيانات.
            return true;
        }

        $isContractsIndexPath = $request->is('api/contracts') || $request->is('contracts');
        if ($isContractsIndexPath) {
            $unitId = $this->positiveInt($request->query('unit_id'));
            if ($unitId && $this->ownsUnit($unitId, $ownerId)) {
                return true;
            }

            $propertyId = $this->positiveInt($request->query('property_id'));
            return $propertyId && $this->ownsProperty($propertyId, $ownerId);
        }

        $isContractFilesIndexPath = $request->is('api/contract-files') || $request->is('contract-files');
        if ($isContractFilesIndexPath) {
            $ownerQueryId = $this->positiveInt($request->query('owner_id'));
            if ($ownerQueryId && $ownerQueryId === $ownerId) {
                return true;
            }

            $unitId = $this->positiveInt($request->query('unit_id'));
            if ($unitId && $this->ownsUnit($unitId, $ownerId)) {
                return true;
            }

            $propertyId = $this->positiveInt($request->query('property_id'));
            if ($propertyId && $this->ownsProperty($propertyId, $ownerId)) {
                return true;
            }

            $contractId = $this->positiveInt($request->query('contract_id'));
            return $contractId && $this->ownsContract($contractId, $ownerId);
        }

        return false;
    }

    private function routeModelKey($value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_object($value)) {
            if (method_exists($value, 'getKey')) {
                return $this->positiveInt($value->getKey());
            }

            if (isset($value->id)) {
                return $this->positiveInt($value->id);
            }

            return null;
        }

        return $this->positiveInt($value);
    }

    private function positiveInt($value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        $number = (int) $value;
        return $number > 0 ? $number : null;
    }

    private function ownsProperty(?int $propertyId, int $ownerId): bool
    {
        if (!$propertyId || $ownerId <= 0 || !Schema::hasTable('properties') || !Schema::hasColumn('properties', 'owner_id')) {
            return false;
        }

        return Property::query()
            ->whereKey($propertyId)
            ->where('owner_id', $ownerId)
            ->exists();
    }

    private function ownerPropertyIds(int $ownerId): array
    {
        if ($ownerId <= 0 || !Schema::hasTable('properties') || !Schema::hasColumn('properties', 'owner_id')) {
            return [];
        }

        return Property::query()
            ->where('owner_id', $ownerId)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
    }

    private function ownsUnit(?int $unitId, int $ownerId): bool
    {
        if (!$unitId || $ownerId <= 0 || !Schema::hasTable('units')) {
            return false;
        }

        $propertyIds = $this->ownerPropertyIds($ownerId);
        $hasOwnerId = Schema::hasColumn('units', 'owner_id');
        $hasPropertyId = Schema::hasColumn('units', 'property_id') && !empty($propertyIds);

        if (!$hasOwnerId && !$hasPropertyId) {
            return false;
        }

        return Unit::query()
            ->whereKey($unitId)
            ->where(function ($query) use ($ownerId, $propertyIds, $hasOwnerId, $hasPropertyId) {
                $hasCondition = false;

                if ($hasOwnerId) {
                    $query->where('owner_id', $ownerId);
                    $hasCondition = true;
                }

                if ($hasPropertyId) {
                    $hasCondition
                        ? $query->orWhereIn('property_id', $propertyIds)
                        : $query->whereIn('property_id', $propertyIds);
                }
            })
            ->exists();
    }

    private function ownsContract(?int $contractId, int $ownerId): bool
    {
        if (!$contractId || $ownerId <= 0 || !Schema::hasTable('contracts')) {
            return false;
        }

        $propertyIds = $this->ownerPropertyIds($ownerId);
        $unitIds = Schema::hasTable('units')
            ? Unit::query()
                ->when(Schema::hasColumn('units', 'owner_id'), fn ($query) => $query->where('owner_id', $ownerId))
                ->when(Schema::hasColumn('units', 'property_id') && !empty($propertyIds), function ($query) use ($propertyIds) {
                    $query->orWhereIn('property_id', $propertyIds);
                })
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->values()
                ->all()
            : [];

        return Contract::query()
            ->whereKey($contractId)
            ->where(function ($query) use ($ownerId, $propertyIds, $unitIds) {
                $hasCondition = false;

                if (Schema::hasColumn('contracts', 'owner_id')) {
                    $query->where('owner_id', $ownerId);
                    $hasCondition = true;
                }

                if (Schema::hasColumn('contracts', 'property_id') && !empty($propertyIds)) {
                    $hasCondition ? $query->orWhereIn('property_id', $propertyIds) : $query->whereIn('property_id', $propertyIds);
                    $hasCondition = true;
                }

                if (Schema::hasColumn('contracts', 'unit_id') && !empty($unitIds)) {
                    $hasCondition ? $query->orWhereIn('unit_id', $unitIds) : $query->whereIn('unit_id', $unitIds);
                }
            })
            ->exists();
    }
}
