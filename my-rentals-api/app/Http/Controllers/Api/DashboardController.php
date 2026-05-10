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

class DashboardController extends Controller
{
    public function index()
    {
        $today = Carbon::today();

        $totalDue = Payment::whereIn('status', ['due', 'overdue'])->sum('amount');
        $totalPaid = Payment::where('status', 'paid')->sum('amount');
        $totalExpenses = PropertyExpense::sum('amount');

        $overduePayments = Payment::with([
                'contract.tenant',
                'contract.unit.property.owner',
            ])
            ->where('status', '!=', 'paid')
            ->whereDate('due_date', '<', $today)
            ->orderBy('due_date')
            ->limit(10)
            ->get()
            ->map(function ($payment) {
                return [
                    'id' => $payment->id,
                    'amount' => (float) $payment->amount,
                    'due_date' => $payment->due_date,
                    'tenant_name' => $payment->contract?->tenant?->name,
                    'unit_number' => $payment->contract?->unit?->unit_number,
                    'property_name' => $payment->contract?->unit?->property?->name,
                    'owner_name' => $payment->contract?->unit?->property?->owner?->name,
                ];
            });

        $owners = Owner::withCount('properties')
            ->orderBy('type')
            ->orderBy('name')
            ->get()
            ->map(function ($owner) {
                $propertyIds = Property::where('owner_id', $owner->id)->pluck('id');

                $unitIds = Unit::whereIn('property_id', $propertyIds)->pluck('id');

                $contractIds = Contract::whereIn('unit_id', $unitIds)->pluck('id');

                $income = Payment::whereIn('contract_id', $contractIds)
                    ->where('status', 'paid')
                    ->sum('amount');

                $due = Payment::whereIn('contract_id', $contractIds)
                    ->whereIn('status', ['due', 'overdue'])
                    ->sum('amount');

                $expenses = PropertyExpense::whereIn('property_id', $propertyIds)->sum('amount');

                return [
                    'id' => $owner->id,
                    'name' => $owner->name,
                    'type' => $owner->type,
                    'properties_count' => $owner->properties_count,
                    'units_count' => $unitIds->count(),
                    'contracts_count' => $contractIds->count(),
                    'paid_income' => (float) $income,
                    'due_income' => (float) $due,
                    'expenses' => (float) $expenses,
                    'net_income' => (float) ($income - $expenses),
                ];
            });

        return response()->json([
            'status' => 'ok',
            'app' => 'my-rentals-api',
            'summary' => [
                'owners_count' => Owner::count(),
                'properties_count' => Property::count(),
                'units_count' => Unit::count(),
                'tenants_count' => Tenant::count(),
                'active_contracts_count' => Contract::where('status', 'active')->count(),
                'total_due' => (float) $totalDue,
                'total_paid' => (float) $totalPaid,
                'total_expenses' => (float) $totalExpenses,
                'net_income' => (float) ($totalPaid - $totalExpenses),
                'overdue_count' => $overduePayments->count(),
            ],
            'owners' => $owners,
            'overdue_payments' => $overduePayments,
        ]);
    }
}
