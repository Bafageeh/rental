<?php

use App\Models\Contract;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

/*
|--------------------------------------------------------------------------
| Contract overdue formula override
|--------------------------------------------------------------------------
| قاعدة المتأخرات:
| المتأخر = مجموع الدفعات المستحقة حتى اليوم - مجموع كل المدفوعات.
| عدد الدفعات المتأخرة = ceil(المبلغ المتأخر / قيمة الدفعة).
|
| هذا الملف يُحمّل في آخر api.php حتى تكون استجابة /contracts و /my/contracts
| مبنية على هذه المعادلة في كل الشاشات التي تعتمد على بيانات العقود والدفعات.
*/

if (!function_exists('mrco_number')) {
    function mrco_number($value): float
    {
        if ($value === null || $value === '') {
            return 0.0;
        }
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
        if ($paid > 0) {
            return $paid;
        }

        return in_array(mrco_status($payment->status ?? null), ['paid', 'مدفوع', 'مسدد', 'سدد'], true)
            ? mrco_payment_amount($payment)
            : 0.0;
    }
}

if (!function_exists('mrco_is_due_payment')) {
    function mrco_is_due_payment($payment, string $today): bool
    {
        $dueDate = substr((string) ($payment->due_date ?? ''), 0, 10);
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $dueDate) && $dueDate <= $today;
    }
}

if (!function_exists('mrco_contract_payment_value')) {
    function mrco_contract_payment_value($contract, $payments): float
    {
        $regular = mrco_number($contract->regular_payment_amount ?? 0);
        if ($regular > 0) {
            return $regular;
        }

        foreach ($payments as $payment) {
            $amount = mrco_payment_amount($payment);
            if ($amount > 0) {
                return $amount;
            }
        }

        $count = max(1, count($payments));
        $total = mrco_number($contract->total_contract_value ?? 0);
        if ($total <= 0) {
            $total = mrco_number($contract->rent_amount ?? 0);
        }

        return $total > 0 ? ($total / $count) : 0.0;
    }
}

if (!function_exists('mrco_apply_overdue_formula_to_contract')) {
    function mrco_apply_overdue_formula_to_contract($contract)
    {
        $payments = $contract->payments ? $contract->payments->sortBy('due_date')->values() : collect();
        if ($payments->isEmpty()) {
            $contract->setAttribute('overdue_payments_count', 0);
            $contract->setAttribute('overdue_amount', 0);
            return $contract;
        }

        $today = now()->toDateString();
        $dueTotal = $payments
            ->filter(fn ($payment) => mrco_is_due_payment($payment, $today))
            ->sum(fn ($payment) => mrco_payment_amount($payment));

        $paidTotal = $payments->sum(fn ($payment) => mrco_payment_paid_amount($payment));
        $overdueAmount = max(0.0, $dueTotal - $paidTotal);
        $paymentValue = mrco_contract_payment_value($contract, $payments);
        $overdueCount = ($overdueAmount > 0 && $paymentValue > 0) ? (int) ceil($overdueAmount / $paymentValue) : 0;

        $remainingToAllocate = $overdueAmount;
        $marked = 0;

        foreach ($payments as $payment) {
            $status = mrco_status($payment->status ?? null);
            $amount = mrco_payment_amount($payment);
            $paid = mrco_payment_paid_amount($payment);
            $isPaid = in_array($status, ['paid', 'مدفوع', 'مسدد', 'سدد'], true) || ($paid >= $amount && $amount > 0);

            if ($isPaid) {
                $payment->setAttribute('status', 'paid');
                $payment->setAttribute('remaining_amount', 0);
                continue;
            }

            if ($marked < $overdueCount && $remainingToAllocate > 0) {
                $allocated = min($paymentValue > 0 ? $paymentValue : $amount, $remainingToAllocate);
                if ($allocated <= 0) {
                    $allocated = min($amount, $remainingToAllocate);
                }

                $payment->setAttribute('status', 'overdue');
                $payment->setAttribute('remaining_amount', $allocated);
                $payment->setAttribute('paid_amount', 0);
                $remainingToAllocate -= $allocated;
                $marked++;
            } else {
                $payment->setAttribute('status', 'pending');
                $payment->setAttribute('remaining_amount', max(0, $amount - $paid));
            }
        }

        $contract->setRelation('payments', $payments);
        $contract->setAttribute('overdue_payments_count', $overdueCount);
        $contract->setAttribute('overdue_amount', $overdueAmount);

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
        if (!$ownerId || !Schema::hasTable('properties') || !Schema::hasColumn('properties', 'owner_id')) {
            return collect();
        }
        return \App\Models\Property::query()->where('owner_id', $ownerId)->pluck('id')->map(fn ($id) => (int) $id)->unique()->values();
    }
}

