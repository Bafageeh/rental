<?php

use App\Models\Contract;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (!function_exists('mrco_number')) {
    function mrco_number($value): float
    {
        if ($value === null || $value === '') return 0.0;
        return is_numeric($value) ? (float) $value : (float) str_replace(',', '', (string) $value);
    }
}

if (!function_exists('mrco_status')) {
    function mrco_status($value): string
    {
        return trim(mb_strtolower((string) ($value ?? '')));
    }
}

if (!function_exists('mrco_payment_amount')) {
    function mrco_payment_amount($payment): float
    {
        return mrco_number($payment->amount ?? $payment->payment_amount ?? $payment->due_amount ?? 0);
    }
}

if (!function_exists('mrco_payment_paid_amount')) {
    function mrco_payment_paid_amount($payment): float
    {
        $paid = mrco_number($payment->paid_amount ?? 0);
        if ($paid > 0) return $paid;
        return in_array(mrco_status($payment->status ?? null), ['paid', 'مدفوع', 'مدفوعة', 'مسدد'], true)
            ? mrco_payment_amount($payment)
            : 0.0;
    }
}

if (!function_exists('mrco_payment_due_date')) {
    function mrco_payment_due_date($payment): string
    {
        return substr((string) ($payment->due_date ?? ''), 0, 10);
    }
}

if (!function_exists('mrco_is_due_payment')) {
    function mrco_is_due_payment($payment, string $today): bool
    {
        $dueDate = mrco_payment_due_date($payment);
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $dueDate) && $dueDate <= $today;
    }
}

if (!function_exists('mrco_contract_payment_value')) {
    function mrco_contract_payment_value($contract, $payments): float
    {
        $regular = mrco_number($contract->regular_payment_amount ?? 0);
        if ($regular > 0) return $regular;
        foreach ($payments as $payment) {
            $amount = mrco_payment_amount($payment);
            if ($amount > 0) return $amount;
        }
        $total = mrco_number($contract->total_contract_value ?? 0);
        if ($total <= 0) $total = mrco_number($contract->rent_amount ?? 0);
        return $total > 0 ? ($total / max(1, count($payments))) : 0.0;
    }
}

if (!function_exists('mrco_apply_overdue_formula_to_contract')) {
    function mrco_apply_overdue_formula_to_contract($contract)
    {
        $payments = $contract->payments ? $contract->payments->sortBy([['due_date', 'asc'], ['id', 'asc']])->values() : collect();
        if ($payments->isEmpty()) {
            $contract->setAttribute('overdue_payments_count', 0);
            $contract->setAttribute('overdue_amount', 0);
            return $contract;
        }

        $today = now()->toDateString();
        $dueTotal = $payments->filter(fn ($p) => mrco_is_due_payment($p, $today))->sum(fn ($p) => mrco_payment_amount($p));
        $paidTotal = $payments->sum(fn ($p) => mrco_payment_paid_amount($p));
        $overdueAmount = max(0.0, $dueTotal - $paidTotal);
        $paymentValue = mrco_contract_payment_value($contract, $payments);
        $overdueCount = ($overdueAmount > 0 && $paymentValue > 0) ? (int) ceil($overdueAmount / $paymentValue) : 0;

        // Allocate the total paid amount cumulatively to the oldest installments.
        // Covered cards are shown as paid, regardless of their original row status.
        $remainingPaid = $paidTotal;
        $remainingOverdue = $overdueAmount;
        $markedOverdue = 0;

        foreach ($payments as $payment) {
            $amount = mrco_payment_amount($payment);
            $dueDate = mrco_payment_due_date($payment);
            $isDue = preg_match('/^\d{4}-\d{2}-\d{2}$/', $dueDate) && $dueDate <= $today;

            if ($amount > 0 && $remainingPaid >= $amount) {
                $payment->setAttribute('status', 'paid');
                $payment->setAttribute('badge', 'مدفوعة');
                $payment->setAttribute('paid_amount', $amount);
                $payment->setAttribute('remaining_amount', 0);
                $remainingPaid -= $amount;
                continue;
            }

            if ($isDue && $markedOverdue < $overdueCount && $remainingOverdue > 0) {
                $remaining = $amount > 0 ? min($amount, $remainingOverdue) : $remainingOverdue;
                $payment->setAttribute('status', 'overdue');
                $payment->setAttribute('badge', 'متأخرة');
                $payment->setAttribute('paid_amount', max(0, $remainingPaid));
                $payment->setAttribute('remaining_amount', $remaining);
                $remainingPaid = 0;
                $remainingOverdue -= $remaining;
                $markedOverdue++;
                continue;
            }

            $payment->setAttribute('status', 'pending');
            $payment->setAttribute('badge', 'مستحقة');
            $payment->setAttribute('paid_amount', 0);
            $payment->setAttribute('remaining_amount', $amount);
        }

        $contract->setRelation('payments', $payments);
        $contract->setAttribute('overdue_payments_count', $overdueCount);
        $contract->setAttribute('overdue_amount', $overdueAmount);
        $contract->setAttribute('paid_total_amount', $paidTotal);
        $contract->setAttribute('due_total_until_today', $dueTotal);
        return $contract;
    }
}

