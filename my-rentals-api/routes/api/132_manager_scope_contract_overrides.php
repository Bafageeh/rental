<?php

use App\Models\Contract;
use App\Models\Payment;
use App\Models\Property;
use App\Models\Tenant;
use App\Models\Unit;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (is_file(__DIR__ . '/130_manager_data_scope.php')) require_once __DIR__ . '/130_manager_data_scope.php';

if (!function_exists('mr_manager_scoped_contract_target_unit')) {
    function mr_manager_scoped_contract_target_unit(array $data, Request $request): Unit
    {
        $scope = $data['contract_scope'] ?? (!empty($data['unit_id']) ? 'unit' : 'property');

        if ($scope === 'unit') {
            if (empty($data['unit_id'])) {
                abort(response()->json(['status' => 'error', 'message' => 'اختر الوحدة التي تريد إنشاء العقد عليها.'], 422));
            }
            mr_manager_scope_abort_unless_record('units', $data['unit_id'], $request);
            return Unit::findOrFail((int) $data['unit_id']);
        }

        if (empty($data['property_id'])) {
            abort(response()->json(['status' => 'error', 'message' => 'يجب تحديد العقار لإنشاء عقد على العقار بالكامل.'], 422));
        }

        mr_manager_scope_abort_unless_record('properties', $data['property_id'], $request);
        $property = Property::findOrFail((int) $data['property_id']);
        $unit = Unit::firstOrCreate(
            ['property_id' => $property->id, 'unit_number' => 'العقار كامل'],
            ['owner_id' => $property->owner_id, 'unit_scope' => 'property', 'floor' => null, 'type' => 'whole_property', 'area' => $property->property_area, 'is_subdivided' => false, 'rent_amount' => 0, 'status' => 'available', 'notes' => 'وحدة نظامية افتراضية لتسجيل عقد على العقار بالكامل.']
        );
        mr_manager_scope_set_record('units', $unit->id, $request);
        return $unit;
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

    $targetUnit = mr_manager_scoped_contract_target_unit($data, $request);

    $existing = Contract::where('unit_id', $targetUnit->id)->first();
    if ($existing) {
        return response()->json(['status' => 'error', 'message' => 'لا يمكن إنشاء عقد جديد؛ يوجد عقد مسجل مسبقًا على هذا العقار أو الوحدة.'], 422);
    }

    $tenantId = $data['tenant_id'] ?? null;
    if ($tenantId) {
        mr_manager_scope_abort_unless_record('tenants', $tenantId, $request);
    } else {
        $tenantName = trim((string) ($data['tenant_name'] ?? ''));
        if ($tenantName === '') return response()->json(['status' => 'error', 'message' => 'أدخل اسم المستأجر.'], 422);

        $tenantQuery = Tenant::where('name', $tenantName);
        mr_manager_scope_apply($tenantQuery, 'tenants', $request);
        $tenant = $tenantQuery->first();
        if (!$tenant) {
            $tenant = Tenant::create(['name' => $tenantName, 'notes' => 'تم إنشاؤه تلقائيًا من شاشة إنشاء عقد جديد']);
            mr_manager_scope_set_record('tenants', $tenant->id, $request);
        }
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
    mr_manager_scope_set_record('contracts', $contract->id, $request);

    Unit::where('id', $targetUnit->id)->update(['status' => 'rented', 'rent_amount' => $data['rent_amount']]);

    $paymentsCount = (int) ($data['payments_count'] ?? 1);
    $paymentAmount = $paymentsCount > 0 ? round(((float) $data['rent_amount']) / $paymentsCount, 2) : (float) $data['rent_amount'];
    $startDate = Carbon::parse($data['start_date']);
    $cycle = $data['payment_cycle'] ?? 'monthly';

    for ($i = 0; $i < $paymentsCount; $i++) {
        $dueDate = $startDate->copy();
        if ($cycle === 'monthly') $dueDate->addMonthsNoOverflow($i);
        elseif ($cycle === 'quarterly') $dueDate->addMonthsNoOverflow($i * 3);
        elseif ($cycle === 'semi_annual') $dueDate->addMonthsNoOverflow($i * 6);
        elseif ($cycle === 'annual') $dueDate->addYears($i);
        else $dueDate->addMonthsNoOverflow($i);

        $payment = Payment::create(['contract_id' => $contract->id, 'amount' => $paymentAmount, 'due_date' => $dueDate->toDateString(), 'status' => 'due', 'notes' => 'دفعة منشأة تلقائيًا من العقد اليدوي']);
        mr_manager_scope_set_record('payments', $payment->id, $request);
    }

    return response()->json(['status' => 'ok', 'message' => 'تم إنشاء العقد والدفعات بنجاح', 'contract' => $contract->fresh()->load(['tenant', 'unit.property.owner', 'payments'])], 201);
});

Route::post('/contracts/{contract}/close', function (Request $request, Contract $contract) {
    mr_manager_scope_abort_unless_record('contracts', $contract->id, $request);
    $contract->update(['status' => 'ended']);
    if ($contract->unit_id) Unit::where('id', $contract->unit_id)->update(['status' => 'available']);
    return response()->json(['status' => 'ok', 'message' => 'تم إغلاق العقد وإتاحة الوحدة', 'contract' => $contract->fresh()->load(['tenant', 'unit.property.owner', 'payments'])]);
});

Route::post('/contracts/{contract}/activate', function (Request $request, Contract $contract) {
    mr_manager_scope_abort_unless_record('contracts', $contract->id, $request);
    $contract->update(['status' => 'active']);
    if ($contract->unit_id) Unit::where('id', $contract->unit_id)->update(['status' => 'rented']);
    return response()->json(['status' => 'ok', 'message' => 'تم تفعيل العقد وتحديث حالة الوحدة إلى مؤجرة', 'contract' => $contract->fresh()->load(['tenant', 'unit.property.owner', 'payments'])]);
});

Route::post('/payments/{payment}/mark-paid', function (Request $request, Payment $payment) {
    mr_manager_scope_abort_unless_record('payments', $payment->id, $request);
    $paidAmount = (float) str_replace(',', '', (string) ($payment->paid_amount ?? 0));
    if ($paidAmount <= 0) $paidAmount = (float) str_replace(',', '', (string) ($payment->amount ?? 0));

    $updates = ['status' => 'paid', 'paid_date' => now()->toDateString()];
    if (Schema::hasColumn('payments', 'paid_amount')) $updates['paid_amount'] = $paidAmount;
    if (Schema::hasColumn('payments', 'remaining_amount')) $updates['remaining_amount'] = 0;
    DB::table('payments')->where('id', $payment->id)->update($updates);

    return response()->json(['status' => 'ok', 'message' => 'تم تسجيل الدفعة كمدفوعة', 'payment' => $payment->fresh()->load(['contract.tenant', 'contract.unit.property.owner'])]);
});

Route::post('/payments/{payment}/mark-due', function (Request $request, Payment $payment) {
    mr_manager_scope_abort_unless_record('payments', $payment->id, $request);
    $payment->update(['status' => 'due', 'paid_date' => null]);
    return response()->json(['status' => 'ok', 'message' => 'تم إرجاع الدفعة إلى مستحقة', 'payment' => $payment->fresh()->load(['contract.tenant', 'contract.unit.property.owner'])]);
});

Route::post('/payments/{payment}/mark-overdue', function (Request $request, Payment $payment) {
    mr_manager_scope_abort_unless_record('payments', $payment->id, $request);
    $payment->update(['status' => 'overdue', 'paid_date' => null]);
    return response()->json(['status' => 'ok', 'message' => 'تم تسجيل الدفعة كمتأخرة', 'payment' => $payment->fresh()->load(['contract.tenant', 'contract.unit.property.owner'])]);
});
