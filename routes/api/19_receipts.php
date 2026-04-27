<?php

// PHASE2_ROUTE_MODULES: generated from routes/api.php on 2026-04-27-083758.
// Section: Payment Receipts / Partial Collections

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
| Payment Receipts / Partial Collections
|--------------------------------------------------------------------------
*/

if (!function_exists('my_rentals_payment_received_amount')) {
    function my_rentals_payment_received_amount(\App\Models\Payment $payment): float
    {
        if (!class_exists(\App\Models\PaymentReceipt::class) || !\Illuminate\Support\Facades\Schema::hasTable('payment_receipts')) {
            return $payment->status === 'paid' ? (float) ($payment->amount ?? 0) : 0;
        }

        return (float) \App\Models\PaymentReceipt::where('payment_id', $payment->id)->sum('amount');
    }
}

if (!function_exists('my_rentals_update_payment_status_from_receipts')) {
    function my_rentals_update_payment_status_from_receipts(\App\Models\Payment $payment): \App\Models\Payment
    {
        $payment = $payment->fresh();
        $received = my_rentals_payment_received_amount($payment);
        $amount = (float) ($payment->amount ?? 0);

        if ($amount > 0 && $received >= $amount) {
            $payment->update([
                'status' => 'paid',
                'paid_date' => $payment->paid_date ?: now()->toDateString(),
            ]);

            return $payment->fresh();
        }

        if ($received > 0) {
            $payment->update([
                'status' => 'partial',
                'paid_date' => null,
            ]);

            return $payment->fresh();
        }

        if ($payment->due_date && \Carbon\Carbon::parse($payment->due_date)->lt(now()->startOfDay())) {
            $payment->update([
                'status' => 'overdue',
                'paid_date' => null,
            ]);

            return $payment->fresh();
        }

        $payment->update([
            'status' => 'due',
            'paid_date' => null,
        ]);

        return $payment->fresh();
    }
}

if (!function_exists('my_rentals_receipt_payment_payload')) {
    function my_rentals_receipt_payment_payload($payment)
    {
        $received = my_rentals_payment_received_amount($payment);
        $amount = (float) ($payment->amount ?? 0);

        return [
            'id' => $payment->id,
            'amount' => $payment->amount,
            'received_amount' => $received,
            'remaining_amount' => max($amount - $received, 0),
            'due_date' => $payment->due_date,
            'paid_date' => $payment->paid_date,
            'status' => $payment->status,
            'tenant_name' => $payment->contract?->tenant?->name,
            'tenant_phone' => $payment->contract?->tenant?->phone,
            'property_name' => $payment->contract?->unit?->property?->name,
            'owner_name' => $payment->contract?->unit?->property?->owner?->name,
            'unit_number' => $payment->contract?->unit?->unit_number,
            'contract_number' => $payment->contract?->government_contract_number ?: $payment->contract?->contract_number,
            'payment' => $payment,
        ];
    }
}

Route::get('/payment-receipts', function () {
    return \App\Models\PaymentReceipt::with([
            'payment.contract.tenant',
            'payment.contract.unit.property.owner',
            'contract.tenant',
            'tenant',
        ])
        ->orderBy('received_date', 'desc')
        ->orderBy('id', 'desc')
        ->get();
});

Route::get('/receipt-payments', function () {
    return \App\Models\Payment::with([
            'contract.tenant',
            'contract.unit.property.owner',
        ])
        ->whereIn('status', ['due', 'overdue', 'partial'])
        ->orderBy('due_date')
        ->get()
        ->map(fn ($payment) => my_rentals_receipt_payment_payload($payment))
        ->values();
});

Route::post('/payments/{payment}/record-receipt', function (\App\Models\Payment $payment, Request $request) {
    $data = $request->validate([
        'amount' => ['required', 'numeric', 'min:0.01'],
        'received_date' => ['nullable', 'date'],
        'method' => ['nullable', 'string', 'max:100'],
        'reference_number' => ['nullable', 'string', 'max:255'],
        'notes' => ['nullable', 'string'],
    ]);

    $payment->load(['contract.tenant']);

    $receipt = \App\Models\PaymentReceipt::create([
        'payment_id' => $payment->id,
        'contract_id' => $payment->contract_id,
        'tenant_id' => $payment->contract?->tenant_id,
        'amount' => $data['amount'],
        'received_date' => $data['received_date'] ?? now()->toDateString(),
        'method' => $data['method'] ?? 'cash',
        'reference_number' => $data['reference_number'] ?? null,
        'notes' => $data['notes'] ?? null,
    ]);

    $updatedPayment = my_rentals_update_payment_status_from_receipts($payment);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم تسجيل سند القبض وتحديث حالة الدفعة',
        'receipt' => $receipt->fresh()->load([
            'payment.contract.tenant',
            'payment.contract.unit.property.owner',
            'contract.tenant',
            'tenant',
        ]),
        'payment' => my_rentals_receipt_payment_payload($updatedPayment->load([
            'contract.tenant',
            'contract.unit.property.owner',
        ])),
    ], 201);
});

Route::get('/my/payment-receipts', function (\Illuminate\Http\Request $request) {
    $user = function_exists('my_rentals_current_user_for_scope')
        ? my_rentals_current_user_for_scope($request)
        : (function_exists('my_rentals_bearer_user') ? my_rentals_bearer_user($request) : null);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $isAdmin = function_exists('my_rentals_is_admin_user')
        ? my_rentals_is_admin_user($user)
        : in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);

    $query = \App\Models\PaymentReceipt::with([
        'payment.contract.tenant',
        'payment.contract.unit.property.owner',
        'contract.tenant',
        'tenant',
    ]);

    if (!$isAdmin) {
        if (!$user->owner_id) {
            return [];
        }

        $propertyIds = \App\Models\Property::where('owner_id', $user->owner_id)->pluck('id');

        $query->whereHas('payment.contract.unit', function ($q) use ($propertyIds) {
            $q->whereIn('property_id', $propertyIds);
        });
    }

    return $query
        ->orderBy('received_date', 'desc')
        ->orderBy('id', 'desc')
        ->get();
});

Route::get('/my/receipt-payments', function (\Illuminate\Http\Request $request) {
    $user = function_exists('my_rentals_current_user_for_scope')
        ? my_rentals_current_user_for_scope($request)
        : (function_exists('my_rentals_bearer_user') ? my_rentals_bearer_user($request) : null);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $isAdmin = function_exists('my_rentals_is_admin_user')
        ? my_rentals_is_admin_user($user)
        : in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);

    $query = \App\Models\Payment::with([
            'contract.tenant',
            'contract.unit.property.owner',
        ])
        ->whereIn('status', ['due', 'overdue', 'partial']);

    if (!$isAdmin) {
        if (!$user->owner_id) {
            return [];
        }

        $propertyIds = \App\Models\Property::where('owner_id', $user->owner_id)->pluck('id');

        $query->whereHas('contract.unit', function ($q) use ($propertyIds) {
            $q->whereIn('property_id', $propertyIds);
        });
    }

    return $query
        ->orderBy('due_date')
        ->get()
        ->map(fn ($payment) => my_rentals_receipt_payment_payload($payment))
        ->values();
});


/*
|--------------------------------------------------------------------------
| Monthly Financial Summary
|--------------------------------------------------------------------------
| Yearly month-by-month financial overview.
*/

if (!function_exists('my_rentals_monthly_financial_payload')) {
    function my_rentals_monthly_financial_payload(int $year, ?\App\Models\User $user = null): array
    {
        $isAdmin = true;
        $ownerId = null;

        if ($user) {
            $ownerId = $user->owner_id ?? null;
            $isAdmin = function_exists('my_rentals_is_admin_user')
                ? my_rentals_is_admin_user($user)
                : in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);
        }

        $propertyQuery = \App\Models\Property::query();

        if (!$isAdmin) {
            if (!$ownerId) {
                return [
                    'year' => $year,
                    'summary' => [
                        'paid_income' => 0,
                        'expected_income' => 0,
                        'due_income' => 0,
                        'overdue_income' => 0,
                        'expenses' => 0,
                        'net_income' => 0,
                        'receipts_count' => 0,
                        'payments_count' => 0,
                        'expenses_count' => 0,
                    ],
                    'months' => [],
                ];
            }

            $propertyQuery->where('owner_id', $ownerId);
        }

        $propertyIds = $propertyQuery->pluck('id');

        $unitIds = \App\Models\Unit::query()
            ->whereIn('property_id', $propertyIds)
            ->pluck('id');

        $contractIds = \App\Models\Contract::query()
            ->whereIn('unit_id', $unitIds)
            ->pluck('id');

        $months = [];

        for ($month = 1; $month <= 12; $month++) {
            $start = \Carbon\Carbon::create($year, $month, 1)->startOfMonth();
            $end = $start->copy()->endOfMonth();

            $expectedPaymentsQuery = \App\Models\Payment::query()
                ->whereIn('contract_id', $contractIds)
                ->whereBetween('due_date', [$start->toDateString(), $end->toDateString()]);

            $expectedIncome = (float) (clone $expectedPaymentsQuery)->sum('amount');
            $paymentsCount = (int) (clone $expectedPaymentsQuery)->count();
            $dueIncome = (float) (clone $expectedPaymentsQuery)->where('status', 'due')->sum('amount');
            $overdueIncome = (float) (clone $expectedPaymentsQuery)->where('status', 'overdue')->sum('amount');

            $paidIncome = 0;
            $receiptsCount = 0;

            if (class_exists(\App\Models\PaymentReceipt::class) && \Illuminate\Support\Facades\Schema::hasTable('payment_receipts')) {
                $receiptsQuery = \App\Models\PaymentReceipt::query()
                    ->whereIn('contract_id', $contractIds)
                    ->whereBetween('received_date', [$start->toDateString(), $end->toDateString()]);

                $paidIncome = (float) (clone $receiptsQuery)->sum('amount');
                $receiptsCount = (int) (clone $receiptsQuery)->count();
            } else {
                $paidPaymentsQuery = \App\Models\Payment::query()
                    ->whereIn('contract_id', $contractIds)
                    ->where('status', 'paid')
                    ->whereBetween('paid_date', [$start->toDateString(), $end->toDateString()]);

                $paidIncome = (float) (clone $paidPaymentsQuery)->sum('amount');
                $receiptsCount = (int) (clone $paidPaymentsQuery)->count();
            }

            $expenses = 0;
            $expensesCount = 0;

            if (class_exists(\App\Models\PropertyExpense::class) && \Illuminate\Support\Facades\Schema::hasTable('property_expenses')) {
                $expenseQuery = \App\Models\PropertyExpense::query()
                    ->whereIn('property_id', $propertyIds)
                    ->whereBetween('expense_date', [$start->toDateString(), $end->toDateString()]);

                $expenses = (float) (clone $expenseQuery)->sum('amount');
                $expensesCount = (int) (clone $expenseQuery)->count();
            }

            $utilityDue = 0;
            $utilityPaid = 0;
            $utilityOverdue = 0;

            if (class_exists(\App\Models\UtilityBill::class) && \Illuminate\Support\Facades\Schema::hasTable('utility_bills')) {
                $utilityMonthQuery = \App\Models\UtilityBill::query()
                    ->whereIn('property_id', $propertyIds)
                    ->whereBetween('due_date', [$start->toDateString(), $end->toDateString()]);

                $utilityDue = (float) (clone $utilityMonthQuery)->where('status', 'due')->sum('amount');
                $utilityOverdue = (float) (clone $utilityMonthQuery)->where('status', 'overdue')->sum('amount');

                $utilityPaidQuery = \App\Models\UtilityBill::query()
                    ->whereIn('property_id', $propertyIds)
                    ->where('status', 'paid')
                    ->whereBetween('paid_date', [$start->toDateString(), $end->toDateString()]);

                $utilityPaid = (float) (clone $utilityPaidQuery)->sum('amount');
            }

            $months[] = [
                'month' => $month,
                'label' => $start->format('Y-m'),
                'month_name' => $start->locale('ar')->translatedFormat('F'),
                'expected_income' => $expectedIncome,
                'paid_income' => $paidIncome,
                'due_income' => $dueIncome,
                'overdue_income' => $overdueIncome,
                'expenses' => $expenses,
                'net_income' => $paidIncome - $expenses,
                'payments_count' => $paymentsCount,
                'receipts_count' => $receiptsCount,
                'expenses_count' => $expensesCount,
                'utility_due' => $utilityDue,
                'utility_paid' => $utilityPaid,
                'utility_overdue' => $utilityOverdue,
            ];
        }

        return [
            'year' => $year,
            'summary' => [
                'paid_income' => array_sum(array_column($months, 'paid_income')),
                'expected_income' => array_sum(array_column($months, 'expected_income')),
                'due_income' => array_sum(array_column($months, 'due_income')),
                'overdue_income' => array_sum(array_column($months, 'overdue_income')),
                'expenses' => array_sum(array_column($months, 'expenses')),
                'net_income' => array_sum(array_column($months, 'net_income')),
                'receipts_count' => array_sum(array_column($months, 'receipts_count')),
                'payments_count' => array_sum(array_column($months, 'payments_count')),
                'expenses_count' => array_sum(array_column($months, 'expenses_count')),
                'utility_due' => array_sum(array_column($months, 'utility_due')),
                'utility_paid' => array_sum(array_column($months, 'utility_paid')),
                'utility_overdue' => array_sum(array_column($months, 'utility_overdue')),
            ],
            'months' => $months,
        ];
    }
}

Route::get('/monthly-financial-summary', function (\Illuminate\Http\Request $request) {
    $year = (int) $request->query('year', now()->year);

    return my_rentals_monthly_financial_payload($year, null);
});

Route::get('/my/monthly-financial-summary', function (\Illuminate\Http\Request $request) {
    $user = function_exists('my_rentals_current_user_for_scope')
        ? my_rentals_current_user_for_scope($request)
        : (function_exists('my_rentals_bearer_user') ? my_rentals_bearer_user($request) : null);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $year = (int) $request->query('year', now()->year);

    return my_rentals_monthly_financial_payload($year, $user);
});


/*
|--------------------------------------------------------------------------
| Rent Roll
|--------------------------------------------------------------------------
| Active lease / rent roll summary.
*/

if (!function_exists('my_rentals_contract_received_total')) {
    function my_rentals_contract_received_total(\App\Models\Contract $contract): float
    {
        if (
            class_exists(\App\Models\PaymentReceipt::class)
            && \Illuminate\Support\Facades\Schema::hasTable('payment_receipts')
        ) {
            return (float) \App\Models\PaymentReceipt::where('contract_id', $contract->id)->sum('amount');
        }

        return (float) \App\Models\Payment::where('contract_id', $contract->id)
            ->where('status', 'paid')
            ->sum('amount');
    }
}

if (!function_exists('my_rentals_rent_roll_payload')) {
    function my_rentals_rent_roll_payload($contracts): array
    {
        $items = $contracts->map(function ($contract) {
            $payments = $contract->payments ?? collect();

            $rent = (float) ($contract->rent_amount ?? 0);
            $parking = (float) ($contract->parking_fee ?? 0);
            $services = (float) ($contract->services_fee ?? 0);
            $monthlyTotal = $rent + $parking + $services;

            $paymentsTotal = (float) $payments->sum('amount');
            $received = my_rentals_contract_received_total($contract);
            $remaining = max($paymentsTotal - $received, 0);

            $nextPayment = $payments
                ->whereIn('status', ['due', 'overdue', 'partial'])
                ->sortBy('due_date')
                ->first();

            $overdueTotal = (float) $payments
                ->whereIn('status', ['overdue'])
                ->sum('amount');

            if (
                class_exists(\App\Models\PaymentReceipt::class)
                && \Illuminate\Support\Facades\Schema::hasTable('payment_receipts')
            ) {
                foreach ($payments->where('status', 'partial') as $partialPayment) {
                    $receivedForPayment = (float) \App\Models\PaymentReceipt::where('payment_id', $partialPayment->id)->sum('amount');
                    $overdueTotal += max(((float) $partialPayment->amount) - $receivedForPayment, 0);
                }
            }

            return [
                'id' => $contract->id,
                'contract_number' => $contract->government_contract_number ?: $contract->contract_number ?: $contract->id,
                'status' => $contract->status,
                'start_date' => $contract->start_date,
                'end_date' => $contract->end_date,
                'rent_amount' => $rent,
                'parking_fee' => $parking,
                'services_fee' => $services,
                'monthly_total' => $monthlyTotal,
                'payment_cycle' => $contract->payment_cycle,
                'payments_total' => $paymentsTotal,
                'received_total' => $received,
                'remaining_total' => $remaining,
                'overdue_total' => $overdueTotal,
                'next_due_date' => $nextPayment?->due_date,
                'next_due_amount' => $nextPayment?->amount,
                'tenant' => [
                    'id' => $contract->tenant?->id,
                    'name' => $contract->tenant?->name,
                    'phone' => $contract->tenant?->phone,
                    'national_id' => $contract->tenant?->national_id,
                ],
                'unit' => [
                    'id' => $contract->unit?->id,
                    'unit_number' => $contract->unit?->unit_number,
                    'floor' => $contract->unit?->floor,
                    'type' => $contract->unit?->type,
                ],
                'property' => [
                    'id' => $contract->unit?->property?->id,
                    'name' => $contract->unit?->property?->name,
                    'city' => $contract->unit?->property?->city,
                    'district' => $contract->unit?->property?->district,
                    'property_type' => $contract->unit?->property?->property_type,
                ],
                'owner' => [
                    'id' => $contract->unit?->property?->owner?->id,
                    'name' => $contract->unit?->property?->owner?->name,
                    'phone' => $contract->unit?->property?->owner?->phone,
                ],
            ];
        })->values();

        return [
            'summary' => [
                'contracts_count' => $items->count(),
                'monthly_rent' => (float) $items->sum('rent_amount'),
                'monthly_parking' => (float) $items->sum('parking_fee'),
                'monthly_services' => (float) $items->sum('services_fee'),
                'monthly_total' => (float) $items->sum('monthly_total'),
                'payments_total' => (float) $items->sum('payments_total'),
                'received_total' => (float) $items->sum('received_total'),
                'remaining_total' => (float) $items->sum('remaining_total'),
                'overdue_total' => (float) $items->sum('overdue_total'),
            ],
            'items' => $items,
        ];
    }
}

Route::get('/rent-roll', function () {
    $contracts = \App\Models\Contract::with([
            'tenant',
            'unit.property.owner',
            'payments' => function ($query) {
                $query->orderBy('due_date');
            },
        ])
        ->where('status', 'active')
        ->orderBy('end_date')
        ->orderBy('id', 'desc')
        ->get();

    return my_rentals_rent_roll_payload($contracts);
});

Route::get('/my/rent-roll', function (\Illuminate\Http\Request $request) {
    $user = function_exists('my_rentals_current_user_for_scope')
        ? my_rentals_current_user_for_scope($request)
        : (function_exists('my_rentals_bearer_user') ? my_rentals_bearer_user($request) : null);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $isAdmin = function_exists('my_rentals_is_admin_user')
        ? my_rentals_is_admin_user($user)
        : in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);

    $query = \App\Models\Contract::with([
            'tenant',
            'unit.property.owner',
            'payments' => function ($paymentQuery) {
                $paymentQuery->orderBy('due_date');
            },
        ])
        ->where('status', 'active')
        ->orderBy('end_date')
        ->orderBy('id', 'desc');

    if (!$isAdmin) {
        if (!$user->owner_id) {
            return [
                'summary' => [
                    'contracts_count' => 0,
                    'monthly_rent' => 0,
                    'monthly_parking' => 0,
                    'monthly_services' => 0,
                    'monthly_total' => 0,
                    'payments_total' => 0,
                    'received_total' => 0,
                    'remaining_total' => 0,
                    'overdue_total' => 0,
                ],
                'items' => [],
            ];
        }

        $propertyIds = \App\Models\Property::where('owner_id', $user->owner_id)->pluck('id');

        $query->whereHas('unit', function ($q) use ($propertyIds) {
            $q->whereIn('property_id', $propertyIds);
        });
    }

    return my_rentals_rent_roll_payload($query->get());
});


/*
|--------------------------------------------------------------------------
| Unit Marketing Listings
|--------------------------------------------------------------------------
| Vacant / available units ready to share on social media.
*/

if (!function_exists('my_rentals_unit_listing_text')) {
    function my_rentals_unit_listing_text(\App\Models\Unit $unit): string
    {
        $property = $unit->property;
        $owner = $property?->owner;

        $lines = [];

        $lines[] = '🏠 وحدة متاحة للإيجار';
        $lines[] = '';
        $lines[] = 'العقار: ' . ($property?->name ?: '-');
        $lines[] = 'المدينة/الحي: ' . ($property?->city ?: '-') . ' / ' . ($property?->district ?: '-');
        $lines[] = 'الوحدة: ' . ($unit->unit_number ?: '-');
        $lines[] = 'الدور: ' . ($unit->floor ?: '-');

        if ($unit->type) {
            $lines[] = 'النوع: ' . $unit->type;
        }

        $lines[] = 'عدد الغرف: ' . ((int) ($unit->rooms_count ?? 0));
        $lines[] = 'عدد الحمامات: ' . ((int) ($unit->bathrooms_count ?? 0));

        if (!is_null($unit->has_living_room)) {
            $lines[] = 'صالة معيشة: ' . ($unit->has_living_room ? 'نعم' : 'لا');
        }

        if (!is_null($unit->has_kitchen)) {
            $kitchen = $unit->has_kitchen ? 'نعم' : 'لا';

            if ($unit->has_kitchen && $unit->kitchen_type) {
                $kitchen .= ' - ' . ($unit->kitchen_type === 'open' ? 'مفتوح' : ($unit->kitchen_type === 'closed' ? 'مغلق' : $unit->kitchen_type));
            }

            if ($unit->has_kitchen && !is_null($unit->is_kitchen_installed)) {
                $kitchen .= $unit->is_kitchen_installed ? ' - مركب' : ' - غير مركب';
            }

            $lines[] = 'المطبخ: ' . $kitchen;
        }

        if (!is_null($unit->is_rooftop) && $unit->is_rooftop) {
            $lines[] = 'ميزة: روف';
        }

        if ($unit->orientation) {
            $lines[] = 'الاتجاه: ' . ($unit->orientation === 'front' ? 'أمامية' : ($unit->orientation === 'back' ? 'خلفية' : $unit->orientation));
        }

        $rent = (float) ($unit->rent_amount ?? 0);

        if ($rent > 0) {
            $lines[] = 'الإيجار: ' . number_format($rent, 0) . ' ريال';
        }

        if ($property?->parking_spots_count) {
            $lines[] = 'المواقف المتاحة بالعقار: ' . $property->parking_spots_count;
        }

        $lines[] = '';
        $lines[] = 'للتواصل: ' . ($owner?->phone ?: 'يرجى التواصل مع الإدارة');

        return implode("\n", $lines);
    }
}

if (!function_exists('my_rentals_unit_listings_payload')) {
    function my_rentals_unit_listings_payload($units): array
    {
        $activeUnitIds = \App\Models\Contract::query()
            ->where('status', 'active')
            ->whereNotNull('unit_id')
            ->pluck('unit_id')
            ->unique();

        return $units
            ->reject(function ($unit) use ($activeUnitIds) {
                return $activeUnitIds->contains($unit->id);
            })
            ->map(function ($unit) {
                $property = $unit->property;

                return [
                    'id' => $unit->id,
                    'unit_number' => $unit->unit_number,
                    'floor' => $unit->floor,
                    'type' => $unit->type,
                    'status' => $unit->status,
                    'rent_amount' => $unit->rent_amount,
                    'rooms_count' => $unit->rooms_count,
                    'bathrooms_count' => $unit->bathrooms_count,
                    'has_kitchen' => $unit->has_kitchen,
                    'kitchen_type' => $unit->kitchen_type,
                    'is_kitchen_installed' => $unit->is_kitchen_installed,
                    'has_living_room' => $unit->has_living_room,
                    'is_rooftop' => $unit->is_rooftop,
                    'orientation' => $unit->orientation,
                    'property' => [
                        'id' => $property?->id,
                        'name' => $property?->name,
                        'city' => $property?->city,
                        'district' => $property?->district,
                        'address' => $property?->address,
                        'property_type' => $property?->property_type,
                        'parking_spots_count' => $property?->parking_spots_count,
                        'owner_name' => $property?->owner?->name,
                        'owner_phone' => $property?->owner?->phone,
                    ],
                    'listing_text' => my_rentals_unit_listing_text($unit),
                ];
            })
            ->values()
            ->all();
    }
}

Route::get('/unit-listings', function () {
    $units = \App\Models\Unit::with(['property.owner'])
        ->where(function ($query) {
            $query->whereNull('status')
                ->orWhereIn('status', ['available', 'vacant', 'ready']);
        })
        ->orderBy('property_id')
        ->orderBy('unit_number')
        ->get();

    return my_rentals_unit_listings_payload($units);
});

Route::get('/my/unit-listings', function (\Illuminate\Http\Request $request) {
    $user = function_exists('my_rentals_current_user_for_scope')
        ? my_rentals_current_user_for_scope($request)
        : (function_exists('my_rentals_bearer_user') ? my_rentals_bearer_user($request) : null);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $isAdmin = function_exists('my_rentals_is_admin_user')
        ? my_rentals_is_admin_user($user)
        : in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);

    $query = \App\Models\Unit::with(['property.owner'])
        ->where(function ($unitQuery) {
            $unitQuery->whereNull('status')
                ->orWhereIn('status', ['available', 'vacant', 'ready']);
        });

    if (!$isAdmin) {
        if (!$user->owner_id) {
            return [];
        }

        $propertyIds = \App\Models\Property::where('owner_id', $user->owner_id)->pluck('id');
        $query->whereIn('property_id', $propertyIds);
    }

    return my_rentals_unit_listings_payload(
        $query
            ->orderBy('property_id')
            ->orderBy('unit_number')
            ->get()
    );
});


/*
|--------------------------------------------------------------------------
| Follow-up Tasks
|--------------------------------------------------------------------------
| Simple operational task tracking for rent, contracts, maintenance and documents.
*/

if (!function_exists('my_rentals_followups_query_for_user')) {
    function my_rentals_followups_query_for_user(?\App\Models\User $user = null)
    {
        $query = \App\Models\FollowUpTask::with([
            'property.owner',
            'unit.property.owner',
            'tenant',
            'contract.tenant',
            'contract.unit.property.owner',
        ]);

        if (!$user) {
            return $query;
        }

        $isAdmin = function_exists('my_rentals_is_admin_user')
            ? my_rentals_is_admin_user($user)
            : in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);

        if ($isAdmin) {
            return $query;
        }

        if (!$user->owner_id) {
            return $query->whereRaw('1 = 0');
        }

        $propertyIds = \App\Models\Property::where('owner_id', $user->owner_id)->pluck('id');

        return $query->where(function ($q) use ($propertyIds) {
            $q->whereIn('property_id', $propertyIds)
                ->orWhereHas('unit', function ($unitQuery) use ($propertyIds) {
                    $unitQuery->whereIn('property_id', $propertyIds);
                })
                ->orWhereHas('contract.unit', function ($contractUnitQuery) use ($propertyIds) {
                    $contractUnitQuery->whereIn('property_id', $propertyIds);
                });
        });
    }
}

if (!function_exists('my_rentals_followups_order')) {
    function my_rentals_followups_order($query)
    {
        return $query
            ->orderByRaw("CASE status WHEN 'open' THEN 1 WHEN 'done' THEN 2 WHEN 'cancelled' THEN 3 ELSE 4 END")
            ->orderByRaw("CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 ELSE 5 END")
            ->orderByRaw("CASE WHEN due_date IS NULL THEN 2 ELSE 1 END")
            ->orderBy('due_date')
            ->orderBy('id', 'desc');
    }
}

Route::get('/follow-up-tasks', function () {
    return my_rentals_followups_order(my_rentals_followups_query_for_user(null))->get();
});

Route::post('/follow-up-tasks', function (Request $request) {
    $data = $request->validate([
        'property_id' => ['nullable', 'integer', 'exists:properties,id'],
        'unit_id' => ['nullable', 'integer', 'exists:units,id'],
        'tenant_id' => ['nullable', 'integer', 'exists:tenants,id'],
        'contract_id' => ['nullable', 'integer', 'exists:contracts,id'],
        'title' => ['required', 'string', 'max:255'],
        'task_type' => ['nullable', 'string', 'max:100'],
        'priority' => ['nullable', 'string', 'max:50'],
        'due_date' => ['nullable', 'date'],
        'status' => ['nullable', 'string', 'max:50'],
        'assigned_to_name' => ['nullable', 'string', 'max:255'],
        'notes' => ['nullable', 'string'],
    ]);

    if (empty($data['property_id']) && !empty($data['unit_id'])) {
        $data['property_id'] = \App\Models\Unit::where('id', $data['unit_id'])->value('property_id');
    }

    if (empty($data['tenant_id']) && !empty($data['contract_id'])) {
        $data['tenant_id'] = \App\Models\Contract::where('id', $data['contract_id'])->value('tenant_id');
    }

    if (empty($data['unit_id']) && !empty($data['contract_id'])) {
        $data['unit_id'] = \App\Models\Contract::where('id', $data['contract_id'])->value('unit_id');
    }

    if (empty($data['property_id']) && !empty($data['unit_id'])) {
        $data['property_id'] = \App\Models\Unit::where('id', $data['unit_id'])->value('property_id');
    }

    $task = \App\Models\FollowUpTask::create([
        'property_id' => $data['property_id'] ?? null,
        'unit_id' => $data['unit_id'] ?? null,
        'tenant_id' => $data['tenant_id'] ?? null,
        'contract_id' => $data['contract_id'] ?? null,
        'title' => $data['title'],
        'task_type' => $data['task_type'] ?? 'general',
        'priority' => $data['priority'] ?? 'normal',
        'due_date' => $data['due_date'] ?? null,
        'status' => $data['status'] ?? 'open',
        'assigned_to_name' => $data['assigned_to_name'] ?? null,
        'notes' => $data['notes'] ?? null,
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم إضافة مهمة المتابعة بنجاح',
        'task' => $task->fresh()->load([
            'property.owner',
            'unit.property.owner',
            'tenant',
            'contract.tenant',
            'contract.unit.property.owner',
        ]),
    ], 201);
});

Route::post('/follow-up-tasks/{followUpTask}/status', function (
    \App\Models\FollowUpTask $followUpTask,
    Request $request
) {
    $data = $request->validate([
        'status' => ['required', 'string', 'max:50'],
        'notes' => ['nullable', 'string'],
    ]);

    $updates = [
        'status' => $data['status'],
    ];

    if ($data['status'] === 'done') {
        $updates['completed_at'] = now();
    } else {
        $updates['completed_at'] = null;
    }

    if (array_key_exists('notes', $data)) {
        $updates['notes'] = $data['notes'];
    }

    $followUpTask->update($updates);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم تحديث حالة مهمة المتابعة',
        'task' => $followUpTask->fresh()->load([
            'property.owner',
            'unit.property.owner',
            'tenant',
            'contract.tenant',
            'contract.unit.property.owner',
        ]),
    ]);
});

Route::get('/my/follow-up-tasks', function (\Illuminate\Http\Request $request) {
    $user = function_exists('my_rentals_current_user_for_scope')
        ? my_rentals_current_user_for_scope($request)
        : (function_exists('my_rentals_bearer_user') ? my_rentals_bearer_user($request) : null);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    return my_rentals_followups_order(my_rentals_followups_query_for_user($user))->get();
});


/*
|--------------------------------------------------------------------------
| Document Center
|--------------------------------------------------------------------------
| File/document registry for properties, units, tenants, contracts and owners.
*/

if (!function_exists('my_rentals_document_record_payload')) {
    function my_rentals_document_record_payload($records)
    {
        return $records->map(function ($record) {
            $entityLabel = null;

            if ($record->entity_type === 'property') {
                $entity = \App\Models\Property::with('owner')->find($record->entity_id);
                $entityLabel = $entity ? (($entity->name ?: 'عقار') . ' — ' . ($entity->owner?->name ?: 'مالك غير محدد')) : null;
            } elseif ($record->entity_type === 'unit') {
                $entity = \App\Models\Unit::with('property.owner')->find($record->entity_id);
                $entityLabel = $entity ? (($entity->property?->name ?: 'عقار') . ' — ' . ($entity->unit_number ?: 'وحدة')) : null;
            } elseif ($record->entity_type === 'tenant') {
                $entity = \App\Models\Tenant::find($record->entity_id);
                $entityLabel = $entity?->name;
            } elseif ($record->entity_type === 'contract') {
                $entity = \App\Models\Contract::with(['tenant', 'unit.property.owner'])->find($record->entity_id);
                $entityLabel = $entity ? ('عقد #' . ($entity->government_contract_number ?: $entity->contract_number ?: $entity->id) . ' — ' . ($entity->tenant?->name ?: 'مستأجر')) : null;
            } elseif ($record->entity_type === 'owner') {
                $entity = \App\Models\Owner::find($record->entity_id);
                $entityLabel = $entity?->name;
            }

            $daysToExpiry = null;

            if ($record->expiry_date) {
                $daysToExpiry = now()->startOfDay()->diffInDays(\Carbon\Carbon::parse($record->expiry_date), false);
            }

            return [
                'id' => $record->id,
                'entity_type' => $record->entity_type,
                'entity_id' => $record->entity_id,
                'entity_label' => $entityLabel,
                'title' => $record->title,
                'document_type' => $record->document_type,
                'original_file_name' => $record->original_file_name,
                'mime_type' => $record->mime_type,
                'file_size' => $record->file_size,
                'storage_path' => $record->storage_path,
                'file_url' => $record->file_url,
                'issue_date' => $record->issue_date,
                'expiry_date' => $record->expiry_date,
                'days_to_expiry' => $daysToExpiry,
                'status' => $record->status,
                'notes' => $record->notes,
                'created_at' => $record->created_at,
                'updated_at' => $record->updated_at,
            ];
        })->values();
    }
}