if (!function_exists('mrco_current_user')) {
    function mrco_current_user(Request $request)
    {
        if (function_exists('my_rentals_current_user_for_scope')) {
            $user = my_rentals_current_user_for_scope($request);
            if ($user) return $user;
        }
        if (function_exists('my_rentals_bearer_user')) {
            $user = my_rentals_bearer_user($request);
            if ($user) return $user;
        }
        return $request->user();
    }
}

if (!function_exists('mrco_is_admin')) {
    function mrco_is_admin($user): bool
    {
        if (!$user) return false;
        if (function_exists('my_rentals_is_admin_user')) return (bool) my_rentals_is_admin_user($user);
        return in_array(strtolower((string) ($user->role ?? '')), ['admin', 'manager', 'super_admin'], true);
    }
}

if (!function_exists('mrco_owner_property_ids')) {
    function mrco_owner_property_ids($ownerId)
    {
        if (!$ownerId || !Schema::hasTable('properties') || !Schema::hasColumn('properties', 'owner_id')) return collect();
        return \App\Models\Property::query()->where('owner_id', $ownerId)->pluck('id')->map(fn ($id) => (int) $id)->unique()->values();
    }
}

if (!function_exists('mrco_base_contract_query')) {
    function mrco_base_contract_query()
    {
        return Contract::query()->with([
            'tenant',
            'unit.property.owner',
            'parkingSpot',
            'files',
            'payments' => fn ($q) => $q->orderBy('due_date')->orderBy('id'),
        ]);
    }
}

if (!function_exists('mrco_apply_scope')) {
    function mrco_apply_scope($query, Request $request)
    {
        $user = mrco_current_user($request);
        if (!$user) return $query->whereRaw('1 = 0');
        if (mrco_is_admin($user)) return $query;
        if (empty($user->owner_id)) return $query->whereRaw('1 = 0');
        $propertyIds = mrco_owner_property_ids($user->owner_id);
        return $query->whereHas('unit', function ($unitQuery) use ($user, $propertyIds) {
            $unitQuery->where(function ($q) use ($user, $propertyIds) {
                $used = false;
                if (Schema::hasColumn('units', 'owner_id')) {
                    $q->where('owner_id', $user->owner_id);
                    $used = true;
                }
                if (Schema::hasColumn('units', 'property_id') && $propertyIds->isNotEmpty()) {
                    $used ? $q->orWhereIn('property_id', $propertyIds->all()) : $q->whereIn('property_id', $propertyIds->all());
                }
            });
        });
    }
}

if (!function_exists('mrco_contracts_response')) {
    function mrco_contracts_response(Request $request, bool $scoped = false)
    {
        $query = mrco_base_contract_query();
        if ($scoped) $query = mrco_apply_scope($query, $request);
        if ($request->filled('unit_id')) $query->where('unit_id', (int) $request->input('unit_id'));
        if ($request->filled('property_id')) {
            $propertyId = (int) $request->input('property_id');
            $query->whereHas('unit', fn ($u) => $u->where('property_id', $propertyId));
        }
        if ($request->filled('owner_id')) {
            $ownerId = (int) $request->input('owner_id');
            $propertyIds = mrco_owner_property_ids($ownerId);
            $query->whereHas('unit', fn ($u) => $u->whereIn('property_id', $propertyIds->all()));
        }
        if ($request->filled('status')) $query->where('status', $request->input('status'));
        return $query->orderByDesc('id')->get()->map(fn ($contract) => mrco_apply_overdue_formula_to_contract($contract))->values();
    }
}

Route::get('/contracts', fn (Request $request) => mrco_contracts_response($request, false));
Route::get('/my/contracts', fn (Request $request) => mrco_contracts_response($request, true));
Route::get('/contracts/{contract}', fn (Request $request, Contract $contract) => mrco_apply_overdue_formula_to_contract($contract->load(['tenant', 'unit.property.owner', 'parkingSpot', 'files', 'payments' => fn ($q) => $q->orderBy('due_date')->orderBy('id')])));
Route::get('/my/contracts/{contract}', function (Request $request, Contract $contract) {
    $query = mrco_apply_scope(mrco_base_contract_query()->where('id', $contract->id), $request);
    $scopedContract = $query->first();
    if (!$scopedContract) return response()->json(['message' => 'العقد غير موجود أو خارج صلاحياتك.'], 404);
    return mrco_apply_overdue_formula_to_contract($scopedContract);
});
Route::get('/units/{unit}/contracts', function (Request $request, \App\Models\Unit $unit) { $request->merge(['unit_id' => $unit->id]); return mrco_contracts_response($request, false); });
Route::get('/my/units/{unit}/contracts', function (Request $request, \App\Models\Unit $unit) { $request->merge(['unit_id' => $unit->id]); return mrco_contracts_response($request, true); });
