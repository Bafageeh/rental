<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Contract;
use App\Models\Owner;
use App\Models\Payment;
use App\Models\Property;
use App\Models\PropertyExpense;
use App\Models\Unit;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;

class OwnerDashboardController extends Controller
{
    public function show(Request $request, Owner $owner): JsonResponse
    {
        return response()->json($this->buildPayload($request, $owner));
    }

    public function showScoped(Request $request, Owner $owner): JsonResponse
    {
        $user = function_exists('my_rentals_current_user_for_scope')
            ? my_rentals_current_user_for_scope($request)
            : (function_exists('my_rentals_bearer_user') ? my_rentals_bearer_user($request) : null);

        if (!$user) {
            return response()->json([
                'message' => 'غير مصرح. الرجاء تسجيل الدخول.',
            ], 401);
        }

        $isAdmin = function_exists('my_rentals_is_admin_user')
            ? my_rentals_is_admin_user($user)
            : in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);

        if (!$isAdmin && (int) ($user->owner_id ?? 0) !== (int) $owner->id) {
            return response()->json([
                'message' => 'لا تملك صلاحية عرض داشبورد هذا المالك.',
            ], 403);
        }

        return response()->json($this->buildPayload($request, $owner, [
            'is_admin' => $isAdmin,
            'user_id' => $user->id ?? null,
        ]));
    }

    private function buildPayload(Request $request, Owner $owner, array $scope = []): array
    {
        [$fromDate, $toDate] = $this->dateRange($request);

        $propertyIds = $this->propertyIdsForOwner($owner);
        $unitIds = $this->unitIdsForOwner($owner, $propertyIds);
        $contractIds = $this->contractIdsForUnits($unitIds);

        $properties = $this->properties($propertyIds);
        $units = $this->units($unitIds);
        $contracts = $this->contracts($contractIds);
        $payments = $this->payments($contractIds, $fromDate, $toDate);
        $expenses = $this->expenses($propertyIds, $fromDate, $toDate);
        $activities = $this->activities($owner);

        $paidIncome = $this->sumPayments($contractIds, 'paid', $fromDate, $toDate);
        $dueIncome = $this->sumPayments($contractIds, 'due', $fromDate, $toDate);
        $overdueIncome = $this->sumPayments($contractIds, 'overdue', $fromDate, $toDate);
        $expensesTotal = (float) $expenses['total'];

        $unitsCount = $units->count();
        $rentedUnits = $units->where('status', 'rented')->count();
        $availableUnits = $units->where('status', 'available')->count();
        $maintenanceUnits = $units->where('status', 'maintenance')->count();

        $activeContracts = $contracts->where('status', 'active')->count();
        $endedContracts = $contracts->whereIn('status', ['ended', 'cancelled'])->count();
        $expiringSoon = $this->expiringContractsCount($contractIds);

        return [
            'status' => 'ok',
            'owner' => [
                'id' => $owner->id,
                'name' => $owner->name,
                'phone' => $owner->phone,
                'email' => $owner->email,
                'national_id' => $owner->national_id,
                'type' => $owner->type,
                'notes' => $owner->notes,
                'properties_count' => $propertyIds->count(),
            ],
            'scope' => $scope,
            'filters' => [
                'from' => $fromDate,
                'to' => $toDate,
            ],
            'summary' => [
                'properties_count' => $propertyIds->count(),
                'units_count' => $unitsCount,
                'rented_units_count' => $rentedUnits,
                'available_units_count' => $availableUnits,
                'maintenance_units_count' => $maintenanceUnits,
                'occupancy_rate' => $unitsCount > 0 ? round(($rentedUnits / $unitsCount) * 100, 1) : 0,
                'contracts_count' => $contracts->count(),
                'active_contracts_count' => $activeContracts,
                'ended_contracts_count' => $endedContracts,
                'expiring_soon_contracts_count' => $expiringSoon,
                'paid_income' => $paidIncome,
                'due_income' => $dueIncome,
                'overdue_income' => $overdueIncome,
                'expenses' => $expensesTotal,
                'net_income' => $paidIncome - $expensesTotal,
            ],
            'properties' => $properties->map(fn (Property $property) => $this->propertyPayload($property, $units, $contracts, $payments['all'], $expenses['all']))->values(),
            'units' => $units->map(fn (Unit $unit) => $this->unitPayload($unit))->values(),
            'contracts' => $contracts->take(20)->map(fn (Contract $contract) => $this->contractPayload($contract))->values(),
            'payments' => $payments['items'],
            'overdue_payments' => $payments['overdue'],
            'expenses' => $expenses['items'],
            'activities' => $activities,
        ];
    }

    private function propertyIdsForOwner(Owner $owner): Collection
    {
        if (!Schema::hasTable('properties') || !Schema::hasColumn('properties', 'owner_id')) {
            return collect();
        }

        return Property::query()
            ->where('owner_id', $owner->id)
            ->pluck('id')
            ->values();
    }

    private function unitIdsForOwner(Owner $owner, Collection $propertyIds): Collection
    {
        if (!Schema::hasTable('units')) {
            return collect();
        }

        $canUsePropertyScope = Schema::hasColumn('units', 'property_id') && $propertyIds->isNotEmpty();
        $canUseDirectOwnerScope = Schema::hasColumn('units', 'owner_id');

        if (!$canUsePropertyScope && !$canUseDirectOwnerScope) {
            return collect();
        }

        $query = Unit::query();

        $query->where(function ($q) use ($owner, $propertyIds, $canUsePropertyScope, $canUseDirectOwnerScope) {
            if ($canUsePropertyScope) {
                $q->whereIn('property_id', $propertyIds);
            }

            if ($canUseDirectOwnerScope) {
                $q->orWhere('owner_id', $owner->id);
            }
        });

        return $query->pluck('id')->unique()->values();
    }

    private function contractIdsForUnits(Collection $unitIds): Collection
    {
        if (!Schema::hasTable('contracts') || !Schema::hasColumn('contracts', 'unit_id') || $unitIds->isEmpty()) {
            return collect();
        }

        return Contract::query()
            ->whereIn('unit_id', $unitIds)
            ->pluck('id')
            ->values();
    }

    private function properties(Collection $propertyIds): Collection
    {
        if (!Schema::hasTable('properties') || $propertyIds->isEmpty()) {
            return collect();
        }

        return Property::query()
            ->whereIn('id', $propertyIds)
            ->orderByDesc('id')
            ->limit(100)
            ->get();
    }

    private function units(Collection $unitIds): Collection
    {
        if (!Schema::hasTable('units') || $unitIds->isEmpty()) {
            return collect();
        }

        return Unit::with('property')
            ->whereIn('id', $unitIds)
            ->orderBy('unit_number')
            ->get();
    }

    private function contracts(Collection $contractIds): Collection
    {
        if (!Schema::hasTable('contracts') || $contractIds->isEmpty()) {
            return collect();
        }

        return Contract::with(['tenant', 'unit.property'])
            ->whereIn('id', $contractIds)
            ->orderByDesc('id')
            ->get();
    }

    private function payments(Collection $contractIds, ?string $fromDate, ?string $toDate): array
    {
        if (!Schema::hasTable('payments') || $contractIds->isEmpty()) {
            return [
                'all' => collect(),
                'items' => collect(),
                'overdue' => collect(),
            ];
        }

        $allQuery = Payment::with(['contract.tenant', 'contract.unit.property'])
            ->whereIn('contract_id', $contractIds);
        $this->applyAnyPaymentDateRange($allQuery, $fromDate, $toDate);
        $all = $this->orderPayments($allQuery)->limit(200)->get();

        $items = $all->take(25)->map(fn (Payment $payment) => $this->paymentPayload($payment))->values();

        $overdueQuery = Payment::with(['contract.tenant', 'contract.unit.property'])
            ->whereIn('contract_id', $contractIds)
            ->where('status', '!=', 'paid');

        if (Schema::hasColumn('payments', 'due_date')) {
            $overdueQuery->whereDate('due_date', '<', Carbon::today());
        } else {
            $overdueQuery->where('status', 'overdue');
        }

        $this->applyAnyPaymentDateRange($overdueQuery, $fromDate, $toDate);

        $overdue = $this->orderPayments($overdueQuery)
            ->limit(10)
            ->get()
            ->map(fn (Payment $payment) => $this->paymentPayload($payment))
            ->values();

        return [
            'all' => $all,
            'items' => $items,
            'overdue' => $overdue,
        ];
    }

    private function expenses(Collection $propertyIds, ?string $fromDate, ?string $toDate): array
    {
        if (!class_exists(PropertyExpense::class) || !Schema::hasTable('property_expenses') || $propertyIds->isEmpty()) {
            return [
                'all' => collect(),
                'items' => collect(),
                'total' => 0.0,
            ];
        }

        $query = PropertyExpense::with(['property', 'category'])
            ->whereIn('property_id', $propertyIds);

        $this->applyDateRange($query, 'property_expenses', $this->firstExistingColumn('property_expenses', ['expense_date', 'created_at']), $fromDate, $toDate);

        $all = $this->orderByExisting($query, 'property_expenses', ['expense_date', 'created_at', 'id'])->limit(200)->get();

        return [
            'all' => $all,
            'items' => $all->take(25)->map(fn (PropertyExpense $expense) => $this->expensePayload($expense))->values(),
            'total' => (float) $all->sum('amount'),
        ];
    }

    private function activities(Owner $owner): Collection
    {
        if (!class_exists(ActivityLog::class) || !Schema::hasTable('activity_logs')) {
            return collect();
        }

        $query = ActivityLog::query();

        $query->where(function ($q) use ($owner) {
            if (Schema::hasColumn('activity_logs', 'owner_id')) {
                $q->where('owner_id', $owner->id);
            }

            if (Schema::hasColumn('activity_logs', 'resource') && Schema::hasColumn('activity_logs', 'record_id')) {
                $q->orWhere(function ($nested) use ($owner) {
                    $nested->whereIn('resource', ['owner', 'owners'])
                        ->where('record_id', $owner->id);
                });
            }
        });

        $this->orderByExisting($query, 'activity_logs', ['created_at', 'id']);

        return $query->limit(20)->get()->map(fn (ActivityLog $activity) => [
            'id' => $activity->id,
            'action' => $activity->action,
            'resource' => $activity->resource,
            'resource_label' => $activity->resource_label,
            'record_title' => $activity->record_title,
            'user_name' => $activity->user_name,
            'created_at' => $activity->created_at,
        ])->values();
    }

    private function sumPayments(Collection $contractIds, string $status, ?string $fromDate, ?string $toDate): float
    {
        if (!Schema::hasTable('payments') || $contractIds->isEmpty() || !Schema::hasColumn('payments', 'amount')) {
            return 0.0;
        }

        $query = Payment::query()
            ->whereIn('contract_id', $contractIds)
            ->where('status', $status);

        $column = $status === 'paid'
            ? $this->firstExistingColumn('payments', ['paid_date', 'due_date', 'created_at'])
            : $this->firstExistingColumn('payments', ['due_date', 'created_at']);

        $this->applyDateRange($query, 'payments', $column, $fromDate, $toDate);

        return (float) $query->sum('amount');
    }

    private function expiringContractsCount(Collection $contractIds): int
    {
        if (!Schema::hasTable('contracts') || $contractIds->isEmpty() || !Schema::hasColumn('contracts', 'end_date')) {
            return 0;
        }

        return Contract::query()
            ->whereIn('id', $contractIds)
            ->where('status', 'active')
            ->whereDate('end_date', '>=', Carbon::today())
            ->whereDate('end_date', '<=', Carbon::today()->addDays(30))
            ->count();
    }

    private function propertyPayload(Property $property, Collection $units, Collection $contracts, Collection $payments, Collection $expenses): array
    {
        $propertyUnits = $units->where('property_id', $property->id);
        $unitIds = $propertyUnits->pluck('id');
        $propertyContracts = $contracts->filter(fn (Contract $contract) => $unitIds->contains((int) $contract->unit_id));
        $contractIds = $propertyContracts->pluck('id');
        $propertyPayments = $payments->filter(fn (Payment $payment) => $contractIds->contains((int) $payment->contract_id));
        $propertyExpenses = $expenses->where('property_id', $property->id);

        return [
            'id' => $property->id,
            'name' => $property->name,
            'city' => $property->city,
            'district' => $property->district,
            'property_type' => $property->property_type,
            'units_count' => $propertyUnits->count(),
            'rented_units_count' => $propertyUnits->where('status', 'rented')->count(),
            'active_contracts_count' => $propertyContracts->where('status', 'active')->count(),
            'paid_income' => (float) $propertyPayments->where('status', 'paid')->sum('amount'),
            'due_income' => (float) $propertyPayments->whereIn('status', ['due', 'overdue'])->sum('amount'),
            'expenses' => (float) $propertyExpenses->sum('amount'),
            'units' => $propertyUnits->map(fn (Unit $unit) => $this->unitPayload($unit))->values(),
        ];
    }

    private function unitPayload(Unit $unit): array
    {
        return [
            'id' => $unit->id,
            'property_id' => $this->hasColumn('units', 'property_id') ? $unit->property_id : null,
            'owner_id' => $this->hasColumn('units', 'owner_id') ? $unit->owner_id : null,
            'unit_scope' => $this->hasColumn('units', 'unit_scope') ? $unit->unit_scope : null,
            'unit_number' => $unit->unit_number,
            'name' => $unit->name ?? null,
            'type' => $unit->type,
            'floor' => $unit->floor,
            'status' => $unit->status,
            'rent_amount' => (float) ($unit->rent_amount ?? 0),
            'property_name' => $unit->property?->name,
        ];
    }

    private function contractPayload(Contract $contract): array
    {
        return [
            'id' => $contract->id,
            'contract_number' => $contract->contract_number,
            'government_contract_number' => $contract->government_contract_number,
            'tenant_name' => $contract->tenant?->name,
            'property_name' => $contract->unit?->property?->name,
            'unit_number' => $contract->unit?->unit_number,
            'start_date' => $contract->start_date,
            'end_date' => $contract->end_date,
            'status' => $contract->status,
            'rent_amount' => (float) ($contract->rent_amount ?? 0),
        ];
    }

    private function paymentPayload(Payment $payment): array
    {
        return [
            'id' => $payment->id,
            'amount' => (float) ($payment->amount ?? 0),
            'status' => $payment->status,
            'due_date' => $payment->due_date,
            'paid_date' => $payment->paid_date,
            'tenant_name' => $payment->contract?->tenant?->name,
            'property_name' => $payment->contract?->unit?->property?->name,
            'unit_number' => $payment->contract?->unit?->unit_number,
        ];
    }

    private function expensePayload(PropertyExpense $expense): array
    {
        return [
            'id' => $expense->id,
            'amount' => (float) ($expense->amount ?? 0),
            'expense_date' => $expense->expense_date,
            'title' => $expense->title ?? $expense->expense_type ?? null,
            'description' => $expense->description ?? $expense->notes ?? null,
            'category_name' => $expense->category?->name,
            'property_name' => $expense->property?->name,
        ];
    }

    private function dateRange(Request $request): array
    {
        return [
            $this->normalizeDate($request->query('from')),
            $this->normalizeDate($request->query('to')),
        ];
    }

    private function normalizeDate(mixed $date): ?string
    {
        $value = trim((string) ($date ?? ''));

        if ($value === '') {
            return null;
        }

        try {
            return Carbon::parse($value)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }

    private function applyAnyPaymentDateRange(Builder $query, ?string $fromDate, ?string $toDate): void
    {
        if (!$fromDate && !$toDate) {
            return;
        }

        $columns = array_values(array_filter([
            $this->hasColumn('payments', 'paid_date') ? 'paid_date' : null,
            $this->hasColumn('payments', 'due_date') ? 'due_date' : null,
            $this->hasColumn('payments', 'created_at') ? 'created_at' : null,
        ]));

        if (!$columns) {
            return;
        }

        $query->where(function ($q) use ($columns, $fromDate, $toDate) {
            foreach ($columns as $column) {
                $q->orWhere(function ($nested) use ($column, $fromDate, $toDate) {
                    if ($fromDate) {
                        $nested->whereDate($column, '>=', $fromDate);
                    }
                    if ($toDate) {
                        $nested->whereDate($column, '<=', $toDate);
                    }
                });
            }
        });
    }

    private function applyDateRange(Builder $query, string $table, ?string $column, ?string $fromDate, ?string $toDate): void
    {
        if (!$column || (!$fromDate && !$toDate) || !$this->hasColumn($table, $column)) {
            return;
        }

        if ($fromDate) {
            $query->whereDate($column, '>=', $fromDate);
        }

        if ($toDate) {
            $query->whereDate($column, '<=', $toDate);
        }
    }

    private function orderPayments(Builder $query): Builder
    {
        foreach (['due_date', 'paid_date', 'created_at', 'id'] as $column) {
            if ($this->hasColumn('payments', $column)) {
                return $query->orderByDesc($column);
            }
        }

        return $query;
    }

    private function orderByExisting(Builder $query, string $table, array $columns): Builder
    {
        foreach ($columns as $column) {
            if ($this->hasColumn($table, $column)) {
                return $query->orderByDesc($column);
            }
        }

        return $query;
    }

    private function firstExistingColumn(string $table, array $columns): ?string
    {
        foreach ($columns as $column) {
            if ($this->hasColumn($table, $column)) {
                return $column;
            }
        }

        return null;
    }

    private function hasColumn(string $table, string $column): bool
    {
        return Schema::hasTable($table) && Schema::hasColumn($table, $column);
    }
}