if (!function_exists('my_rentals_document_query_for_user')) {
    function my_rentals_document_query_for_user(?\App\Models\User $user = null)
    {
        $query = \App\Models\DocumentRecord::query();

        if (!$user) {
            return $query;
        }

        $isAdmin = function_exists('my_rentals_is_admin_user')
            ? my_rentals_is_admin_user($user)
            : in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);

        if ($isAdmin) {
            return $query;
        }

        if (!$user->owner_id) {
            return $query->whereRaw('1 = 0');
        }

        $propertyIds = \App\Models\Property::where('owner_id', $user->owner_id)->pluck('id');
        $unitIds = \App\Models\Unit::whereIn('property_id', $propertyIds)->pluck('id');
        $contractIds = \App\Models\Contract::whereIn('unit_id', $unitIds)->pluck('id');
        $tenantIds = \App\Models\Tenant::whereHas('contracts', function ($contractQuery) use ($unitIds) {
            $contractQuery->whereIn('unit_id', $unitIds);
        })->pluck('id');

        return $query->where(function ($q) use ($propertyIds, $unitIds, $contractIds, $tenantIds, $user) {
            $q->where(function ($sub) use ($propertyIds) {
                    $sub->where('entity_type', 'property')->whereIn('entity_id', $propertyIds);
                })
                ->orWhere(function ($sub) use ($unitIds) {
                    $sub->where('entity_type', 'unit')->whereIn('entity_id', $unitIds);
                })
                ->orWhere(function ($sub) use ($contractIds) {
                    $sub->where('entity_type', 'contract')->whereIn('entity_id', $contractIds);
                })
                ->orWhere(function ($sub) use ($tenantIds) {
                    $sub->where('entity_type', 'tenant')->whereIn('entity_id', $tenantIds);
                })
                ->orWhere(function ($sub) use ($user) {
                    $sub->where('entity_type', 'owner')->where('entity_id', $user->owner_id);
                });
        });
    }
}

Route::get('/document-records', function (Request $request) {
    $query = \App\Models\DocumentRecord::query();

    if ($request->filled('entity_type')) {
        $query->where('entity_type', $request->string('entity_type'));
    }

    if ($request->filled('entity_id')) {
        $query->where('entity_id', $request->integer('entity_id'));
    }

    if ($request->filled('property_id')) {
        $query->where('entity_type', 'property')
            ->where('entity_id', $request->integer('property_id'));
    }

    $records = $query
        ->orderByRaw("CASE status WHEN 'active' THEN 1 WHEN 'expired' THEN 2 WHEN 'archived' THEN 3 ELSE 4 END")
        ->orderByRaw("CASE WHEN expiry_date IS NULL THEN 2 ELSE 1 END")
        ->orderBy('expiry_date')
        ->orderBy('id', 'desc')
        ->get();

    return my_rentals_document_record_payload($records);
});

Route::post('/document-records', function (\Illuminate\Http\Request $request) {
    $data = $request->validate([
        'entity_type' => ['required', 'string', 'max:50'],
        'entity_id' => ['nullable', 'integer'],
        'title' => ['required', 'string', 'max:255'],
        'document_type' => ['nullable', 'string', 'max:100'],
        'issue_date' => ['nullable', 'date'],
        'expiry_date' => ['nullable', 'date'],
        'status' => ['nullable', 'string', 'max:50'],
        'notes' => ['nullable', 'string'],
        'file' => ['nullable', 'file', 'max:20480'],
    ]);

    $storagePath = null;
    $fileUrl = null;
    $originalName = null;
    $mimeType = null;
    $fileSize = null;

    if ($request->hasFile('file')) {
        $file = $request->file('file');
        $originalName = $file->getClientOriginalName();
        $mimeType = $file->getClientMimeType();
        $fileSize = $file->getSize();

        $directory = 'my-rentals-documents/' . ($data['entity_type'] ?? 'general') . '/' . date('Y/m');
        $storagePath = $file->store($directory, 'public');
        $fileUrl = \Illuminate\Support\Facades\Storage::disk('public')->url($storagePath);
    }

    $record = \App\Models\DocumentRecord::create([
        'entity_type' => $data['entity_type'],
        'entity_id' => $data['entity_id'] ?? null,
        'title' => $data['title'],
        'document_type' => $data['document_type'] ?? 'other',
        'original_file_name' => $originalName,
        'mime_type' => $mimeType,
        'file_size' => $fileSize,
        'storage_path' => $storagePath,
        'file_url' => $fileUrl,
        'issue_date' => $data['issue_date'] ?? null,
        'expiry_date' => $data['expiry_date'] ?? null,
        'status' => $data['status'] ?? 'active',
        'notes' => $data['notes'] ?? null,
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم حفظ المستند بنجاح',
        'document' => my_rentals_document_record_payload(collect([$record->fresh()]))->first(),
    ], 201);
});

Route::post('/document-records/{documentRecord}/status', function (
    \App\Models\DocumentRecord $documentRecord,
    \Illuminate\Http\Request $request
) {
    $data = $request->validate([
        'status' => ['required', 'string', 'max:50'],
    ]);

    $documentRecord->update([
        'status' => $data['status'],
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم تحديث حالة المستند',
        'document' => my_rentals_document_record_payload(collect([$documentRecord->fresh()]))->first(),
    ]);
});

Route::get('/my/document-records', function (\Illuminate\Http\Request $request) {
    $user = function_exists('my_rentals_current_user_for_scope')
        ? my_rentals_current_user_for_scope($request)
        : (function_exists('my_rentals_bearer_user') ? my_rentals_bearer_user($request) : null);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $query = my_rentals_document_query_for_user($user);

    if ($request->filled('entity_type')) {
        $query->where('entity_type', $request->string('entity_type'));
    }

    if ($request->filled('entity_id')) {
        $query->where('entity_id', $request->integer('entity_id'));
    }

    if ($request->filled('property_id')) {
        $query->where('entity_type', 'property')
            ->where('entity_id', $request->integer('property_id'));
    }

    $records = $query
        ->orderByRaw("CASE status WHEN 'active' THEN 1 WHEN 'expired' THEN 2 WHEN 'archived' THEN 3 ELSE 4 END")
        ->orderByRaw("CASE WHEN expiry_date IS NULL THEN 2 ELSE 1 END")
        ->orderBy('expiry_date')
        ->orderBy('id', 'desc')
        ->get();

    return my_rentals_document_record_payload($records);
});


/*
|--------------------------------------------------------------------------
| Smart Alerts Center
|--------------------------------------------------------------------------
| Unified alerts from payments, contracts, utility bills, documents,
| maintenance requests and follow-up tasks.
*/

if (!function_exists('my_rentals_smart_alerts_add')) {
    function my_rentals_smart_alerts_add(array &$items, string $type, string $severity, string $title, ?string $subtitle, $date = null, array $meta = []): void
    {
        $dateValue = $date ?: now();

        try {
            $carbon = $dateValue instanceof \Carbon\Carbon ? $dateValue : \Carbon\Carbon::parse($dateValue);
        } catch (\Throwable $e) {
            $carbon = now();
        }

        $items[] = [
            'type' => $type,
            'severity' => $severity,
            'title' => $title,
            'subtitle' => $subtitle,
            'alert_date' => $carbon->toDateString(),
            'date_label' => $carbon->format('Y-m-d'),
            'meta' => $meta,
        ];
    }
}

if (!function_exists('my_rentals_smart_alerts_scope')) {
    function my_rentals_smart_alerts_scope(?\App\Models\User $user = null): array
    {
        $isAdmin = true;
        $ownerId = null;

        if ($user) {
            $ownerId = $user->owner_id ?? null;
            $isAdmin = function_exists('my_rentals_is_admin_user')
                ? my_rentals_is_admin_user($user)
                : in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);
        }

        if (!$isAdmin && !$ownerId) {
            return [
                'is_admin' => false,
                'owner_id' => null,
                'property_ids' => collect(),
                'unit_ids' => collect(),
                'contract_ids' => collect(),
            ];
        }

        $propertyQuery = \App\Models\Property::query();

        if (!$isAdmin) {
            $propertyQuery->where('owner_id', $ownerId);
        }

        $propertyIds = $propertyQuery->pluck('id');

        $unitIds = \App\Models\Unit::query()
            ->whereIn('property_id', $propertyIds)
            ->pluck('id');

        $contractIds = \App\Models\Contract::query()
            ->whereIn('unit_id', $unitIds)
            ->pluck('id');

        return [
            'is_admin' => $isAdmin,
            'owner_id' => $ownerId,
            'property_ids' => $propertyIds,
            'unit_ids' => $unitIds,
            'contract_ids' => $contractIds,
        ];
    }
}

if (!function_exists('my_rentals_smart_alerts_payload')) {
    function my_rentals_smart_alerts_payload(?\App\Models\User $user = null): array
    {
        $scope = my_rentals_smart_alerts_scope($user);

        if (!$scope['is_admin'] && !$scope['owner_id']) {
            return [
                'summary' => [
                    'total' => 0,
                    'critical' => 0,
                    'warning' => 0,
                    'info' => 0,
                ],
                'items' => [],
            ];
        }

        $items = [];
        $today = now()->startOfDay();
        $soon30 = $today->copy()->addDays(30);
        $soon90 = $today->copy()->addDays(90);

        /*
         * Payments: overdue and upcoming due within 7 days
         */
        $paymentQuery = \App\Models\Payment::with([
                'contract.tenant',
                'contract.unit.property.owner',
            ])
            ->whereIn('contract_id', $scope['contract_ids']);

        $overduePayments = (clone $paymentQuery)
            ->whereIn('status', ['overdue', 'due', 'partial'])
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', $today->toDateString())
            ->orderBy('due_date')
            ->limit(50)
            ->get();

        foreach ($overduePayments as $payment) {
            $days = \Carbon\Carbon::parse($payment->due_date)->diffInDays($today, false);

            my_rentals_smart_alerts_add(
                $items,
                'payment',
                'critical',
                'دفعة متأخرة',
                number_format((float) ($payment->amount ?? 0), 0) . ' ريال — ' . ($payment->contract?->tenant?->name ?: 'مستأجر') . ' — متأخرة ' . $days . ' يوم',
                $payment->due_date,
                [
                    'payment_id' => $payment->id,
                    'amount' => $payment->amount,
                    'due_date' => $payment->due_date,
                    'tenant_name' => $payment->contract?->tenant?->name,
                    'tenant_phone' => $payment->contract?->tenant?->phone,
                    'property_name' => $payment->contract?->unit?->property?->name,
                    'unit_number' => $payment->contract?->unit?->unit_number,
                    'days_late' => $days,
                ]
            );
        }

        $upcomingPayments = (clone $paymentQuery)
            ->whereIn('status', ['due', 'partial'])
            ->whereNotNull('due_date')
            ->whereBetween('due_date', [$today->toDateString(), $today->copy()->addDays(7)->toDateString()])
            ->orderBy('due_date')
            ->limit(50)
            ->get();

        foreach ($upcomingPayments as $payment) {
            my_rentals_smart_alerts_add(
                $items,
                'payment',
                'warning',
                'دفعة قريبة الاستحقاق',
                number_format((float) ($payment->amount ?? 0), 0) . ' ريال — ' . ($payment->contract?->tenant?->name ?: 'مستأجر'),
                $payment->due_date,
                [
                    'payment_id' => $payment->id,
                    'amount' => $payment->amount,
                    'due_date' => $payment->due_date,
                    'tenant_name' => $payment->contract?->tenant?->name,
                    'property_name' => $payment->contract?->unit?->property?->name,
                    'unit_number' => $payment->contract?->unit?->unit_number,
                ]
            );
        }

        /*
         * Contracts: expired or ending soon
         */
        $contractQuery = \App\Models\Contract::with([
                'tenant',
                'unit.property.owner',
            ])
            ->whereIn('id', $scope['contract_ids'])
            ->whereNotNull('end_date');

        $expiredContracts = (clone $contractQuery)
            ->where('status', 'active')
            ->whereDate('end_date', '<', $today->toDateString())
            ->orderBy('end_date')
            ->limit(50)
            ->get();

        foreach ($expiredContracts as $contract) {
            $days = \Carbon\Carbon::parse($contract->end_date)->diffInDays($today, false);

            my_rentals_smart_alerts_add(
                $items,
                'contract',
                'critical',
                'عقد نشط منتهي التاريخ',
                'عقد #' . ($contract->government_contract_number ?: $contract->contract_number ?: $contract->id) . ' — ' . ($contract->tenant?->name ?: 'مستأجر') . ' — منتهي منذ ' . $days . ' يوم',
                $contract->end_date,
                [
                    'contract_id' => $contract->id,
                    'end_date' => $contract->end_date,
                    'tenant_name' => $contract->tenant?->name,
                    'property_name' => $contract->unit?->property?->name,
                    'unit_number' => $contract->unit?->unit_number,
                    'days_after_end' => $days,
                ]
            );
        }

        $endingContracts = (clone $contractQuery)
            ->where('status', 'active')
            ->whereBetween('end_date', [$today->toDateString(), $soon90->toDateString()])
            ->orderBy('end_date')
            ->limit(50)
            ->get();

        foreach ($endingContracts as $contract) {
            $days = $today->diffInDays(\Carbon\Carbon::parse($contract->end_date), false);
            $severity = $days <= 30 ? 'warning' : 'info';

            my_rentals_smart_alerts_add(
                $items,
                'contract',
                $severity,
                'عقد قريب من الانتهاء',
                'عقد #' . ($contract->government_contract_number ?: $contract->contract_number ?: $contract->id) . ' — باقي ' . $days . ' يوم',
                $contract->end_date,
                [
                    'contract_id' => $contract->id,
                    'end_date' => $contract->end_date,
                    'tenant_name' => $contract->tenant?->name,
                    'property_name' => $contract->unit?->property?->name,
                    'unit_number' => $contract->unit?->unit_number,
                    'days_to_end' => $days,
                ]
            );
        }

        /*
         * Utility Bills
         */
        if (class_exists(\App\Models\UtilityBill::class) && \Illuminate\Support\Facades\Schema::hasTable('utility_bills')) {
            $utilityQuery = \App\Models\UtilityBill::with(['property.owner'])
                ->whereIn('property_id', $scope['property_ids']);

            $overdueUtilities = (clone $utilityQuery)
                ->whereIn('status', ['overdue', 'due'])
                ->whereNotNull('due_date')
                ->whereDate('due_date', '<', $today->toDateString())
                ->orderBy('due_date')
                ->limit(40)
                ->get();

            foreach ($overdueUtilities as $bill) {
                my_rentals_smart_alerts_add(
                    $items,
                    'utility',
                    'critical',
                    'فاتورة خدمات متأخرة',
                    number_format((float) ($bill->amount ?? 0), 0) . ' ريال — ' . ($bill->property?->name ?: 'عقار'),
                    $bill->due_date,
                    [
                        'utility_bill_id' => $bill->id,
                        'bill_type' => $bill->bill_type,
                        'amount' => $bill->amount,
                        'due_date' => $bill->due_date,
                        'property_name' => $bill->property?->name,
                    ]
                );
            }

            $upcomingUtilities = (clone $utilityQuery)
                ->where('status', 'due')
                ->whereNotNull('due_date')
                ->whereBetween('due_date', [$today->toDateString(), $soon30->toDateString()])
                ->orderBy('due_date')
                ->limit(40)
                ->get();

            foreach ($upcomingUtilities as $bill) {
                my_rentals_smart_alerts_add(
                    $items,
                    'utility',
                    'warning',
                    'فاتورة خدمات قريبة الاستحقاق',
                    number_format((float) ($bill->amount ?? 0), 0) . ' ريال — ' . ($bill->property?->name ?: 'عقار'),
                    $bill->due_date,
                    [
                        'utility_bill_id' => $bill->id,
                        'bill_type' => $bill->bill_type,
                        'amount' => $bill->amount,
                        'due_date' => $bill->due_date,
                        'property_name' => $bill->property?->name,
                    ]
                );
            }
        }

        /*
         * Documents expiring
         */
        if (class_exists(\App\Models\DocumentRecord::class) && \Illuminate\Support\Facades\Schema::hasTable('document_records')) {
            $documentQuery = \App\Models\DocumentRecord::query()
                ->where('status', 'active')
                ->whereNotNull('expiry_date');

            if (!$scope['is_admin']) {
                $propertyIds = $scope['property_ids'];
                $unitIds = $scope['unit_ids'];
                $contractIds = $scope['contract_ids'];

                $tenantIds = \App\Models\Tenant::whereHas('contracts', function ($query) use ($unitIds) {
                    $query->whereIn('unit_id', $unitIds);
                })->pluck('id');

                $documentQuery->where(function ($q) use ($propertyIds, $unitIds, $contractIds, $tenantIds, $scope) {
                    $q->where(function ($sub) use ($propertyIds) {
                            $sub->where('entity_type', 'property')->whereIn('entity_id', $propertyIds);
                        })
                        ->orWhere(function ($sub) use ($unitIds) {
                            $sub->where('entity_type', 'unit')->whereIn('entity_id', $unitIds);
                        })
                        ->orWhere(function ($sub) use ($contractIds) {
                            $sub->where('entity_type', 'contract')->whereIn('entity_id', $contractIds);
                        })
                        ->orWhere(function ($sub) use ($tenantIds) {
                            $sub->where('entity_type', 'tenant')->whereIn('entity_id', $tenantIds);
                        })
                        ->orWhere(function ($sub) use ($scope) {
                            $sub->where('entity_type', 'owner')->where('entity_id', $scope['owner_id']);
                        });
                });
            }

            $documents = $documentQuery
                ->whereDate('expiry_date', '<=', $soon90->toDateString())
                ->orderBy('expiry_date')
                ->limit(50)
                ->get();

            foreach ($documents as $doc) {
                $days = $today->diffInDays(\Carbon\Carbon::parse($doc->expiry_date), false);
                $severity = $days < 0 ? 'critical' : ($days <= 30 ? 'warning' : 'info');

                my_rentals_smart_alerts_add(
                    $items,
                    'document',
                    $severity,
                    $days < 0 ? 'مستند منتهي' : 'مستند قريب الانتهاء',
                    ($doc->title ?: 'مستند') . ' — ' . ($days < 0 ? 'منتهي منذ ' . abs($days) . ' يوم' : 'باقي ' . $days . ' يوم'),
                    $doc->expiry_date,
                    [
                        'document_record_id' => $doc->id,
                        'document_type' => $doc->document_type,
                        'entity_type' => $doc->entity_type,
                        'entity_id' => $doc->entity_id,
                        'expiry_date' => $doc->expiry_date,
                        'days_to_expiry' => $days,
                    ]
                );
            }
        }

        /*
         * Maintenance Requests
         */
        if (class_exists(\App\Models\MaintenanceRequest::class) && \Illuminate\Support\Facades\Schema::hasTable('maintenance_requests')) {
            $maintenanceQuery = \App\Models\MaintenanceRequest::with(['property.owner', 'unit', 'tenant'])
                ->whereIn('property_id', $scope['property_ids'])
                ->whereIn('status', ['open', 'scheduled', 'in_progress']);

            $maintenance = $maintenanceQuery
                ->where(function ($query) use ($today) {
                    $query->where('priority', 'urgent')
                        ->orWhereDate('scheduled_date', '<=', $today->toDateString());
                })
                ->orderByRaw("CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 ELSE 3 END")
                ->orderBy('scheduled_date')
                ->limit(40)
                ->get();

            foreach ($maintenance as $request) {
                my_rentals_smart_alerts_add(
                    $items,
                    'maintenance',
                    $request->priority === 'urgent' ? 'critical' : 'warning',
                    'طلب صيانة يحتاج متابعة',
                    ($request->title ?: 'طلب صيانة') . ' — ' . ($request->property?->name ?: 'عقار') . ' — ' . ($request->priority ?: 'normal'),
                    $request->scheduled_date ?: $request->request_date ?: $request->created_at,
                    [
                        'maintenance_request_id' => $request->id,
                        'priority' => $request->priority,
                        'status' => $request->status,
                        'property_name' => $request->property?->name,
                        'unit_number' => $request->unit?->unit_number,
                    ]
                );
            }
        }

        /*
         * Follow-up Tasks
         */
        if (class_exists(\App\Models\FollowUpTask::class) && \Illuminate\Support\Facades\Schema::hasTable('follow_up_tasks')) {
            $followupQuery = \App\Models\FollowUpTask::with(['property.owner', 'unit.property.owner', 'tenant', 'contract.unit.property.owner'])
                ->where('status', 'open');

            if (!$scope['is_admin']) {
                $propertyIds = $scope['property_ids'];

                $followupQuery->where(function ($q) use ($propertyIds) {
                    $q->whereIn('property_id', $propertyIds)
                        ->orWhereHas('unit', function ($unitQuery) use ($propertyIds) {
                            $unitQuery->whereIn('property_id', $propertyIds);
                        })
                        ->orWhereHas('contract.unit', function ($contractUnitQuery) use ($propertyIds) {
                            $contractUnitQuery->whereIn('property_id', $propertyIds);
                        });
                });
            }

            $tasks = $followupQuery
                ->where(function ($query) use ($soon30) {
                    $query->whereIn('priority', ['urgent', 'high'])
                        ->orWhereDate('due_date', '<=', $soon30->toDateString());
                })
                ->orderByRaw("CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 ELSE 3 END")
                ->orderBy('due_date')
                ->limit(50)
                ->get();

            foreach ($tasks as $task) {
                $days = $task->due_date ? now()->startOfDay()->diffInDays(\Carbon\Carbon::parse($task->due_date), false) : null;
                $severity = ($task->priority === 'urgent' || ($days !== null && $days < 0)) ? 'critical' : 'warning';

                my_rentals_smart_alerts_add(
                    $items,
                    'followup',
                    $severity,
                    'مهمة متابعة',
                    ($task->title ?: 'متابعة') . ($days !== null ? ' — ' . ($days < 0 ? 'متأخرة ' . abs($days) . ' يوم' : 'باقي ' . $days . ' يوم') : ''),
                    $task->due_date ?: $task->created_at,
                    [
                        'follow_up_task_id' => $task->id,
                        'priority' => $task->priority,
                        'task_type' => $task->task_type,
                        'property_name' => $task->property?->name ?: $task->unit?->property?->name ?: $task->contract?->unit?->property?->name,
                        'tenant_name' => $task->tenant?->name ?: $task->contract?->tenant?->name,
                    ]
                );
            }
        }

        $weight = [
            'critical' => 1,
            'warning' => 2,
            'info' => 3,
        ];

        usort($items, function ($a, $b) use ($weight) {
            $severityCompare = ($weight[$a['severity']] ?? 9) <=> ($weight[$b['severity']] ?? 9);

            if ($severityCompare !== 0) {
                return $severityCompare;
            }

            return strcmp($a['alert_date'], $b['alert_date']);
        });

        $items = array_slice($items, 0, 200);

        return [
            'summary' => [
                'total' => count($items),
                'critical' => collect($items)->where('severity', 'critical')->count(),
                'warning' => collect($items)->where('severity', 'warning')->count(),
                'info' => collect($items)->where('severity', 'info')->count(),
            ],
            'items' => array_values($items),
        ];
    }
}

Route::get('/smart-alerts', function () {
    return my_rentals_smart_alerts_payload(null);
});

Route::get('/my/smart-alerts', function (\Illuminate\Http\Request $request) {
    $user = function_exists('my_rentals_current_user_for_scope')
        ? my_rentals_current_user_for_scope($request)
        : (function_exists('my_rentals_bearer_user') ? my_rentals_bearer_user($request) : null);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    return my_rentals_smart_alerts_payload($user);
});


/*
|--------------------------------------------------------------------------
| Home Dashboard Summary
|--------------------------------------------------------------------------
| Compact executive summary for the mobile home screen.
*/

if (!function_exists('my_rentals_dashboard_scope')) {
    function my_rentals_dashboard_scope(?\App\Models\User $user = null): array
    {
        $isAdmin = true;
        $ownerId = null;

        if ($user) {
            $ownerId = $user->owner_id ?? null;
            $isAdmin = function_exists('my_rentals_is_admin_user')
                ? my_rentals_is_admin_user($user)
                : in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);
        }

        if (!$isAdmin && !$ownerId) {
            return [
                'is_admin' => false,
                'owner_id' => null,
                'property_ids' => collect(),
                'unit_ids' => collect(),
                'contract_ids' => collect(),
                'tenant_ids' => collect(),
            ];
        }

        $propertyQuery = \App\Models\Property::query();

        if (!$isAdmin) {
            $propertyQuery->where('owner_id', $ownerId);
        }

        $propertyIds = $propertyQuery->pluck('id');

        $unitIds = \App\Models\Unit::query()
            ->whereIn('property_id', $propertyIds)
            ->pluck('id');

        $contractIds = \App\Models\Contract::query()
            ->whereIn('unit_id', $unitIds)
            ->pluck('id');

        $tenantIds = \App\Models\Tenant::query()
            ->whereHas('contracts', function ($query) use ($unitIds) {
                $query->whereIn('unit_id', $unitIds);
            })
            ->pluck('id');

        return [
            'is_admin' => $isAdmin,
            'owner_id' => $ownerId,
            'property_ids' => $propertyIds,
            'unit_ids' => $unitIds,
            'contract_ids' => $contractIds,
            'tenant_ids' => $tenantIds,
        ];
    }
}

if (!function_exists('my_rentals_dashboard_summary_payload')) {
    function my_rentals_dashboard_summary_payload(?\App\Models\User $user = null): array
    {
        $scope = my_rentals_dashboard_scope($user);
        $propertyIds = $scope['property_ids'];
        $unitIds = $scope['unit_ids'];
        $contractIds = $scope['contract_ids'];
        $tenantIds = $scope['tenant_ids'];

        if (!$scope['is_admin'] && !$scope['owner_id']) {
            return [
                'scope' => [
                    'is_admin' => false,
                    'owner_id' => null,
                ],
                'summary' => [
                    'properties_count' => 0,
                    'units_count' => 0,
                    'rented_units_count' => 0,
                    'vacant_units_count' => 0,
                    'occupancy_rate' => 0,
                    'active_contracts_count' => 0,
                    'tenants_count' => 0,
                    'paid_income' => 0,
                    'due_income' => 0,
                    'overdue_income' => 0,
                    'expenses' => 0,
                    'net_income' => 0,
                    'open_maintenance_count' => 0,
                    'open_followups_count' => 0,
                    'critical_alerts_count' => 0,
                    'documents_expiring_count' => 0,
                    'utility_overdue_amount' => 0,
                ],
                'cards' => [],
            ];
        }

        $propertiesCount = \App\Models\Property::query()
            ->whereIn('id', $propertyIds)
            ->count();

        $unitsCount = \App\Models\Unit::query()
            ->whereIn('id', $unitIds)
            ->count();

        $activeContracts = \App\Models\Contract::query()
            ->whereIn('id', $contractIds)
            ->where('status', 'active')
            ->get();

        $activeContractsCount = $activeContracts->count();
        $rentedUnitsCount = $activeContracts->pluck('unit_id')->filter()->unique()->count();
        $vacantUnitsCount = max($unitsCount - $rentedUnitsCount, 0);
        $occupancyRate = $unitsCount > 0 ? round(($rentedUnitsCount / $unitsCount) * 100, 2) : 0;

        $paymentsQuery = \App\Models\Payment::query()
            ->whereIn('contract_id', $contractIds);

        $dueIncome = (float) (clone $paymentsQuery)->where('status', 'due')->sum('amount');
        $overdueIncome = (float) (clone $paymentsQuery)->where('status', 'overdue')->sum('amount');

        if (
            class_exists(\App\Models\PaymentReceipt::class)
            && \Illuminate\Support\Facades\Schema::hasTable('payment_receipts')
        ) {
            $paidIncome = (float) \App\Models\PaymentReceipt::query()
                ->whereIn('contract_id', $contractIds)
                ->sum('amount');
        } else {
            $paidIncome = (float) (clone $paymentsQuery)->where('status', 'paid')->sum('amount');
        }

        $expenses = 0;

        if (class_exists(\App\Models\PropertyExpense::class) && \Illuminate\Support\Facades\Schema::hasTable('property_expenses')) {
            $expenses = (float) \App\Models\PropertyExpense::query()
                ->whereIn('property_id', $propertyIds)
                ->sum('amount');
        }

        $utilityOverdueAmount = 0;
        $utilityOverdueCount = 0;

        if (class_exists(\App\Models\UtilityBill::class) && \Illuminate\Support\Facades\Schema::hasTable('utility_bills')) {
            $utilityOverdueAmount = (float) \App\Models\UtilityBill::query()
                ->whereIn('property_id', $propertyIds)
                ->where('status', 'overdue')
                ->sum('amount');

            $utilityOverdueCount = (int) \App\Models\UtilityBill::query()
                ->whereIn('property_id', $propertyIds)
                ->where('status', 'overdue')
                ->count();
        }

        $openMaintenanceCount = 0;

        if (class_exists(\App\Models\MaintenanceRequest::class) && \Illuminate\Support\Facades\Schema::hasTable('maintenance_requests')) {
            $openMaintenanceCount = (int) \App\Models\MaintenanceRequest::query()
                ->whereIn('property_id', $propertyIds)
                ->whereIn('status', ['open', 'scheduled', 'in_progress'])
                ->count();
        }

        $openFollowupsCount = 0;

        if (class_exists(\App\Models\FollowUpTask::class) && \Illuminate\Support\Facades\Schema::hasTable('follow_up_tasks')) {
            $openFollowupsCount = (int) \App\Models\FollowUpTask::query()
                ->where('status', 'open')
                ->where(function ($query) use ($propertyIds, $unitIds, $contractIds) {
                    $query->whereIn('property_id', $propertyIds)
                        ->orWhereIn('unit_id', $unitIds)
                        ->orWhereIn('contract_id', $contractIds);
                })
                ->count();
        }

        $documentsExpiringCount = 0;

        if (class_exists(\App\Models\DocumentRecord::class) && \Illuminate\Support\Facades\Schema::hasTable('document_records')) {
            $soon = now()->addDays(30)->toDateString();

            $documentsQuery = \App\Models\DocumentRecord::query()
                ->where('status', 'active')
                ->whereNotNull('expiry_date')
                ->whereDate('expiry_date', '<=', $soon);

            if (!$scope['is_admin']) {
                $documentsQuery->where(function ($q) use ($propertyIds, $unitIds, $contractIds, $tenantIds, $scope) {
                    $q->where(function ($sub) use ($propertyIds) {
                            $sub->where('entity_type', 'property')->whereIn('entity_id', $propertyIds);
                        })
                        ->orWhere(function ($sub) use ($unitIds) {
                            $sub->where('entity_type', 'unit')->whereIn('entity_id', $unitIds);
                        })
                        ->orWhere(function ($sub) use ($contractIds) {
                            $sub->where('entity_type', 'contract')->whereIn('entity_id', $contractIds);
                        })
                        ->orWhere(function ($sub) use ($tenantIds) {
                            $sub->where('entity_type', 'tenant')->whereIn('entity_id', $tenantIds);
                        })
                        ->orWhere(function ($sub) use ($scope) {
                            $sub->where('entity_type', 'owner')->where('entity_id', $scope['owner_id']);
                        });
                });
            }

            $documentsExpiringCount = (int) $documentsQuery->count();
        }

        $criticalAlertsCount = 0;

        if (function_exists('my_rentals_smart_alerts_payload')) {
            try {
                $alerts = my_rentals_smart_alerts_payload($user);
                $criticalAlertsCount = (int) ($alerts['summary']['critical'] ?? 0);
            } catch (\Throwable $e) {
                $criticalAlertsCount = 0;
            }
        }

        $recentDuePayments = \App\Models\Payment::with(['contract.tenant', 'contract.unit.property.owner'])
            ->whereIn('contract_id', $contractIds)
            ->whereIn('status', ['due', 'overdue', 'partial'])
            ->orderBy('due_date')
            ->limit(5)
            ->get()
            ->map(function ($payment) {
                return [
                    'id' => $payment->id,
                    'amount' => $payment->amount,
                    'status' => $payment->status,
                    'due_date' => $payment->due_date,
                    'tenant_name' => $payment->contract?->tenant?->name,
                    'property_name' => $payment->contract?->unit?->property?->name,
                    'unit_number' => $payment->contract?->unit?->unit_number,
                ];
            })
            ->values();

        $recentContracts = \App\Models\Contract::with(['tenant', 'unit.property.owner'])
            ->whereIn('id', $contractIds)
            ->where('status', 'active')
            ->whereNotNull('end_date')
            ->orderBy('end_date')
            ->limit(5)
            ->get()
            ->map(function ($contract) {
                return [
                    'id' => $contract->id,
                    'contract_number' => $contract->government_contract_number ?: $contract->contract_number ?: $contract->id,
                    'end_date' => $contract->end_date,
                    'tenant_name' => $contract->tenant?->name,
                    'property_name' => $contract->unit?->property?->name,
                    'unit_number' => $contract->unit?->unit_number,
                ];
            })
            ->values();

        $summary = [
            'properties_count' => $propertiesCount,
            'units_count' => $unitsCount,
            'rented_units_count' => $rentedUnitsCount,
            'vacant_units_count' => $vacantUnitsCount,
            'occupancy_rate' => $occupancyRate,
            'active_contracts_count' => $activeContractsCount,
            'tenants_count' => $tenantIds->count(),
            'paid_income' => $paidIncome,
            'due_income' => $dueIncome,
            'overdue_income' => $overdueIncome,
            'expenses' => $expenses,
            'net_income' => $paidIncome - $expenses,
            'open_maintenance_count' => $openMaintenanceCount,
            'open_followups_count' => $openFollowupsCount,
            'critical_alerts_count' => $criticalAlertsCount,
            'documents_expiring_count' => $documentsExpiringCount,
            'utility_overdue_amount' => $utilityOverdueAmount,
            'utility_overdue_count' => $utilityOverdueCount,
        ];

        return [
            'scope' => [
                'is_admin' => $scope['is_admin'],
                'owner_id' => $scope['owner_id'],
            ],
            'summary' => $summary,
            'cards' => [
                [
                    'title' => 'العقارات',
                    'value' => $propertiesCount,
                    'subtitle' => 'إجمالي العقارات',
                    'target' => '/properties',
                ],
                [
                    'title' => 'الوحدات الشاغرة',
                    'value' => $vacantUnitsCount,
                    'subtitle' => 'جاهزة للتسويق',
                    'target' => '/unit-marketing',
                ],
                [
                    'title' => 'الإشغال',
                    'value' => $occupancyRate . '%',
                    'subtitle' => $rentedUnitsCount . ' من ' . $unitsCount,
                    'target' => '/occupancy',
                ],
                [
                    'title' => 'المتأخر',
                    'value' => number_format($overdueIncome, 0),
                    'subtitle' => 'دفعات متأخرة',
                    'target' => '/reminders',
                ],
                [
                    'title' => 'الصافي',
                    'value' => number_format($paidIncome - $expenses, 0),
                    'subtitle' => 'المقبوض ناقص المصاريف',
                    'target' => '/monthly-financial',
                ],
                [
                    'title' => 'التنبيهات',
                    'value' => $criticalAlertsCount,
                    'subtitle' => 'تنبيهات عاجلة',
                    'target' => '/smart-alerts',
                ],
            ],
            'recent_due_payments' => $recentDuePayments,
            'recent_contracts' => $recentContracts,
        ];
    }
}

