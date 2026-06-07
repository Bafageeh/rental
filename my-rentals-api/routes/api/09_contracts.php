<?php

// PHASE2_ROUTE_MODULES: generated from routes/api.php on 2026-04-27-083758.
// Section: Contracts & Payments

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ContractFileController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\OwnerDashboardController;
use App\Models\Contract;
use App\Models\Owner;
use App\Models\Payment;
use App\Models\Property;
use App\Models\Tenant;
use App\Models\Unit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;


if (!function_exists('mr_contract_payment_num')) {
    function mr_contract_payment_num($value): float
    {
        if ($value === null || $value === '') return 0.0;
        return is_numeric($value) ? (float) $value : (float) str_replace(',', '', (string) $value);
    }
}

if (!function_exists('mr_contract_apply_running_payment_status')) {
    function mr_contract_apply_running_payment_status($contract)
    {
        if (!$contract || !$contract->relationLoaded('payments')) {
            return $contract;
        }

        $runningRequired = 0.0;
        $runningPaid = 0.0;
        $today = now()->toDateString();

        $contract->payments = $contract->payments
            ->sortBy([
                ['due_date', 'asc'],
                ['id', 'asc'],
            ])
            ->values()
            ->map(function ($payment) use (&$runningRequired, &$runningPaid, $today) {
                $amount = mr_contract_payment_num($payment->amount ?? 0);
                $paid = mr_contract_payment_num($payment->paid_amount ?? 0);

                $requiredBefore = $runningRequired;
                $runningRequired += $amount;
                $runningPaid += $paid;

                $coveredForThis = max(0.0, min($amount, $runningPaid - $requiredBefore));
                $remainingForThis = max(0.0, $amount - $coveredForThis);

                $dueDate = substr((string) ($payment->due_date ?? ''), 0, 10);
                $isDue = preg_match('/^\d{4}-\d{2}-\d{2}$/', $dueDate) && $dueDate <= $today;

                if ($amount > 0 && $coveredForThis >= ($amount - 0.009)) {
                    $visualStatus = 'paid';
                    $visualBadge = 'مدفوعة';
                } elseif ($coveredForThis > 0 && $coveredForThis < $amount) {
                    $visualStatus = 'partial';
                    $visualBadge = 'جزئي';
                } elseif ($isDue) {
                    $visualStatus = 'overdue';
                    $visualBadge = 'متأخرة';
                } else {
                    $visualStatus = 'due';
                    $visualBadge = 'مستحقة';
                }

                $payment->setAttribute('status', $visualStatus);
                $payment->setAttribute('badge', $visualBadge);
                $payment->setAttribute('actual_paid_amount', round($coveredForThis, 2));
                $payment->setAttribute('display_amount', $visualStatus === 'due' || $visualStatus === 'overdue' ? $amount : round($coveredForThis, 2));
                $payment->setAttribute('remaining_amount', round($remainingForThis, 2));
                $payment->setAttribute('running_required_amount', round($runningRequired, 2));
                $payment->setAttribute('running_paid_amount', round($runningPaid, 2));
                $payment->setAttribute('running_remaining_amount', round(max(0.0, $runningRequired - $runningPaid), 2));

                return $payment;
            });

        return $contract;
    }
}

/*
|--------------------------------------------------------------------------
| Contracts & Payments
|--------------------------------------------------------------------------
*/

