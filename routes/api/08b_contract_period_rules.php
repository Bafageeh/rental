<?php

use App\Models\Contract;
use App\Models\Payment;
use App\Models\Tenant;
use App\Models\Unit;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

if (!function_exists('mr_contract_status_from_dates')) {
    function mr_contract_status_from_dates(?string $startDate, ?string $endDate): string
    {
        if ($endDate && Carbon::parse($endDate)->lt(today())) {
            return 'ended';
        }

        return 'active';
    }
}

if (!function_exists('mr_contract_period_overlaps')) {
    function mr_contract_period_overlaps($query, string $startDate, string $endDate)
    {
        return $query
            ->whereDate('start_date', '<=', $endDate)
            ->whereDate('end_date', '>=', $startDate);
    }
}

if (!function_exists('mr_contract_find_matching_identity_dates')) {
    function mr_contract_find_matching_identity_dates(Unit $unit, Tenant $tenant, string $startDate, string $endDate, ?int $ignoreId = null): ?Contract
    {
        $tenantNationalId = trim((string) ($tenant->national_id ?? ''));

        $query = Contract::where('unit_id', $unit->id)
            ->whereDate('start_date', $startDate)
            ->whereDate('end_date', $endDate)
            ->whereHas('tenant', function ($tenantQuery) use ($tenant, $tenantNationalId) {
                if ($tenantNationalId !== '') {
                    $tenantQuery->where('national_id', $tenantNationalId);
                } else {
                    $tenantQuery->where('id', $tenant->id);
                }
            });

        if ($ignoreId) {
            $query->where('id', '!=', $ignoreId);
        }

        return $query->first();
    }
}

if (!function_exists('mr_contract_abort_if_overlapping_period')) {
    function mr_contract_abort_if_overlapping_period(Unit $unit, string $startDate, string $endDate, ?int $ignoreId = null): void
    {
        $query = Contract::where('unit_id', $unit->id);

        if ($ignoreId) {
            $query->where('id', '!=', $ignoreId);
        }

        $overlap = mr_contract_period_overlaps($query, $startDate, $endDate)->first();

        if (!$overlap) {
            return;
        }

        abort(response()->json([
            'status' => 'error',
            'message' => 'لا يمكن حفظ العقد؛ توجد فترة عقد أخرى متداخلة على نفس الوحدة. يسمح بعقود تاريخية متعددة فقط إذا لم تتداخل التواريخ.',
            'existing_contract_id' => $overlap->id,
            'existing_start_date' => $overlap->start_date,
            'existing_end_date' => $overlap->end_date,
        ], 422));
    }
}

Route::post('/contracts', function (Request $request) {
    $data = $request->validate([
        'tenant_id' => ['required', 'integer', 'exists:tenants,id'],
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
    $tenant = Tenant::findOrFail((int) $data['tenant_id']);
    $startDate = Carbon::parse($data['start_date'])->toDateString();
    $endDate = Carbon::parse($data['end_date'])->toDateString();

    $existingSameIdentityAndDates = mr_contract_find_matching_identity_dates($targetUnit, $tenant, $startDate, $endDate);

    if (!$existingSameIdentityAndDates) {
        mr_contract_abort_if_overlapping_period($targetUnit, $startDate, $endDate);
    }

    $status = mr_contract_status_from_dates($startDate, $endDate);
    $payload = [
        'tenant_id' => $tenant->id,
        'unit_id' => $targetUnit->id,
        'contract_number' => $data['contract_number'] ?? ($existingSameIdentityAndDates?->contract_number ?: 'MAN-' . now()->format('YmdHis')),
        'start_date' => $startDate,
        'end_date' => $endDate,
        'rent_amount' => $data['rent_amount'],
        'parking_fee' => $data['parking_fee'] ?? 0,
        'services_fee' => $data['services_fee'] ?? 0,
        'deposit_amount' => $data['deposit_amount'] ?? 0,
        'payment_cycle' => $data['payment_cycle'] ?? 'monthly',
        'status' => $status,
        'source' => 'manual',
        'notes' => $data['notes'] ?? null,
    ];

    $contract = $existingSameIdentityAndDates ?: new Contract();
    $contract->fill($payload);
    $contract->save();

    Unit::where('id', $targetUnit->id)->update([
        'status' => $status === 'active' ? 'rented' : 'available',
        'rent_amount' => $status === 'active' ? $data['rent_amount'] : $targetUnit->rent_amount,
    ]);

    if (!$existingSameIdentityAndDates) {
        $paymentsCount = (int) ($data['payments_count'] ?? 1);
        $totalRent = (float) $data['rent_amount'];
        $paymentAmount = $paymentsCount > 0 ? round($totalRent / $paymentsCount, 2) : $totalRent;
        $cycle = $data['payment_cycle'] ?? 'monthly';
        $baseStartDate = Carbon::parse($startDate);

        for ($i = 0; $i < $paymentsCount; $i++) {
            $dueDate = $baseStartDate->copy();
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
    }

    return response()->json([
        'status' => 'ok',
        'message' => $existingSameIdentityAndDates ? 'تم تحديث العقد الموجود لتطابق الهوية والتواريخ' : 'تم إنشاء العقد والدفعات بنجاح',
        'contract' => $contract->fresh()->load(['tenant', 'unit.property.owner', 'payments']),
    ], $existingSameIdentityAndDates ? 200 : 201);
});

Route::post('/contracts/{contract}/activate', function (Contract $contract) {
    $targetUnit = $contract->unit;

    if ($targetUnit) {
        mr_contract_abort_if_overlapping_period(
            $targetUnit,
            Carbon::parse($contract->start_date)->toDateString(),
            Carbon::parse($contract->end_date)->toDateString(),
            $contract->id
        );
    }

    $status = mr_contract_status_from_dates($contract->start_date, $contract->end_date);
    $contract->update(['status' => $status]);

    if ($contract->unit_id) {
        Unit::where('id', $contract->unit_id)->update(['status' => $status === 'active' ? 'rented' : 'available']);
    }

    return response()->json([
        'status' => 'ok',
        'message' => $status === 'active' ? 'تم تفعيل العقد وتحديث حالة الوحدة إلى مؤجرة' : 'العقد منتهي حسب تاريخ نهايته، لذلك تم حفظه كعقد غير نشط',
        'contract' => $contract->fresh()->load(['tenant', 'unit.property.owner', 'payments']),
    ]);
});
