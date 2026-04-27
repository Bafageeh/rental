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

/*
|--------------------------------------------------------------------------
| Contracts & Payments
|--------------------------------------------------------------------------
*/

Route::post('/contracts', function (Request $request) {
    $data = $request->validate([
        'tenant_id' => ['required', 'integer', 'exists:tenants,id'],
        'unit_id' => ['required', 'integer', 'exists:units,id'],
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

    $contract = Contract::create([
        'tenant_id' => $data['tenant_id'],
        'unit_id' => $data['unit_id'],
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

    Unit::where('id', $data['unit_id'])->update([
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

        if ($cycle === 'monthly') {
            $dueDate->addMonthsNoOverflow($i);
        } elseif ($cycle === 'quarterly') {
            $dueDate->addMonthsNoOverflow($i * 3);
        } elseif ($cycle === 'semi_annual') {
            $dueDate->addMonthsNoOverflow($i * 6);
        } elseif ($cycle === 'annual') {
            $dueDate->addYears($i);
        } else {
            $dueDate->addMonthsNoOverflow($i);
        }

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
        'contract' => $contract->fresh()->load([
            'tenant',
            'unit.property.owner',
            'payments',
        ]),
    ], 201);
});

Route::get('/contracts', function (Request $request) {
    $query = Contract::with([
        'tenant',
        'unit.property.owner',
        'parkingSpot',
        'files',
        'payments' => function ($query) {
            $query->orderBy('due_date');
        },
    ]);

    if ($request->filled('property_id')) {
        $propertyId = (int) $request->input('property_id');
        $query->whereHas('unit', function ($unitQuery) use ($propertyId) {
            $unitQuery->where('property_id', $propertyId);
        });
    }

    if ($request->filled('unit_id')) {
        $query->where('unit_id', (int) $request->input('unit_id'));
    }

    if ($request->filled('search')) {
        $search = trim((string) $request->input('search'));
        $query->where(function ($searchQuery) use ($search) {
            $searchQuery
                ->where('contract_number', 'like', "%{$search}%")
                ->orWhere('government_contract_number', 'like', "%{$search}%")
                ->orWhereHas('tenant', function ($tenantQuery) use ($search) {
                    $tenantQuery->where('name', 'like', "%{$search}%");
                })
                ->orWhereHas('unit', function ($unitQuery) use ($search) {
                    $unitQuery->where('unit_number', 'like', "%{$search}%");
                })
                ->orWhereHas('unit.property', function ($propertyQuery) use ($search) {
                    $propertyQuery->where('name', 'like', "%{$search}%");
                });
        });
    }

    return $query->orderBy('id', 'desc')->get();
});

Route::post('/contracts/{contract}/close', function (Contract $contract) {
    $contract->update([
        'status' => 'ended',
    ]);

    if ($contract->unit_id) {
        Unit::where('id', $contract->unit_id)->update([
            'status' => 'available',
        ]);
    }

    return response()->json([
        'status' => 'ok',
        'message' => 'تم إغلاق العقد وإتاحة الوحدة',
        'contract' => $contract->fresh()->load([
            'tenant',
            'unit.property.owner',
            'payments',
        ]),
    ]);
});

Route::post('/contracts/{contract}/activate', function (Contract $contract) {
    $contract->update([
        'status' => 'active',
    ]);

    if ($contract->unit_id) {
        Unit::where('id', $contract->unit_id)->update([
            'status' => 'rented',
        ]);
    }

    return response()->json([
        'status' => 'ok',
        'message' => 'تم تفعيل العقد وتحديث حالة الوحدة إلى مؤجرة',
        'contract' => $contract->fresh()->load([
            'tenant',
            'unit.property.owner',
            'payments',
        ]),
    ]);
});

Route::get('/payments', function () {
    return Payment::with([
        'contract.tenant',
        'contract.unit.property.owner',
    ])
        ->orderBy('due_date')
        ->get();
});

Route::post('/payments/{payment}/mark-paid', function (Payment $payment) {
    $payment->update([
        'status' => 'paid',
        'paid_date' => now()->toDateString(),
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم تسجيل الدفعة كمدفوعة',
        'payment' => $payment->fresh()->load([
            'contract.tenant',
            'contract.unit.property.owner',
        ]),
    ]);
});

Route::post('/payments/{payment}/mark-due', function (Payment $payment) {
    $payment->update([
        'status' => 'due',
        'paid_date' => null,
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم إرجاع الدفعة إلى مستحقة',
        'payment' => $payment->fresh()->load([
            'contract.tenant',
            'contract.unit.property.owner',
        ]),
    ]);
});

Route::post('/payments/{payment}/mark-overdue', function (Payment $payment) {
    $payment->update([
        'status' => 'overdue',
        'paid_date' => null,
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم تسجيل الدفعة كمتأخرة',
        'payment' => $payment->fresh()->load([
            'contract.tenant',
            'contract.unit.property.owner',
        ]),
    ]);
});