Route::get('/dashboard-summary', function () {
    return my_rentals_dashboard_summary_payload(null);
});

Route::get('/my/dashboard-summary', function (\Illuminate\Http\Request $request) {
    $user = function_exists('my_rentals_current_user_for_scope')
        ? my_rentals_current_user_for_scope($request)
        : (function_exists('my_rentals_bearer_user') ? my_rentals_bearer_user($request) : null);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    return my_rentals_dashboard_summary_payload($user);
});

Route::get('/my/dashboard', function (\Illuminate\Http\Request $request) {
    $user = function_exists('my_rentals_current_user_for_scope')
        ? my_rentals_current_user_for_scope($request)
        : (function_exists('my_rentals_bearer_user') ? my_rentals_bearer_user($request) : null);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    return my_rentals_dashboard_summary_payload($user);
});


/*
|--------------------------------------------------------------------------
| Export Center
|--------------------------------------------------------------------------
| Creates JSON/CSV exports from current data, scoped by owner when logged in.
*/

if (!function_exists('my_rentals_export_scope')) {
    function my_rentals_export_scope(?\App\Models\User $user = null): array
    {
        $isAdmin = true;
        $ownerId = null;

        if ($user) {
            $ownerId = $user->owner_id ?? null;
            $isAdmin = function_exists('my_rentals_is_admin_user')
                ? my_rentals_is_admin_user($user)
                : in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);
        }

        if (!$isAdmin && !$ownerId) {
            return [
                'is_admin' => false,
                'owner_id' => null,
                'property_ids' => collect(),
                'unit_ids' => collect(),
                'contract_ids' => collect(),
                'tenant_ids' => collect(),
            ];
        }

        $propertyQuery = \App\Models\Property::query();

        if (!$isAdmin) {
            $propertyQuery->where('owner_id', $ownerId);
        }

        $propertyIds = $propertyQuery->pluck('id');

        $unitIds = \App\Models\Unit::query()
            ->whereIn('property_id', $propertyIds)
            ->pluck('id');

        $contractIds = \App\Models\Contract::query()
            ->whereIn('unit_id', $unitIds)
            ->pluck('id');

        $tenantIds = \App\Models\Tenant::query()
            ->whereHas('contracts', function ($query) use ($unitIds) {
                $query->whereIn('unit_id', $unitIds);
            })
            ->pluck('id');

        return [
            'is_admin' => $isAdmin,
            'owner_id' => $ownerId,
            'property_ids' => $propertyIds,
            'unit_ids' => $unitIds,
            'contract_ids' => $contractIds,
            'tenant_ids' => $tenantIds,
        ];
    }
}

if (!function_exists('my_rentals_export_csv')) {
    function my_rentals_export_csv(array $rows): string
    {
        if (count($rows) === 0) {
            return '';
        }

        $headers = array_keys($rows[0]);

        $stream = fopen('php://temp', 'r+');
        fputcsv($stream, $headers);

        foreach ($rows as $row) {
            $line = [];

            foreach ($headers as $header) {
                $value = $row[$header] ?? '';

                if (is_bool($value)) {
                    $value = $value ? '1' : '0';
                } elseif (is_array($value) || is_object($value)) {
                    $value = json_encode($value, JSON_UNESCAPED_UNICODE);
                }

                $line[] = $value;
            }

            fputcsv($stream, $line);
        }

        rewind($stream);
        $csv = stream_get_contents($stream);
        fclose($stream);

        return "\xEF\xBB\xBF" . $csv;
    }
}

if (!function_exists('my_rentals_export_payload_rows')) {
    function my_rentals_export_payload_rows(string $type, array $scope): array
    {
        $propertyIds = $scope['property_ids'];
        $unitIds = $scope['unit_ids'];
        $contractIds = $scope['contract_ids'];
        $tenantIds = $scope['tenant_ids'];

        if ($type === 'properties') {
            return \App\Models\Property::with('owner')
                ->whereIn('id', $propertyIds)
                ->orderBy('id')
                ->get()
                ->map(fn ($property) => [
                    'id' => $property->id,
                    'name' => $property->name,
                    'owner' => $property->owner?->name,
                    'city' => $property->city,
                    'district' => $property->district,
                    'address' => $property->address,
                    'property_type' => $property->property_type,
                    'management_type' => $property->management_type,
                    'deed_number' => $property->deed_number,
                    'floors_count' => $property->floors_count,
                    'parking_spots_count' => $property->parking_spots_count,
                    'created_at' => optional($property->created_at)->toDateTimeString(),
                ])
                ->values()
                ->all();
        }

        if ($type === 'units') {
            return \App\Models\Unit::with('property.owner')
                ->whereIn('id', $unitIds)
                ->orderBy('property_id')
                ->orderBy('unit_number')
                ->get()
                ->map(fn ($unit) => [
                    'id' => $unit->id,
                    'property' => $unit->property?->name,
                    'owner' => $unit->property?->owner?->name,
                    'unit_number' => $unit->unit_number,
                    'floor' => $unit->floor,
                    'type' => $unit->type,
                    'status' => $unit->status,
                    'rent_amount' => $unit->rent_amount,
                    'rooms_count' => $unit->rooms_count,
                    'bathrooms_count' => $unit->bathrooms_count,
                    'has_kitchen' => $unit->has_kitchen,
                    'kitchen_type' => $unit->kitchen_type,
                    'has_living_room' => $unit->has_living_room,
                    'is_rooftop' => $unit->is_rooftop,
                    'orientation' => $unit->orientation,
                ])
                ->values()
                ->all();
        }

        if ($type === 'tenants') {
            return \App\Models\Tenant::query()
                ->whereIn('id', $tenantIds)
                ->orderBy('id')
                ->get()
                ->map(fn ($tenant) => [
                    'id' => $tenant->id,
                    'name' => $tenant->name,
                    'phone' => $tenant->phone,
                    'email' => $tenant->email,
                    'national_id' => $tenant->national_id,
                    'nationality' => $tenant->nationality,
                    'created_at' => optional($tenant->created_at)->toDateTimeString(),
                ])
                ->values()
                ->all();
        }

        if ($type === 'contracts') {
            return \App\Models\Contract::with(['tenant', 'unit.property.owner'])
                ->whereIn('id', $contractIds)
                ->orderBy('id')
                ->get()
                ->map(fn ($contract) => [
                    'id' => $contract->id,
                    'contract_number' => $contract->government_contract_number ?: $contract->contract_number,
                    'status' => $contract->status,
                    'tenant' => $contract->tenant?->name,
                    'tenant_phone' => $contract->tenant?->phone,
                    'property' => $contract->unit?->property?->name,
                    'owner' => $contract->unit?->property?->owner?->name,
                    'unit_number' => $contract->unit?->unit_number,
                    'start_date' => $contract->start_date,
                    'end_date' => $contract->end_date,
                    'rent_amount' => $contract->rent_amount,
                    'parking_fee' => $contract->parking_fee,
                    'services_fee' => $contract->services_fee,
                    'deposit_amount' => $contract->deposit_amount,
                    'payment_cycle' => $contract->payment_cycle,
                ])
                ->values()
                ->all();
        }

        if ($type === 'payments') {
            return \App\Models\Payment::with(['contract.tenant', 'contract.unit.property.owner'])
                ->whereIn('contract_id', $contractIds)
                ->orderBy('due_date')
                ->get()
                ->map(fn ($payment) => [
                    'id' => $payment->id,
                    'contract_id' => $payment->contract_id,
                    'tenant' => $payment->contract?->tenant?->name,
                    'property' => $payment->contract?->unit?->property?->name,
                    'owner' => $payment->contract?->unit?->property?->owner?->name,
                    'unit_number' => $payment->contract?->unit?->unit_number,
                    'amount' => $payment->amount,
                    'due_date' => $payment->due_date,
                    'paid_date' => $payment->paid_date,
                    'status' => $payment->status,
                    'notes' => $payment->notes,
                ])
                ->values()
                ->all();
        }

        if ($type === 'receipts') {
            if (!class_exists(\App\Models\PaymentReceipt::class) || !\Illuminate\Support\Facades\Schema::hasTable('payment_receipts')) {
                return [];
            }

            return \App\Models\PaymentReceipt::with(['payment.contract.tenant', 'payment.contract.unit.property.owner'])
                ->whereIn('contract_id', $contractIds)
                ->orderBy('received_date')
                ->get()
                ->map(fn ($receipt) => [
                    'id' => $receipt->id,
                    'payment_id' => $receipt->payment_id,
                    'contract_id' => $receipt->contract_id,
                    'tenant' => $receipt->payment?->contract?->tenant?->name,
                    'property' => $receipt->payment?->contract?->unit?->property?->name,
                    'owner' => $receipt->payment?->contract?->unit?->property?->owner?->name,
                    'unit_number' => $receipt->payment?->contract?->unit?->unit_number,
                    'amount' => $receipt->amount,
                    'received_date' => $receipt->received_date,
                    'method' => $receipt->method,
                    'reference_number' => $receipt->reference_number,
                    'notes' => $receipt->notes,
                ])
                ->values()
                ->all();
        }

        if ($type === 'expenses') {
            if (!class_exists(\App\Models\PropertyExpense::class) || !\Illuminate\Support\Facades\Schema::hasTable('property_expenses')) {
                return [];
            }

            return \App\Models\PropertyExpense::with(['property.owner', 'category'])
                ->whereIn('property_id', $propertyIds)
                ->orderBy('expense_date')
                ->get()
                ->map(fn ($expense) => [
                    'id' => $expense->id,
                    'property' => $expense->property?->name,
                    'owner' => $expense->property?->owner?->name,
                    'category' => $expense->category?->name,
                    'title' => $expense->title,
                    'amount' => $expense->amount,
                    'expense_date' => $expense->expense_date,
                    'description' => $expense->description,
                ])
                ->values()
                ->all();
        }

        if ($type === 'utility_bills') {
            if (!class_exists(\App\Models\UtilityBill::class) || !\Illuminate\Support\Facades\Schema::hasTable('utility_bills')) {
                return [];
            }

            return \App\Models\UtilityBill::with(['property.owner'])
                ->whereIn('property_id', $propertyIds)
                ->orderBy('due_date')
                ->get()
                ->map(fn ($bill) => [
                    'id' => $bill->id,
                    'property' => $bill->property?->name,
                    'owner' => $bill->property?->owner?->name,
                    'bill_type' => $bill->bill_type,
                    'provider' => $bill->provider,
                    'bill_number' => $bill->bill_number,
                    'amount' => $bill->amount,
                    'bill_date' => $bill->bill_date,
                    'due_date' => $bill->due_date,
                    'paid_date' => $bill->paid_date,
                    'status' => $bill->status,
                    'notes' => $bill->notes,
                ])
                ->values()
                ->all();
        }

        if ($type === 'followups') {
            if (!class_exists(\App\Models\FollowUpTask::class) || !\Illuminate\Support\Facades\Schema::hasTable('follow_up_tasks')) {
                return [];
            }

            return \App\Models\FollowUpTask::with(['property.owner', 'unit.property.owner', 'tenant', 'contract.tenant'])
                ->where(function ($query) use ($propertyIds, $unitIds, $contractIds, $tenantIds) {
                    $query->whereIn('property_id', $propertyIds)
                        ->orWhereIn('unit_id', $unitIds)
                        ->orWhereIn('contract_id', $contractIds)
                        ->orWhereIn('tenant_id', $tenantIds);
                })
                ->orderBy('due_date')
                ->get()
                ->map(fn ($task) => [
                    'id' => $task->id,
                    'title' => $task->title,
                    'task_type' => $task->task_type,
                    'priority' => $task->priority,
                    'status' => $task->status,
                    'due_date' => $task->due_date,
                    'completed_at' => $task->completed_at,
                    'property' => $task->property?->name ?: $task->unit?->property?->name,
                    'unit' => $task->unit?->unit_number,
                    'tenant' => $task->tenant?->name ?: $task->contract?->tenant?->name,
                    'assigned_to_name' => $task->assigned_to_name,
                    'notes' => $task->notes,
                ])
                ->values()
                ->all();
        }

        if ($type === 'backup') {
            return [
                'properties' => my_rentals_export_payload_rows('properties', $scope),
                'units' => my_rentals_export_payload_rows('units', $scope),
                'tenants' => my_rentals_export_payload_rows('tenants', $scope),
                'contracts' => my_rentals_export_payload_rows('contracts', $scope),
                'payments' => my_rentals_export_payload_rows('payments', $scope),
                'receipts' => my_rentals_export_payload_rows('receipts', $scope),
                'expenses' => my_rentals_export_payload_rows('expenses', $scope),
                'utility_bills' => my_rentals_export_payload_rows('utility_bills', $scope),
                'followups' => my_rentals_export_payload_rows('followups', $scope),
            ];
        }

        return [];
    }
}

if (!function_exists('my_rentals_export_summary_payload')) {
    function my_rentals_export_summary_payload(?\App\Models\User $user = null): array
    {
        $scope = my_rentals_export_scope($user);

        return [
            'scope' => [
                'is_admin' => $scope['is_admin'],
                'owner_id' => $scope['owner_id'],
            ],
            'counts' => [
                'properties' => $scope['property_ids']->count(),
                'units' => $scope['unit_ids']->count(),
                'tenants' => $scope['tenant_ids']->count(),
                'contracts' => $scope['contract_ids']->count(),
                'payments' => \App\Models\Payment::whereIn('contract_id', $scope['contract_ids'])->count(),
                'receipts' => class_exists(\App\Models\PaymentReceipt::class) && \Illuminate\Support\Facades\Schema::hasTable('payment_receipts')
                    ? \App\Models\PaymentReceipt::whereIn('contract_id', $scope['contract_ids'])->count()
                    : 0,
                'expenses' => class_exists(\App\Models\PropertyExpense::class) && \Illuminate\Support\Facades\Schema::hasTable('property_expenses')
                    ? \App\Models\PropertyExpense::whereIn('property_id', $scope['property_ids'])->count()
                    : 0,
                'utility_bills' => class_exists(\App\Models\UtilityBill::class) && \Illuminate\Support\Facades\Schema::hasTable('utility_bills')
                    ? \App\Models\UtilityBill::whereIn('property_id', $scope['property_ids'])->count()
                    : 0,
                'followups' => class_exists(\App\Models\FollowUpTask::class) && \Illuminate\Support\Facades\Schema::hasTable('follow_up_tasks')
                    ? \App\Models\FollowUpTask::where(function ($query) use ($scope) {
                        $query->whereIn('property_id', $scope['property_ids'])
                            ->orWhereIn('unit_id', $scope['unit_ids'])
                            ->orWhereIn('contract_id', $scope['contract_ids'])
                            ->orWhereIn('tenant_id', $scope['tenant_ids']);
                    })->count()
                    : 0,
            ],
            'available_types' => [
                'properties',
                'units',
                'tenants',
                'contracts',
                'payments',
                'receipts',
                'expenses',
                'utility_bills',
                'followups',
                'backup',
            ],
        ];
    }
}

if (!function_exists('my_rentals_export_response')) {
    function my_rentals_export_response(\Illuminate\Http\Request $request, ?\App\Models\User $user = null)
    {
        $type = (string) $request->query('type', 'backup');
        $format = (string) $request->query('format', 'json');

        $allowedTypes = [
            'properties',
            'units',
            'tenants',
            'contracts',
            'payments',
            'receipts',
            'expenses',
            'utility_bills',
            'followups',
            'backup',
        ];

        if (!in_array($type, $allowedTypes, true)) {
            return response()->json([
                'message' => 'نوع التصدير غير مدعوم.',
            ], 422);
        }

        $scope = my_rentals_export_scope($user);
        $rows = my_rentals_export_payload_rows($type, $scope);
        $now = now()->format('Ymd_His');

        if ($format === 'csv' && $type !== 'backup') {
            $content = my_rentals_export_csv($rows);
            $mime = 'text/csv';
            $filename = 'my_rentals_' . $type . '_' . $now . '.csv';
        } else {
            $content = json_encode($rows, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $mime = 'application/json';
            $filename = 'my_rentals_' . $type . '_' . $now . '.json';
            $format = 'json';
        }

        return response()->json([
            'status' => 'ok',
            'type' => $type,
            'format' => $format,
            'filename' => $filename,
            'mime_type' => $mime,
            'records_count' => $type === 'backup' ? count($rows) : count($rows),
            'content' => $content,
            'generated_at' => now()->toDateTimeString(),
        ]);
    }
}

Route::get('/export-center/summary', function () {
    return my_rentals_export_summary_payload(null);
});

Route::get('/export-center/export', function (\Illuminate\Http\Request $request) {
    return my_rentals_export_response($request, null);
});

Route::get('/my/export-center/summary', function (\Illuminate\Http\Request $request) {
    $user = function_exists('my_rentals_current_user_for_scope')
        ? my_rentals_current_user_for_scope($request)
        : (function_exists('my_rentals_bearer_user') ? my_rentals_bearer_user($request) : null);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    return my_rentals_export_summary_payload($user);
});

Route::get('/my/export-center/export', function (\Illuminate\Http\Request $request) {
    $user = function_exists('my_rentals_current_user_for_scope')
        ? my_rentals_current_user_for_scope($request)
        : (function_exists('my_rentals_bearer_user') ? my_rentals_bearer_user($request) : null);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    return my_rentals_export_response($request, $user);
});


/*
|--------------------------------------------------------------------------
| System Settings & Message Templates
|--------------------------------------------------------------------------
| Central configurable settings used by reminders, listings and reports.
*/

if (!function_exists('my_rentals_default_app_settings')) {
    function my_rentals_default_app_settings(): array
    {
        return [
            [
                'key' => 'company_name',
                'value' => 'My Rentals',
                'type' => 'string',
                'group' => 'general',
                'label' => 'اسم المنشأة',
                'notes' => 'يظهر في الرسائل والتقارير.',
            ],
            [
                'key' => 'company_phone',
                'value' => '',
                'type' => 'string',
                'group' => 'general',
                'label' => 'رقم التواصل',
                'notes' => 'رقم التواصل الافتراضي للمستأجرين.',
            ],
            [
                'key' => 'company_email',
                'value' => '',
                'type' => 'string',
                'group' => 'general',
                'label' => 'البريد الإلكتروني',
                'notes' => 'البريد الافتراضي للتواصل.',
            ],
            [
                'key' => 'default_city',
                'value' => 'جدة',
                'type' => 'string',
                'group' => 'general',
                'label' => 'المدينة الافتراضية',
                'notes' => 'تستخدم عند إضافة عقارات جديدة إذا لزم.',
            ],
            [
                'key' => 'payment_reminder_days',
                'value' => '30',
                'type' => 'number',
                'group' => 'payments',
                'label' => 'مدة عرض تذكيرات السداد',
                'notes' => 'عدد الأيام القادمة لعرض الدفعات المستحقة.',
            ],
            [
                'key' => 'contract_renewal_days',
                'value' => '90',
                'type' => 'number',
                'group' => 'contracts',
                'label' => 'مدة تنبيه تجديد العقود',
                'notes' => 'عدد الأيام قبل نهاية العقد للتنبيه.',
            ],
            [
                'key' => 'document_expiry_days',
                'value' => '30',
                'type' => 'number',
                'group' => 'documents',
                'label' => 'مدة تنبيه انتهاء المستندات',
                'notes' => 'عدد الأيام قبل انتهاء المستند للتنبيه.',
            ],
            [
                'key' => 'payment_reminder_template',
                'value' => "السلام عليكم\nنود تذكيركم بوجود دفعة إيجار مستحقة.\nالمستأجر: {tenant_name}\nالعقار: {property_name}\nالوحدة: {unit_number}\nالمبلغ: {amount} ريال\nتاريخ الاستحقاق: {due_date}\nشاكرين لكم سرعة السداد.",
                'type' => 'text',
                'group' => 'templates',
                'label' => 'قالب تذكير السداد',
                'notes' => 'المتغيرات: {tenant_name}, {property_name}, {unit_number}, {amount}, {due_date}',
            ],
            [
                'key' => 'contract_renewal_template',
                'value' => "السلام عليكم\nنود إشعاركم بأن عقد الإيجار الخاص بكم قريب من الانتهاء.\nالعقار: {property_name}\nالوحدة: {unit_number}\nتاريخ نهاية العقد: {end_date}\nيرجى التواصل لترتيب التجديد.",
                'type' => 'text',
                'group' => 'templates',
                'label' => 'قالب إشعار تجديد العقد',
                'notes' => 'المتغيرات: {tenant_name}, {property_name}, {unit_number}, {end_date}',
            ],
            [
                'key' => 'listing_footer',
                'value' => "للتواصل والاستفسار يرجى التواصل مع الإدارة.",
                'type' => 'text',
                'group' => 'templates',
                'label' => 'تذييل إعلان الشاغر',
                'notes' => 'يضاف في نهاية نص إعلان الوحدة الشاغرة.',
            ],
            [
                'key' => 'receipt_footer',
                'value' => "تم استلام المبلغ، شاكرين لكم تعاونكم.",
                'type' => 'text',
                'group' => 'templates',
                'label' => 'تذييل سند القبض',
                'notes' => 'نص افتراضي لسندات القبض.',
            ],
        ];
    }
}

if (!function_exists('my_rentals_seed_default_app_settings')) {
    function my_rentals_seed_default_app_settings(bool $force = false): void
    {
        foreach (my_rentals_default_app_settings() as $item) {
            if ($force) {
                \App\Models\AppSetting::setValue(
                    $item['key'],
                    $item['value'],
                    $item['type'],
                    $item['group'],
                    $item['label'],
                    $item['notes']
                );
            } else {
                \App\Models\AppSetting::firstOrCreate(
                    ['key' => $item['key']],
                    [
                        'value' => $item['value'],
                        'type' => $item['type'],
                        'group' => $item['group'],
                        'label' => $item['label'],
                        'notes' => $item['notes'],
                    ]
                );
            }
        }
    }
}

if (!function_exists('my_rentals_app_settings_payload')) {
    function my_rentals_app_settings_payload(): array
    {
        my_rentals_seed_default_app_settings(false);

        $settings = \App\Models\AppSetting::query()
            ->orderBy('group')
            ->orderBy('id')
            ->get();

        return [
            'groups' => $settings->groupBy('group')->map(function ($groupItems, $group) {
                return [
                    'group' => $group,
                    'label' => [
                        'general' => 'عام',
                        'payments' => 'الدفعات',
                        'contracts' => 'العقود',
                        'documents' => 'المستندات',
                        'templates' => 'قوالب الرسائل',
                    ][$group] ?? $group,
                    'settings' => $groupItems->values(),
                ];
            })->values(),
            'settings' => $settings->mapWithKeys(fn ($setting) => [$setting->key => $setting->value]),
        ];
    }
}

Route::get('/app-settings', function () {
    return my_rentals_app_settings_payload();
});

Route::get('/my/app-settings', function (\Illuminate\Http\Request $request) {
    $user = function_exists('my_rentals_current_user_for_scope')
        ? my_rentals_current_user_for_scope($request)
        : (function_exists('my_rentals_bearer_user') ? my_rentals_bearer_user($request) : null);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    return my_rentals_app_settings_payload();
});

Route::post('/app-settings', function (Request $request) {
    my_rentals_seed_default_app_settings(false);

    $data = $request->validate([
        'settings' => ['required', 'array'],
        'settings.*.key' => ['required', 'string', 'max:255'],
        'settings.*.value' => ['nullable'],
        'settings.*.type' => ['nullable', 'string', 'max:50'],
        'settings.*.group' => ['nullable', 'string', 'max:100'],
        'settings.*.label' => ['nullable', 'string', 'max:255'],
        'settings.*.notes' => ['nullable', 'string'],
    ]);

    $updated = [];

    foreach ($data['settings'] as $item) {
        $existing = \App\Models\AppSetting::where('key', $item['key'])->first();

        $updated[] = \App\Models\AppSetting::setValue(
            $item['key'],
            $item['value'] ?? '',
            $item['type'] ?? $existing?->type ?? 'string',
            $item['group'] ?? $existing?->group ?? 'general',
            $item['label'] ?? $existing?->label,
            $item['notes'] ?? $existing?->notes
        );
    }

    return response()->json([
        'status' => 'ok',
        'message' => 'تم حفظ إعدادات النظام',
        'updated_count' => count($updated),
        'data' => my_rentals_app_settings_payload(),
    ]);
});

Route::post('/app-settings/reset-defaults', function () {
    my_rentals_seed_default_app_settings(true);

    return response()->json([
        'status' => 'ok',
        'message' => 'تمت إعادة الإعدادات الافتراضية',
        'data' => my_rentals_app_settings_payload(),
    ]);
});


/*
|--------------------------------------------------------------------------
| User Accounts Management
|--------------------------------------------------------------------------
| Admin screen to create owner accounts, link them to owners, and manage roles.
*/

if (!function_exists('my_rentals_accounts_current_user')) {
    function my_rentals_accounts_current_user(\Illuminate\Http\Request $request): ?\App\Models\User
    {
        if (function_exists('my_rentals_current_user_for_scope')) {
            return my_rentals_current_user_for_scope($request);
        }

        if (function_exists('my_rentals_bearer_user')) {
            return my_rentals_bearer_user($request);
        }

        return null;
    }
}

if (!function_exists('my_rentals_accounts_is_admin')) {
    function my_rentals_accounts_is_admin(?\App\Models\User $user): bool
    {
        if (!$user) {
            return false;
        }

        if (function_exists('my_rentals_is_admin_user')) {
            return my_rentals_is_admin_user($user);
        }

        return in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);
    }
}

if (!function_exists('my_rentals_user_account_payload')) {
    function my_rentals_user_account_payload($users)
    {
        $users->loadMissing('owner');

        return $users->map(function ($user) {
            return [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role ?? 'owner',
                'owner_id' => $user->owner_id ?? null,
                'owner_name' => $user->owner?->name,
                'is_active' => (bool) ($user->is_active ?? true),
                'last_login_at' => $user->last_login_at ?? null,
                'notes' => $user->notes ?? null,
                'created_at' => $user->created_at,
                'updated_at' => $user->updated_at,
            ];
        })->values();
    }
}

Route::get('/user-accounts', function () {
    return my_rentals_user_account_payload(
        \App\Models\User::with('owner')
            ->orderByRaw("CASE role WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 WHEN 'owner' THEN 3 ELSE 4 END")
            ->orderBy('id')
            ->get()
    );
});

Route::get('/my/user-accounts', function (\Illuminate\Http\Request $request) {
    $currentUser = my_rentals_accounts_current_user($request);

    if (!$currentUser) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    if (my_rentals_accounts_is_admin($currentUser)) {
        return my_rentals_user_account_payload(
            \App\Models\User::with('owner')
                ->orderByRaw("CASE role WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 WHEN 'owner' THEN 3 ELSE 4 END")
                ->orderBy('id')
                ->get()
        );
    }

    return my_rentals_user_account_payload(
        \App\Models\User::with('owner')
            ->where('id', $currentUser->id)
            ->get()
    );
});

Route::post('/user-accounts', function (\Illuminate\Http\Request $request) {
    $currentUser = my_rentals_accounts_current_user($request);

    if (!$currentUser || !my_rentals_accounts_is_admin($currentUser)) {
        return response()->json(['message' => 'هذه العملية متاحة للمدير فقط.'], 403);
    }

    $data = $request->validate([
        'name' => ['required', 'string', 'max:255'],
        'email' => ['required', 'email', 'max:255', 'unique:users,email'],
        'password' => ['required', 'string', 'min:6'],
        'role' => ['nullable', 'string', 'max:50'],
        'owner_id' => ['nullable', 'integer', 'exists:owners,id'],
        'is_active' => ['nullable', 'boolean'],
        'notes' => ['nullable', 'string'],
    ]);

    $role = $data['role'] ?? 'owner';

    if ($role === 'owner' && empty($data['owner_id'])) {
        return response()->json([
            'message' => 'حساب المالك يجب ربطه بمالك محدد.',
        ], 422);
    }

    $user = \App\Models\User::create([
        'name' => $data['name'],
        'email' => $data['email'],
        'password' => \Illuminate\Support\Facades\Hash::make($data['password']),
        'role' => $role,
        'owner_id' => $data['owner_id'] ?? null,
        'is_active' => $data['is_active'] ?? true,
        'notes' => $data['notes'] ?? null,
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم إنشاء حساب المستخدم بنجاح',
        'user' => my_rentals_user_account_payload(collect([$user->fresh()->load('owner')]))->first(),
    ], 201);
});

Route::post('/user-accounts/{user}/update', function (
    \App\Models\User $user,
    \Illuminate\Http\Request $request
) {
    $currentUser = my_rentals_accounts_current_user($request);

    if (!$currentUser || !my_rentals_accounts_is_admin($currentUser)) {
        return response()->json(['message' => 'هذه العملية متاحة للمدير فقط.'], 403);
    }

    $data = $request->validate([
        'name' => ['nullable', 'string', 'max:255'],
        'email' => ['nullable', 'email', 'max:255', \Illuminate\Validation\Rule::unique('users', 'email')->ignore($user->id)],
        'password' => ['nullable', 'string', 'min:6'],
        'role' => ['nullable', 'string', 'max:50'],
        'owner_id' => ['nullable', 'integer', 'exists:owners,id'],
        'is_active' => ['nullable', 'boolean'],
        'notes' => ['nullable', 'string'],
    ]);

    $updates = [];

    foreach (['name', 'email', 'role', 'owner_id', 'is_active', 'notes'] as $field) {
        if (array_key_exists($field, $data)) {
            $updates[$field] = $data[$field];
        }
    }

    if (!empty($data['password'])) {
        $updates['password'] = \Illuminate\Support\Facades\Hash::make($data['password']);
    }

    $nextRole = $updates['role'] ?? $user->role ?? 'owner';
    $nextOwnerId = array_key_exists('owner_id', $updates) ? $updates['owner_id'] : $user->owner_id;

    if ($nextRole === 'owner' && empty($nextOwnerId)) {
        return response()->json([
            'message' => 'حساب المالك يجب ربطه بمالك محدد.',
        ], 422);
    }

    $user->update($updates);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم تحديث حساب المستخدم',
        'user' => my_rentals_user_account_payload(collect([$user->fresh()->load('owner')]))->first(),
    ]);
});

