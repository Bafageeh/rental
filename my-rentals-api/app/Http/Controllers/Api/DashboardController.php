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
use Illuminate\Support\Facades\Schema;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $user = function_exists('my_rentals_current_user_for_scope')
            ? my_rentals_current_user_for_scope($request)
            : $request->user();

        $ownerIds = $this->ownerIdsForUser($user);
        $propertyIds = $this->propertyIds($ownerIds);
        $visibleUnitIds = $this->visibleUnitIds($propertyIds);
        $allUnitIds = $this->allUnitIds($propertyIds);
        $contractIds = $this->contractIds($allUnitIds);
        $today = Carbon::today();

        $paidIncome = $this->paymentsSum($contractIds, ['paid']);
        $dueIncome = $this->paymentsSum($contractIds, ['due']);
        $overdueIncome = $this->paymentsSum($contractIds, ['overdue']);
        $expenses = $this->expensesSum($propertyIds);

        $unitsQuery = Unit::query()->whereIn('id', $visibleUnitIds);
        $unitsCount = (clone $unitsQuery)->count();
        $rentedUnits = (clone $unitsQuery)->where('status', 'rented')->count();
        $availableUnits = (clone $unitsQuery)->where('status', 'available')->count();
        $vacantUnits = (clone $unitsQuery)->whereIn('status', ['available', 'vacant'])->count();

        $overduePayments = $contractIds->isEmpty()
            ? collect()
            : Payment::with([
                'contract.tenant',
                'contract.unit.property.owner',
            ])
                ->whereIn('contract_id', $contractIds)
                ->where('status', '!=', 'paid')
                ->where(function ($query) use ($today) {
                    if (Schema::hasColumn('payments', 'due_date')) {
                        $query->whereDate('due_date', '<', $today);
                    } else {
                        $query->where('status', 'overdue');
                    }
                })
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

        $owners = $ownerIds->isEmpty()
            ? collect()
            : Owner::query()
                ->whereIn('id', $ownerIds)
                ->withCount('properties')
                ->orderBy('type')
                ->orderBy('name')
                ->get()
                ->map(function ($owner) {
                    $ownerPropertyIds = Property::where('owner_id', $owner->id)->pluck('id');
                    $ownerUnitIds = Unit::whereIn('property_id', $ownerPropertyIds)->pluck('id');
                    $ownerContractIds = Contract::whereIn('unit_id', $ownerUnitIds)->pluck('id');
                    $income = Payment::whereIn('contract_id', $ownerContractIds)->where('status', 'paid')->sum('amount');
                    $due = Payment::whereIn('contract_id', $ownerContractIds)->whereIn('status', ['due', 'overdue'])->sum('amount');
                    $expenses = PropertyExpense::whereIn('property_id', $ownerPropertyIds)->sum('amount');

                    return [
                        'id' => $owner->id,
                        'name' => $owner->name,
                        'type' => $owner->type,
                        'properties_count' => $owner->properties_count,
                        'units_count' => $ownerUnitIds->count(),
                        'contracts_count' => $ownerContractIds->count(),
                        'paid_income' => (float) $income,
                        'due_income' => (float) $due,
                        'expenses' => (float) $expenses,
                        'net_income' => (float) ($income - $expenses),
                    ];
                });

        return response()->json([
            'status' => 'ok',
            'app' => 'my-rentals-api',
            'scope' => [
                'owner_ids' => $ownerIds->values(),
                'property_ids' => $propertyIds->values(),
                'user_id' => $user?->id,
                'role' => $user?->role,
            ],
            'summary' => [
                'owners_count' => $ownerIds->count(),
                'properties_count' => $propertyIds->count(),
                'units_count' => $unitsCount,
                'rented_units_count' => $rentedUnits,
                'available_units_count' => $availableUnits,
                'vacant_units_count' => $vacantUnits,
                'occupancy_rate' => $unitsCount > 0 ? round(($rentedUnits / $unitsCount) * 100, 1) : 0,
                'tenants_count' => $this->tenantsCount($contractIds),
                'active_contracts_count' => $contractIds->isEmpty() ? 0 : Contract::whereIn('id', $contractIds)->where('status', 'active')->count(),
                'paid_income' => $paidIncome,
                'due_income' => $dueIncome,
                'overdue_income' => $overdueIncome,
                'expenses' => $expenses,
                'net_income' => $paidIncome - $expenses,
                'total_due' => $dueIncome + $overdueIncome,
                'total_paid' => $paidIncome,
                'total_expenses' => $expenses,
                'overdue_count' => $overduePayments->count(),
                'critical_alerts_count' => $overduePayments->count(),
                'open_followups_count' => 0,
            ],
            'owners' => $owners,
            'overdue_payments' => $overduePayments,
            'recent_due_payments' => $overduePayments,
        ]);
    }

    private function ownerIdsForUser($user): Collection
    {
        if (!$user || !Schema::hasTable('owners')) {
            return collect();
        }

        $role = method_exists($user, 'effectiveRole') ? $user->effectiveRole() : strtolower((string) ($user->role ?? ''));
        $isAdmin = in_array($role, ['admin', 'manager', 'super_admin'], true);
        $ownerIds = collect();

        if (!empty($user->owner_id)) {
            $ownerIds->push((int) $user->owner_id);
        }

        $linkedOwners = DB::table('owners')->where(function ($query) use ($user) {
            $hasCondition = false;

            if (!empty($user->id)) {
                if (Schema::hasColumn('owners', 'user_id')) {
                    $query->orWhere('user_id', $user->id);
                    $hasCondition = true;
                }

                if (Schema::hasColumn('owners', 'account_user_id')) {
                    $query->orWhere('account_user_id', $user->id);
                    $hasCondition = true;
                }
            }

            if (!$hasCondition) {
                $query->whereRaw('1 = 0');
            }
        })->pluck('id');

        $ownerIds = $ownerIds->merge($linkedOwners);

        if ($isAdmin && $ownerIds->isEmpty() && Schema::hasColumn('owners', 'type')) {
            $ownerIds = $ownerIds->merge(DB::table('owners')->where('type', 'self')->pluck('id'));
        }

        return $ownerIds
            ->filter(fn ($id) => !empty($id))
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();
    }

    private function propertyIds(Collection $ownerIds): Collection
    {
        if ($ownerIds->isEmpty() || !Schema::hasTable('properties') || !Schema::hasColumn('properties', 'owner_id')) {
            return collect();
        }

        return Property::whereIn('owner_id', $ownerIds)->pluck('id')->values();
    }

    private function visibleUnitIds(Collection $propertyIds): Collection
    {
        if ($propertyIds->isEmpty() || !Schema::hasTable('units') || !Schema::hasColumn('units', 'property_id')) {
            return collect();
        }

        return Unit::whereIn('property_id', $propertyIds)
            ->where('unit_number', '!=', 'العقار كامل')
            ->where(function ($query) {
                $query->whereNull('type')->orWhere('type', '!=', 'whole_property');
            })
            ->pluck('id')
            ->values();
    }

    private function allUnitIds(Collection $propertyIds): Collection
    {
        if ($propertyIds->isEmpty() || !Schema::hasTable('units') || !Schema::hasColumn('units', 'property_id')) {
            return collect();
        }

        return Unit::whereIn('property_id', $propertyIds)->pluck('id')->values();
    }

    private function contractIds(Collection $unitIds): Collection
    {
        if ($unitIds->isEmpty() || !Schema::hasTable('contracts') || !Schema::hasColumn('contracts', 'unit_id')) {
            return collect();
        }

        return Contract::whereIn('unit_id', $unitIds)->pluck('id')->values();
    }

    private function paymentsSum(Collection $contractIds, array $statuses): float
    {
        if ($contractIds->isEmpty() || !Schema::hasTable('payments') || !Schema::hasColumn('payments', 'amount')) {
            return 0.0;
        }

        return (float) Payment::whereIn('contract_id', $contractIds)->whereIn('status', $statuses)->sum('amount');
    }

    private function expensesSum(Collection $propertyIds): float
    {
        if ($propertyIds->isEmpty() || !class_exists(PropertyExpense::class) || !Schema::hasTable('property_expenses')) {
            return 0.0;
        }

        return (float) PropertyExpense::whereIn('property_id', $propertyIds)->sum('amount');
    }

    private function tenantsCount(Collection $contractIds): int
    {
        if ($contractIds->isEmpty() || !Schema::hasTable('contracts') || !Schema::hasColumn('contracts', 'tenant_id')) {
            return 0;
        }

        return (int) Contract::whereIn('id', $contractIds)->whereNotNull('tenant_id')->distinct('tenant_id')->count('tenant_id');
    }
}
