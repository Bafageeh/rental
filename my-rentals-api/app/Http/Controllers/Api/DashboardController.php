<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use App\Models\Owner;
use App\Models\Payment;
use App\Models\Property;
use App\Models\PropertyExpense;
use App\Models\Tenant;
use App\Models\Unit;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Throwable;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        try {
            return $this->buildDashboardResponse($request);
        } catch (Throwable $e) {
            Log::error('Dashboard API failed; returning safe fallback payload', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            return response()->json($this->emptyDashboardPayload($request, true));
        }
    }

    private function buildDashboardResponse(Request $request)
    {
        $user = function_exists('my_rentals_current_user_for_scope')
            ? my_rentals_current_user_for_scope($request)
            : $request->user();

        $today = Carbon::today('Asia/Riyadh');
        $role = $this->effectiveRole($user);
        $isAdmin = $this->isAdminRole($role);

        // في حساب المدير يجب أن تكون الإحصائيات عامة للنظام، أما حساب المالك فتقتصر على ملاكه فقط.
        // سابقاً كانت تعتمد على مالك type=self فقط، وهذا جعل البطاقات تظهر أصفاراً إذا لم يكن مالك المدير مضبوطاً.
        $ownerIds = $this->ownerIdsForUser($user, $request, $isAdmin);
        $propertyIds = $this->propertyIds($ownerIds, $isAdmin);
        $visibleUnitIds = $this->unitIdsForScope($propertyIds, $ownerIds, true, $isAdmin);
        $allUnitIds = $this->unitIdsForScope($propertyIds, $ownerIds, false, $isAdmin);
        $contractIds = $this->contractIds($allUnitIds, $isAdmin);
        $activeContractIds = $this->activeContractsQuery($allUnitIds, $today, $isAdmin)->pluck('id')->map(fn ($id) => (int) $id)->unique()->values();

        $paidIncome = $this->paymentsSum($contractIds, ['paid', 'مدفوع', 'مسدد']);
        $dueIncome = $this->paymentsSum($contractIds, ['due', 'مستحق', 'unpaid', 'غير مدفوع', 'partial', 'جزئي']);
        $overdueIncome = $this->overduePaymentsQuery($contractIds, $today)->sum('amount');
        $expenses = $this->expensesSum($propertyIds, $visibleUnitIds);

        $unitsCount = $visibleUnitIds->count();
        $statusRentedUnitIds = $this->rentedUnitIdsByStatus($visibleUnitIds);
        $activeContractUnitIds = $this->activeContractsQuery($allUnitIds, $today, $isAdmin)
            ->whereIn('unit_id', $visibleUnitIds)
            ->pluck('unit_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $rentedUnits = $statusRentedUnitIds->merge($activeContractUnitIds)->unique()->count();
        $vacantUnits = max(0, $unitsCount - $rentedUnits);

        $overduePayments = $this->overduePaymentsQuery($contractIds, $today)
            ->with([
                'contract.tenant',
                'contract.unit.property.owner',
            ])
            ->orderBy('due_date')
            ->limit(10)
            ->get()
            ->map(function ($payment) {
                return [
                    'id' => $payment->id,
                    'amount' => (float) ($payment->amount ?? 0),
                    'due_date' => $payment->due_date,
                    'tenant_name' => $payment->contract?->tenant?->name,
                    'unit_number' => $payment->contract?->unit?->unit_number,
                    'property_name' => $payment->contract?->unit?->property?->name,
                    'owner_name' => $payment->contract?->unit?->property?->owner?->name,
                ];
            });

        $owners = $this->ownersSummary($ownerIds, $isAdmin);

        return response()->json([
            'status' => 'ok',
            'app' => 'my-rentals-api',
            'scope' => [
                'owner_ids' => $ownerIds->values(),
                'property_ids' => $propertyIds->values(),
                'user_id' => $user?->id,
                'role' => $role,
                'is_admin_scope' => $isAdmin,
            ],
            'summary' => [
                'owners_count' => $ownerIds->count(),
                'properties_count' => $propertyIds->count(),
                'units_count' => $unitsCount,
                'rented_units_count' => $rentedUnits,
                'available_units_count' => $vacantUnits,
                'vacant_units_count' => $vacantUnits,
                'occupancy_rate' => $unitsCount > 0 ? round(($rentedUnits / $unitsCount) * 100, 1) : 0,
                'tenants_count' => $this->tenantsCount($contractIds),
                'active_contracts_count' => $activeContractIds->count(),
                'paid_income' => $paidIncome,
                'due_income' => $dueIncome,
                'overdue_income' => (float) $overdueIncome,
                'expenses' => $expenses,
                'net_income' => $paidIncome - $expenses,
                'total_due' => $dueIncome + (float) $overdueIncome,
                'total_paid' => $paidIncome,
                'total_expenses' => $expenses,
                'overdue_count' => $overduePayments->count(),
                'critical_alerts_count' => $overduePayments->count(),
                'open_followups_count' => $this->openChatTicketsCount($ownerIds, $isAdmin),
            ],
            'owners' => $owners,
            'overdue_payments' => $overduePayments,
            'recent_due_payments' => $overduePayments,
        ]);
    }

    private function emptyDashboardPayload(Request $request, bool $fallback = false): array
    {
        $user = $request->user();

        return [
            'status' => 'ok',
            'app' => 'my-rentals-api',
            'fallback' => $fallback,
            'scope' => [
                'owner_ids' => [],
                'property_ids' => [],
                'user_id' => $user?->id,
                'role' => $this->effectiveRole($user),
            ],
            'summary' => [
                'owners_count' => 0,
                'properties_count' => 0,
                'units_count' => 0,
                'rented_units_count' => 0,
                'available_units_count' => 0,
                'vacant_units_count' => 0,
                'occupancy_rate' => 0,
                'tenants_count' => 0,
                'active_contracts_count' => 0,
                'paid_income' => 0,
                'due_income' => 0,
                'overdue_income' => 0,
                'expenses' => 0,
                'net_income' => 0,
                'total_due' => 0,
                'total_paid' => 0,
                'total_expenses' => 0,
                'overdue_count' => 0,
                'critical_alerts_count' => 0,
                'open_followups_count' => 0,
            ],
            'owners' => [],
            'overdue_payments' => [],
            'recent_due_payments' => [],
        ];
    }

    private function overduePaymentsQuery(Collection $contractIds, Carbon $today)
    {
        $query = Payment::query();

        if ($contractIds->isEmpty() || !$this->hasTable('payments')) {
            return $query->whereRaw('1 = 0');
        }

        if ($this->hasColumn('payments', 'contract_id')) {
            $query->whereIn('contract_id', $contractIds);
        }

        if ($this->hasColumn('payments', 'status')) {
            $query->whereNotIn('status', ['paid', 'مدفوع', 'مسدد', 'cancelled', 'canceled', 'ملغي', 'ملغى']);
        }

        if ($this->hasColumn('payments', 'due_date')) {
            $query->whereDate('due_date', '<', $today->toDateString());
        } elseif ($this->hasColumn('payments', 'status')) {
            $query->whereIn('status', ['overdue', 'متأخر', 'متاخر']);
        } else {
            $query->whereRaw('1 = 0');
        }

        return $query;
    }

    private function activeContractsQuery(Collection $unitIds, Carbon $today, bool $isAdmin)
    {
        $query = Contract::query();

        if (!$this->hasTable('contracts')) {
            return $query->whereRaw('1 = 0');
        }

        if ($unitIds->isEmpty() && !$isAdmin) {
            return $query->whereRaw('1 = 0');
        }

        if ($unitIds->isNotEmpty() && $this->hasColumn('contracts', 'unit_id')) {
            $query->whereIn('unit_id', $unitIds);
        }

        $hasStatus = $this->hasColumn('contracts', 'status');
        $hasStart = $this->hasColumn('contracts', 'start_date');
        $hasEnd = $this->hasColumn('contracts', 'end_date');

        if ($hasStatus || $hasStart || $hasEnd) {
            $query->where(function ($statusOrDateQuery) use ($hasStatus, $hasStart, $hasEnd, $today) {
                $used = false;

                if ($hasStatus) {
                    $statusOrDateQuery->whereIn('status', ['active', 'نشط', 'ساري', 'مفتوح', 'open']);
                    $used = true;
                }

                if ($hasStart || $hasEnd) {
                    $dateScope = function ($dateQuery) use ($hasStart, $hasEnd, $today) {
                        if ($hasStart) {
                            $dateQuery->where(function ($q) use ($today) {
                                $q->whereNull('start_date')->orWhereDate('start_date', '<=', $today->toDateString());
                            });
                        }

                        if ($hasEnd) {
                            $dateQuery->where(function ($q) use ($today) {
                                $q->whereNull('end_date')->orWhereDate('end_date', '>=', $today->toDateString());
                            });
                        }
                    };

                    if ($used) {
                        $statusOrDateQuery->orWhere($dateScope);
                    } else {
                        $statusOrDateQuery->where($dateScope);
                    }
                }
            });
        }

        return $query;
    }

    private function ownersSummary(Collection $ownerIds, bool $isAdmin): Collection
    {
        if (!$this->hasTable('owners')) {
            return collect();
        }

        $query = Owner::query()->withCount('properties');
        if ($ownerIds->isNotEmpty()) {
            $query->whereIn('id', $ownerIds);
        } elseif (!$isAdmin) {
            return collect();
        }

        return $query
            ->orderBy($this->hasColumn('owners', 'type') ? 'type' : 'id')
            ->orderBy('name')
            ->get()
            ->map(function ($owner) {
                $ownerPropertyIds = $this->propertyIds(collect([(int) $owner->id]), false);
                $ownerUnitIds = $this->unitIdsForScope($ownerPropertyIds, collect([(int) $owner->id]), false, false);
                $ownerContractIds = $this->contractIds($ownerUnitIds, false);
                $income = $this->paymentsSum($ownerContractIds, ['paid', 'مدفوع', 'مسدد']);
                $due = $this->paymentsSum($ownerContractIds, ['due', 'مستحق', 'unpaid', 'غير مدفوع', 'partial', 'جزئي']);
                $expenses = $this->expensesSum($ownerPropertyIds, $ownerUnitIds);

                return [
                    'id' => $owner->id,
                    'name' => $owner->name,
                    'type' => $owner->type ?? null,
                    'properties_count' => $owner->properties_count,
                    'units_count' => $ownerUnitIds->count(),
                    'contracts_count' => $ownerContractIds->count(),
                    'paid_income' => (float) $income,
                    'due_income' => (float) $due,
                    'expenses' => (float) $expenses,
                    'net_income' => (float) ($income - $expenses),
                ];
            });
    }

    private function ownerIdsForUser($user, Request $request, bool $isAdmin): Collection
    {
        if (!$user || !$this->hasTable('owners')) {
            return collect();
        }

        if ($isAdmin && $request->filled('owner_id')) {
            return collect([(int) $request->integer('owner_id')])->filter()->values();
        }

        if ($isAdmin) {
            return DB::table('owners')->pluck('id')->map(fn ($id) => (int) $id)->filter()->unique()->values();
        }

        $ownerIds = collect();
        if (!empty($user->owner_id)) {
            $ownerIds->push((int) $user->owner_id);
        }

        $linkedOwners = DB::table('owners')->where(function ($query) use ($user) {
            $hasCondition = false;

            if (!empty($user->id)) {
                if ($this->hasColumn('owners', 'user_id')) {
                    $query->orWhere('user_id', $user->id);
                    $hasCondition = true;
                }

                if ($this->hasColumn('owners', 'account_user_id')) {
                    $query->orWhere('account_user_id', $user->id);
                    $hasCondition = true;
                }
            }

            if (!$hasCondition) {
                $query->whereRaw('1 = 0');
            }
        })->pluck('id');

        return $ownerIds
            ->merge($linkedOwners)
            ->filter(fn ($id) => !empty($id))
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();
    }

    private function propertyIds(Collection $ownerIds, bool $isAdmin): Collection
    {
        if (!$this->hasTable('properties') || !$this->hasColumn('properties', 'id')) {
            return collect();
        }

        $query = Property::query();
        if ($ownerIds->isNotEmpty() && $this->hasColumn('properties', 'owner_id')) {
            $query->whereIn('owner_id', $ownerIds);
        } elseif (!$isAdmin) {
            return collect();
        }

        return $query->pluck('id')->map(fn ($id) => (int) $id)->unique()->values();
    }

    private function unitIdsForScope(Collection $propertyIds, Collection $ownerIds, bool $visibleOnly, bool $isAdmin): Collection
    {
        if (!$this->hasTable('units') || !$this->hasColumn('units', 'id')) {
            return collect();
        }

        $query = Unit::query();
        $canUseOwner = $this->hasColumn('units', 'owner_id') && $ownerIds->isNotEmpty();
        $canUseProperty = $this->hasColumn('units', 'property_id') && $propertyIds->isNotEmpty();

        if ($canUseOwner || $canUseProperty) {
            $query->where(function ($unitScope) use ($canUseOwner, $canUseProperty, $ownerIds, $propertyIds) {
                $used = false;

                if ($canUseOwner) {
                    $unitScope->whereIn('owner_id', $ownerIds);
                    $used = true;
                }

                if ($canUseProperty) {
                    if ($used) {
                        $unitScope->orWhereIn('property_id', $propertyIds);
                    } else {
                        $unitScope->whereIn('property_id', $propertyIds);
                    }
                }
            });
        } elseif (!$isAdmin) {
            return collect();
        }

        if ($visibleOnly) {
            if ($this->hasColumn('units', 'unit_number')) {
                $query->where('unit_number', '!=', 'العقار كامل');
            }

            if ($this->hasColumn('units', 'type')) {
                $query->where(function ($subQuery) {
                    $subQuery->whereNull('type')->orWhere('type', '!=', 'whole_property');
                });
            }
        }

        return $query->pluck('id')->map(fn ($id) => (int) $id)->unique()->values();
    }

    private function contractIds(Collection $unitIds, bool $isAdmin): Collection
    {
        if (!$this->hasTable('contracts') || !$this->hasColumn('contracts', 'id')) {
            return collect();
        }

        $query = Contract::query();
        if ($unitIds->isNotEmpty() && $this->hasColumn('contracts', 'unit_id')) {
            $query->whereIn('unit_id', $unitIds);
        } elseif (!$isAdmin) {
            return collect();
        }

        return $query->pluck('id')->map(fn ($id) => (int) $id)->unique()->values();
    }

    private function rentedUnitIdsByStatus(Collection $visibleUnitIds): Collection
    {
        if ($visibleUnitIds->isEmpty() || !$this->hasTable('units') || !$this->hasColumn('units', 'status')) {
            return collect();
        }

        return Unit::query()
            ->whereIn('id', $visibleUnitIds)
            ->whereIn('status', ['rented', 'مؤجرة', 'مؤجر', 'occupied'])
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();
    }

    private function paymentsSum(Collection $contractIds, array $statuses): float
    {
        if ($contractIds->isEmpty() || !$this->hasTable('payments') || !$this->hasColumn('payments', 'amount') || !$this->hasColumn('payments', 'status')) {
            return 0.0;
        }

        return (float) Payment::whereIn('contract_id', $contractIds)->whereIn('status', $statuses)->sum('amount');
    }

    private function expensesSum(Collection $propertyIds, Collection $unitIds): float
    {
        if (!$this->hasTable('property_expenses') || !$this->hasColumn('property_expenses', 'amount')) {
            return 0.0;
        }

        $query = PropertyExpense::query();
        $canUseProperty = $this->hasColumn('property_expenses', 'property_id') && $propertyIds->isNotEmpty();
        $canUseUnit = $this->hasColumn('property_expenses', 'unit_id') && $unitIds->isNotEmpty();

        if ($canUseProperty || $canUseUnit) {
            $query->where(function ($expenseScope) use ($canUseProperty, $canUseUnit, $propertyIds, $unitIds) {
                $used = false;

                if ($canUseProperty) {
                    $expenseScope->whereIn('property_id', $propertyIds);
                    $used = true;
                }

                if ($canUseUnit) {
                    if ($used) {
                        $expenseScope->orWhereIn('unit_id', $unitIds);
                    } else {
                        $expenseScope->whereIn('unit_id', $unitIds);
                    }
                }
            });
        } else {
            return 0.0;
        }

        return (float) $query->sum('amount');
    }

    private function tenantsCount(Collection $contractIds): int
    {
        if ($contractIds->isEmpty() || !$this->hasTable('contracts') || !$this->hasColumn('contracts', 'tenant_id')) {
            return 0;
        }

        return (int) Contract::whereIn('id', $contractIds)->whereNotNull('tenant_id')->distinct('tenant_id')->count('tenant_id');
    }

    private function openChatTicketsCount(Collection $ownerIds, bool $isAdmin): int
    {
        if (!$this->hasTable('chat_threads')) {
            return 0;
        }

        $query = DB::table('chat_threads')->where('status', '<>', 'closed');
        if (!$isAdmin && $ownerIds->isNotEmpty() && $this->hasColumn('chat_threads', 'owner_id')) {
            $query->whereIn('owner_id', $ownerIds);
        }

        return (int) $query->count();
    }

    private function effectiveRole($user): string
    {
        if (!$user) {
            return '';
        }

        if (method_exists($user, 'effectiveRole')) {
            return strtolower((string) $user->effectiveRole());
        }

        return strtolower((string) ($user->role ?? ''));
    }

    private function isAdminRole(string $role): bool
    {
        return in_array($role, ['admin', 'manager', 'super_admin'], true);
    }

    private function hasTable(string $table): bool
    {
        try {
            return Schema::hasTable($table);
        } catch (Throwable $e) {
            return false;
        }
    }

    private function hasColumn(string $table, string $column): bool
    {
        try {
            return Schema::hasColumn($table, $column);
        } catch (Throwable $e) {
            return false;
        }
    }
}