Route::post('/user-accounts/{user}/toggle-active', function (
    \App\Models\User $user,
    \Illuminate\Http\Request $request
) {
    $currentUser = my_rentals_accounts_current_user($request);

    if (!$currentUser || !my_rentals_accounts_is_admin($currentUser)) {
        return response()->json(['message' => 'هذه العملية متاحة للمدير فقط.'], 403);
    }

    if ($currentUser->id === $user->id) {
        return response()->json([
            'message' => 'لا يمكن تعطيل حسابك الحالي من هذه الشاشة.',
        ], 422);
    }

    $user->update([
        'is_active' => !((bool) ($user->is_active ?? true)),
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => $user->is_active ? 'تم تفعيل الحساب' : 'تم تعطيل الحساب',
        'user' => my_rentals_user_account_payload(collect([$user->fresh()->load('owner')]))->first(),
    ]);
});

Route::post('/user-accounts/{user}/reset-password', function (
    \App\Models\User $user,
    \Illuminate\Http\Request $request
) {
    $currentUser = my_rentals_accounts_current_user($request);

    if (!$currentUser || !my_rentals_accounts_is_admin($currentUser)) {
        return response()->json(['message' => 'هذه العملية متاحة للمدير فقط.'], 403);
    }

    $data = $request->validate([
        'password' => ['required', 'string', 'min:6'],
    ]);

    $user->update([
        'password' => \Illuminate\Support\Facades\Hash::make($data['password']),
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم تغيير كلمة المرور بنجاح',
    ]);
});


/*
|--------------------------------------------------------------------------
| Owner Payouts
|--------------------------------------------------------------------------
| Records actual transfers paid to owners and compares them with settlement balance.
*/

if (!function_exists('my_rentals_payout_current_user')) {
    function my_rentals_payout_current_user(\Illuminate\Http\Request $request): ?\App\Models\User
    {
        if (function_exists('my_rentals_current_user_for_scope')) {
            return my_rentals_current_user_for_scope($request);
        }

        if (function_exists('my_rentals_bearer_user')) {
            return my_rentals_bearer_user($request);
        }

        return null;
    }
}

if (!function_exists('my_rentals_payout_is_admin')) {
    function my_rentals_payout_is_admin(?\App\Models\User $user): bool
    {
        if (!$user) {
            return true;
        }

        if (function_exists('my_rentals_is_admin_user')) {
            return my_rentals_is_admin_user($user);
        }

        return in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);
    }
}

if (!function_exists('my_rentals_owner_financial_balance')) {
    function my_rentals_owner_financial_balance(\App\Models\Owner $owner): array
    {
        $propertyIds = \App\Models\Property::where('owner_id', $owner->id)->pluck('id');
        $unitIds = \App\Models\Unit::whereIn('property_id', $propertyIds)->pluck('id');
        $contractIds = \App\Models\Contract::whereIn('unit_id', $unitIds)->pluck('id');

        $paidIncome = 0;

        if (class_exists(\App\Models\PaymentReceipt::class) && \Illuminate\Support\Facades\Schema::hasTable('payment_receipts')) {
            $paidIncome = (float) \App\Models\PaymentReceipt::whereIn('contract_id', $contractIds)->sum('amount');
        } else {
            $paidIncome = (float) \App\Models\Payment::whereIn('contract_id', $contractIds)
                ->where('status', 'paid')
                ->sum('amount');
        }

        $expenses = 0;

        if (class_exists(\App\Models\PropertyExpense::class) && \Illuminate\Support\Facades\Schema::hasTable('property_expenses')) {
            $expenses = (float) \App\Models\PropertyExpense::whereIn('property_id', $propertyIds)->sum('amount');
        }

        $paidPayouts = (float) \App\Models\OwnerPayout::where('owner_id', $owner->id)
            ->where('status', 'paid')
            ->sum('amount');

        $pendingPayouts = (float) \App\Models\OwnerPayout::where('owner_id', $owner->id)
            ->where('status', 'pending')
            ->sum('amount');

        $netIncome = $paidIncome - $expenses;
        $remaining = $netIncome - $paidPayouts;

        return [
            'owner_id' => $owner->id,
            'owner_name' => $owner->name,
            'properties_count' => $propertyIds->count(),
            'paid_income' => $paidIncome,
            'expenses' => $expenses,
            'net_income' => $netIncome,
            'paid_payouts' => $paidPayouts,
            'pending_payouts' => $pendingPayouts,
            'remaining_balance' => $remaining,
        ];
    }
}

if (!function_exists('my_rentals_owner_payouts_payload')) {
    function my_rentals_owner_payouts_payload($query)
    {
        return $query->with('owner')
            ->orderByRaw("CASE status WHEN 'pending' THEN 1 WHEN 'paid' THEN 2 WHEN 'cancelled' THEN 3 ELSE 4 END")
            ->orderBy('payout_date', 'desc')
            ->orderBy('id', 'desc')
            ->get()
            ->map(function ($payout) {
                return [
                    'id' => $payout->id,
                    'owner_id' => $payout->owner_id,
                    'owner_name' => $payout->owner?->name,
                    'amount' => $payout->amount,
                    'payout_date' => $payout->payout_date,
                    'period_start' => $payout->period_start,
                    'period_end' => $payout->period_end,
                    'method' => $payout->method,
                    'reference_number' => $payout->reference_number,
                    'status' => $payout->status,
                    'notes' => $payout->notes,
                    'created_at' => $payout->created_at,
                ];
            })
            ->values();
    }
}

Route::get('/owner-payouts/summary', function () {
    return \App\Models\Owner::orderBy('name')
        ->get()
        ->map(fn ($owner) => my_rentals_owner_financial_balance($owner))
        ->values();
});

Route::get('/owner-payouts', function () {
    return my_rentals_owner_payouts_payload(\App\Models\OwnerPayout::query());
});

Route::post('/owner-payouts', function (\Illuminate\Http\Request $request) {
    $currentUser = my_rentals_payout_current_user($request);

    if ($currentUser && !my_rentals_payout_is_admin($currentUser)) {
        return response()->json(['message' => 'تسجيل حوالات الملاك متاح للمدير فقط.'], 403);
    }

    $data = $request->validate([
        'owner_id' => ['required', 'integer', 'exists:owners,id'],
        'amount' => ['required', 'numeric', 'min:0.01'],
        'payout_date' => ['nullable', 'date'],
        'period_start' => ['nullable', 'date'],
        'period_end' => ['nullable', 'date'],
        'method' => ['nullable', 'string', 'max:100'],
        'reference_number' => ['nullable', 'string', 'max:255'],
        'status' => ['nullable', 'string', 'max:50'],
        'notes' => ['nullable', 'string'],
    ]);

    $payout = \App\Models\OwnerPayout::create([
        'owner_id' => $data['owner_id'],
        'amount' => $data['amount'],
        'payout_date' => $data['payout_date'] ?? now()->toDateString(),
        'period_start' => $data['period_start'] ?? null,
        'period_end' => $data['period_end'] ?? null,
        'method' => $data['method'] ?? 'bank_transfer',
        'reference_number' => $data['reference_number'] ?? null,
        'status' => $data['status'] ?? 'paid',
        'notes' => $data['notes'] ?? null,
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم تسجيل حوالة المالك بنجاح',
        'payout' => my_rentals_owner_payouts_payload(\App\Models\OwnerPayout::where('id', $payout->id))->first(),
    ], 201);
});

Route::post('/owner-payouts/{ownerPayout}/status', function (
    \App\Models\OwnerPayout $ownerPayout,
    \Illuminate\Http\Request $request
) {
    $currentUser = my_rentals_payout_current_user($request);

    if ($currentUser && !my_rentals_payout_is_admin($currentUser)) {
        return response()->json(['message' => 'تحديث حوالات الملاك متاح للمدير فقط.'], 403);
    }

    $data = $request->validate([
        'status' => ['required', 'string', 'max:50'],
    ]);

    $ownerPayout->update([
        'status' => $data['status'],
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم تحديث حالة حوالة المالك',
        'payout' => my_rentals_owner_payouts_payload(\App\Models\OwnerPayout::where('id', $ownerPayout->id))->first(),
    ]);
});