if (!function_exists('mrco_contracts_response')) {
    function mrco_contracts_response(Request $request, bool $scoped = false)
    {
        $query = Contract::query()->with([
            'tenant',
            'unit.property.owner',
            'parkingSpot',
            'files',
            'payments' => fn ($paymentQuery) => $paymentQuery->orderBy('due_date')->orderBy('id'),
        ]);

        if ($scoped) {
            $user = mrco_current_user($request);
            if (!$user) {
                return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
            }

            if (!mrco_is_admin($user)) {
                if (empty($user->owner_id)) {
                    $query->whereRaw('1 = 0');
                } else {
                    $propertyIds = mrco_owner_property_ids($user->owner_id);
                    $query->whereHas('unit', function ($unitQuery) use ($user, $propertyIds) {
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
        }

        if ($request->filled('unit_id')) {
            $query->where('unit_id', (int) $request->input('unit_id'));
        }

        if ($request->filled('property_id')) {
            $propertyId = (int) $request->input('property_id');
            $query->whereHas('unit', fn ($unitQuery) => $unitQuery->where('property_id', $propertyId));
        }

        if ($request->filled('owner_id')) {
            $ownerId = (int) $request->input('owner_id');
            $propertyIds = mrco_owner_property_ids($ownerId);
            $query->whereHas('unit', function ($unitQuery) use ($ownerId, $propertyIds) {
                $unitQuery->where(function ($q) use ($ownerId, $propertyIds) {
                    $used = false;
                    if (Schema::hasColumn('units', 'owner_id')) {
                        $q->where('owner_id', $ownerId);
                        $used = true;
                    }
                    if (Schema::hasColumn('units', 'property_id') && $propertyIds->isNotEmpty()) {
                        $used ? $q->orWhereIn('property_id', $propertyIds->all()) : $q->whereIn('property_id', $propertyIds->all());
                    }
                });
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            if ($search !== '') {
                $query->where(function ($searchQuery) use ($search) {
                    $searchQuery
                        ->where('contract_number', 'like', "%{$search}%")
                        ->orWhere('government_contract_number', 'like', "%{$search}%")
                        ->orWhere('ejar_record_number', 'like', "%{$search}%")
                        ->orWhereHas('tenant', fn ($tenantQuery) => $tenantQuery->where('name', 'like', "%{$search}%"))
                        ->orWhereHas('unit', fn ($unitQuery) => $unitQuery->where('unit_number', 'like', "%{$search}%"))
                        ->orWhereHas('unit.property', fn ($propertyQuery) => $propertyQuery->where('name', 'like', "%{$search}%"));
                });
            }
        }

        return $query->orderByDesc('id')->get()->map(fn ($contract) => mrco_apply_overdue_formula_to_contract($contract))->values();
    }
}

Route::get('/contracts', fn (Request $request) => mrco_contracts_response($request, false));
Route::get('/my/contracts', fn (Request $request) => mrco_contracts_response($request, true));
Route::get('/units/{unit}/contracts', function (Request $request, \App\Models\Unit $unit) {
    $request->merge(['unit_id' => $unit->id]);
    return mrco_contracts_response($request, false);
});
Route::get('/my/units/{unit}/contracts', function (Request $request, \App\Models\Unit $unit) {
    $request->merge(['unit_id' => $unit->id]);
    return mrco_contracts_response($request, true);
});