if (!function_exists('mr_contract_target_unit')) {
    function mr_contract_target_unit(array $data): Unit
    {
        $scope = $data['contract_scope'] ?? (!empty($data['unit_id']) ? 'unit' : 'property');

        if ($scope === 'unit') {
            if (empty($data['unit_id'])) {
                abort(response()->json([
                    'status' => 'error',
                    'message' => 'اختر الوحدة التي تريد إنشاء العقد عليها.',
                ], 422));
            }

            $unit = Unit::findOrFail((int) $data['unit_id']);

            $wholeContractExists = Unit::where('property_id', $unit->property_id)
                ->where(function ($query) {
                    $query->where('type', 'whole_property')->orWhere('unit_number', 'العقار كامل');
                })
                ->whereHas('contracts')
                ->exists();

            if ($wholeContractExists) {
                abort(response()->json([
                    'status' => 'error',
                    'message' => 'لا يمكن إنشاء عقد على وحدة؛ يوجد عقد على العقار بالكامل.',
                ], 422));
            }

            return $unit;
        }

        if (empty($data['property_id'])) {
            abort(response()->json([
                'status' => 'error',
                'message' => 'يجب تحديد العقار لإنشاء عقد على العقار بالكامل.',
            ], 422));
        }

        $property = Property::findOrFail((int) $data['property_id']);
        $actualUnitIds = Unit::where('property_id', $property->id)
            ->where('unit_number', '!=', 'العقار كامل')
            ->where(function ($query) {
                $query->whereNull('type')->orWhere('type', '!=', 'whole_property');
            })
            ->pluck('id')
            ->all();

        if (!empty($actualUnitIds) && Contract::whereIn('unit_id', $actualUnitIds)->exists()) {
            abort(response()->json([
                'status' => 'error',
                'message' => 'لا يمكن إنشاء عقد على العقار بالكامل؛ توجد عقود على وحدات داخل العقار.',
            ], 422));
        }

        return Unit::firstOrCreate(
            [
                'property_id' => $property->id,
                'unit_number' => 'العقار كامل',
            ],
            [
                'owner_id' => $property->owner_id,
                'unit_scope' => 'property',
                'floor' => null,
                'type' => 'whole_property',
                'area' => $property->property_area,
                'is_subdivided' => false,
                'rent_amount' => 0,
                'status' => 'available',
                'notes' => 'وحدة نظامية افتراضية لتسجيل عقد على العقار بالكامل، وليست وحدة فعلية ضمن العقار.',
            ]
        );
    }
}

if (!function_exists('mr_contract_prevent_duplicate')) {
    function mr_contract_prevent_duplicate(Unit $unit): void
    {
        $existing = Contract::where('unit_id', $unit->id)->first();

        if (!$existing) {
            return;
        }

        $assetName = $unit->unit_number === 'العقار كامل' ? 'هذا العقار' : 'هذه الوحدة';

        abort(response()->json([
            'status' => 'error',
            'message' => "لا يمكن إنشاء عقد جديد؛ يوجد عقد مسجل مسبقًا على {$assetName}. النظام يسمح بعقد واحد فقط لكل عقار أو وحدة.",
            'existing_contract_id' => $existing->id,
        ], 422));
    }
}