Route::get('/my/owner-payouts/summary', function (\Illuminate\Http\Request $request) {
    $user = my_rentals_payout_current_user($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    if (my_rentals_payout_is_admin($user)) {
        return \App\Models\Owner::orderBy('name')
            ->get()
            ->map(fn ($owner) => my_rentals_owner_financial_balance($owner))
            ->values();
    }

    if (!$user->owner_id) {
        return [];
    }

    $owner = \App\Models\Owner::find($user->owner_id);

    return $owner ? [my_rentals_owner_financial_balance($owner)] : [];
});

Route::get('/my/owner-payouts', function (\Illuminate\Http\Request $request) {
    $user = my_rentals_payout_current_user($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $query = \App\Models\OwnerPayout::query();

    if (!my_rentals_payout_is_admin($user)) {
        if (!$user->owner_id) {
            return [];
        }

        $query->where('owner_id', $user->owner_id);
    }

    return my_rentals_owner_payouts_payload($query);
});


/*
|--------------------------------------------------------------------------
| Owner Bank Accounts
|--------------------------------------------------------------------------
| Stores bank/IBAN data for owner payouts.
*/

if (!function_exists('my_rentals_owner_bank_current_user')) {
    function my_rentals_owner_bank_current_user(\Illuminate\Http\Request $request): ?\App\Models\User
    {
        if (function_exists('my_rentals_current_user_for_scope')) {
            return my_rentals_current_user_for_scope($request);
        }

        if (function_exists('my_rentals_bearer_user')) {
            return my_rentals_bearer_user($request);
        }

        return null;
    }
}

if (!function_exists('my_rentals_owner_bank_is_admin')) {
    function my_rentals_owner_bank_is_admin(?\App\Models\User $user): bool
    {
        if (!$user) {
            return true;
        }

        if (function_exists('my_rentals_is_admin_user')) {
            return my_rentals_is_admin_user($user);
        }

        return in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);
    }
}

if (!function_exists('my_rentals_owner_bank_payload')) {
    function my_rentals_owner_bank_payload($query)
    {
        return $query->with('owner')
            ->orderBy('owner_id')
            ->orderByDesc('is_default')
            ->orderByDesc('is_active')
            ->orderBy('id', 'desc')
            ->get()
            ->map(function ($account) {
                return [
                    'id' => $account->id,
                    'owner_id' => $account->owner_id,
                    'owner_name' => $account->owner?->name,
                    'bank_name' => $account->bank_name,
                    'account_name' => $account->account_name,
                    'iban' => $account->iban,
                    'account_number' => $account->account_number,
                    'is_default' => (bool) $account->is_default,
                    'is_active' => (bool) $account->is_active,
                    'notes' => $account->notes,
                    'created_at' => $account->created_at,
                    'updated_at' => $account->updated_at,
                ];
            })
            ->values();
    }
}

Route::get('/owner-bank-accounts', function () {
    return my_rentals_owner_bank_payload(\App\Models\OwnerBankAccount::query());
});

Route::post('/owner-bank-accounts', function (\Illuminate\Http\Request $request) {
    $currentUser = my_rentals_owner_bank_current_user($request);

    if ($currentUser && !my_rentals_owner_bank_is_admin($currentUser)) {
        return response()->json(['message' => 'إضافة حسابات الملاك البنكية متاحة للمدير فقط.'], 403);
    }

    $data = $request->validate([
        'owner_id' => ['required', 'integer', 'exists:owners,id'],
        'bank_name' => ['nullable', 'string', 'max:255'],
        'account_name' => ['nullable', 'string', 'max:255'],
        'iban' => ['nullable', 'string', 'max:50'],
        'account_number' => ['nullable', 'string', 'max:100'],
        'is_default' => ['nullable', 'boolean'],
        'is_active' => ['nullable', 'boolean'],
        'notes' => ['nullable', 'string'],
    ]);

    if (($data['is_default'] ?? false) === true) {
        \App\Models\OwnerBankAccount::where('owner_id', $data['owner_id'])->update(['is_default' => false]);
    }

    $account = \App\Models\OwnerBankAccount::create([
        'owner_id' => $data['owner_id'],
        'bank_name' => $data['bank_name'] ?? null,
        'account_name' => $data['account_name'] ?? null,
        'iban' => $data['iban'] ?? null,
        'account_number' => $data['account_number'] ?? null,
        'is_default' => $data['is_default'] ?? false,
        'is_active' => $data['is_active'] ?? true,
        'notes' => $data['notes'] ?? null,
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم إضافة الحساب البنكي للمالك بنجاح',
        'bank_account' => my_rentals_owner_bank_payload(\App\Models\OwnerBankAccount::where('id', $account->id))->first(),
    ], 201);
});

Route::post('/owner-bank-accounts/{ownerBankAccount}/update', function (
    \App\Models\OwnerBankAccount $ownerBankAccount,
    \Illuminate\Http\Request $request
) {
    $currentUser = my_rentals_owner_bank_current_user($request);

    if ($currentUser && !my_rentals_owner_bank_is_admin($currentUser)) {
        return response()->json(['message' => 'تحديث حسابات الملاك البنكية متاح للمدير فقط.'], 403);
    }

    $data = $request->validate([
        'owner_id' => ['nullable', 'integer', 'exists:owners,id'],
        'bank_name' => ['nullable', 'string', 'max:255'],
        'account_name' => ['nullable', 'string', 'max:255'],
        'iban' => ['nullable', 'string', 'max:50'],
        'account_number' => ['nullable', 'string', 'max:100'],
        'is_default' => ['nullable', 'boolean'],
        'is_active' => ['nullable', 'boolean'],
        'notes' => ['nullable', 'string'],
    ]);

    $nextOwnerId = $data['owner_id'] ?? $ownerBankAccount->owner_id;

    if (($data['is_default'] ?? false) === true) {
        \App\Models\OwnerBankAccount::where('owner_id', $nextOwnerId)
            ->where('id', '!=', $ownerBankAccount->id)
            ->update(['is_default' => false]);
    }

    $ownerBankAccount->update([
        'owner_id' => $nextOwnerId,
        'bank_name' => array_key_exists('bank_name', $data) ? $data['bank_name'] : $ownerBankAccount->bank_name,
        'account_name' => array_key_exists('account_name', $data) ? $data['account_name'] : $ownerBankAccount->account_name,
        'iban' => array_key_exists('iban', $data) ? $data['iban'] : $ownerBankAccount->iban,
        'account_number' => array_key_exists('account_number', $data) ? $data['account_number'] : $ownerBankAccount->account_number,
        'is_default' => array_key_exists('is_default', $data) ? $data['is_default'] : $ownerBankAccount->is_default,
        'is_active' => array_key_exists('is_active', $data) ? $data['is_active'] : $ownerBankAccount->is_active,
        'notes' => array_key_exists('notes', $data) ? $data['notes'] : $ownerBankAccount->notes,
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم تحديث الحساب البنكي للمالك',
        'bank_account' => my_rentals_owner_bank_payload(\App\Models\OwnerBankAccount::where('id', $ownerBankAccount->id))->first(),
    ]);
});

Route::post('/owner-bank-accounts/{ownerBankAccount}/set-default', function (
    \App\Models\OwnerBankAccount $ownerBankAccount,
    \Illuminate\Http\Request $request
) {
    $currentUser = my_rentals_owner_bank_current_user($request);

    if ($currentUser && !my_rentals_owner_bank_is_admin($currentUser)) {
        return response()->json(['message' => 'تحديد الحساب الافتراضي متاح للمدير فقط.'], 403);
    }

    \App\Models\OwnerBankAccount::where('owner_id', $ownerBankAccount->owner_id)->update(['is_default' => false]);

    $ownerBankAccount->update([
        'is_default' => true,
        'is_active' => true,
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم تحديد الحساب البنكي الافتراضي',
        'bank_account' => my_rentals_owner_bank_payload(\App\Models\OwnerBankAccount::where('id', $ownerBankAccount->id))->first(),
    ]);
});

Route::post('/owner-bank-accounts/{ownerBankAccount}/toggle-active', function (
    \App\Models\OwnerBankAccount $ownerBankAccount,
    \Illuminate\Http\Request $request
) {
    $currentUser = my_rentals_owner_bank_current_user($request);

    if ($currentUser && !my_rentals_owner_bank_is_admin($currentUser)) {
        return response()->json(['message' => 'تفعيل/تعطيل الحساب البنكي متاح للمدير فقط.'], 403);
    }

    $nextActive = !((bool) $ownerBankAccount->is_active);

    $updates = [
        'is_active' => $nextActive,
    ];

    if (!$nextActive) {
        $updates['is_default'] = false;
    }

    $ownerBankAccount->update($updates);

    return response()->json([
        'status' => 'ok',
        'message' => $nextActive ? 'تم تفعيل الحساب البنكي' : 'تم تعطيل الحساب البنكي',
        'bank_account' => my_rentals_owner_bank_payload(\App\Models\OwnerBankAccount::where('id', $ownerBankAccount->id))->first(),
    ]);
});

Route::get('/my/owner-bank-accounts', function (\Illuminate\Http\Request $request) {
    $user = my_rentals_owner_bank_current_user($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $query = \App\Models\OwnerBankAccount::query();

    if (!my_rentals_owner_bank_is_admin($user)) {
        if (!$user->owner_id) {
            return [];
        }

        $query->where('owner_id', $user->owner_id);
    }

    return my_rentals_owner_bank_payload($query);
});


/*
|--------------------------------------------------------------------------
| Owner Payouts with Bank Account Link
|--------------------------------------------------------------------------
| Bank-aware payout endpoints. Keeps previous owner-payouts endpoints intact.
*/

if (!function_exists('my_rentals_bank_payout_current_user')) {
    function my_rentals_bank_payout_current_user(\Illuminate\Http\Request $request): ?\App\Models\User
    {
        if (function_exists('my_rentals_current_user_for_scope')) {
            return my_rentals_current_user_for_scope($request);
        }

        if (function_exists('my_rentals_bearer_user')) {
            return my_rentals_bearer_user($request);
        }

        return null;
    }
}

if (!function_exists('my_rentals_bank_payout_is_admin')) {
    function my_rentals_bank_payout_is_admin(?\App\Models\User $user): bool
    {
        if (!$user) {
            return true;
        }

        if (function_exists('my_rentals_is_admin_user')) {
            return my_rentals_is_admin_user($user);
        }

        return in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);
    }
}

if (!function_exists('my_rentals_bank_owner_balance')) {
    function my_rentals_bank_owner_balance(\App\Models\Owner $owner): array
    {
        if (function_exists('my_rentals_owner_financial_balance')) {
            $base = my_rentals_owner_financial_balance($owner);
        } else {
            $propertyIds = \App\Models\Property::where('owner_id', $owner->id)->pluck('id');
            $unitIds = \App\Models\Unit::whereIn('property_id', $propertyIds)->pluck('id');
            $contractIds = \App\Models\Contract::whereIn('unit_id', $unitIds)->pluck('id');

            $paidIncome = 0;

            if (class_exists(\App\Models\PaymentReceipt::class) && \Illuminate\Support\Facades\Schema::hasTable('payment_receipts')) {
                $paidIncome = (float) \App\Models\PaymentReceipt::whereIn('contract_id', $contractIds)->sum('amount');
            } else {
                $paidIncome = (float) \App\Models\Payment::whereIn('contract_id', $contractIds)
                    ->where('status', 'paid')
                    ->sum('amount');
            }

            $expenses = 0;

            if (class_exists(\App\Models\PropertyExpense::class) && \Illuminate\Support\Facades\Schema::hasTable('property_expenses')) {
                $expenses = (float) \App\Models\PropertyExpense::whereIn('property_id', $propertyIds)->sum('amount');
            }

            $paidPayouts = (float) \App\Models\OwnerPayout::where('owner_id', $owner->id)
                ->where('status', 'paid')
                ->sum('amount');

            $pendingPayouts = (float) \App\Models\OwnerPayout::where('owner_id', $owner->id)
                ->where('status', 'pending')
                ->sum('amount');

            $base = [
                'owner_id' => $owner->id,
                'owner_name' => $owner->name,
                'properties_count' => $propertyIds->count(),
                'paid_income' => $paidIncome,
                'expenses' => $expenses,
                'net_income' => $paidIncome - $expenses,
                'paid_payouts' => $paidPayouts,
                'pending_payouts' => $pendingPayouts,
                'remaining_balance' => ($paidIncome - $expenses) - $paidPayouts,
            ];
        }

        $bankAccounts = class_exists(\App\Models\OwnerBankAccount::class) && \Illuminate\Support\Facades\Schema::hasTable('owner_bank_accounts')
            ? \App\Models\OwnerBankAccount::where('owner_id', $owner->id)
                ->orderByDesc('is_default')
                ->orderByDesc('is_active')
                ->orderBy('id', 'desc')
                ->get()
            : collect();

        $defaultBank = $bankAccounts->firstWhere('is_default', true) ?: $bankAccounts->firstWhere('is_active', true);

        $base['bank_accounts_count'] = $bankAccounts->count();
        $base['default_bank_account_id'] = $defaultBank?->id;
        $base['default_bank_name'] = $defaultBank?->bank_name;
        $base['default_iban'] = $defaultBank?->iban;
        $base['bank_accounts'] = $bankAccounts->map(function ($account) {
            return [
                'id' => $account->id,
                'bank_name' => $account->bank_name,
                'account_name' => $account->account_name,
                'iban' => $account->iban,
                'account_number' => $account->account_number,
                'is_default' => (bool) $account->is_default,
                'is_active' => (bool) $account->is_active,
            ];
        })->values();

        return $base;
    }
}

if (!function_exists('my_rentals_bank_owner_payouts_payload')) {
    function my_rentals_bank_owner_payouts_payload($query)
    {
        return $query->with(['owner', 'ownerBankAccount'])
            ->orderByRaw("CASE status WHEN 'pending' THEN 1 WHEN 'paid' THEN 2 WHEN 'cancelled' THEN 3 ELSE 4 END")
            ->orderBy('payout_date', 'desc')
            ->orderBy('id', 'desc')
            ->get()
            ->map(function ($payout) {
                return [
                    'id' => $payout->id,
                    'owner_id' => $payout->owner_id,
                    'owner_name' => $payout->owner?->name,
                    'owner_bank_account_id' => $payout->owner_bank_account_id,
                    'bank_name' => $payout->ownerBankAccount?->bank_name,
                    'account_name' => $payout->ownerBankAccount?->account_name,
                    'iban' => $payout->ownerBankAccount?->iban,
                    'account_number' => $payout->ownerBankAccount?->account_number,
                    'amount' => $payout->amount,
                    'payout_date' => $payout->payout_date,
                    'period_start' => $payout->period_start,
                    'period_end' => $payout->period_end,
                    'method' => $payout->method,
                    'reference_number' => $payout->reference_number,
                    'status' => $payout->status,
                    'notes' => $payout->notes,
                    'created_at' => $payout->created_at,
                ];
            })
            ->values();
    }
}

if (!function_exists('my_rentals_bank_owner_ids_for_user')) {
    function my_rentals_bank_owner_ids_for_user(?\App\Models\User $user)
    {
        if (!$user || my_rentals_bank_payout_is_admin($user)) {
            return \App\Models\Owner::pluck('id');
        }

        if (!$user->owner_id) {
            return collect();
        }

        return collect([$user->owner_id]);
    }
}

Route::get('/owner-payouts-bank/summary', function () {
    return \App\Models\Owner::orderBy('name')
        ->get()
        ->map(fn ($owner) => my_rentals_bank_owner_balance($owner))
        ->values();
});

Route::get('/owner-payouts-bank', function () {
    return my_rentals_bank_owner_payouts_payload(\App\Models\OwnerPayout::query());
});

Route::post('/owner-payouts-bank', function (\Illuminate\Http\Request $request) {
    $currentUser = my_rentals_bank_payout_current_user($request);

    if ($currentUser && !my_rentals_bank_payout_is_admin($currentUser)) {
        return response()->json(['message' => 'تسجيل حوالات الملاك متاح للمدير فقط.'], 403);
    }

    $data = $request->validate([
        'owner_id' => ['required', 'integer', 'exists:owners,id'],
        'owner_bank_account_id' => ['nullable', 'integer', 'exists:owner_bank_accounts,id'],
        'amount' => ['required', 'numeric', 'min:0.01'],
        'payout_date' => ['nullable', 'date'],
        'period_start' => ['nullable', 'date'],
        'period_end' => ['nullable', 'date'],
        'method' => ['nullable', 'string', 'max:100'],
        'reference_number' => ['nullable', 'string', 'max:255'],
        'status' => ['nullable', 'string', 'max:50'],
        'notes' => ['nullable', 'string'],
    ]);

    $bankAccountId = $data['owner_bank_account_id'] ?? null;

    if ($bankAccountId) {
        $belongsToOwner = \App\Models\OwnerBankAccount::where('id', $bankAccountId)
            ->where('owner_id', $data['owner_id'])
            ->exists();

        if (!$belongsToOwner) {
            return response()->json([
                'message' => 'الحساب البنكي المختار لا يتبع هذا المالك.',
            ], 422);
        }
    } elseif (class_exists(\App\Models\OwnerBankAccount::class) && \Illuminate\Support\Facades\Schema::hasTable('owner_bank_accounts')) {
        $bankAccountId = \App\Models\OwnerBankAccount::where('owner_id', $data['owner_id'])
            ->where('is_active', true)
            ->orderByDesc('is_default')
            ->orderBy('id', 'desc')
            ->value('id');
    }

    $payout = \App\Models\OwnerPayout::create([
        'owner_id' => $data['owner_id'],
        'owner_bank_account_id' => $bankAccountId,
        'amount' => $data['amount'],
        'payout_date' => $data['payout_date'] ?? now()->toDateString(),
        'period_start' => $data['period_start'] ?? null,
        'period_end' => $data['period_end'] ?? null,
        'method' => $data['method'] ?? 'bank_transfer',
        'reference_number' => $data['reference_number'] ?? null,
        'status' => $data['status'] ?? 'paid',
        'notes' => $data['notes'] ?? null,
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم تسجيل حوالة المالك وربطها بالحساب البنكي',
        'payout' => my_rentals_bank_owner_payouts_payload(\App\Models\OwnerPayout::where('id', $payout->id))->first(),
    ], 201);
});

Route::post('/owner-payouts-bank/{ownerPayout}/status', function (
    \App\Models\OwnerPayout $ownerPayout,
    \Illuminate\Http\Request $request
) {
    $currentUser = my_rentals_bank_payout_current_user($request);

    if ($currentUser && !my_rentals_bank_payout_is_admin($currentUser)) {
        return response()->json(['message' => 'تحديث حوالات الملاك متاح للمدير فقط.'], 403);
    }

    $data = $request->validate([
        'status' => ['required', 'string', 'max:50'],
    ]);

    $ownerPayout->update([
        'status' => $data['status'],
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم تحديث حالة حوالة المالك',
        'payout' => my_rentals_bank_owner_payouts_payload(\App\Models\OwnerPayout::where('id', $ownerPayout->id))->first(),
    ]);
});

Route::get('/my/owner-payouts-bank/summary', function (\Illuminate\Http\Request $request) {
    $user = my_rentals_bank_payout_current_user($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $ownerIds = my_rentals_bank_owner_ids_for_user($user);

    return \App\Models\Owner::whereIn('id', $ownerIds)
        ->orderBy('name')
        ->get()
        ->map(fn ($owner) => my_rentals_bank_owner_balance($owner))
        ->values();
});

Route::get('/my/owner-payouts-bank', function (\Illuminate\Http\Request $request) {
    $user = my_rentals_bank_payout_current_user($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $query = \App\Models\OwnerPayout::query();

    if (!my_rentals_bank_payout_is_admin($user)) {
        if (!$user->owner_id) {
            return [];
        }

        $query->where('owner_id', $user->owner_id);
    }

    return my_rentals_bank_owner_payouts_payload($query);
});


/*
|--------------------------------------------------------------------------
| Owner Statement
|--------------------------------------------------------------------------
| Detailed owner account statement: receipts, expenses, owner payouts and balance.
*/

if (!function_exists('my_rentals_statement_current_user')) {
    function my_rentals_statement_current_user(\Illuminate\Http\Request $request): ?\App\Models\User
    {
        if (function_exists('my_rentals_current_user_for_scope')) {
            return my_rentals_current_user_for_scope($request);
        }

        if (function_exists('my_rentals_bearer_user')) {
            return my_rentals_bearer_user($request);
        }

        return null;
    }
}

if (!function_exists('my_rentals_statement_is_admin')) {
    function my_rentals_statement_is_admin(?\App\Models\User $user): bool
    {
        if (!$user) {
            return true;
        }

        if (function_exists('my_rentals_is_admin_user')) {
            return my_rentals_is_admin_user($user);
        }

        return in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);
    }
}

if (!function_exists('my_rentals_statement_owner_ids_for_user')) {
    function my_rentals_statement_owner_ids_for_user(?\App\Models\User $user)
    {
        if (!$user || my_rentals_statement_is_admin($user)) {
            return \App\Models\Owner::orderBy('name')->pluck('id');
        }

        if (!$user->owner_id) {
            return collect();
        }

        return collect([$user->owner_id]);
    }
}

if (!function_exists('my_rentals_owner_statement_payload')) {
    function my_rentals_owner_statement_payload(
        ?int $ownerId,
        ?string $from,
        ?string $to,
        ?\App\Models\User $user = null
    ): array {
        $allowedOwnerIds = my_rentals_statement_owner_ids_for_user($user);

        if ($allowedOwnerIds->count() === 0) {
            return [
                'owners' => [],
                'selected_owner' => null,
                'period' => [
                    'from' => $from,
                    'to' => $to,
                ],
                'summary' => [
                    'income' => 0,
                    'expenses' => 0,
                    'payouts' => 0,
                    'balance' => 0,
                    'transactions_count' => 0,
                ],
                'transactions' => [],
                'statement_text' => '',
            ];
        }

        if (!$ownerId || !$allowedOwnerIds->contains($ownerId)) {
            $ownerId = (int) $allowedOwnerIds->first();
        }

        $owner = \App\Models\Owner::find($ownerId);

        if (!$owner) {
            return [
                'owners' => [],
                'selected_owner' => null,
                'period' => [
                    'from' => $from,
                    'to' => $to,
                ],
                'summary' => [
                    'income' => 0,
                    'expenses' => 0,
                    'payouts' => 0,
                    'balance' => 0,
                    'transactions_count' => 0,
                ],
                'transactions' => [],
                'statement_text' => '',
            ];
        }

        $fromDate = $from ?: now()->startOfYear()->toDateString();
        $toDate = $to ?: now()->toDateString();

        $propertyIds = \App\Models\Property::where('owner_id', $owner->id)->pluck('id');
        $unitIds = \App\Models\Unit::whereIn('property_id', $propertyIds)->pluck('id');
        $contractIds = \App\Models\Contract::whereIn('unit_id', $unitIds)->pluck('id');

        $transactions = [];

        /*
         * Income from payment receipts, or paid payments fallback
         */
        if (
            class_exists(\App\Models\PaymentReceipt::class)
            && \Illuminate\Support\Facades\Schema::hasTable('payment_receipts')
        ) {
            $receipts = \App\Models\PaymentReceipt::with(['payment.contract.tenant', 'payment.contract.unit.property.owner'])
                ->whereIn('contract_id', $contractIds)
                ->whereBetween('received_date', [$fromDate, $toDate])
                ->orderBy('received_date')
                ->get();

            foreach ($receipts as $receipt) {
                $contract = $receipt->payment?->contract ?: $receipt->contract;
                $unit = $contract?->unit;

                $transactions[] = [
                    'date' => optional($receipt->received_date)->toDateString() ?: (string) $receipt->received_date,
                    'kind' => 'income',
                    'kind_label' => 'إيراد',
                    'description' => 'سند قبض من ' . ($contract?->tenant?->name ?: 'مستأجر'),
                    'property_name' => $unit?->property?->name,
                    'unit_number' => $unit?->unit_number,
                    'tenant_name' => $contract?->tenant?->name,
                    'reference' => $receipt->reference_number,
                    'method' => $receipt->method,
                    'credit' => (float) $receipt->amount,
                    'debit' => 0,
                    'amount' => (float) $receipt->amount,
                ];
            }
        } else {
            $payments = \App\Models\Payment::with(['contract.tenant', 'contract.unit.property.owner'])
                ->whereIn('contract_id', $contractIds)
                ->where('status', 'paid')
                ->whereBetween('paid_date', [$fromDate, $toDate])
                ->orderBy('paid_date')
                ->get();

            foreach ($payments as $payment) {
                $transactions[] = [
                    'date' => optional($payment->paid_date)->toDateString() ?: (string) $payment->paid_date,
                    'kind' => 'income',
                    'kind_label' => 'إيراد',
                    'description' => 'دفعة إيجار مدفوعة من ' . ($payment->contract?->tenant?->name ?: 'مستأجر'),
                    'property_name' => $payment->contract?->unit?->property?->name,
                    'unit_number' => $payment->contract?->unit?->unit_number,
                    'tenant_name' => $payment->contract?->tenant?->name,
                    'reference' => null,
                    'method' => null,
                    'credit' => (float) $payment->amount,
                    'debit' => 0,
                    'amount' => (float) $payment->amount,
                ];
            }
        }

        /*
         * Expenses
         */
        if (
            class_exists(\App\Models\PropertyExpense::class)
            && \Illuminate\Support\Facades\Schema::hasTable('property_expenses')
        ) {
            $expenses = \App\Models\PropertyExpense::with(['property.owner', 'category'])
                ->whereIn('property_id', $propertyIds)
                ->whereBetween('expense_date', [$fromDate, $toDate])
                ->orderBy('expense_date')
                ->get();

            foreach ($expenses as $expense) {
                $transactions[] = [
                    'date' => optional($expense->expense_date)->toDateString() ?: (string) $expense->expense_date,
                    'kind' => 'expense',
                    'kind_label' => 'مصروف',
                    'description' => ($expense->title ?: 'مصروف') . ($expense->category?->name ? ' - ' . $expense->category?->name : ''),
                    'property_name' => $expense->property?->name,
                    'unit_number' => null,
                    'tenant_name' => null,
                    'reference' => null,
                    'method' => null,
                    'credit' => 0,
                    'debit' => (float) $expense->amount,
                    'amount' => (float) $expense->amount,
                ];
            }
        }

        /*
         * Owner payouts
         */
        if (
            class_exists(\App\Models\OwnerPayout::class)
            && \Illuminate\Support\Facades\Schema::hasTable('owner_payouts')
        ) {
            $payouts = \App\Models\OwnerPayout::query()
                ->where('owner_id', $owner->id)
                ->whereIn('status', ['paid', 'pending'])
                ->whereBetween('payout_date', [$fromDate, $toDate])
                ->orderBy('payout_date')
                ->get();

            foreach ($payouts as $payout) {
                $transactions[] = [
                    'date' => optional($payout->payout_date)->toDateString() ?: (string) $payout->payout_date,
                    'kind' => 'payout',
                    'kind_label' => $payout->status === 'pending' ? 'حوالة معلقة' : 'حوالة مالك',
                    'description' => 'حوالة للمالك' . ($payout->reference_number ? ' - مرجع ' . $payout->reference_number : ''),
                    'property_name' => null,
                    'unit_number' => null,
                    'tenant_name' => null,
                    'reference' => $payout->reference_number,
                    'method' => $payout->method,
                    'credit' => 0,
                    'debit' => (float) $payout->amount,
                    'amount' => (float) $payout->amount,
                ];
            }
        }

        usort($transactions, function ($a, $b) {
            $dateCompare = strcmp((string) ($a['date'] ?? ''), (string) ($b['date'] ?? ''));

            if ($dateCompare !== 0) {
                return $dateCompare;
            }

            $order = [
                'income' => 1,
                'expense' => 2,
                'payout' => 3,
            ];

            return ($order[$a['kind']] ?? 9) <=> ($order[$b['kind']] ?? 9);
        });

        $runningBalance = 0;

        foreach ($transactions as $index => $transaction) {
            $runningBalance += (float) $transaction['credit'];
            $runningBalance -= (float) $transaction['debit'];
            $transactions[$index]['balance_after'] = $runningBalance;
        }

        $income = collect($transactions)->sum('credit');
        $expenses = collect($transactions)->where('kind', 'expense')->sum('debit');
        $payouts = collect($transactions)->where('kind', 'payout')->sum('debit');
        $balance = $income - $expenses - $payouts;

        $owners = \App\Models\Owner::whereIn('id', $allowedOwnerIds)
            ->orderBy('name')
            ->get()
            ->map(fn ($item) => [
                'id' => $item->id,
                'name' => $item->name,
                'phone' => $item->phone,
                'email' => $item->email,
            ])
            ->values();

        $lines = [];
        $lines[] = 'كشف حساب مالك';
        $lines[] = 'المالك: ' . ($owner->name ?: '-');
        $lines[] = 'الفترة: ' . $fromDate . ' إلى ' . $toDate;
        $lines[] = '------------------------------';
        $lines[] = 'الإيرادات: ' . number_format($income, 2) . ' ريال';
        $lines[] = 'المصاريف: ' . number_format($expenses, 2) . ' ريال';
        $lines[] = 'حوالات المالك: ' . number_format($payouts, 2) . ' ريال';
        $lines[] = 'الرصيد: ' . number_format($balance, 2) . ' ريال';
        $lines[] = '------------------------------';

        foreach ($transactions as $transaction) {
            $lines[] = ($transaction['date'] ?: '-') . ' | ' . $transaction['kind_label'] . ' | ' . $transaction['description'] . ' | دائن: ' . number_format((float) $transaction['credit'], 2) . ' | مدين: ' . number_format((float) $transaction['debit'], 2) . ' | الرصيد: ' . number_format((float) $transaction['balance_after'], 2);
        }

        return [
            'owners' => $owners,
            'selected_owner' => [
                'id' => $owner->id,
                'name' => $owner->name,
                'phone' => $owner->phone,
                'email' => $owner->email,
            ],
            'period' => [
                'from' => $fromDate,
                'to' => $toDate,
            ],
            'summary' => [
                'income' => $income,
                'expenses' => $expenses,
                'payouts' => $payouts,
                'balance' => $balance,
                'transactions_count' => count($transactions),
            ],
            'transactions' => array_values($transactions),
            'statement_text' => implode("\n", $lines),
        ];
    }
}

Route::get('/owner-statement', function (\Illuminate\Http\Request $request) {
    $ownerId = $request->query('owner_id') ? (int) $request->query('owner_id') : null;

    return my_rentals_owner_statement_payload(
        $ownerId,
        $request->query('from'),
        $request->query('to'),
        null
    );
});

Route::get('/my/owner-statement', function (\Illuminate\Http\Request $request) {
    $user = my_rentals_statement_current_user($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $ownerId = $request->query('owner_id') ? (int) $request->query('owner_id') : null;

    return my_rentals_owner_statement_payload(
        $ownerId,
        $request->query('from'),
        $request->query('to'),
        $user
    );
});


/*
|--------------------------------------------------------------------------
| Tenant Statement
|--------------------------------------------------------------------------
| Detailed tenant account statement: rent charges, receipts and running balance.
*/

if (!function_exists('my_rentals_tenant_statement_current_user')) {
    function my_rentals_tenant_statement_current_user(\Illuminate\Http\Request $request): ?\App\Models\User
    {
        if (function_exists('my_rentals_current_user_for_scope')) {
            return my_rentals_current_user_for_scope($request);
        }

        if (function_exists('my_rentals_bearer_user')) {
            return my_rentals_bearer_user($request);
        }

        return null;
    }
}

if (!function_exists('my_rentals_tenant_statement_is_admin')) {
    function my_rentals_tenant_statement_is_admin(?\App\Models\User $user): bool
    {
        if (!$user) {
            return true;
        }

        if (function_exists('my_rentals_is_admin_user')) {
            return my_rentals_is_admin_user($user);
        }

        return in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);
    }
}

if (!function_exists('my_rentals_tenant_statement_allowed_tenant_ids')) {
    function my_rentals_tenant_statement_allowed_tenant_ids(?\App\Models\User $user)
    {
        if (!$user || my_rentals_tenant_statement_is_admin($user)) {
            return \App\Models\Tenant::orderBy('name')->pluck('id');
        }

        if (!$user->owner_id) {
            return collect();
        }

        $propertyIds = \App\Models\Property::where('owner_id', $user->owner_id)->pluck('id');
        $unitIds = \App\Models\Unit::whereIn('property_id', $propertyIds)->pluck('id');

        return \App\Models\Contract::whereIn('unit_id', $unitIds)
            ->whereNotNull('tenant_id')
            ->pluck('tenant_id')
            ->unique()
            ->values();
    }
}

if (!function_exists('my_rentals_tenant_statement_payload')) {
    function my_rentals_tenant_statement_payload(
        ?int $tenantId,
        ?string $from,
        ?string $to,
        ?\App\Models\User $user = null
    ): array {
        $allowedTenantIds = my_rentals_tenant_statement_allowed_tenant_ids($user);

        if ($allowedTenantIds->count() === 0) {
            return [
                'tenants' => [],
                'selected_tenant' => null,
                'period' => [
                    'from' => $from,
                    'to' => $to,
                ],
                'summary' => [
                    'charges' => 0,
                    'receipts' => 0,
                    'balance' => 0,
                    'overdue' => 0,
                    'transactions_count' => 0,
                ],
                'transactions' => [],
                'statement_text' => '',
            ];
        }

        if (!$tenantId || !$allowedTenantIds->contains($tenantId)) {
            $tenantId = (int) $allowedTenantIds->first();
        }

        $tenant = \App\Models\Tenant::find($tenantId);

        if (!$tenant) {
            return [
                'tenants' => [],
                'selected_tenant' => null,
                'period' => [
                    'from' => $from,
                    'to' => $to,
                ],
                'summary' => [
                    'charges' => 0,
                    'receipts' => 0,
                    'balance' => 0,
                    'overdue' => 0,
                    'transactions_count' => 0,
                ],
                'transactions' => [],
                'statement_text' => '',
            ];
        }

        $fromDate = $from ?: now()->startOfYear()->toDateString();
        $toDate = $to ?: now()->toDateString();

        $contracts = \App\Models\Contract::with(['unit.property.owner'])
            ->where('tenant_id', $tenant->id)
            ->get();

        $contractIds = $contracts->pluck('id');

        $transactions = [];

        /*
         * Rent charges from due payments
         */
        $payments = \App\Models\Payment::with(['contract.tenant', 'contract.unit.property.owner'])
            ->whereIn('contract_id', $contractIds)
            ->whereBetween('due_date', [$fromDate, $toDate])
            ->orderBy('due_date')
            ->get();

        foreach ($payments as $payment) {
            $transactions[] = [
                'date' => optional($payment->due_date)->toDateString() ?: (string) $payment->due_date,
                'kind' => 'charge',
                'kind_label' => 'استحقاق',
                'description' => 'استحقاق إيجار',
                'property_name' => $payment->contract?->unit?->property?->name,
                'unit_number' => $payment->contract?->unit?->unit_number,
                'contract_number' => $payment->contract?->government_contract_number ?: $payment->contract?->contract_number ?: $payment->contract_id,
                'reference' => null,
                'method' => null,
                'debit' => (float) $payment->amount,
                'credit' => 0,
                'amount' => (float) $payment->amount,
                'payment_id' => $payment->id,
                'payment_status' => $payment->status,
            ];
        }

        /*
         * Receipts from payment_receipts when available, otherwise paid payments fallback.
         */
        if (
            class_exists(\App\Models\PaymentReceipt::class)
            && \Illuminate\Support\Facades\Schema::hasTable('payment_receipts')
        ) {
            $receipts = \App\Models\PaymentReceipt::with(['payment.contract.tenant', 'payment.contract.unit.property.owner', 'contract.unit.property.owner'])
                ->where('tenant_id', $tenant->id)
                ->whereBetween('received_date', [$fromDate, $toDate])
                ->orderBy('received_date')
                ->get();

            foreach ($receipts as $receipt) {
                $contract = $receipt->payment?->contract ?: $receipt->contract;
                $unit = $contract?->unit;

                $transactions[] = [
                    'date' => optional($receipt->received_date)->toDateString() ?: (string) $receipt->received_date,
                    'kind' => 'receipt',
                    'kind_label' => 'سداد',
                    'description' => 'سداد من المستأجر',
                    'property_name' => $unit?->property?->name,
                    'unit_number' => $unit?->unit_number,
                    'contract_number' => $contract?->government_contract_number ?: $contract?->contract_number ?: $receipt->contract_id,
                    'reference' => $receipt->reference_number,
                    'method' => $receipt->method,
                    'debit' => 0,
                    'credit' => (float) $receipt->amount,
                    'amount' => (float) $receipt->amount,
                    'payment_id' => $receipt->payment_id,
                    'payment_status' => $receipt->payment?->status,
                ];
            }
        } else {
            $paidPayments = \App\Models\Payment::with(['contract.tenant', 'contract.unit.property.owner'])
                ->whereIn('contract_id', $contractIds)
                ->where('status', 'paid')
                ->whereBetween('paid_date', [$fromDate, $toDate])
                ->orderBy('paid_date')
                ->get();

            foreach ($paidPayments as $payment) {
                $transactions[] = [
                    'date' => optional($payment->paid_date)->toDateString() ?: (string) $payment->paid_date,
                    'kind' => 'receipt',
                    'kind_label' => 'سداد',
                    'description' => 'سداد دفعة إيجار',
                    'property_name' => $payment->contract?->unit?->property?->name,
                    'unit_number' => $payment->contract?->unit?->unit_number,
                    'contract_number' => $payment->contract?->government_contract_number ?: $payment->contract?->contract_number ?: $payment->contract_id,
                    'reference' => null,
                    'method' => null,
                    'debit' => 0,
                    'credit' => (float) $payment->amount,
                    'amount' => (float) $payment->amount,
                    'payment_id' => $payment->id,
                    'payment_status' => $payment->status,
                ];
            }
        }

        usort($transactions, function ($a, $b) {
            $dateCompare = strcmp((string) ($a['date'] ?? ''), (string) ($b['date'] ?? ''));

            if ($dateCompare !== 0) {
                return $dateCompare;
            }

            $order = [
                'charge' => 1,
                'receipt' => 2,
            ];

            return ($order[$a['kind']] ?? 9) <=> ($order[$b['kind']] ?? 9);
        });

        $runningBalance = 0;

        foreach ($transactions as $index => $transaction) {
            $runningBalance += (float) $transaction['debit'];
            $runningBalance -= (float) $transaction['credit'];
            $transactions[$index]['balance_after'] = $runningBalance;
        }

        $charges = collect($transactions)->sum('debit');
        $receiptsTotal = collect($transactions)->sum('credit');
        $balance = $charges - $receiptsTotal;

        $overdue = (float) \App\Models\Payment::whereIn('contract_id', $contractIds)
            ->whereIn('status', ['overdue', 'partial'])
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', now()->toDateString())
            ->sum('amount');

        if (
            class_exists(\App\Models\PaymentReceipt::class)
            && \Illuminate\Support\Facades\Schema::hasTable('payment_receipts')
        ) {
            $partialPayments = \App\Models\Payment::whereIn('contract_id', $contractIds)
                ->where('status', 'partial')
                ->whereNotNull('due_date')
                ->whereDate('due_date', '<', now()->toDateString())
                ->get();

            $partialRemaining = 0;

            foreach ($partialPayments as $payment) {
                $received = (float) \App\Models\PaymentReceipt::where('payment_id', $payment->id)->sum('amount');
                $partialRemaining += max(((float) $payment->amount) - $received, 0);
            }

            $overdue = (float) \App\Models\Payment::whereIn('contract_id', $contractIds)
                ->where('status', 'overdue')
                ->whereNotNull('due_date')
                ->whereDate('due_date', '<', now()->toDateString())
                ->sum('amount') + $partialRemaining;
        }

        $tenants = \App\Models\Tenant::whereIn('id', $allowedTenantIds)
            ->orderBy('name')
            ->get()
            ->map(fn ($item) => [
                'id' => $item->id,
                'name' => $item->name,
                'phone' => $item->phone,
                'email' => $item->email,
                'national_id' => $item->national_id,
            ])
            ->values();

        $activeContracts = $contracts->map(function ($contract) {
            return [
                'id' => $contract->id,
                'contract_number' => $contract->government_contract_number ?: $contract->contract_number ?: $contract->id,
                'status' => $contract->status,
                'start_date' => $contract->start_date,
                'end_date' => $contract->end_date,
                'rent_amount' => $contract->rent_amount,
                'property_name' => $contract->unit?->property?->name,
                'unit_number' => $contract->unit?->unit_number,
            ];
        })->values();

        $lines = [];
        $lines[] = 'كشف حساب مستأجر';
        $lines[] = 'المستأجر: ' . ($tenant->name ?: '-');
        $lines[] = 'الجوال: ' . ($tenant->phone ?: '-');
        $lines[] = 'الفترة: ' . $fromDate . ' إلى ' . $toDate;
        $lines[] = '------------------------------';
        $lines[] = 'الاستحقاقات: ' . number_format($charges, 2) . ' ريال';
        $lines[] = 'السداد: ' . number_format($receiptsTotal, 2) . ' ريال';
        $lines[] = 'الرصيد المستحق: ' . number_format($balance, 2) . ' ريال';
        $lines[] = 'المتأخر الحالي: ' . number_format($overdue, 2) . ' ريال';
        $lines[] = '------------------------------';

        foreach ($transactions as $transaction) {
            $lines[] = ($transaction['date'] ?: '-') . ' | ' . $transaction['kind_label'] . ' | ' . $transaction['description'] . ' | مدين: ' . number_format((float) $transaction['debit'], 2) . ' | دائن: ' . number_format((float) $transaction['credit'], 2) . ' | الرصيد: ' . number_format((float) $transaction['balance_after'], 2);
        }

        return [
            'tenants' => $tenants,
            'selected_tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'phone' => $tenant->phone,
                'email' => $tenant->email,
                'national_id' => $tenant->national_id,
            ],
            'contracts' => $activeContracts,
            'period' => [
                'from' => $fromDate,
                'to' => $toDate,
            ],
            'summary' => [
                'charges' => $charges,
                'receipts' => $receiptsTotal,
                'balance' => $balance,
                'overdue' => $overdue,
                'transactions_count' => count($transactions),
            ],
            'transactions' => array_values($transactions),
            'statement_text' => implode("\n", $lines),
        ];
    }
}

Route::get('/tenant-statement', function (\Illuminate\Http\Request $request) {
    $tenantId = $request->query('tenant_id') ? (int) $request->query('tenant_id') : null;

    return my_rentals_tenant_statement_payload(
        $tenantId,
        $request->query('from'),
        $request->query('to'),
        null
    );
});

Route::get('/my/tenant-statement', function (\Illuminate\Http\Request $request) {
    $user = my_rentals_tenant_statement_current_user($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $tenantId = $request->query('tenant_id') ? (int) $request->query('tenant_id') : null;

    return my_rentals_tenant_statement_payload(
        $tenantId,
        $request->query('from'),
        $request->query('to'),
        $user
    );
});


/*
|--------------------------------------------------------------------------
| Communication Center
|--------------------------------------------------------------------------
| Generates ready-to-share messages for payment reminders, contract renewals,
| tenant statements and owner statements.
*/

if (!function_exists('my_rentals_comm_current_user')) {
    function my_rentals_comm_current_user(\Illuminate\Http\Request $request): ?\App\Models\User
    {
        if (function_exists('my_rentals_current_user_for_scope')) {
            return my_rentals_current_user_for_scope($request);
        }

        if (function_exists('my_rentals_bearer_user')) {
            return my_rentals_bearer_user($request);
        }

        return null;
    }
}

if (!function_exists('my_rentals_comm_is_admin')) {
    function my_rentals_comm_is_admin(?\App\Models\User $user): bool
    {
        if (!$user) {
            return true;
        }

        if (function_exists('my_rentals_is_admin_user')) {
            return my_rentals_is_admin_user($user);
        }

        return in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);
    }
}

if (!function_exists('my_rentals_comm_setting')) {
    function my_rentals_comm_setting(string $key, string $default): string
    {
        if (class_exists(\App\Models\AppSetting::class) && \Illuminate\Support\Facades\Schema::hasTable('app_settings')) {
            try {
                return (string) \App\Models\AppSetting::getValue($key, $default);
            } catch (\Throwable $e) {
                return $default;
            }
        }

        return $default;
    }
}

if (!function_exists('my_rentals_comm_replace')) {
    function my_rentals_comm_replace(string $template, array $data): string
    {
        foreach ($data as $key => $value) {
            $template = str_replace('{' . $key . '}', (string) ($value ?? ''), $template);
        }

        return $template;
    }
}

if (!function_exists('my_rentals_comm_scope')) {
    function my_rentals_comm_scope(?\App\Models\User $user = null): array
    {
        $isAdmin = my_rentals_comm_is_admin($user);
        $ownerId = $user?->owner_id;

        if (!$isAdmin && !$ownerId) {
            return [
                'is_admin' => false,
                'owner_id' => null,
                'property_ids' => collect(),
                'unit_ids' => collect(),
                'contract_ids' => collect(),
                'tenant_ids' => collect(),
            ];
        }

        $propertyQuery = \App\Models\Property::query();

        if (!$isAdmin) {
            $propertyQuery->where('owner_id', $ownerId);
        }

        $propertyIds = $propertyQuery->pluck('id');
        $unitIds = \App\Models\Unit::whereIn('property_id', $propertyIds)->pluck('id');
        $contractIds = \App\Models\Contract::whereIn('unit_id', $unitIds)->pluck('id');
        $tenantIds = \App\Models\Contract::whereIn('id', $contractIds)
            ->whereNotNull('tenant_id')
            ->pluck('tenant_id')
            ->unique()
            ->values();

        return [
            'is_admin' => $isAdmin,
            'owner_id' => $ownerId,
            'property_ids' => $propertyIds,
            'unit_ids' => $unitIds,
            'contract_ids' => $contractIds,
            'tenant_ids' => $tenantIds,
        ];
    }
}

if (!function_exists('my_rentals_comm_payment_message')) {
    function my_rentals_comm_payment_message(\App\Models\Payment $payment): string
    {
        $default = "السلام عليكم\nنود تذكيركم بوجود دفعة إيجار مستحقة.\nالمستأجر: {tenant_name}\nالعقار: {property_name}\nالوحدة: {unit_number}\nالمبلغ: {amount} ريال\nتاريخ الاستحقاق: {due_date}\nشاكرين لكم سرعة السداد.";

        $template = my_rentals_comm_setting('payment_reminder_template', $default);
        $contract = $payment->contract;
        $unit = $contract?->unit;
        $property = $unit?->property;
        $tenant = $contract?->tenant;

        return my_rentals_comm_replace($template, [
            'tenant_name' => $tenant?->name ?: '-',
            'tenant_phone' => $tenant?->phone ?: '-',
            'property_name' => $property?->name ?: '-',
            'unit_number' => $unit?->unit_number ?: '-',
            'amount' => number_format((float) ($payment->amount ?? 0), 0),
            'due_date' => $payment->due_date ?: '-',
            'company_name' => my_rentals_comm_setting('company_name', 'My Rentals'),
            'company_phone' => my_rentals_comm_setting('company_phone', ''),
        ]);
    }
}

if (!function_exists('my_rentals_comm_contract_message')) {
    function my_rentals_comm_contract_message(\App\Models\Contract $contract): string
    {
        $default = "السلام عليكم\nنود إشعاركم بأن عقد الإيجار الخاص بكم قريب من الانتهاء.\nالعقار: {property_name}\nالوحدة: {unit_number}\nتاريخ نهاية العقد: {end_date}\nيرجى التواصل لترتيب التجديد.";

        $template = my_rentals_comm_setting('contract_renewal_template', $default);
        $unit = $contract->unit;
        $property = $unit?->property;
        $tenant = $contract->tenant;

        return my_rentals_comm_replace($template, [
            'tenant_name' => $tenant?->name ?: '-',
            'tenant_phone' => $tenant?->phone ?: '-',
            'property_name' => $property?->name ?: '-',
            'unit_number' => $unit?->unit_number ?: '-',
            'end_date' => $contract->end_date ?: '-',
            'contract_number' => $contract->government_contract_number ?: $contract->contract_number ?: $contract->id,
            'company_name' => my_rentals_comm_setting('company_name', 'My Rentals'),
            'company_phone' => my_rentals_comm_setting('company_phone', ''),
        ]);
    }
}

if (!function_exists('my_rentals_comm_payload')) {
    function my_rentals_comm_payload(?\App\Models\User $user = null): array
    {
        $scope = my_rentals_comm_scope($user);

        if (!$scope['is_admin'] && !$scope['owner_id']) {
            return [
                'summary' => [
                    'payment_reminders' => 0,
                    'contract_renewals' => 0,
                    'tenant_statements' => 0,
                    'owner_statements' => 0,
                ],
                'payment_reminders' => [],
                'contract_renewals' => [],
                'tenant_statements' => [],
                'owner_statements' => [],
            ];
        }

        $paymentDays = (int) my_rentals_comm_setting('payment_reminder_days', '30');
        $contractDays = (int) my_rentals_comm_setting('contract_renewal_days', '90');

        $today = now()->startOfDay();
        $paymentTo = $today->copy()->addDays(max($paymentDays, 1));
        $contractTo = $today->copy()->addDays(max($contractDays, 1));

        $payments = \App\Models\Payment::with(['contract.tenant', 'contract.unit.property.owner'])
            ->whereIn('contract_id', $scope['contract_ids'])
            ->whereIn('status', ['due', 'overdue', 'partial'])
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<=', $paymentTo->toDateString())
            ->orderBy('due_date')
            ->limit(80)
            ->get()
            ->map(function ($payment) use ($today) {
                $contract = $payment->contract;
                $unit = $contract?->unit;
                $property = $unit?->property;
                $tenant = $contract?->tenant;

                $days = $payment->due_date
                    ? $today->diffInDays(\Carbon\Carbon::parse($payment->due_date), false)
                    : null;

                return [
                    'id' => $payment->id,
                    'type' => 'payment',
                    'severity' => ($days !== null && $days < 0) ? 'late' : 'soon',
                    'title' => ($days !== null && $days < 0) ? 'دفعة متأخرة' : 'دفعة قريبة',
                    'tenant_name' => $tenant?->name,
                    'tenant_phone' => $tenant?->phone,
                    'property_name' => $property?->name,
                    'unit_number' => $unit?->unit_number,
                    'amount' => $payment->amount,
                    'due_date' => $payment->due_date,
                    'status' => $payment->status,
                    'days' => $days,
                    'message' => my_rentals_comm_payment_message($payment),
                ];
            })
            ->values();

        $contracts = \App\Models\Contract::with(['tenant', 'unit.property.owner'])
            ->whereIn('id', $scope['contract_ids'])
            ->where('status', 'active')
            ->whereNotNull('end_date')
            ->whereDate('end_date', '<=', $contractTo->toDateString())
            ->orderBy('end_date')
            ->limit(80)
            ->get()
            ->map(function ($contract) use ($today) {
                $unit = $contract->unit;
                $property = $unit?->property;
                $tenant = $contract->tenant;

                $days = $contract->end_date
                    ? $today->diffInDays(\Carbon\Carbon::parse($contract->end_date), false)
                    : null;

                return [
                    'id' => $contract->id,
                    'type' => 'contract',
                    'severity' => ($days !== null && $days < 0) ? 'expired' : 'soon',
                    'title' => ($days !== null && $days < 0) ? 'عقد منتهي' : 'عقد قريب الانتهاء',
                    'contract_number' => $contract->government_contract_number ?: $contract->contract_number ?: $contract->id,
                    'tenant_name' => $tenant?->name,
                    'tenant_phone' => $tenant?->phone,
                    'property_name' => $property?->name,
                    'unit_number' => $unit?->unit_number,
                    'end_date' => $contract->end_date,
                    'days' => $days,
                    'message' => my_rentals_comm_contract_message($contract),
                ];
            })
            ->values();

        $tenantStatements = \App\Models\Tenant::whereIn('id', $scope['tenant_ids'])
            ->orderBy('name')
            ->limit(80)
            ->get()
            ->map(function ($tenant) use ($user) {
                $statementText = '';

                try {
                    if (function_exists('my_rentals_tenant_statement_payload')) {
                        $payload = my_rentals_tenant_statement_payload($tenant->id, now()->startOfYear()->toDateString(), now()->toDateString(), $user);
                        $statementText = (string) ($payload['statement_text'] ?? '');
                        $balance = (float) ($payload['summary']['balance'] ?? 0);
                        $overdue = (float) ($payload['summary']['overdue'] ?? 0);
                    } else {
                        $balance = 0;
                        $overdue = 0;
                    }
                } catch (\Throwable $e) {
                    $balance = 0;
                    $overdue = 0;
                }

                return [
                    'id' => $tenant->id,
                    'type' => 'tenant_statement',
                    'title' => 'كشف حساب مستأجر',
                    'tenant_name' => $tenant->name,
                    'tenant_phone' => $tenant->phone,
                    'balance' => $balance,
                    'overdue' => $overdue,
                    'message' => $statementText ?: ('كشف حساب المستأجر: ' . ($tenant->name ?: '-')),
                ];
            })
            ->values();

        $ownerIds = $scope['is_admin']
            ? \App\Models\Owner::pluck('id')
            : collect([$scope['owner_id']])->filter();

        $ownerStatements = \App\Models\Owner::whereIn('id', $ownerIds)
            ->orderBy('name')
            ->limit(80)
            ->get()
            ->map(function ($owner) use ($user) {
                $statementText = '';

                try {
                    if (function_exists('my_rentals_owner_statement_payload')) {
                        $payload = my_rentals_owner_statement_payload($owner->id, now()->startOfYear()->toDateString(), now()->toDateString(), $user);
                        $statementText = (string) ($payload['statement_text'] ?? '');
                        $balance = (float) ($payload['summary']['balance'] ?? 0);
                    } elseif (function_exists('my_rentals_owner_financial_balance')) {
                        $balancePayload = my_rentals_owner_financial_balance($owner);
                        $balance = (float) ($balancePayload['remaining_balance'] ?? 0);
                    } else {
                        $balance = 0;
                    }
                } catch (\Throwable $e) {
                    $balance = 0;
                }

                return [
                    'id' => $owner->id,
                    'type' => 'owner_statement',
                    'title' => 'كشف حساب مالك',
                    'owner_name' => $owner->name,
                    'owner_phone' => $owner->phone,
                    'balance' => $balance,
                    'message' => $statementText ?: ('كشف حساب المالك: ' . ($owner->name ?: '-')),
                ];
            })
            ->values();

        return [
            'summary' => [
                'payment_reminders' => $payments->count(),
                'contract_renewals' => $contracts->count(),
                'tenant_statements' => $tenantStatements->count(),
                'owner_statements' => $ownerStatements->count(),
            ],
            'payment_reminders' => $payments,
            'contract_renewals' => $contracts,
            'tenant_statements' => $tenantStatements,
            'owner_statements' => $ownerStatements,
            'settings' => [
                'company_name' => my_rentals_comm_setting('company_name', 'My Rentals'),
                'company_phone' => my_rentals_comm_setting('company_phone', ''),
                'payment_reminder_days' => $paymentDays,
                'contract_renewal_days' => $contractDays,
            ],
        ];
    }
}

Route::get('/communication-center/data', function () {
    return my_rentals_comm_payload(null);
});

Route::get('/my/communication-center/data', function (\Illuminate\Http\Request $request) {
    $user = my_rentals_comm_current_user($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    return my_rentals_comm_payload($user);
});


/*
|--------------------------------------------------------------------------
| Property Performance
|--------------------------------------------------------------------------
| Profitability and occupancy analysis by property.
*/

if (!function_exists('my_rentals_property_performance_current_user')) {
    function my_rentals_property_performance_current_user(\Illuminate\Http\Request $request): ?\App\Models\User
    {
        if (function_exists('my_rentals_current_user_for_scope')) {
            return my_rentals_current_user_for_scope($request);
        }

        if (function_exists('my_rentals_bearer_user')) {
            return my_rentals_bearer_user($request);
        }

        return null;
    }
}

if (!function_exists('my_rentals_property_performance_is_admin')) {
    function my_rentals_property_performance_is_admin(?\App\Models\User $user): bool
    {
        if (!$user) {
            return true;
        }

        if (function_exists('my_rentals_is_admin_user')) {
            return my_rentals_is_admin_user($user);
        }

        return in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);
    }
}

if (!function_exists('my_rentals_property_performance_scope')) {
    function my_rentals_property_performance_scope(?\App\Models\User $user = null)
    {
        $query = \App\Models\Property::with('owner');

        if ($user && !my_rentals_property_performance_is_admin($user)) {
            if (!$user->owner_id) {
                return $query->whereRaw('1 = 0');
            }

            $query->where('owner_id', $user->owner_id);
        }

        return $query;
    }
}

if (!function_exists('my_rentals_property_performance_payload')) {
    function my_rentals_property_performance_payload(?\App\Models\User $user = null): array
    {
        $today = now()->startOfDay();
        $documentSoon = $today->copy()->addDays(30)->toDateString();

        $properties = my_rentals_property_performance_scope($user)
            ->orderBy('owner_id')
            ->orderBy('name')
            ->get();

        $items = $properties->map(function ($property) use ($today, $documentSoon) {
            $unitIds = \App\Models\Unit::where('property_id', $property->id)->pluck('id');
            $unitsCount = $unitIds->count();

            $activeContracts = \App\Models\Contract::with(['tenant', 'unit'])
                ->whereIn('unit_id', $unitIds)
                ->where('status', 'active')
                ->get();

            $activeContractIds = $activeContracts->pluck('id');
            $rentedUnitsCount = $activeContracts->pluck('unit_id')->filter()->unique()->count();
            $vacantUnitsCount = max($unitsCount - $rentedUnitsCount, 0);
            $occupancyRate = $unitsCount > 0 ? round(($rentedUnitsCount / $unitsCount) * 100, 2) : 0;

            $monthlyRent = (float) $activeContracts->sum(function ($contract) {
                return (float) ($contract->rent_amount ?? 0)
                    + (float) ($contract->parking_fee ?? 0)
                    + (float) ($contract->services_fee ?? 0);
            });

            $paymentsQuery = \App\Models\Payment::whereIn('contract_id', $activeContractIds);

            $dueIncome = (float) (clone $paymentsQuery)
                ->where('status', 'due')
                ->sum('amount');

            $overdueIncome = (float) (clone $paymentsQuery)
                ->where('status', 'overdue')
                ->sum('amount');

            $partialRemaining = 0;

            if (
                class_exists(\App\Models\PaymentReceipt::class)
                && \Illuminate\Support\Facades\Schema::hasTable('payment_receipts')
            ) {
                $paidIncome = (float) \App\Models\PaymentReceipt::whereIn('contract_id', $activeContractIds)->sum('amount');

                $partialPayments = \App\Models\Payment::whereIn('contract_id', $activeContractIds)
                    ->where('status', 'partial')
                    ->get();

                foreach ($partialPayments as $payment) {
                    $receivedForPayment = (float) \App\Models\PaymentReceipt::where('payment_id', $payment->id)->sum('amount');
                    $partialRemaining += max(((float) $payment->amount) - $receivedForPayment, 0);
                }
            } else {
                $paidIncome = (float) (clone $paymentsQuery)
                    ->where('status', 'paid')
                    ->sum('amount');
            }

            $overdueIncome += $partialRemaining;

            $expenses = 0;
            $expensesCount = 0;

            if (
                class_exists(\App\Models\PropertyExpense::class)
                && \Illuminate\Support\Facades\Schema::hasTable('property_expenses')
            ) {
                $expensesQuery = \App\Models\PropertyExpense::where('property_id', $property->id);
                $expenses = (float) (clone $expensesQuery)->sum('amount');
                $expensesCount = (int) (clone $expensesQuery)->count();
            }

            $utilityDue = 0;
            $utilityOverdue = 0;
            $utilityBillsCount = 0;

            if (
                class_exists(\App\Models\UtilityBill::class)
                && \Illuminate\Support\Facades\Schema::hasTable('utility_bills')
            ) {
                $utilityQuery = \App\Models\UtilityBill::where('property_id', $property->id);

                $utilityDue = (float) (clone $utilityQuery)
                    ->where('status', 'due')
                    ->sum('amount');

                $utilityOverdue = (float) (clone $utilityQuery)
                    ->where('status', 'overdue')
                    ->sum('amount');

                $utilityBillsCount = (int) (clone $utilityQuery)->count();
            }

            $maintenanceOpen = 0;
            $maintenanceUrgent = 0;

            if (
                class_exists(\App\Models\MaintenanceRequest::class)
                && \Illuminate\Support\Facades\Schema::hasTable('maintenance_requests')
            ) {
                $maintenanceOpen = (int) \App\Models\MaintenanceRequest::where('property_id', $property->id)
                    ->whereIn('status', ['open', 'scheduled', 'in_progress'])
                    ->count();

                $maintenanceUrgent = (int) \App\Models\MaintenanceRequest::where('property_id', $property->id)
                    ->whereIn('status', ['open', 'scheduled', 'in_progress'])
                    ->whereIn('priority', ['urgent', 'high'])
                    ->count();
            }

            $documentsExpiring = 0;

            if (
                class_exists(\App\Models\DocumentRecord::class)
                && \Illuminate\Support\Facades\Schema::hasTable('document_records')
            ) {
                $documentsExpiring = (int) \App\Models\DocumentRecord::where('status', 'active')
                    ->whereNotNull('expiry_date')
                    ->whereDate('expiry_date', '<=', $documentSoon)
                    ->where(function ($query) use ($property, $unitIds, $activeContractIds) {
                        $query->where(function ($sub) use ($property) {
                                $sub->where('entity_type', 'property')->where('entity_id', $property->id);
                            })
                            ->orWhere(function ($sub) use ($unitIds) {
                                $sub->where('entity_type', 'unit')->whereIn('entity_id', $unitIds);
                            })
                            ->orWhere(function ($sub) use ($activeContractIds) {
                                $sub->where('entity_type', 'contract')->whereIn('entity_id', $activeContractIds);
                            });
                    })
                    ->count();
            }

            $netIncome = $paidIncome - $expenses - $utilityOverdue;
            $annualizedRent = $monthlyRent * 12;

            return [
                'id' => $property->id,
                'name' => $property->name,
                'owner_id' => $property->owner_id,
                'owner_name' => $property->owner?->name,
                'city' => $property->city,
                'district' => $property->district,
                'property_type' => $property->property_type,
                'management_type' => $property->management_type,
                'units_count' => $unitsCount,
                'rented_units_count' => $rentedUnitsCount,
                'vacant_units_count' => $vacantUnitsCount,
                'occupancy_rate' => $occupancyRate,
                'active_contracts_count' => $activeContracts->count(),
                'monthly_rent' => $monthlyRent,
                'annualized_rent' => $annualizedRent,
                'paid_income' => $paidIncome,
                'due_income' => $dueIncome,
                'overdue_income' => $overdueIncome,
                'expenses' => $expenses,
                'expenses_count' => $expensesCount,
                'utility_due' => $utilityDue,
                'utility_overdue' => $utilityOverdue,
                'utility_bills_count' => $utilityBillsCount,
                'net_income' => $netIncome,
                'maintenance_open' => $maintenanceOpen,
                'maintenance_urgent' => $maintenanceUrgent,
                'documents_expiring' => $documentsExpiring,
                'risk_score' => min(100, ($overdueIncome > 0 ? 35 : 0) + ($maintenanceUrgent > 0 ? 25 : 0) + ($documentsExpiring > 0 ? 15 : 0) + ($occupancyRate < 70 ? 25 : 0)),
            ];
        })->values();

        return [
            'summary' => [
                'properties_count' => $items->count(),
                'units_count' => (int) $items->sum('units_count'),
                'rented_units_count' => (int) $items->sum('rented_units_count'),
                'vacant_units_count' => (int) $items->sum('vacant_units_count'),
                'occupancy_rate' => $items->sum('units_count') > 0
                    ? round(($items->sum('rented_units_count') / $items->sum('units_count')) * 100, 2)
                    : 0,
                'monthly_rent' => (float) $items->sum('monthly_rent'),
                'annualized_rent' => (float) $items->sum('annualized_rent'),
                'paid_income' => (float) $items->sum('paid_income'),
                'due_income' => (float) $items->sum('due_income'),
                'overdue_income' => (float) $items->sum('overdue_income'),
                'expenses' => (float) $items->sum('expenses'),
                'utility_overdue' => (float) $items->sum('utility_overdue'),
                'net_income' => (float) $items->sum('net_income'),
                'maintenance_open' => (int) $items->sum('maintenance_open'),
                'documents_expiring' => (int) $items->sum('documents_expiring'),
            ],
            'items' => $items,
        ];
    }
}

Route::get('/property-performance', function () {
    return my_rentals_property_performance_payload(null);
});

Route::get('/my/property-performance', function (\Illuminate\Http\Request $request) {
    $user = my_rentals_property_performance_current_user($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    return my_rentals_property_performance_payload($user);
});


/*
|--------------------------------------------------------------------------
| Unit Inspections & Handover
|--------------------------------------------------------------------------
| Move-in / move-out / periodic inspection checklist for units.
*/

if (!function_exists('my_rentals_inspections_current_user')) {
    function my_rentals_inspections_current_user(\Illuminate\Http\Request $request): ?\App\Models\User
    {
        if (function_exists('my_rentals_current_user_for_scope')) {
            return my_rentals_current_user_for_scope($request);
        }

        if (function_exists('my_rentals_bearer_user')) {
            return my_rentals_bearer_user($request);
        }

        return null;
    }
}

if (!function_exists('my_rentals_inspections_is_admin')) {
    function my_rentals_inspections_is_admin(?\App\Models\User $user): bool
    {
        if (!$user) {
            return true;
        }

        if (function_exists('my_rentals_is_admin_user')) {
            return my_rentals_is_admin_user($user);
        }

        return in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);
    }
}

if (!function_exists('my_rentals_inspections_scope')) {
    function my_rentals_inspections_scope(?\App\Models\User $user = null): array
    {
        $isAdmin = my_rentals_inspections_is_admin($user);

        if (!$user || $isAdmin) {
            $propertyIds = \App\Models\Property::pluck('id');
        } elseif ($user->owner_id) {
            $propertyIds = \App\Models\Property::where('owner_id', $user->owner_id)->pluck('id');
        } else {
            $propertyIds = collect();
        }

        $unitIds = \App\Models\Unit::whereIn('property_id', $propertyIds)->pluck('id');
        $contractIds = \App\Models\Contract::whereIn('unit_id', $unitIds)->pluck('id');
        $tenantIds = \App\Models\Contract::whereIn('id', $contractIds)
            ->whereNotNull('tenant_id')
            ->pluck('tenant_id')
            ->unique()
            ->values();

        return [
            'is_admin' => $isAdmin,
            'property_ids' => $propertyIds,
            'unit_ids' => $unitIds,
            'contract_ids' => $contractIds,
            'tenant_ids' => $tenantIds,
        ];
    }
}

if (!function_exists('my_rentals_inspections_query_for_user')) {
    function my_rentals_inspections_query_for_user(?\App\Models\User $user = null)
    {
        $query = \App\Models\UnitInspection::with([
            'property.owner',
            'unit.property.owner',
            'tenant',
            'contract.tenant',
            'contract.unit.property.owner',
        ]);

        if (!$user || my_rentals_inspections_is_admin($user)) {
            return $query;
        }

        $scope = my_rentals_inspections_scope($user);

        return $query->where(function ($q) use ($scope) {
            $q->whereIn('property_id', $scope['property_ids'])
                ->orWhereIn('unit_id', $scope['unit_ids'])
                ->orWhereIn('contract_id', $scope['contract_ids']);
        });
    }
}

if (!function_exists('my_rentals_inspection_payload')) {
    function my_rentals_inspection_payload($query)
    {
        return $query
            ->orderByRaw("CASE status WHEN 'open' THEN 1 WHEN 'needs_repair' THEN 2 WHEN 'completed' THEN 3 WHEN 'cancelled' THEN 4 ELSE 5 END")
            ->orderByRaw("CASE WHEN inspection_date IS NULL THEN 2 ELSE 1 END")
            ->orderBy('inspection_date', 'desc')
            ->orderBy('id', 'desc')
            ->get()
            ->map(function ($inspection) {
                $checks = [
                    'walls_ok' => (bool) $inspection->walls_ok,
                    'doors_ok' => (bool) $inspection->doors_ok,
                    'windows_ok' => (bool) $inspection->windows_ok,
                    'plumbing_ok' => (bool) $inspection->plumbing_ok,
                    'electricity_ok' => (bool) $inspection->electricity_ok,
                    'ac_ok' => (bool) $inspection->ac_ok,
                    'kitchen_ok' => (bool) $inspection->kitchen_ok,
                    'bathrooms_ok' => (bool) $inspection->bathrooms_ok,
                    'cleanliness_ok' => (bool) $inspection->cleanliness_ok,
                ];

                $failedChecks = collect($checks)->filter(fn ($value) => $value === false)->count();

                return [
                    'id' => $inspection->id,
                    'property_id' => $inspection->property_id,
                    'property_name' => $inspection->property?->name ?: $inspection->unit?->property?->name ?: $inspection->contract?->unit?->property?->name,
                    'owner_name' => $inspection->property?->owner?->name ?: $inspection->unit?->property?->owner?->name ?: $inspection->contract?->unit?->property?->owner?->name,
                    'unit_id' => $inspection->unit_id,
                    'unit_number' => $inspection->unit?->unit_number ?: $inspection->contract?->unit?->unit_number,
                    'tenant_id' => $inspection->tenant_id,
                    'tenant_name' => $inspection->tenant?->name ?: $inspection->contract?->tenant?->name,
                    'contract_id' => $inspection->contract_id,
                    'contract_number' => $inspection->contract?->government_contract_number ?: $inspection->contract?->contract_number ?: $inspection->contract_id,
                    'inspection_type' => $inspection->inspection_type,
                    'status' => $inspection->status,
                    'inspection_date' => $inspection->inspection_date,
                    'inspector_name' => $inspection->inspector_name,
                    'electricity_meter_reading' => $inspection->electricity_meter_reading,
                    'water_meter_reading' => $inspection->water_meter_reading,
                    'keys_count' => $inspection->keys_count,
                    'checks' => $checks,
                    'failed_checks' => $failedChecks,
                    'damage_notes' => $inspection->damage_notes,
                    'estimated_repair_cost' => $inspection->estimated_repair_cost,
                    'recommendations' => $inspection->recommendations,
                    'notes' => $inspection->notes,
                    'created_at' => $inspection->created_at,
                ];
            })
            ->values();
    }
}

Route::get('/unit-inspections', function () {
    return my_rentals_inspection_payload(my_rentals_inspections_query_for_user(null));
});

Route::post('/unit-inspections', function (\Illuminate\Http\Request $request) {
    $user = my_rentals_inspections_current_user($request);

    $data = $request->validate([
        'property_id' => ['nullable', 'integer', 'exists:properties,id'],
        'unit_id' => ['nullable', 'integer', 'exists:units,id'],
        'tenant_id' => ['nullable', 'integer', 'exists:tenants,id'],
        'contract_id' => ['nullable', 'integer', 'exists:contracts,id'],
        'inspection_type' => ['nullable', 'string', 'max:100'],
        'status' => ['nullable', 'string', 'max:50'],
        'inspection_date' => ['nullable', 'date'],
        'inspector_name' => ['nullable', 'string', 'max:255'],
        'electricity_meter_reading' => ['nullable', 'string', 'max:100'],
        'water_meter_reading' => ['nullable', 'string', 'max:100'],
        'keys_count' => ['nullable', 'integer', 'min:0'],
        'walls_ok' => ['nullable', 'boolean'],
        'doors_ok' => ['nullable', 'boolean'],
        'windows_ok' => ['nullable', 'boolean'],
        'plumbing_ok' => ['nullable', 'boolean'],
        'electricity_ok' => ['nullable', 'boolean'],
        'ac_ok' => ['nullable', 'boolean'],
        'kitchen_ok' => ['nullable', 'boolean'],
        'bathrooms_ok' => ['nullable', 'boolean'],
        'cleanliness_ok' => ['nullable', 'boolean'],
        'damage_notes' => ['nullable', 'string'],
        'estimated_repair_cost' => ['nullable', 'numeric', 'min:0'],
        'recommendations' => ['nullable', 'string'],
        'notes' => ['nullable', 'string'],
    ]);

    if (empty($data['unit_id']) && !empty($data['contract_id'])) {
        $contract = \App\Models\Contract::find($data['contract_id']);
        $data['unit_id'] = $contract?->unit_id;
        $data['tenant_id'] = $data['tenant_id'] ?? $contract?->tenant_id;
    }

    if (empty($data['property_id']) && !empty($data['unit_id'])) {
        $data['property_id'] = \App\Models\Unit::where('id', $data['unit_id'])->value('property_id');
    }

    if ($user && !my_rentals_inspections_is_admin($user)) {
        $scope = my_rentals_inspections_scope($user);

        if (empty($data['property_id']) || !$scope['property_ids']->contains((int) $data['property_id'])) {
            return response()->json(['message' => 'غير مصرح بإضافة معاينة لهذا العقار.'], 403);
        }
    }

    $inspection = \App\Models\UnitInspection::create([
        'property_id' => $data['property_id'] ?? null,
        'unit_id' => $data['unit_id'] ?? null,
        'tenant_id' => $data['tenant_id'] ?? null,
        'contract_id' => $data['contract_id'] ?? null,
        'inspection_type' => $data['inspection_type'] ?? 'periodic',
        'status' => $data['status'] ?? 'open',
        'inspection_date' => $data['inspection_date'] ?? now()->toDateString(),
        'inspector_name' => $data['inspector_name'] ?? null,
        'electricity_meter_reading' => $data['electricity_meter_reading'] ?? null,
        'water_meter_reading' => $data['water_meter_reading'] ?? null,
        'keys_count' => $data['keys_count'] ?? null,
        'walls_ok' => $data['walls_ok'] ?? true,
        'doors_ok' => $data['doors_ok'] ?? true,
        'windows_ok' => $data['windows_ok'] ?? true,
        'plumbing_ok' => $data['plumbing_ok'] ?? true,
        'electricity_ok' => $data['electricity_ok'] ?? true,
        'ac_ok' => $data['ac_ok'] ?? true,
        'kitchen_ok' => $data['kitchen_ok'] ?? true,
        'bathrooms_ok' => $data['bathrooms_ok'] ?? true,
        'cleanliness_ok' => $data['cleanliness_ok'] ?? true,
        'damage_notes' => $data['damage_notes'] ?? null,
        'estimated_repair_cost' => $data['estimated_repair_cost'] ?? 0,
        'recommendations' => $data['recommendations'] ?? null,
        'notes' => $data['notes'] ?? null,
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم حفظ معاينة الوحدة بنجاح',
        'inspection' => my_rentals_inspection_payload(\App\Models\UnitInspection::where('id', $inspection->id))->first(),
    ], 201);
});

Route::post('/unit-inspections/{unitInspection}/status', function (
    \App\Models\UnitInspection $unitInspection,
    \Illuminate\Http\Request $request
) {
    $user = my_rentals_inspections_current_user($request);

    if ($user && !my_rentals_inspections_is_admin($user)) {
        $scope = my_rentals_inspections_scope($user);

        if (!$scope['property_ids']->contains((int) $unitInspection->property_id)) {
            return response()->json(['message' => 'غير مصرح بتحديث هذه المعاينة.'], 403);
        }
    }

    $data = $request->validate([
        'status' => ['required', 'string', 'max:50'],
    ]);

    $unitInspection->update([
        'status' => $data['status'],
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم تحديث حالة المعاينة',
        'inspection' => my_rentals_inspection_payload(\App\Models\UnitInspection::where('id', $unitInspection->id))->first(),
    ]);
});

Route::get('/my/unit-inspections', function (\Illuminate\Http\Request $request) {
    $user = my_rentals_inspections_current_user($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    return my_rentals_inspection_payload(my_rentals_inspections_query_for_user($user));
});


/*
|--------------------------------------------------------------------------
| Service Providers / Vendors
|--------------------------------------------------------------------------
| Service providers directory and assignment to maintenance requests.
*/

if (!function_exists('my_rentals_service_provider_current_user')) {
    function my_rentals_service_provider_current_user(\Illuminate\Http\Request $request): ?\App\Models\User
    {
        if (function_exists('my_rentals_current_user_for_scope')) {
            return my_rentals_current_user_for_scope($request);
        }

        if (function_exists('my_rentals_bearer_user')) {
            return my_rentals_bearer_user($request);
        }

        return null;
    }
}

if (!function_exists('my_rentals_service_provider_is_admin')) {
    function my_rentals_service_provider_is_admin(?\App\Models\User $user): bool
    {
        if (!$user) {
            return true;
        }

        if (function_exists('my_rentals_is_admin_user')) {
            return my_rentals_is_admin_user($user);
        }

        return in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);
    }
}

if (!function_exists('my_rentals_service_provider_scope')) {
    function my_rentals_service_provider_scope(?\App\Models\User $user = null): array
    {
        $isAdmin = my_rentals_service_provider_is_admin($user);

        if (!$user || $isAdmin) {
            $propertyIds = \App\Models\Property::pluck('id');
        } elseif ($user->owner_id) {
            $propertyIds = \App\Models\Property::where('owner_id', $user->owner_id)->pluck('id');
        } else {
            $propertyIds = collect();
        }

        $unitIds = \App\Models\Unit::whereIn('property_id', $propertyIds)->pluck('id');

        return [
            'is_admin' => $isAdmin,
            'property_ids' => $propertyIds,
            'unit_ids' => $unitIds,
        ];
    }
}

if (!function_exists('my_rentals_service_provider_payload')) {
    function my_rentals_service_provider_payload($query)
    {
        $hasMaintenance = class_exists(\App\Models\MaintenanceRequest::class)
            && \Illuminate\Support\Facades\Schema::hasTable('maintenance_requests');

        if ($hasMaintenance) {
            $query->withCount([
                'maintenanceRequests as maintenance_requests_count',
                'maintenanceRequests as open_maintenance_requests_count' => function ($q) {
                    $q->whereIn('status', ['open', 'scheduled', 'in_progress']);
                },
            ]);
        }

        return $query
            ->orderByDesc('is_preferred')
            ->orderByDesc('is_active')
            ->orderBy('provider_type')
            ->orderBy('name')
            ->get()
            ->map(function ($provider) use ($hasMaintenance) {
                return [
                    'id' => $provider->id,
                    'name' => $provider->name,
                    'provider_type' => $provider->provider_type,
                    'phone' => $provider->phone,
                    'alternate_phone' => $provider->alternate_phone,
                    'email' => $provider->email,
                    'city' => $provider->city,
                    'district' => $provider->district,
                    'address' => $provider->address,
                    'default_visit_fee' => $provider->default_visit_fee,
                    'rating' => $provider->rating,
                    'is_preferred' => (bool) $provider->is_preferred,
                    'is_active' => (bool) $provider->is_active,
                    'notes' => $provider->notes,
                    'maintenance_requests_count' => $hasMaintenance ? ($provider->maintenance_requests_count ?? 0) : 0,
                    'open_maintenance_requests_count' => $hasMaintenance ? ($provider->open_maintenance_requests_count ?? 0) : 0,
                    'created_at' => $provider->created_at,
                    'updated_at' => $provider->updated_at,
                ];
            })
            ->values();
    }
}


if (!function_exists('my_rentals_service_provider_maintenance_payload')) {
    function my_rentals_service_provider_maintenance_payload(?\App\Models\User $user = null)
    {
        if (!class_exists(\App\Models\MaintenanceRequest::class) || !\Illuminate\Support\Facades\Schema::hasTable('maintenance_requests')) {
            return collect();
        }

        $scope = my_rentals_service_provider_scope($user);

        $query = \App\Models\MaintenanceRequest::with([
            'property.owner',
            'unit.property.owner',
            'tenant',
        ])
            ->whereIn('status', ['open', 'scheduled', 'in_progress'])
            ->where(function ($q) use ($scope) {
                $q->whereIn('property_id', $scope['property_ids'])
                    ->orWhereIn('unit_id', $scope['unit_ids']);
            });

        if (\Illuminate\Support\Facades\Schema::hasColumn('maintenance_requests', 'service_provider_id')) {
            $query->with('serviceProvider');
        }

        return $query
            ->orderByRaw("CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END")
            ->orderBy('scheduled_date')
            ->orderBy('id', 'desc')
            ->limit(100)
            ->get()
            ->map(function ($request) {
                return [
                    'id' => $request->id,
                    'title' => $request->title,
                    'priority' => $request->priority,
                    'status' => $request->status,
                    'request_date' => $request->request_date,
                    'scheduled_date' => $request->scheduled_date,
                    'property_name' => $request->property?->name ?: $request->unit?->property?->name,
                    'unit_number' => $request->unit?->unit_number,
                    'tenant_name' => $request->tenant?->name,
                    'service_provider_id' => $request->service_provider_id ?? null,
                    'service_provider_name' => $request->serviceProvider?->name ?? null,
                    'estimated_cost' => $request->estimated_cost ?? null,
                    'actual_cost' => $request->actual_cost ?? null,
                    'description' => $request->description ?? null,
                ];
            })
            ->values();
    }
}

Route::get('/service-providers', function () {
    return my_rentals_service_provider_payload(\App\Models\ServiceProvider::query());
});

Route::post('/service-providers', function (\Illuminate\Http\Request $request) {
    $data = $request->validate([
        'name' => ['required', 'string', 'max:255'],
        'provider_type' => ['nullable', 'string', 'max:100'],
        'phone' => ['nullable', 'string', 'max:100'],
        'alternate_phone' => ['nullable', 'string', 'max:100'],
        'email' => ['nullable', 'email', 'max:255'],
        'city' => ['nullable', 'string', 'max:100'],
        'district' => ['nullable', 'string', 'max:100'],
        'address' => ['nullable', 'string'],
        'default_visit_fee' => ['nullable', 'numeric', 'min:0'],
        'rating' => ['nullable', 'integer', 'min:1', 'max:5'],
        'is_preferred' => ['nullable', 'boolean'],
        'is_active' => ['nullable', 'boolean'],
        'notes' => ['nullable', 'string'],
    ]);

    $provider = \App\Models\ServiceProvider::create([
        'name' => $data['name'],
        'provider_type' => $data['provider_type'] ?? 'general',
        'phone' => $data['phone'] ?? null,
        'alternate_phone' => $data['alternate_phone'] ?? null,
        'email' => $data['email'] ?? null,
        'city' => $data['city'] ?? null,
        'district' => $data['district'] ?? null,
        'address' => $data['address'] ?? null,
        'default_visit_fee' => $data['default_visit_fee'] ?? 0,
        'rating' => $data['rating'] ?? null,
        'is_preferred' => $data['is_preferred'] ?? false,
        'is_active' => $data['is_active'] ?? true,
        'notes' => $data['notes'] ?? null,
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم إضافة مقدم الخدمة بنجاح',
        'service_provider' => my_rentals_service_provider_payload(\App\Models\ServiceProvider::where('id', $provider->id))->first(),
    ], 201);
});

Route::post('/service-providers/{serviceProvider}/update', function (
    \App\Models\ServiceProvider $serviceProvider,
    \Illuminate\Http\Request $request
) {
    $data = $request->validate([
        'name' => ['nullable', 'string', 'max:255'],
        'provider_type' => ['nullable', 'string', 'max:100'],
        'phone' => ['nullable', 'string', 'max:100'],
        'alternate_phone' => ['nullable', 'string', 'max:100'],
        'email' => ['nullable', 'email', 'max:255'],
        'city' => ['nullable', 'string', 'max:100'],
        'district' => ['nullable', 'string', 'max:100'],
        'address' => ['nullable', 'string'],
        'default_visit_fee' => ['nullable', 'numeric', 'min:0'],
        'rating' => ['nullable', 'integer', 'min:1', 'max:5'],
        'is_preferred' => ['nullable', 'boolean'],
        'is_active' => ['nullable', 'boolean'],
        'notes' => ['nullable', 'string'],
    ]);

    $serviceProvider->update($data);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم تحديث مقدم الخدمة',
        'service_provider' => my_rentals_service_provider_payload(\App\Models\ServiceProvider::where('id', $serviceProvider->id))->first(),
    ]);
});

Route::post('/service-providers/{serviceProvider}/toggle-active', function (
    \App\Models\ServiceProvider $serviceProvider
) {
    $serviceProvider->update([
        'is_active' => !((bool) $serviceProvider->is_active),
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => $serviceProvider->is_active ? 'تم تفعيل مقدم الخدمة' : 'تم تعطيل مقدم الخدمة',
        'service_provider' => my_rentals_service_provider_payload(\App\Models\ServiceProvider::where('id', $serviceProvider->id))->first(),
    ]);
});

Route::post('/service-providers/{serviceProvider}/toggle-preferred', function (
    \App\Models\ServiceProvider $serviceProvider
) {
    $serviceProvider->update([
        'is_preferred' => !((bool) $serviceProvider->is_preferred),
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => $serviceProvider->is_preferred ? 'تم تمييز مقدم الخدمة كمفضل' : 'تم إزالة التفضيل',
        'service_provider' => my_rentals_service_provider_payload(\App\Models\ServiceProvider::where('id', $serviceProvider->id))->first(),
    ]);
});

Route::get('/service-providers/data', function () {
    return [
        'providers' => my_rentals_service_provider_payload(\App\Models\ServiceProvider::query()),
        'maintenance_requests' => my_rentals_service_provider_maintenance_payload(null),
    ];
});

Route::post('/maintenance-requests/{maintenanceRequest}/assign-provider', function (
    \App\Models\MaintenanceRequest $maintenanceRequest,
    \Illuminate\Http\Request $request
) {
    if (!\Illuminate\Support\Facades\Schema::hasColumn('maintenance_requests', 'service_provider_id')) {
        return response()->json(['message' => 'حقل مقدم الخدمة غير موجود في جدول الصيانة.'], 422);
    }

    $data = $request->validate([
        'service_provider_id' => ['nullable', 'integer', 'exists:service_providers,id'],
    ]);

    $maintenanceRequest->update([
        'service_provider_id' => $data['service_provider_id'] ?? null,
        'provider_assigned_at' => !empty($data['service_provider_id']) ? now() : null,
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم ربط مقدم الخدمة بطلب الصيانة',
    ]);
});