Route::post('/contracts', function (Request $request) {
    $data = $request->validate([
        'tenant_id' => ['nullable', 'integer', 'exists:tenants,id'],
        'tenant_name' => ['required_without:tenant_id', 'nullable', 'string', 'max:255'],
        'unit_id' => ['nullable', 'integer', 'exists:units,id'],
        'property_id' => ['nullable', 'integer', 'exists:properties,id'],
        'contract_scope' => ['nullable', 'string', 'in:property,unit'],
        'contract_number' => ['nullable', 'string', 'max:255'],
        'start_date' => ['required', 'date'],
        'end_date' => ['required', 'date', 'after_or_equal:start_date'],
        'rent_amount' => ['required', 'numeric', 'min:0'],
        'parking_fee' => ['nullable', 'numeric', 'min:0'],
        'services_fee' => ['nullable', 'numeric', 'min:0'],
        'deposit_amount' => ['nullable', 'numeric', 'min:0'],
        'payment_cycle' => ['nullable', 'string', 'max:50'],
        'payments_count' => ['nullable', 'integer', 'min:1', 'max:120'],
        'notes' => ['nullable', 'string'],
    ]);

    $targetUnit = mr_contract_target_unit($data);
    mr_contract_prevent_duplicate($targetUnit);

    $tenantId = $data['tenant_id'] ?? null;
    if (!$tenantId) {
        $tenantName = trim((string) ($data['tenant_name'] ?? ''));
        if ($tenantName === '') {
            return response()->json([
                'status' => 'error',
                'message' => 'أدخل اسم المستأجر.',
            ], 422);
        }

        $tenant = Tenant::firstOrCreate(
            ['name' => $tenantName],
            ['notes' => 'تم إنشاؤه تلقائيًا من شاشة إنشاء عقد جديد']
        );
        $tenantId = $tenant->id;
    }

    $contract = Contract::create([
        'tenant_id' => $tenantId,
        'unit_id' => $targetUnit->id,
        'contract_number' => $data['contract_number'] ?? ('MAN-' . now()->format('YmdHis')),
        'start_date' => $data['start_date'],
        'end_date' => $data['end_date'],
        'rent_amount' => $data['rent_amount'],
        'parking_fee' => $data['parking_fee'] ?? 0,
        'services_fee' => $data['services_fee'] ?? 0,
        'deposit_amount' => $data['deposit_amount'] ?? 0,
        'payment_cycle' => $data['payment_cycle'] ?? 'monthly',
        'status' => 'active',
        'source' => 'manual',
        'notes' => $data['notes'] ?? null,
    ]);

    Unit::where('id', $targetUnit->id)->update([
        'status' => 'rented',
        'rent_amount' => $data['rent_amount'],
    ]);

    $paymentsCount = (int) ($data['payments_count'] ?? 1);
    $totalRent = (float) $data['rent_amount'];
    $paymentAmount = $paymentsCount > 0 ? round($totalRent / $paymentsCount, 2) : $totalRent;

    $startDate = \Carbon\Carbon::parse($data['start_date']);
    $cycle = $data['payment_cycle'] ?? 'monthly';

    for ($i = 0; $i < $paymentsCount; $i++) {
        $dueDate = $startDate->copy();
        if ($cycle === 'monthly') $dueDate->addMonthsNoOverflow($i);
        elseif ($cycle === 'quarterly') $dueDate->addMonthsNoOverflow($i * 3);
        elseif ($cycle === 'semi_annual') $dueDate->addMonthsNoOverflow($i * 6);
        elseif ($cycle === 'annual') $dueDate->addYears($i);
        else $dueDate->addMonthsNoOverflow($i);

        Payment::create([
            'contract_id' => $contract->id,
            'amount' => $paymentAmount,
            'due_date' => $dueDate->toDateString(),
            'status' => 'due',
            'notes' => 'دفعة منشأة تلقائيًا من العقد اليدوي',
        ]);
    }

    return response()->json([
        'status' => 'ok',
        'message' => 'تم إنشاء العقد والدفعات بنجاح',
        'contract' => $contract->fresh()->load(['tenant', 'unit.property.owner', 'payments']),
    ], 201);
});

Route::get('/contracts', function (Request $request) {
    $query = Contract::with([
        'tenant',
        'unit.property.owner',
        'parkingSpot',
        'files',
        'payments' => function ($query) { $query->orderBy('due_date'); },
    ]);

    if ($request->filled('property_id')) {
        $propertyId = (int) $request->input('property_id');
        $query->whereHas('unit', function ($unitQuery) use ($propertyId) {
            $unitQuery->where('property_id', $propertyId);
        });
    }

    if ($request->filled('unit_id')) $query->where('unit_id', (int) $request->input('unit_id'));

    if ($request->filled('search')) {
        $search = trim((string) $request->input('search'));
        $query->where(function ($searchQuery) use ($search) {
            $searchQuery
                ->where('contract_number', 'like', "%{$search}%")
                ->orWhere('government_contract_number', 'like', "%{$search}%")
                ->orWhereHas('tenant', fn($tenantQuery) => $tenantQuery->where('name', 'like', "%{$search}%"))
                ->orWhereHas('unit', fn($unitQuery) => $unitQuery->where('unit_number', 'like', "%{$search}%"))
                ->orWhereHas('unit.property', fn($propertyQuery) => $propertyQuery->where('name', 'like', "%{$search}%"));
        });
    }

    return $query->orderBy('id', 'desc')->get();
});

Route::get('/contracts/{contract}', function (Request $request, Contract $contract) {
    if (function_exists('mrr_request_owner_scope_id') && function_exists('mrr_record_belongs_to_owner')) {
        $ownerScopeId = mrr_request_owner_scope_id($request);
        if ($ownerScopeId === 0 || ($ownerScopeId !== null && !mrr_record_belongs_to_owner('contracts', $contract, $ownerScopeId))) {
            return mrr_owner_scope_forbidden_response();
        }
    }

    $loadedContract = $contract->load([
        'tenant',
        'unit.property.owner',
        'parkingSpot',
        'files',
        'payments' => function ($query) { $query->orderBy('due_date')->orderBy('id'); },
    ]);

    return function_exists('mr_contract_apply_running_payment_status')
        ? mr_contract_apply_running_payment_status($loadedContract)
        : $loadedContract;
});

Route::post('/contracts/{contract}/close', function (Contract $contract) {
    $contract->update(['status' => 'ended']);
    if ($contract->unit_id) Unit::where('id', $contract->unit_id)->update(['status' => 'available']);
    return response()->json(['status' => 'ok', 'message' => 'تم إغلاق العقد وإتاحة الوحدة', 'contract' => $contract->fresh()->load(['tenant', 'unit.property.owner', 'payments'])]);
});

Route::post('/contracts/{contract}/activate', function (Contract $contract) {
    $targetUnit = $contract->unit;
    if ($targetUnit) {
        $otherContract = Contract::where('unit_id', $targetUnit->id)->where('id', '!=', $contract->id)->first();
        if ($otherContract) return response()->json(['status' => 'error', 'message' => 'لا يمكن تفعيل العقد؛ يوجد عقد آخر مسجل على نفس العقار أو الوحدة.'], 422);
    }
    $contract->update(['status' => 'active']);
    if ($contract->unit_id) Unit::where('id', $contract->unit_id)->update(['status' => 'rented']);
    return response()->json(['status' => 'ok', 'message' => 'تم تفعيل العقد وتحديث حالة الوحدة إلى مؤجرة', 'contract' => $contract->fresh()->load(['tenant', 'unit.property.owner', 'payments'])]);
});

Route::get('/payments', function () {
    return Payment::with(['contract.tenant', 'contract.unit.property.owner'])->orderBy('due_date')->get();
});

Route::post('/payments/{payment}/mark-paid', function (Payment $payment) {
    $paidAmount = (float) str_replace(',', '', (string) ($payment->paid_amount ?? 0));
    if ($paidAmount <= 0) {
        $paidAmount = (float) str_replace(',', '', (string) ($payment->amount ?? 0));
    }

    $updates = ['status' => 'paid', 'paid_date' => now()->toDateString()];

    if (Schema::hasColumn('payments', 'paid_amount')) {
        $updates['paid_amount'] = $paidAmount;
    }

    if (Schema::hasColumn('payments', 'remaining_amount')) {
        $updates['remaining_amount'] = 0;
    }

    DB::table('payments')->where('id', $payment->id)->update($updates);

    return response()->json(['status' => 'ok', 'message' => 'تم تسجيل الدفعة كمدفوعة', 'payment' => $payment->fresh()->load(['contract.tenant', 'contract.unit.property.owner'])]);
});

Route::post('/payments/{payment}/mark-due', function (Payment $payment) {
    $payment->update(['status' => 'due', 'paid_date' => null]);
    return response()->json(['status' => 'ok', 'message' => 'تم إرجاع الدفعة إلى مستحقة', 'payment' => $payment->fresh()->load(['contract.tenant', 'contract.unit.property.owner'])]);
});

Route::post('/payments/{payment}/mark-overdue', function (Payment $payment) {
    $payment->update(['status' => 'overdue', 'paid_date' => null]);
    return response()->json(['status' => 'ok', 'message' => 'تم تسجيل الدفعة كمتأخرة', 'payment' => $payment->fresh()->load(['contract.tenant', 'contract.unit.property.owner'])]);
});