Route::get('/my/service-providers', function (\Illuminate\Http\Request $request) {
    $user = my_rentals_service_provider_current_user($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    return my_rentals_service_provider_payload(\App\Models\ServiceProvider::query());
});

Route::get('/my/service-providers/data', function (\Illuminate\Http\Request $request) {
    $user = my_rentals_service_provider_current_user($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    return [
        'providers' => my_rentals_service_provider_payload(\App\Models\ServiceProvider::query()),
        'maintenance_requests' => my_rentals_service_provider_maintenance_payload($user),
    ];
});


/*
|--------------------------------------------------------------------------
| Edit / Delete Center
|--------------------------------------------------------------------------
| Generic safe edit/delete endpoints for the main application records.
*/

if (!function_exists('my_rentals_ed_current_user')) {
    function my_rentals_ed_current_user(\Illuminate\Http\Request $request): ?\App\Models\User
    {
        if (function_exists('my_rentals_current_user_for_scope')) {
            return my_rentals_current_user_for_scope($request);
        }

        if (function_exists('my_rentals_bearer_user')) {
            return my_rentals_bearer_user($request);
        }

        return null;
    }
}

if (!function_exists('my_rentals_ed_is_admin')) {
    function my_rentals_ed_is_admin(?\App\Models\User $user): bool
    {
        if (!$user) {
            return true;
        }

        if (function_exists('my_rentals_is_admin_user')) {
            return my_rentals_is_admin_user($user);
        }

        return in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);
    }
}

if (!function_exists('my_rentals_ed_model_map')) {
    function my_rentals_ed_model_map(): array
    {
        return [
            'owners' => [
                'label' => 'الملاك',
                'model' => \App\Models\Owner::class,
                'table' => 'owners',
                'title_fields' => ['name', 'phone', 'email'],
                'search_fields' => ['name', 'phone', 'email', 'national_id'],
                'editable' => ['name', 'phone', 'email', 'national_id', 'type', 'notes'],
                'danger_delete_if_related' => true,
            ],
            'properties' => [
                'label' => 'العقارات',
                'model' => \App\Models\Property::class,
                'table' => 'properties',
                'title_fields' => ['name', 'city', 'district'],
                'search_fields' => ['name', 'city', 'district', 'address', 'deed_number'],
                'editable' => ['owner_id', 'name', 'deed_number', 'city', 'district', 'address', 'national_short_address', 'property_area', 'floors_count', 'parking_spots_count', 'elevators_count', 'property_type', 'usage_type', 'management_type', 'notes'],
                'scope' => 'property',
                'danger_delete_if_related' => true,
            ],
            'units' => [
                'label' => 'الوحدات',
                'model' => \App\Models\Unit::class,
                'table' => 'units',
                'title_fields' => ['unit_number', 'floor', 'status'],
                'search_fields' => ['unit_number', 'floor', 'type', 'status'],
                'editable' => ['property_id', 'parent_unit_id', 'unit_number', 'floor', 'type', 'is_subdivided', 'rooms_count', 'bathrooms_count', 'has_kitchen', 'kitchen_type', 'is_kitchen_installed', 'has_living_room', 'is_rooftop', 'orientation', 'rent_amount', 'status', 'notes'],
                'scope' => 'unit',
                'danger_delete_if_related' => true,
            ],
            'tenants' => [
                'label' => 'المستأجرون',
                'model' => \App\Models\Tenant::class,
                'table' => 'tenants',
                'title_fields' => ['name', 'phone', 'national_id'],
                'search_fields' => ['name', 'phone', 'email', 'national_id'],
                'editable' => ['name', 'phone', 'email', 'national_id', 'nationality', 'notes'],
                'scope' => 'tenant',
                'danger_delete_if_related' => true,
            ],
            'contracts' => [
                'label' => 'العقود',
                'model' => \App\Models\Contract::class,
                'table' => 'contracts',
                'title_fields' => ['contract_number', 'government_contract_number', 'status'],
                'search_fields' => ['contract_number', 'government_contract_number', 'status'],
                'editable' => ['tenant_id', 'unit_id', 'contract_number', 'government_contract_number', 'start_date', 'end_date', 'rent_amount', 'parking_fee', 'services_fee', 'deposit_amount', 'payment_cycle', 'status', 'notes'],
                'scope' => 'contract',
                'danger_delete_if_related' => true,
            ],
            'payments' => [
                'label' => 'الدفعات',
                'model' => \App\Models\Payment::class,
                'table' => 'payments',
                'title_fields' => ['amount', 'due_date', 'status'],
                'search_fields' => ['status', 'notes'],
                'editable' => ['contract_id', 'amount', 'due_date', 'paid_date', 'status', 'notes'],
                'scope' => 'payment',
                'danger_delete_if_related' => false,
            ],
            'payment_receipts' => [
                'label' => 'سندات القبض',
                'model' => class_exists(\App\Models\PaymentReceipt::class) ? \App\Models\PaymentReceipt::class : null,
                'table' => 'payment_receipts',
                'title_fields' => ['amount', 'received_date', 'method'],
                'search_fields' => ['method', 'reference_number', 'notes'],
                'editable' => ['payment_id', 'contract_id', 'tenant_id', 'amount', 'received_date', 'method', 'reference_number', 'notes'],
                'scope' => 'payment_receipt',
                'danger_delete_if_related' => false,
            ],
            'property_expenses' => [
                'label' => 'مصروفات العقارات',
                'model' => class_exists(\App\Models\PropertyExpense::class) ? \App\Models\PropertyExpense::class : null,
                'table' => 'property_expenses',
                'title_fields' => ['title', 'amount', 'expense_date'],
                'search_fields' => ['title', 'description', 'notes'],
                'editable' => ['property_id', 'category_id', 'title', 'amount', 'expense_date', 'description', 'notes'],
                'scope' => 'property_expense',
                'danger_delete_if_related' => false,
            ],
            'utility_bills' => [
                'label' => 'فواتير الخدمات',
                'model' => class_exists(\App\Models\UtilityBill::class) ? \App\Models\UtilityBill::class : null,
                'table' => 'utility_bills',
                'title_fields' => ['bill_type', 'amount', 'due_date'],
                'search_fields' => ['bill_type', 'provider', 'bill_number', 'status', 'notes'],
                'editable' => ['property_id', 'bill_type', 'provider', 'bill_number', 'amount', 'bill_date', 'due_date', 'paid_date', 'status', 'notes'],
                'scope' => 'utility_bill',
                'danger_delete_if_related' => false,
            ],
            'maintenance_requests' => [
                'label' => 'طلبات الصيانة',
                'model' => class_exists(\App\Models\MaintenanceRequest::class) ? \App\Models\MaintenanceRequest::class : null,
                'table' => 'maintenance_requests',
                'title_fields' => ['title', 'priority', 'status'],
                'search_fields' => ['title', 'description', 'priority', 'status', 'notes'],
                'editable' => ['property_id', 'unit_id', 'tenant_id', 'service_provider_id', 'title', 'description', 'priority', 'status', 'request_date', 'scheduled_date', 'completed_date', 'estimated_cost', 'actual_cost', 'notes'],
                'scope' => 'maintenance_request',
                'danger_delete_if_related' => false,
            ],
            'document_records' => [
                'label' => 'المستندات',
                'model' => class_exists(\App\Models\DocumentRecord::class) ? \App\Models\DocumentRecord::class : null,
                'table' => 'document_records',
                'title_fields' => ['title', 'document_type', 'status'],
                'search_fields' => ['title', 'document_type', 'document_number', 'status', 'notes'],
                'editable' => ['entity_type', 'entity_id', 'title', 'document_type', 'document_number', 'issue_date', 'expiry_date', 'status', 'notes'],
                'scope' => 'document_record',
                'danger_delete_if_related' => false,
            ],
            'follow_up_tasks' => [
                'label' => 'المتابعات والمهام',
                'model' => class_exists(\App\Models\FollowUpTask::class) ? \App\Models\FollowUpTask::class : null,
                'table' => 'follow_up_tasks',
                'title_fields' => ['title', 'priority', 'status'],
                'search_fields' => ['title', 'task_type', 'priority', 'status', 'notes'],
                'editable' => ['title', 'task_type', 'priority', 'status', 'due_date', 'completed_at', 'property_id', 'unit_id', 'tenant_id', 'contract_id', 'assigned_to_name', 'notes'],
                'scope' => 'follow_up_task',
                'danger_delete_if_related' => false,
            ],
            'owner_payouts' => [
                'label' => 'حوالات الملاك',
                'model' => class_exists(\App\Models\OwnerPayout::class) ? \App\Models\OwnerPayout::class : null,
                'table' => 'owner_payouts',
                'title_fields' => ['amount', 'payout_date', 'status'],
                'search_fields' => ['method', 'reference_number', 'status', 'notes'],
                'editable' => ['owner_id', 'owner_bank_account_id', 'amount', 'payout_date', 'period_start', 'period_end', 'method', 'reference_number', 'status', 'notes'],
                'scope' => 'owner_payout',
                'danger_delete_if_related' => false,
            ],
            'owner_bank_accounts' => [
                'label' => 'حسابات الملاك البنكية',
                'model' => class_exists(\App\Models\OwnerBankAccount::class) ? \App\Models\OwnerBankAccount::class : null,
                'table' => 'owner_bank_accounts',
                'title_fields' => ['bank_name', 'account_name', 'iban'],
                'search_fields' => ['bank_name', 'account_name', 'iban', 'account_number', 'notes'],
                'editable' => ['owner_id', 'bank_name', 'account_name', 'iban', 'account_number', 'is_default', 'is_active', 'notes'],
                'scope' => 'owner_bank_account',
                'danger_delete_if_related' => false,
            ],
            'unit_inspections' => [
                'label' => 'معاينات الوحدات',
                'model' => class_exists(\App\Models\UnitInspection::class) ? \App\Models\UnitInspection::class : null,
                'table' => 'unit_inspections',
                'title_fields' => ['inspection_type', 'inspection_date', 'status'],
                'search_fields' => ['inspection_type', 'status', 'inspector_name', 'damage_notes', 'notes'],
                'editable' => ['property_id', 'unit_id', 'tenant_id', 'contract_id', 'inspection_type', 'status', 'inspection_date', 'inspector_name', 'electricity_meter_reading', 'water_meter_reading', 'keys_count', 'walls_ok', 'doors_ok', 'windows_ok', 'plumbing_ok', 'electricity_ok', 'ac_ok', 'kitchen_ok', 'bathrooms_ok', 'cleanliness_ok', 'damage_notes', 'estimated_repair_cost', 'recommendations', 'notes'],
                'scope' => 'unit_inspection',
                'danger_delete_if_related' => false,
            ],
            'service_providers' => [
                'label' => 'مقدمو الخدمة',
                'model' => class_exists(\App\Models\ServiceProvider::class) ? \App\Models\ServiceProvider::class : null,
                'table' => 'service_providers',
                'title_fields' => ['name', 'provider_type', 'phone'],
                'search_fields' => ['name', 'provider_type', 'phone', 'email', 'city', 'district', 'notes'],
                'editable' => ['name', 'provider_type', 'phone', 'alternate_phone', 'email', 'city', 'district', 'address', 'default_visit_fee', 'rating', 'is_preferred', 'is_active', 'notes'],
                'scope' => 'global',
                'danger_delete_if_related' => false,
            ],
        ];
    }
}

if (!function_exists('my_rentals_ed_resource_config')) {
    function my_rentals_ed_resource_config(string $resource): ?array
    {
        $map = my_rentals_ed_model_map();
        $config = $map[$resource] ?? null;

        if (!$config || empty($config['model']) || !class_exists($config['model'])) {
            return null;
        }

        if (!\Illuminate\Support\Facades\Schema::hasTable($config['table'])) {
            return null;
        }

        return $config;
    }
}

if (!function_exists('my_rentals_ed_existing_fields')) {
    function my_rentals_ed_existing_fields(array $config, array $fields): array
    {
        return array_values(array_filter($fields, fn ($field) => \Illuminate\Support\Facades\Schema::hasColumn($config['table'], $field)));
    }
}

if (!function_exists('my_rentals_ed_scope_ids')) {
    function my_rentals_ed_scope_ids(?\App\Models\User $user): array
    {
        $isAdmin = my_rentals_ed_is_admin($user);

        if (!$user || $isAdmin) {
            $propertyIds = \App\Models\Property::pluck('id');
        } elseif ($user->owner_id) {
            $propertyIds = \App\Models\Property::where('owner_id', $user->owner_id)->pluck('id');
        } else {
            $propertyIds = collect();
        }

        $unitIds = \App\Models\Unit::whereIn('property_id', $propertyIds)->pluck('id');
        $contractIds = \App\Models\Contract::whereIn('unit_id', $unitIds)->pluck('id');
        $tenantIds = \App\Models\Contract::whereIn('id', $contractIds)->whereNotNull('tenant_id')->pluck('tenant_id')->unique()->values();

        return [
            'is_admin' => $isAdmin,
            'property_ids' => $propertyIds,
            'unit_ids' => $unitIds,
            'contract_ids' => $contractIds,
            'tenant_ids' => $tenantIds,
            'owner_id' => $user?->owner_id,
        ];
    }
}

if (!function_exists('my_rentals_ed_apply_scope')) {
    function my_rentals_ed_apply_scope($query, string $resource, array $config, ?\App\Models\User $user)
    {
        if (!$user || my_rentals_ed_is_admin($user)) {
            return $query;
        }

        $scope = my_rentals_ed_scope_ids($user);

        if ($resource === 'owners') {
            return $query->where('id', $scope['owner_id'] ?: 0);
        }

        if (in_array($resource, ['properties'], true)) {
            return $query->whereIn('id', $scope['property_ids']);
        }

        if (in_array($resource, ['units'], true)) {
            return $query->whereIn('id', $scope['unit_ids']);
        }

        if (in_array($resource, ['contracts'], true)) {
            return $query->whereIn('id', $scope['contract_ids']);
        }

        if (in_array($resource, ['tenants'], true)) {
            return $query->whereIn('id', $scope['tenant_ids']);
        }

        if (in_array($resource, ['payments', 'payment_receipts'], true) && \Illuminate\Support\Facades\Schema::hasColumn($config['table'], 'contract_id')) {
            return $query->whereIn('contract_id', $scope['contract_ids']);
        }

        if (in_array($resource, ['property_expenses', 'utility_bills'], true) && \Illuminate\Support\Facades\Schema::hasColumn($config['table'], 'property_id')) {
            return $query->whereIn('property_id', $scope['property_ids']);
        }

        if (in_array($resource, ['maintenance_requests', 'unit_inspections', 'follow_up_tasks'], true)) {
            return $query->where(function ($q) use ($scope, $config) {
                if (\Illuminate\Support\Facades\Schema::hasColumn($config['table'], 'property_id')) {
                    $q->orWhereIn('property_id', $scope['property_ids']);
                }

                if (\Illuminate\Support\Facades\Schema::hasColumn($config['table'], 'unit_id')) {
                    $q->orWhereIn('unit_id', $scope['unit_ids']);
                }

                if (\Illuminate\Support\Facades\Schema::hasColumn($config['table'], 'contract_id')) {
                    $q->orWhereIn('contract_id', $scope['contract_ids']);
                }
            });
        }

        if ($resource === 'owner_payouts' || $resource === 'owner_bank_accounts') {
            return $query->where('owner_id', $scope['owner_id'] ?: 0);
        }

        if ($resource === 'document_records') {
            return $query->where(function ($q) use ($scope) {
                $q->where(function ($sub) use ($scope) {
                    $sub->where('entity_type', 'property')->whereIn('entity_id', $scope['property_ids']);
                })->orWhere(function ($sub) use ($scope) {
                    $sub->where('entity_type', 'unit')->whereIn('entity_id', $scope['unit_ids']);
                })->orWhere(function ($sub) use ($scope) {
                    $sub->where('entity_type', 'contract')->whereIn('entity_id', $scope['contract_ids']);
                })->orWhere(function ($sub) use ($scope) {
                    $sub->where('entity_type', 'tenant')->whereIn('entity_id', $scope['tenant_ids']);
                });
            });
        }

        if ($resource === 'service_providers') {
            return $query;
        }

        return $query->whereRaw('1 = 0');
    }
}

if (!function_exists('my_rentals_ed_item_payload')) {
    function my_rentals_ed_item_payload($item, string $resource, array $config): array
    {
        $editable = my_rentals_ed_existing_fields($config, $config['editable']);
        $titleFields = my_rentals_ed_existing_fields($config, $config['title_fields']);

        $titleParts = [];

        foreach ($titleFields as $field) {
            $value = $item->{$field} ?? null;

            if ($value !== null && $value !== '') {
                $titleParts[] = (string) $value;
            }
        }

        $fields = [];

        foreach ($editable as $field) {
            $value = $item->{$field} ?? null;

            if ($value instanceof \Carbon\CarbonInterface) {
                $value = $value->toDateString();
            }

            $fields[$field] = $value;
        }

        return [
            'id' => $item->id,
            'resource' => $resource,
            'resource_label' => $config['label'],
            'title' => count($titleParts) ? implode(' - ', $titleParts) : ('#' . $item->id),
            'fields' => $fields,
            'editable_fields' => $editable,
            'can_archive' => \Illuminate\Support\Facades\Schema::hasColumn($config['table'], 'is_active') || \Illuminate\Support\Facades\Schema::hasColumn($config['table'], 'status'),
            'created_at' => $item->created_at ?? null,
            'updated_at' => $item->updated_at ?? null,
        ];
    }
}

if (!function_exists('my_rentals_ed_cast_value')) {
    function my_rentals_ed_cast_value(string $table, string $field, mixed $value): mixed
    {
        if ($value === '') {
            return null;
        }

        if (in_array($field, ['is_active', 'is_default', 'is_preferred', 'has_kitchen', 'is_kitchen_installed', 'has_living_room', 'is_rooftop', 'is_subdivided', 'walls_ok', 'doors_ok', 'windows_ok', 'plumbing_ok', 'electricity_ok', 'ac_ok', 'kitchen_ok', 'bathrooms_ok', 'cleanliness_ok'], true)) {
            return in_array(strtolower((string) $value), ['1', 'true', 'yes', 'on', 'نعم'], true);
        }

        if (str_ends_with($field, '_id') || in_array($field, ['rooms_count', 'bathrooms_count', 'floors_count', 'parking_spots_count', 'elevators_count', 'keys_count', 'rating'], true)) {
            return $value === null ? null : (int) $value;
        }

        if (in_array($field, ['amount', 'rent_amount', 'parking_fee', 'services_fee', 'deposit_amount', 'estimated_cost', 'actual_cost', 'estimated_repair_cost', 'default_visit_fee', 'property_area'], true)) {
            return $value === null ? null : (float) $value;
        }

        return $value;
    }
}

if (!function_exists('my_rentals_ed_relationship_blockers')) {
    function my_rentals_ed_relationship_blockers(string $resource, $item): array
    {
        $blockers = [];

        $countIf = function (string $model, string $column, mixed $value, string $label) use (&$blockers) {
            if (class_exists($model)) {
                try {
                    $count = $model::where($column, $value)->count();

                    if ($count > 0) {
                        $blockers[] = $label . ': ' . $count;
                    }
                } catch (\Throwable $e) {
                    //
                }
            }
        };

        if ($resource === 'owners') {
            $countIf(\App\Models\Property::class, 'owner_id', $item->id, 'عقارات مرتبطة');
            if (class_exists(\App\Models\User::class) && \Illuminate\Support\Facades\Schema::hasColumn('users', 'owner_id')) {
                $countIf(\App\Models\User::class, 'owner_id', $item->id, 'حسابات مستخدمين مرتبطة');
            }
            if (class_exists(\App\Models\OwnerPayout::class)) {
                $countIf(\App\Models\OwnerPayout::class, 'owner_id', $item->id, 'حوالات مرتبطة');
            }
            if (class_exists(\App\Models\OwnerBankAccount::class)) {
                $countIf(\App\Models\OwnerBankAccount::class, 'owner_id', $item->id, 'حسابات بنكية مرتبطة');
            }
        }

        if ($resource === 'properties') {
            $countIf(\App\Models\Unit::class, 'property_id', $item->id, 'وحدات مرتبطة');
            if (class_exists(\App\Models\PropertyExpense::class)) {
                $countIf(\App\Models\PropertyExpense::class, 'property_id', $item->id, 'مصروفات مرتبطة');
            }
            if (class_exists(\App\Models\UtilityBill::class)) {
                $countIf(\App\Models\UtilityBill::class, 'property_id', $item->id, 'فواتير خدمات مرتبطة');
            }
            if (class_exists(\App\Models\MaintenanceRequest::class)) {
                $countIf(\App\Models\MaintenanceRequest::class, 'property_id', $item->id, 'طلبات صيانة مرتبطة');
            }
        }

        if ($resource === 'units') {
            $countIf(\App\Models\Contract::class, 'unit_id', $item->id, 'عقود مرتبطة');
            if (class_exists(\App\Models\MaintenanceRequest::class)) {
                $countIf(\App\Models\MaintenanceRequest::class, 'unit_id', $item->id, 'طلبات صيانة مرتبطة');
            }
            if (class_exists(\App\Models\UnitInspection::class)) {
                $countIf(\App\Models\UnitInspection::class, 'unit_id', $item->id, 'معاينات مرتبطة');
            }
        }

        if ($resource === 'tenants') {
            $countIf(\App\Models\Contract::class, 'tenant_id', $item->id, 'عقود مرتبطة');
            if (class_exists(\App\Models\PaymentReceipt::class)) {
                $countIf(\App\Models\PaymentReceipt::class, 'tenant_id', $item->id, 'سندات قبض مرتبطة');
            }
        }

        if ($resource === 'contracts') {
            $countIf(\App\Models\Payment::class, 'contract_id', $item->id, 'دفعات مرتبطة');
            if (class_exists(\App\Models\PaymentReceipt::class)) {
                $countIf(\App\Models\PaymentReceipt::class, 'contract_id', $item->id, 'سندات قبض مرتبطة');
            }
            if (class_exists(\App\Models\UnitInspection::class)) {
                $countIf(\App\Models\UnitInspection::class, 'contract_id', $item->id, 'معاينات مرتبطة');
            }
        }

        if ($resource === 'service_providers' && class_exists(\App\Models\MaintenanceRequest::class) && \Illuminate\Support\Facades\Schema::hasColumn('maintenance_requests', 'service_provider_id')) {
            $countIf(\App\Models\MaintenanceRequest::class, 'service_provider_id', $item->id, 'طلبات صيانة مسندة');
        }

        return $blockers;
    }
}

Route::get('/edit-delete-center/resources', function () {
    $map = my_rentals_ed_model_map();

    return collect($map)
        ->filter(fn ($config) => !empty($config['model']) && class_exists($config['model']) && \Illuminate\Support\Facades\Schema::hasTable($config['table']))
        ->map(fn ($config, $key) => [
            'key' => $key,
            'label' => $config['label'],
            'editable_fields' => my_rentals_ed_existing_fields($config, $config['editable']),
        ])
        ->values();
});


/* Phase 2: removed duplicate route GET /edit-delete-center/{resource}; kept the latest definition. */


Route::get('/my/edit-delete-center/resources', function (\Illuminate\Http\Request $request) {
    $user = my_rentals_ed_current_user($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    return app('router')->getRoutes()->match(\Illuminate\Http\Request::create('/api/edit-delete-center/resources', 'GET'))->run();
});


/* Phase 2: removed duplicate route GET /my/edit-delete-center/{resource}; kept the latest definition. */



/* Phase 2: removed duplicate route POST /edit-delete-center/{resource}/{id}/update; kept the latest definition. */



/* Phase 2: removed duplicate route POST /edit-delete-center/{resource}/{id}/archive; kept the latest definition. */



/* Phase 2: removed duplicate route POST /edit-delete-center/{resource}/{id}/delete; kept the latest definition. */


Route::post('/my/edit-delete-center/{resource}/{id}/update', function (string $resource, int $id, \Illuminate\Http\Request $request) {
    return app('router')->getRoutes()->match(\Illuminate\Http\Request::create('/api/edit-delete-center/' . $resource . '/' . $id . '/update', 'POST', $request->all(), [], [], ['HTTP_AUTHORIZATION' => $request->header('Authorization')]))->run();
});

Route::post('/my/edit-delete-center/{resource}/{id}/archive', function (string $resource, int $id, \Illuminate\Http\Request $request) {
    return app('router')->getRoutes()->match(\Illuminate\Http\Request::create('/api/edit-delete-center/' . $resource . '/' . $id . '/archive', 'POST', $request->all(), [], [], ['HTTP_AUTHORIZATION' => $request->header('Authorization')]))->run();
});

Route::post('/my/edit-delete-center/{resource}/{id}/delete', function (string $resource, int $id, \Illuminate\Http\Request $request) {
    return app('router')->getRoutes()->match(\Illuminate\Http\Request::create('/api/edit-delete-center/' . $resource . '/' . $id . '/delete', 'POST', $request->all(), [], [], ['HTTP_AUTHORIZATION' => $request->header('Authorization')]))->run();
});


/*
|--------------------------------------------------------------------------
| Trash Center / Restore
|--------------------------------------------------------------------------
| Stores deleted records before physical deletion and allows restore.
*/

if (!function_exists('my_rentals_trash_current_user')) {
    function my_rentals_trash_current_user(\Illuminate\Http\Request $request): ?\App\Models\User
    {
        if (function_exists('my_rentals_current_user_for_scope')) {
            return my_rentals_current_user_for_scope($request);
        }

        if (function_exists('my_rentals_bearer_user')) {
            return my_rentals_bearer_user($request);
        }

        return null;
    }
}

if (!function_exists('my_rentals_trash_is_admin')) {
    function my_rentals_trash_is_admin(?\App\Models\User $user): bool
    {
        if (!$user) {
            return true;
        }

        if (function_exists('my_rentals_is_admin_user')) {
            return my_rentals_is_admin_user($user);
        }

        return in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);
    }
}

if (!function_exists('my_rentals_trash_model_map')) {
    function my_rentals_trash_model_map(): array
    {
        if (function_exists('my_rentals_ed_model_map')) {
            return my_rentals_ed_model_map();
        }

        return [
            'owners' => [
                'label' => 'الملاك',
                'model' => \App\Models\Owner::class,
                'table' => 'owners',
                'title_fields' => ['name', 'phone'],
            ],
            'properties' => [
                'label' => 'العقارات',
                'model' => \App\Models\Property::class,
                'table' => 'properties',
                'title_fields' => ['name', 'city', 'district'],
            ],
            'units' => [
                'label' => 'الوحدات',
                'model' => \App\Models\Unit::class,
                'table' => 'units',
                'title_fields' => ['unit_number', 'floor', 'status'],
            ],
            'tenants' => [
                'label' => 'المستأجرون',
                'model' => \App\Models\Tenant::class,
                'table' => 'tenants',
                'title_fields' => ['name', 'phone'],
            ],
            'contracts' => [
                'label' => 'العقود',
                'model' => \App\Models\Contract::class,
                'table' => 'contracts',
                'title_fields' => ['contract_number', 'government_contract_number', 'status'],
            ],
            'payments' => [
                'label' => 'الدفعات',
                'model' => \App\Models\Payment::class,
                'table' => 'payments',
                'title_fields' => ['amount', 'due_date', 'status'],
            ],
        ];
    }
}

if (!function_exists('my_rentals_trash_resource_config')) {
    function my_rentals_trash_resource_config(string $resource): ?array
    {
        if (function_exists('my_rentals_ed_resource_config')) {
            $config = my_rentals_ed_resource_config($resource);

            if ($config) {
                return $config;
            }
        }

        $map = my_rentals_trash_model_map();
        $config = $map[$resource] ?? null;

        if (!$config || empty($config['model']) || !class_exists($config['model'])) {
            return null;
        }

        if (!\Illuminate\Support\Facades\Schema::hasTable($config['table'])) {
            return null;
        }

        return $config;
    }
}

if (!function_exists('my_rentals_trash_record_title')) {
    function my_rentals_trash_record_title($item, array $config): string
    {
        $fields = $config['title_fields'] ?? ['id'];
        $parts = [];

        foreach ($fields as $field) {
            if (\Illuminate\Support\Facades\Schema::hasColumn($config['table'], $field)) {
                $value = $item->{$field} ?? null;

                if ($value !== null && $value !== '') {
                    $parts[] = (string) $value;
                }
            }
        }

        return count($parts) ? implode(' - ', $parts) : ('#' . $item->id);
    }
}

if (!function_exists('my_rentals_trash_owner_id_for_record')) {
    function my_rentals_trash_owner_id_for_record(string $resource, $item): ?int
    {
        try {
            if ($resource === 'owners') {
                return (int) $item->id;
            }

            if (\Illuminate\Support\Facades\Schema::hasColumn($item->getTable(), 'owner_id') && !empty($item->owner_id)) {
                return (int) $item->owner_id;
            }

            if (\Illuminate\Support\Facades\Schema::hasColumn($item->getTable(), 'property_id') && !empty($item->property_id)) {
                return \App\Models\Property::where('id', $item->property_id)->value('owner_id');
            }

            if (\Illuminate\Support\Facades\Schema::hasColumn($item->getTable(), 'unit_id') && !empty($item->unit_id)) {
                $propertyId = \App\Models\Unit::where('id', $item->unit_id)->value('property_id');

                return $propertyId ? \App\Models\Property::where('id', $propertyId)->value('owner_id') : null;
            }

            if (\Illuminate\Support\Facades\Schema::hasColumn($item->getTable(), 'contract_id') && !empty($item->contract_id)) {
                $unitId = \App\Models\Contract::where('id', $item->contract_id)->value('unit_id');
                $propertyId = $unitId ? \App\Models\Unit::where('id', $unitId)->value('property_id') : null;

                return $propertyId ? \App\Models\Property::where('id', $propertyId)->value('owner_id') : null;
            }

            if ($resource === 'tenants') {
                $contract = \App\Models\Contract::where('tenant_id', $item->id)->first();
                $unitId = $contract?->unit_id;
                $propertyId = $unitId ? \App\Models\Unit::where('id', $unitId)->value('property_id') : null;

                return $propertyId ? \App\Models\Property::where('id', $propertyId)->value('owner_id') : null;
            }
        } catch (\Throwable $e) {
            return null;
        }

        return null;
    }
}

if (!function_exists('my_rentals_trash_apply_scope')) {
    function my_rentals_trash_apply_scope($query, string $resource, array $config, ?\App\Models\User $user)
    {
        if (function_exists('my_rentals_ed_apply_scope')) {
            return my_rentals_ed_apply_scope($query, $resource, $config, $user);
        }

        if (!$user || my_rentals_trash_is_admin($user)) {
            return $query;
        }

        if ($resource === 'owners') {
            return $query->where('id', $user->owner_id ?: 0);
        }

        if ($resource === 'properties' && \Illuminate\Support\Facades\Schema::hasColumn($config['table'], 'owner_id')) {
            return $query->where('owner_id', $user->owner_id ?: 0);
        }

        return $query;
    }
}

if (!function_exists('my_rentals_trash_payload')) {
    function my_rentals_trash_payload($query)
    {
        return $query
            ->orderByDesc('deleted_at')
            ->orderByDesc('id')
            ->limit(300)
            ->get()
            ->map(function ($record) {
                return [
                    'id' => $record->id,
                    'resource' => $record->resource,
                    'resource_label' => $record->resource_label,
                    'table_name' => $record->table_name,
                    'record_id' => $record->record_id,
                    'record_title' => $record->record_title,
                    'owner_id' => $record->owner_id,
                    'deleted_by_user_id' => $record->deleted_by_user_id,
                    'deleted_by_name' => $record->deleted_by_name,
                    'payload' => $record->payload,
                    'metadata' => $record->metadata,
                    'status' => $record->status,
                    'deleted_at' => $record->deleted_at,
                    'restored_at' => $record->restored_at,
                    'restore_error' => $record->restore_error,
                ];
            })
            ->values();
    }
}

/*
 * Enhanced delete endpoint.
 * This intentionally uses the same URI as the previous Edit/Delete Center delete route.
 * Laravel keeps the latest route for the same method/URI, so this version stores a backup first.
 */

/* Phase 2: removed duplicate route POST /edit-delete-center/{resource}/{id}/delete; kept the latest definition. */


Route::get('/trash-center/deleted-records', function () {
    return my_rentals_trash_payload(\App\Models\DeletedRecord::where('status', 'deleted'));
});

Route::get('/my/trash-center/deleted-records', function (\Illuminate\Http\Request $request) {
    $user = my_rentals_trash_current_user($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $query = \App\Models\DeletedRecord::where('status', 'deleted');

    if (!my_rentals_trash_is_admin($user)) {
        $query->where('owner_id', $user->owner_id ?: 0);
    }

    return my_rentals_trash_payload($query);
});

Route::post('/trash-center/deleted-records/{deletedRecord}/restore', function (
    \App\Models\DeletedRecord $deletedRecord,
    \Illuminate\Http\Request $request
) {
    $user = my_rentals_trash_current_user($request);

    if ($user && !my_rentals_trash_is_admin($user) && (int) $deletedRecord->owner_id !== (int) $user->owner_id) {
        return response()->json(['message' => 'لا تملك صلاحية استعادة هذا السجل.'], 403);
    }

    if ($deletedRecord->status !== 'deleted') {
        return response()->json(['message' => 'هذا السجل غير متاح للاستعادة.'], 422);
    }

    $config = my_rentals_trash_resource_config($deletedRecord->resource);

    if (!$config) {
        return response()->json(['message' => 'تعذر تحديد نوع السجل للاستعادة.'], 422);
    }

    if ($config['model']::where('id', $deletedRecord->record_id)->exists()) {
        return response()->json(['message' => 'يوجد سجل حالي بنفس الرقم، لا يمكن الاستعادة تلقائيًا.'], 422);
    }

    $payload = $deletedRecord->payload ?: [];
    $columns = \Illuminate\Support\Facades\Schema::getColumnListing($config['table']);
    $insert = [];

    foreach ($payload as $key => $value) {
        if (in_array($key, $columns, true)) {
            $insert[$key] = $value;
        }
    }

    if (!in_array('id', $columns, true) || empty($insert['id'])) {
        $insert['id'] = $deletedRecord->record_id;
    }

    try {
        \Illuminate\Support\Facades\DB::transaction(function () use ($config, $insert, $deletedRecord, $user) {
            \Illuminate\Support\Facades\DB::table($config['table'])->insert($insert);

            $deletedRecord->update([
                'status' => 'restored',
                'restored_at' => now(),
                'restored_by_user_id' => $user?->id,
                'restore_error' => null,
            ]);
        });
    } catch (\Throwable $e) {
        $deletedRecord->update([
            'restore_error' => $e->getMessage(),
        ]);

        return response()->json([
            'message' => 'تعذر استعادة السجل. قد تكون هناك علاقات ناقصة أو قيود في قاعدة البيانات.',
            'error' => $e->getMessage(),
        ], 422);
    }

    return response()->json([
        'status' => 'ok',
        'message' => 'تمت استعادة السجل بنجاح',
    ]);
});

Route::post('/trash-center/deleted-records/{deletedRecord}/purge', function (
    \App\Models\DeletedRecord $deletedRecord,
    \Illuminate\Http\Request $request
) {
    $user = my_rentals_trash_current_user($request);

    if ($user && !my_rentals_trash_is_admin($user)) {
        return response()->json(['message' => 'حذف سجل السلة نهائيًا متاح للمدير فقط.'], 403);
    }

    $deletedRecord->delete();

    return response()->json([
        'status' => 'ok',
        'message' => 'تم حذف نسخة السلة نهائيًا',
    ]);
});

Route::post('/my/trash-center/deleted-records/{deletedRecord}/restore', function (
    \App\Models\DeletedRecord $deletedRecord,
    \Illuminate\Http\Request $request
) {
    return app('router')->getRoutes()->match(\Illuminate\Http\Request::create('/api/trash-center/deleted-records/' . $deletedRecord->id . '/restore', 'POST', $request->all(), [], [], ['HTTP_AUTHORIZATION' => $request->header('Authorization')]))->run();
});

Route::post('/my/trash-center/deleted-records/{deletedRecord}/purge', function (
    \App\Models\DeletedRecord $deletedRecord,
    \Illuminate\Http\Request $request
) {
    return app('router')->getRoutes()->match(\Illuminate\Http\Request::create('/api/trash-center/deleted-records/' . $deletedRecord->id . '/purge', 'POST', $request->all(), [], [], ['HTTP_AUTHORIZATION' => $request->header('Authorization')]))->run();
});


/*
|--------------------------------------------------------------------------
| Edit/Delete Center Relation Lookups + Exact ID Loading
|--------------------------------------------------------------------------
| Enhances edit/delete screens with readable selectors for *_id fields.
*/

if (!function_exists('my_rentals_ed_lookup_current_user')) {
    function my_rentals_ed_lookup_current_user(\Illuminate\Http\Request $request): ?\App\Models\User
    {
        if (function_exists('my_rentals_ed_current_user')) {
            return my_rentals_ed_current_user($request);
        }

        if (function_exists('my_rentals_current_user_for_scope')) {
            return my_rentals_current_user_for_scope($request);
        }

        if (function_exists('my_rentals_bearer_user')) {
            return my_rentals_bearer_user($request);
        }

        return null;
    }
}

if (!function_exists('my_rentals_ed_lookup_is_admin')) {
    function my_rentals_ed_lookup_is_admin(?\App\Models\User $user): bool
    {
        if (function_exists('my_rentals_ed_is_admin')) {
            return my_rentals_ed_is_admin($user);
        }

        if (!$user) {
            return true;
        }

        if (function_exists('my_rentals_is_admin_user')) {
            return my_rentals_is_admin_user($user);
        }

        return in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);
    }
}

if (!function_exists('my_rentals_ed_lookup_scope')) {
    function my_rentals_ed_lookup_scope(?\App\Models\User $user): array
    {
        $isAdmin = my_rentals_ed_lookup_is_admin($user);

        if (!$user || $isAdmin) {
            $ownerIds = \App\Models\Owner::pluck('id');
            $propertyIds = \App\Models\Property::pluck('id');
        } elseif ($user->owner_id) {
            $ownerIds = collect([$user->owner_id]);
            $propertyIds = \App\Models\Property::where('owner_id', $user->owner_id)->pluck('id');
        } else {
            $ownerIds = collect();
            $propertyIds = collect();
        }

        $unitIds = \App\Models\Unit::whereIn('property_id', $propertyIds)->pluck('id');
        $contractIds = \App\Models\Contract::whereIn('unit_id', $unitIds)->pluck('id');
        $tenantIds = \App\Models\Contract::whereIn('id', $contractIds)
            ->whereNotNull('tenant_id')
            ->pluck('tenant_id')
            ->unique()
            ->values();

        if ($isAdmin) {
            $tenantIds = \App\Models\Tenant::pluck('id');
        }

        return [
            'is_admin' => $isAdmin,
            'owner_ids' => $ownerIds,
            'property_ids' => $propertyIds,
            'unit_ids' => $unitIds,
            'contract_ids' => $contractIds,
            'tenant_ids' => $tenantIds,
        ];
    }
}

if (!function_exists('my_rentals_ed_lookup_option')) {
    function my_rentals_ed_lookup_option($id, $label, array $extra = []): array
    {
        return array_merge([
            'id' => $id,
            'label' => trim((string) $label) ?: ('#' . $id),
        ], $extra);
    }
}

if (!function_exists('my_rentals_ed_lookup_payload')) {
    function my_rentals_ed_lookup_payload(?\App\Models\User $user = null): array
    {
        $scope = my_rentals_ed_lookup_scope($user);

        $owners = \App\Models\Owner::whereIn('id', $scope['owner_ids'])
            ->orderBy('name')
            ->limit(300)
            ->get()
            ->map(fn ($item) => my_rentals_ed_lookup_option($item->id, $item->name ?: ('مالك #' . $item->id), [
                'phone' => $item->phone,
            ]))
            ->values();

        $properties = \App\Models\Property::whereIn('id', $scope['property_ids'])
            ->orderBy('name')
            ->limit(400)
            ->get()
            ->map(fn ($item) => my_rentals_ed_lookup_option($item->id, ($item->name ?: ('عقار #' . $item->id)) . ' - ' . ($item->district ?: $item->city ?: ''), [
                'owner_id' => $item->owner_id,
                'city' => $item->city,
                'district' => $item->district,
            ]))
            ->values();

        $units = \App\Models\Unit::with('property')
            ->whereIn('id', $scope['unit_ids'])
            ->orderBy('property_id')
            ->orderBy('unit_number')
            ->limit(600)
            ->get()
            ->map(fn ($item) => my_rentals_ed_lookup_option($item->id, ($item->property?->name ?: 'عقار') . ' / وحدة ' . ($item->unit_number ?: $item->id), [
                'property_id' => $item->property_id,
                'status' => $item->status,
            ]))
            ->values();

        $tenants = \App\Models\Tenant::whereIn('id', $scope['tenant_ids'])
            ->orderBy('name')
            ->limit(400)
            ->get()
            ->map(fn ($item) => my_rentals_ed_lookup_option($item->id, ($item->name ?: ('مستأجر #' . $item->id)) . ($item->phone ? ' - ' . $item->phone : ''), [
                'phone' => $item->phone,
            ]))
            ->values();

        $contracts = \App\Models\Contract::with(['tenant', 'unit.property'])
            ->whereIn('id', $scope['contract_ids'])
            ->orderByDesc('id')
            ->limit(500)
            ->get()
            ->map(function ($item) {
                $number = $item->government_contract_number ?: $item->contract_number ?: $item->id;
                $tenant = $item->tenant?->name ?: 'مستأجر';
                $unit = $item->unit?->unit_number ?: '-';
                $property = $item->unit?->property?->name ?: 'عقار';

                return my_rentals_ed_lookup_option($item->id, 'عقد ' . $number . ' - ' . $tenant . ' - ' . $property . '/' . $unit, [
                    'tenant_id' => $item->tenant_id,
                    'unit_id' => $item->unit_id,
                    'status' => $item->status,
                ]);
            })
            ->values();

        $serviceProviders = collect();

        if (class_exists(\App\Models\ServiceProvider::class) && \Illuminate\Support\Facades\Schema::hasTable('service_providers')) {
            $serviceProviders = \App\Models\ServiceProvider::orderByDesc('is_preferred')
                ->orderBy('name')
                ->limit(300)
                ->get()
                ->map(fn ($item) => my_rentals_ed_lookup_option($item->id, ($item->name ?: ('مقدم خدمة #' . $item->id)) . ($item->provider_type ? ' - ' . $item->provider_type : ''), [
                    'provider_type' => $item->provider_type,
                    'phone' => $item->phone,
                ]))
                ->values();
        }

        $ownerBankAccounts = collect();

        if (class_exists(\App\Models\OwnerBankAccount::class) && \Illuminate\Support\Facades\Schema::hasTable('owner_bank_accounts')) {
            $ownerBankAccounts = \App\Models\OwnerBankAccount::whereIn('owner_id', $scope['owner_ids'])
                ->orderByDesc('is_default')
                ->orderBy('bank_name')
                ->limit(300)
                ->get()
                ->map(fn ($item) => my_rentals_ed_lookup_option($item->id, ($item->bank_name ?: 'بنك') . ' - ' . ($item->account_name ?: '') . ' - ' . ($item->iban ? substr($item->iban, 0, 4) . '****' . substr($item->iban, -4) : ('#' . $item->id)), [
                    'owner_id' => $item->owner_id,
                ]))
                ->values();
        }

        $expenseCategories = collect();

        if (class_exists(\App\Models\ExpenseCategory::class) && \Illuminate\Support\Facades\Schema::hasTable('expense_categories')) {
            $expenseCategories = \App\Models\ExpenseCategory::orderBy('name')
                ->limit(200)
                ->get()
                ->map(fn ($item) => my_rentals_ed_lookup_option($item->id, $item->name ?: ('تصنيف #' . $item->id)))
                ->values();
        }

        return [
            'owners' => $owners,
            'properties' => $properties,
            'units' => $units,
            'tenants' => $tenants,
            'contracts' => $contracts,
            'service_providers' => $serviceProviders,
            'owner_bank_accounts' => $ownerBankAccounts,
            'expense_categories' => $expenseCategories,
        ];
    }
}

Route::get('/edit-delete-center/lookups', function () {
    return my_rentals_ed_lookup_payload(null);
});

Route::get('/my/edit-delete-center/lookups', function (\Illuminate\Http\Request $request) {
    $user = my_rentals_ed_lookup_current_user($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    return my_rentals_ed_lookup_payload($user);
});

/*
 * Enhanced listing endpoint with exact id support:
 * /api/edit-delete-center/properties?id=5
 */
Route::get('/edit-delete-center/{resource}', function (string $resource, \Illuminate\Http\Request $request) {
    if (!function_exists('my_rentals_ed_resource_config')) {
        return response()->json(['message' => 'يجب تثبيت باتش مركز التعديل والحذف أولاً.'], 422);
    }

    $config = my_rentals_ed_resource_config($resource);

    if (!$config) {
        return response()->json(['message' => 'هذا النوع غير متاح للتعديل.'], 404);
    }

    $user = my_rentals_ed_lookup_current_user($request);
    $model = $config['model'];
    $query = my_rentals_ed_apply_scope($model::query(), $resource, $config, $user);

    $id = $request->query('id');

    if ($id !== null && $id !== '') {
        $query->where('id', (int) $id);
    } else {
        $search = trim((string) $request->query('q', ''));

        if ($search !== '') {
            $searchFields = my_rentals_ed_existing_fields($config, $config['search_fields']);

            $query->where(function ($q) use ($searchFields, $search) {
                foreach ($searchFields as $field) {
                    $q->orWhere($field, 'like', '%' . $search . '%');
                }
            });
        }
    }

    $items = $query->orderByDesc('id')->limit($id ? 1 : 150)->get();

    return [
        'resource' => $resource,
        'resource_label' => $config['label'],
        'editable_fields' => my_rentals_ed_existing_fields($config, $config['editable']),
        'items' => $items->map(fn ($item) => my_rentals_ed_item_payload($item, $resource, $config))->values(),
    ];
});

Route::get('/my/edit-delete-center/{resource}', function (string $resource, \Illuminate\Http\Request $request) {
    $user = my_rentals_ed_lookup_current_user($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    if (!function_exists('my_rentals_ed_resource_config')) {
        return response()->json(['message' => 'يجب تثبيت باتش مركز التعديل والحذف أولاً.'], 422);
    }

    $config = my_rentals_ed_resource_config($resource);

    if (!$config) {
        return response()->json(['message' => 'هذا النوع غير متاح للتعديل.'], 404);
    }

    $model = $config['model'];
    $query = my_rentals_ed_apply_scope($model::query(), $resource, $config, $user);

    $id = $request->query('id');

    if ($id !== null && $id !== '') {
        $query->where('id', (int) $id);
    } else {
        $search = trim((string) $request->query('q', ''));

        if ($search !== '') {
            $searchFields = my_rentals_ed_existing_fields($config, $config['search_fields']);

            $query->where(function ($q) use ($searchFields, $search) {
                foreach ($searchFields as $field) {
                    $q->orWhere($field, 'like', '%' . $search . '%');
                }
            });
        }
    }

    $items = $query->orderByDesc('id')->limit($id ? 1 : 150)->get();

    return [
        'resource' => $resource,
        'resource_label' => $config['label'],
        'editable_fields' => my_rentals_ed_existing_fields($config, $config['editable']),
        'items' => $items->map(fn ($item) => my_rentals_ed_item_payload($item, $resource, $config))->values(),
    ];
});


/*
|--------------------------------------------------------------------------
| Activity / Audit Log
|--------------------------------------------------------------------------
| Records update, archive, delete and restore actions.
*/

if (!function_exists('my_rentals_activity_current_user')) {
    function my_rentals_activity_current_user(\Illuminate\Http\Request $request): ?\App\Models\User
    {
        if (function_exists('my_rentals_ed_current_user')) {
            return my_rentals_ed_current_user($request);
        }

        if (function_exists('my_rentals_current_user_for_scope')) {
            return my_rentals_current_user_for_scope($request);
        }

        if (function_exists('my_rentals_bearer_user')) {
            return my_rentals_bearer_user($request);
        }

        return null;
    }
}

if (!function_exists('my_rentals_activity_is_admin')) {
    function my_rentals_activity_is_admin(?\App\Models\User $user): bool
    {
        if (function_exists('my_rentals_ed_is_admin')) {
            return my_rentals_ed_is_admin($user);
        }

        if (!$user) {
            return true;
        }

        if (function_exists('my_rentals_is_admin_user')) {
            return my_rentals_is_admin_user($user);
        }

        return in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);
    }
}

if (!function_exists('my_rentals_activity_record_title')) {
    function my_rentals_activity_record_title($item, array $config): string
    {
        if (function_exists('my_rentals_trash_record_title')) {
            return my_rentals_trash_record_title($item, $config);
        }

        $fields = $config['title_fields'] ?? ['id'];
        $parts = [];

        foreach ($fields as $field) {
            if (\Illuminate\Support\Facades\Schema::hasColumn($config['table'], $field)) {
                $value = $item->{$field} ?? null;

                if ($value !== null && $value !== '') {
                    $parts[] = (string) $value;
                }
            }
        }

        return count($parts) ? implode(' - ', $parts) : ('#' . $item->id);
    }
}

if (!function_exists('my_rentals_activity_owner_id_for_record')) {
    function my_rentals_activity_owner_id_for_record(string $resource, $item): ?int
    {
        if (function_exists('my_rentals_trash_owner_id_for_record')) {
            return my_rentals_trash_owner_id_for_record($resource, $item);
        }

        try {
            if ($resource === 'owners') {
                return (int) $item->id;
            }

            if (\Illuminate\Support\Facades\Schema::hasColumn($item->getTable(), 'owner_id') && !empty($item->owner_id)) {
                return (int) $item->owner_id;
            }

            if (\Illuminate\Support\Facades\Schema::hasColumn($item->getTable(), 'property_id') && !empty($item->property_id)) {
                return \App\Models\Property::where('id', $item->property_id)->value('owner_id');
            }

            if (\Illuminate\Support\Facades\Schema::hasColumn($item->getTable(), 'unit_id') && !empty($item->unit_id)) {
                $propertyId = \App\Models\Unit::where('id', $item->unit_id)->value('property_id');

                return $propertyId ? \App\Models\Property::where('id', $propertyId)->value('owner_id') : null;
            }

            if (\Illuminate\Support\Facades\Schema::hasColumn($item->getTable(), 'contract_id') && !empty($item->contract_id)) {
                $unitId = \App\Models\Contract::where('id', $item->contract_id)->value('unit_id');
                $propertyId = $unitId ? \App\Models\Unit::where('id', $unitId)->value('property_id') : null;

                return $propertyId ? \App\Models\Property::where('id', $propertyId)->value('owner_id') : null;
            }
        } catch (\Throwable $e) {
            return null;
        }

        return null;
    }
}

if (!function_exists('my_rentals_activity_log_action')) {
    function my_rentals_activity_log_action(
        string $action,
        ?string $resource = null,
        ?array $config = null,
        $recordId = null,
        ?string $recordTitle = null,
        ?array $oldPayload = null,
        ?array $newPayload = null,
        ?\App\Models\User $user = null,
        ?int $ownerId = null,
        array $metadata = []
    ): void {
        try {
            if (!class_exists(\App\Models\ActivityLog::class) || !\Illuminate\Support\Facades\Schema::hasTable('activity_logs')) {
                return;
            }

            \App\Models\ActivityLog::create([
                'action' => $action,
                'resource' => $resource,
                'resource_label' => $config['label'] ?? $resource,
                'record_id' => $recordId,
                'record_title' => $recordTitle,
                'owner_id' => $ownerId,
                'user_id' => $user?->id,
                'user_name' => $user?->name,
                'user_email' => $user?->email,
                'old_payload' => $oldPayload,
                'new_payload' => $newPayload,
                'metadata' => $metadata,
                'ip_address' => request()?->ip(),
                'user_agent' => request()?->userAgent(),
            ]);
        } catch (\Throwable $e) {
            // Audit logging must never break the main action.
        }
    }
}

if (!function_exists('my_rentals_activity_payload')) {
    function my_rentals_activity_payload($query)
    {
        return $query
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(300)
            ->get()
            ->map(function ($log) {
                return [
                    'id' => $log->id,
                    'action' => $log->action,
                    'resource' => $log->resource,
                    'resource_label' => $log->resource_label,
                    'record_id' => $log->record_id,
                    'record_title' => $log->record_title,
                    'owner_id' => $log->owner_id,
                    'user_id' => $log->user_id,
                    'user_name' => $log->user_name,
                    'user_email' => $log->user_email,
                    'old_payload' => $log->old_payload,
                    'new_payload' => $log->new_payload,
                    'metadata' => $log->metadata,
                    'ip_address' => $log->ip_address,
                    'created_at' => $log->created_at,
                ];
            })
            ->values();
    }
}


/* Phase 2: removed duplicate route GET /activity-logs; kept the latest definition. */



/* Phase 2: removed duplicate route GET /my/activity-logs; kept the latest definition. */


/*
 * Audited update handler. Same URI as Edit/Delete Center, appended later so the app uses it.
 */
Route::post('/edit-delete-center/{resource}/{id}/update', function (string $resource, int $id, \Illuminate\Http\Request $request) {
    if (!function_exists('my_rentals_ed_resource_config')) {
        return response()->json(['message' => 'يجب تثبيت مركز التعديل والحذف أولاً.'], 422);
    }

    $config = my_rentals_ed_resource_config($resource);

    if (!$config) {
        return response()->json(['message' => 'هذا النوع غير متاح للتعديل.'], 404);
    }

    $user = my_rentals_activity_current_user($request);
    $model = $config['model'];
    $item = my_rentals_ed_apply_scope($model::query(), $resource, $config, $user)->where('id', $id)->first();

    if (!$item) {
        return response()->json(['message' => 'السجل غير موجود أو لا تملك صلاحية تعديله.'], 404);
    }

    $oldPayload = $item->getAttributes();
    $fields = $request->input('fields', []);
    $editable = my_rentals_ed_existing_fields($config, $config['editable']);
    $updates = [];

    foreach ($editable as $field) {
        if (array_key_exists($field, $fields)) {
            $updates[$field] = my_rentals_ed_cast_value($config['table'], $field, $fields[$field]);
        }
    }

    if ($resource === 'properties') {
        $nextOwnerId = $updates['owner_id'] ?? ($item->owner_id ?? null);

        if (!$nextOwnerId) {
            return response()->json(['message' => 'يجب اختيار اسم المالك قبل حفظ العقار.'], 422);
        }
    }

    if ($resource === 'properties' && array_key_exists('national_short_address', $updates)) {
        $shortAddress = $updates['national_short_address'];
        if ($shortAddress !== null && !preg_match('/^[A-Za-z0-9]{1,8}$/', (string) $shortAddress)) {
            return response()->json(['message' => 'العنوان الوطني المختصر يجب ألا يزيد عن 8 أحرف أو أرقام إنجليزية فقط.'], 422);
        }
    }

    if (empty($updates)) {
        return response()->json(['message' => 'لا توجد حقول صالحة للتحديث.'], 422);
    }

    $item->fill($updates);
    $item->save();
    $fresh = $item->fresh();

    my_rentals_activity_log_action(
        'update',
        $resource,
        $config,
        $fresh->id,
        my_rentals_activity_record_title($fresh, $config),
        $oldPayload,
        $fresh->getAttributes(),
        $user,
        my_rentals_activity_owner_id_for_record($resource, $fresh),
        ['source' => 'direct_card_edit']
    );

    return response()->json([
        'status' => 'ok',
        'message' => 'تم حفظ التعديل بنجاح',
        'item' => my_rentals_ed_item_payload($fresh, $resource, $config),
    ]);
});

/*
 * Audited archive handler.
 */
Route::post('/edit-delete-center/{resource}/{id}/archive', function (string $resource, int $id, \Illuminate\Http\Request $request) {
    if (!function_exists('my_rentals_ed_resource_config')) {
        return response()->json(['message' => 'يجب تثبيت مركز التعديل والحذف أولاً.'], 422);
    }

    $config = my_rentals_ed_resource_config($resource);

    if (!$config) {
        return response()->json(['message' => 'هذا النوع غير متاح.'], 404);
    }

    $user = my_rentals_activity_current_user($request);
    $model = $config['model'];
    $item = my_rentals_ed_apply_scope($model::query(), $resource, $config, $user)->where('id', $id)->first();

    if (!$item) {
        return response()->json(['message' => 'السجل غير موجود أو لا تملك صلاحية تعديله.'], 404);
    }

    $oldPayload = $item->getAttributes();

    if (\Illuminate\Support\Facades\Schema::hasColumn($config['table'], 'is_active')) {
        $item->is_active = !((bool) $item->is_active);
        $item->save();

        $fresh = $item->fresh();

        my_rentals_activity_log_action(
            'archive',
            $resource,
            $config,
            $fresh->id,
            my_rentals_activity_record_title($fresh, $config),
            $oldPayload,
            $fresh->getAttributes(),
            $user,
            my_rentals_activity_owner_id_for_record($resource, $fresh),
            ['source' => 'direct_card_edit', 'field' => 'is_active']
        );

        return response()->json([
            'status' => 'ok',
            'message' => $item->is_active ? 'تم تفعيل السجل' : 'تم تعطيل السجل',
            'item' => my_rentals_ed_item_payload($fresh, $resource, $config),
        ]);
    }

    if (\Illuminate\Support\Facades\Schema::hasColumn($config['table'], 'status')) {
        $current = (string) ($item->status ?? '');
        $item->status = in_array($current, ['cancelled', 'archived', 'inactive'], true) ? 'active' : 'cancelled';
        $item->save();

        $fresh = $item->fresh();

        my_rentals_activity_log_action(
            'archive',
            $resource,
            $config,
            $fresh->id,
            my_rentals_activity_record_title($fresh, $config),
            $oldPayload,
            $fresh->getAttributes(),
            $user,
            my_rentals_activity_owner_id_for_record($resource, $fresh),
            ['source' => 'direct_card_edit', 'field' => 'status']
        );

        return response()->json([
            'status' => 'ok',
            'message' => 'تم تغيير حالة السجل',
            'item' => my_rentals_ed_item_payload($fresh, $resource, $config),
        ]);
    }

    return response()->json(['message' => 'هذا السجل لا يدعم التعطيل أو الأرشفة.'], 422);
});

/*
 * Audited delete handler with trash snapshot support when installed.
 */
Route::post('/edit-delete-center/{resource}/{id}/delete', function (string $resource, int $id, \Illuminate\Http\Request $request) {
    if (!function_exists('my_rentals_ed_resource_config')) {
        return response()->json(['message' => 'يجب تثبيت مركز التعديل والحذف أولاً.'], 422);
    }

    $config = my_rentals_ed_resource_config($resource);

    if (!$config) {
        return response()->json(['message' => 'هذا النوع غير متاح للحذف.'], 404);
    }

    $user = my_rentals_activity_current_user($request);
    $model = $config['model'];
    $item = my_rentals_ed_apply_scope($model::query(), $resource, $config, $user)->where('id', $id)->first();

    if (!$item) {
        return response()->json(['message' => 'السجل غير موجود أو لا تملك صلاحية حذفه.'], 404);
    }

    $blockers = function_exists('my_rentals_ed_relationship_blockers')
        ? my_rentals_ed_relationship_blockers($resource, $item)
        : [];

    if (count($blockers) > 0) {
        return response()->json([
            'message' => 'لا يمكن حذف هذا السجل لوجود ارتباطات. احذف أو انقل الارتباطات أولاً.',
            'blockers' => $blockers,
        ], 422);
    }

    $oldPayload = $item->getAttributes();
    $recordTitle = my_rentals_activity_record_title($item, $config);
    $ownerId = my_rentals_activity_owner_id_for_record($resource, $item);
    $usedTrash = false;

    try {
        \Illuminate\Support\Facades\DB::transaction(function () use ($resource, $config, $item, $user, $oldPayload, $recordTitle, $ownerId, &$usedTrash) {
            if (class_exists(\App\Models\DeletedRecord::class) && \Illuminate\Support\Facades\Schema::hasTable('deleted_records')) {
                \App\Models\DeletedRecord::create([
                    'resource' => $resource,
                    'resource_label' => $config['label'] ?? $resource,
                    'table_name' => $config['table'],
                    'record_id' => $item->id,
                    'record_title' => $recordTitle,
                    'owner_id' => $ownerId,
                    'deleted_by_user_id' => $user?->id,
                    'deleted_by_name' => $user?->name,
                    'payload' => $oldPayload,
                    'metadata' => [
                        'deleted_from' => 'direct_card_edit',
                        'app' => 'my_rentals',
                    ],
                    'status' => 'deleted',
                    'deleted_at' => now(),
                ]);

                $usedTrash = true;
            }

            $item->delete();

            my_rentals_activity_log_action(
                'delete',
                $resource,
                $config,
                $oldPayload['id'] ?? null,
                $recordTitle,
                $oldPayload,
                null,
                $user,
                $ownerId,
                ['source' => 'direct_card_edit', 'trash_snapshot' => $usedTrash]
            );
        });
    } catch (\Throwable $e) {
        return response()->json([
            'message' => 'تعذر الحذف. قد يكون السجل مرتبطًا بسجلات أخرى أو توجد قيود في قاعدة البيانات.',
            'error' => $e->getMessage(),
        ], 422);
    }

    return response()->json([
        'status' => 'ok',
        'message' => $usedTrash ? 'تم حذف السجل ونقله إلى سلة المحذوفات' : 'تم حذف السجل بنجاح',
    ]);
});


/*
|--------------------------------------------------------------------------
| Activity Rollback / Undo
|--------------------------------------------------------------------------
| Allows undoing successful update/archive operations from the activity log.
*/

if (!function_exists('my_rentals_rollback_current_user')) {
    function my_rentals_rollback_current_user(\Illuminate\Http\Request $request): ?\App\Models\User
    {
        if (function_exists('my_rentals_activity_current_user')) {
            return my_rentals_activity_current_user($request);
        }

        if (function_exists('my_rentals_ed_current_user')) {
            return my_rentals_ed_current_user($request);
        }

        if (function_exists('my_rentals_current_user_for_scope')) {
            return my_rentals_current_user_for_scope($request);
        }

        if (function_exists('my_rentals_bearer_user')) {
            return my_rentals_bearer_user($request);
        }

        return null;
    }
}

if (!function_exists('my_rentals_rollback_is_admin')) {
    function my_rentals_rollback_is_admin(?\App\Models\User $user): bool
    {
        if (function_exists('my_rentals_activity_is_admin')) {
            return my_rentals_activity_is_admin($user);
        }

        if (function_exists('my_rentals_ed_is_admin')) {
            return my_rentals_ed_is_admin($user);
        }

        if (!$user) {
            return true;
        }

        if (function_exists('my_rentals_is_admin_user')) {
            return my_rentals_is_admin_user($user);
        }

        return in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);
    }
}

if (!function_exists('my_rentals_rollback_clean_payload')) {
    function my_rentals_rollback_clean_payload(array $payload, string $table): array
    {
        $columns = \Illuminate\Support\Facades\Schema::getColumnListing($table);
        $blocked = ['id', 'created_at', 'updated_at', 'deleted_at'];
        $clean = [];

        foreach ($payload as $key => $value) {
            if (in_array($key, $columns, true) && !in_array($key, $blocked, true)) {
                $clean[$key] = $value;
            }
        }

        return $clean;
    }
}

if (!function_exists('my_rentals_rollback_changed_fields')) {
    function my_rentals_rollback_changed_fields(?array $oldPayload, ?array $newPayload): array
    {
        if (!$oldPayload || !$newPayload) {
            return [];
        }

        $fields = [];

        foreach ($newPayload as $key => $newValue) {
            $oldValue = $oldPayload[$key] ?? null;

            if ((string) ($oldValue ?? '') !== (string) ($newValue ?? '')) {
                $fields[] = $key;
            }
        }

        return $fields;
    }
}

Route::post('/activity-logs/{activityLog}/rollback', function (
    \App\Models\ActivityLog $activityLog,
    \Illuminate\Http\Request $request
) {
    if (!function_exists('my_rentals_ed_resource_config')) {
        return response()->json(['message' => 'يجب تثبيت مركز التعديل والحذف أولاً.'], 422);
    }

    if (!in_array($activityLog->action, ['update', 'archive'], true)) {
        return response()->json([
            'message' => 'التراجع متاح فقط لعمليات التعديل أو الأرشفة. للحذف استخدم سلة المحذوفات.',
        ], 422);
    }

    $oldPayload = $activityLog->old_payload ?: [];
    $newPayload = $activityLog->new_payload ?: [];

    if (empty($oldPayload) || empty($activityLog->resource) || empty($activityLog->record_id)) {
        return response()->json(['message' => 'لا توجد بيانات كافية للتراجع عن هذه العملية.'], 422);
    }

    $user = my_rentals_rollback_current_user($request);

    if ($user && !my_rentals_rollback_is_admin($user) && (int) $activityLog->owner_id !== (int) $user->owner_id) {
        return response()->json(['message' => 'لا تملك صلاحية التراجع عن هذه العملية.'], 403);
    }

    $config = my_rentals_ed_resource_config($activityLog->resource);

    if (!$config) {
        return response()->json(['message' => 'تعذر تحديد نوع السجل للتراجع.'], 422);
    }

    $model = $config['model'];

    $query = $model::query();

    if (function_exists('my_rentals_ed_apply_scope')) {
        $query = my_rentals_ed_apply_scope($query, $activityLog->resource, $config, $user);
    }

    $record = $query->where('id', $activityLog->record_id)->first();

    if (!$record) {
        return response()->json([
            'message' => 'السجل غير موجود حاليًا أو لا تملك صلاحية تعديله. إن كان محذوفًا استخدم سلة المحذوفات.',
        ], 404);
    }

    $currentBeforeRollback = $record->getAttributes();
    $updates = my_rentals_rollback_clean_payload($oldPayload, $config['table']);

    if (empty($updates)) {
        return response()->json(['message' => 'لا توجد حقول صالحة للاستعادة.'], 422);
    }

    try {
        \Illuminate\Support\Facades\DB::transaction(function () use (
            $record,
            $updates,
            $activityLog,
            $config,
            $user,
            $currentBeforeRollback,
            $oldPayload,
            $newPayload
        ) {
            $record->fill($updates);
            $record->save();

            $fresh = $record->fresh();

            if (function_exists('my_rentals_activity_log_action')) {
                my_rentals_activity_log_action(
                    'rollback',
                    $activityLog->resource,
                    $config,
                    $fresh->id,
                    function_exists('my_rentals_activity_record_title')
                        ? my_rentals_activity_record_title($fresh, $config)
                        : ($activityLog->record_title ?: ('#' . $fresh->id)),
                    $currentBeforeRollback,
                    $fresh->getAttributes(),
                    $user,
                    function_exists('my_rentals_activity_owner_id_for_record')
                        ? my_rentals_activity_owner_id_for_record($activityLog->resource, $fresh)
                        : $activityLog->owner_id,
                    [
                        'source' => 'activity_log_rollback',
                        'rollback_of_log_id' => $activityLog->id,
                        'rollback_of_action' => $activityLog->action,
                        'changed_fields' => my_rentals_rollback_changed_fields($oldPayload, $newPayload),
                    ]
                );
            }
        });
    } catch (\Throwable $e) {
        return response()->json([
            'message' => 'تعذر التراجع عن العملية.',
            'error' => $e->getMessage(),
        ], 422);
    }

    return response()->json([
        'status' => 'ok',
        'message' => 'تم التراجع عن العملية واستعادة القيم السابقة',
    ]);
});

Route::post('/my/activity-logs/{activityLog}/rollback', function (
    \App\Models\ActivityLog $activityLog,
    \Illuminate\Http\Request $request
) {
    return app('router')->getRoutes()->match(
        \Illuminate\Http\Request::create(
            '/api/activity-logs/' . $activityLog->id . '/rollback',
            'POST',
            $request->all(),
            [],
            [],
            ['HTTP_AUTHORIZATION' => $request->header('Authorization')]
        )
    )->run();
});


/*
|--------------------------------------------------------------------------
| Card History / Record Activity Filters
|--------------------------------------------------------------------------
| Adds record_id filtering for activity logs so each card can show its own history.
*/

Route::get('/activity-logs', function (\Illuminate\Http\Request $request) {
    if (!class_exists(\App\Models\ActivityLog::class) || !\Illuminate\Support\Facades\Schema::hasTable('activity_logs')) {
        return [];
    }

    $query = \App\Models\ActivityLog::query();

    if ($request->query('action')) {
        $query->where('action', $request->query('action'));
    }

    if ($request->query('resource')) {
        $query->where('resource', $request->query('resource'));
    }

    if ($request->query('record_id')) {
        $query->where('record_id', (int) $request->query('record_id'));
    }

    if (function_exists('my_rentals_activity_payload')) {
        return my_rentals_activity_payload($query);
    }

    return $query->orderByDesc('created_at')->limit(300)->get();
});

Route::get('/my/activity-logs', function (\Illuminate\Http\Request $request) {
    if (!class_exists(\App\Models\ActivityLog::class) || !\Illuminate\Support\Facades\Schema::hasTable('activity_logs')) {
        return [];
    }

    $user = function_exists('my_rentals_activity_current_user')
        ? my_rentals_activity_current_user($request)
        : null;

    if (!$user && function_exists('my_rentals_ed_current_user')) {
        $user = my_rentals_ed_current_user($request);
    }

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $query = \App\Models\ActivityLog::query();

    $isAdmin = function_exists('my_rentals_activity_is_admin')
        ? my_rentals_activity_is_admin($user)
        : in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);

    if (!$isAdmin) {
        $query->where('owner_id', $user->owner_id ?: 0);
    }

    if ($request->query('action')) {
        $query->where('action', $request->query('action'));
    }

    if ($request->query('resource')) {
        $query->where('resource', $request->query('resource'));
    }

    if ($request->query('record_id')) {
        $query->where('record_id', (int) $request->query('record_id'));
    }

    if (function_exists('my_rentals_activity_payload')) {
        return my_rentals_activity_payload($query);
    }

    return $query->orderByDesc('created_at')->limit(300)->get();
});

/*
|--------------------------------------------------------------------------
| Relation Manager Add-ons
|--------------------------------------------------------------------------
| These route files were present in the project but were not loaded by api.php.
| Loading them fixes /relation-manager/* and record related-details screens.
*/
$relationRoutes = [
    __DIR__ . '/relation_manager_routes.php',
    __DIR__ . '/relation_related_routes.php',
];

foreach ($relationRoutes as $relationRouteFile) {
    if (is_file($relationRouteFile)) {
        require $relationRouteFile;
    }
}
