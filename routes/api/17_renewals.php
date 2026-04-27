<?php

// PHASE2_ROUTE_MODULES: generated from routes/api.php on 2026-04-27-083758.
// Section: Contract Renewals

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
| Contract Renewals
|--------------------------------------------------------------------------
*/

if (!function_exists('my_rentals_contract_renewal_query')) {
    function my_rentals_contract_renewal_query()
    {
        $today = now()->toDateString();
        $until = now()->addDays(90)->toDateString();

        return \App\Models\Contract::with([
                'tenant',
                'unit.property.owner',
                'payments' => function ($query) {
                    $query->orderBy('due_date');
                },
            ])
            ->where(function ($query) use ($today, $until) {
                $query->whereBetween('end_date', [$today, $until])
                    ->orWhere('status', 'ended')
                    ->orWhereDate('end_date', '<', $today);
            })
            ->orderBy('end_date')
            ->orderBy('id', 'desc');
    }
}

if (!function_exists('my_rentals_contract_renewal_payload')) {
    function my_rentals_contract_renewal_payload($query)
    {
        return $query->get()->map(function ($contract) {
            $endDate = $contract->end_date ? \Carbon\Carbon::parse($contract->end_date) : null;
            $daysToEnd = $endDate ? now()->startOfDay()->diffInDays($endDate, false) : null;

            $payments = $contract->payments ?? collect();

            return [
                'id' => $contract->id,
                'contract_number' => $contract->government_contract_number ?: $contract->contract_number,
                'status' => $contract->status,
                'start_date' => $contract->start_date,
                'end_date' => $contract->end_date,
                'days_to_end' => $daysToEnd,
                'rent_amount' => $contract->rent_amount,
                'parking_fee' => $contract->parking_fee,
                'services_fee' => $contract->services_fee,
                'deposit_amount' => $contract->deposit_amount,
                'payment_cycle' => $contract->payment_cycle,
                'tenant' => $contract->tenant,
                'unit' => $contract->unit,
                'summary' => [
                    'payments_count' => $payments->count(),
                    'paid_amount' => (float) $payments->where('status', 'paid')->sum('amount'),
                    'due_amount' => (float) $payments->where('status', 'due')->sum('amount'),
                    'overdue_amount' => (float) $payments->where('status', 'overdue')->sum('amount'),
                ],
            ];
        })->values();
    }
}

Route::get('/contract-renewals', function () {
    return my_rentals_contract_renewal_payload(my_rentals_contract_renewal_query());
});

Route::get('/my/contract-renewals', function (\Illuminate\Http\Request $request) {
    $user = function_exists('my_rentals_current_user_for_scope')
        ? my_rentals_current_user_for_scope($request)
        : (function_exists('my_rentals_bearer_user') ? my_rentals_bearer_user($request) : null);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $isAdmin = function_exists('my_rentals_is_admin_user')
        ? my_rentals_is_admin_user($user)
        : in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);

    $query = my_rentals_contract_renewal_query();

    if (!$isAdmin) {
        if (!$user->owner_id) {
            return [];
        }

        $propertyIds = \App\Models\Property::where('owner_id', $user->owner_id)->pluck('id');

        $query->whereHas('unit', function ($q) use ($propertyIds) {
            $q->whereIn('property_id', $propertyIds);
        });
    }

    return my_rentals_contract_renewal_payload($query);
});

Route::post('/contracts/{contract}/renew', function (\App\Models\Contract $contract, Request $request) {
    $data = $request->validate([
        'start_date' => ['nullable', 'date'],
        'end_date' => ['required', 'date'],
        'rent_amount' => ['nullable', 'numeric', 'min:0'],
        'parking_fee' => ['nullable', 'numeric', 'min:0'],
        'services_fee' => ['nullable', 'numeric', 'min:0'],
        'deposit_amount' => ['nullable', 'numeric', 'min:0'],
        'payment_cycle' => ['nullable', 'string', 'max:50'],
        'payments_count' => ['nullable', 'integer', 'min:1', 'max:120'],
        'close_old_contract' => ['nullable', 'boolean'],
        'notes' => ['nullable', 'string'],
    ]);

    $oldEndDate = $contract->end_date
        ? \Carbon\Carbon::parse($contract->end_date)
        : now();

    $startDate = !empty($data['start_date'])
        ? \Carbon\Carbon::parse($data['start_date'])
        : $oldEndDate->copy()->addDay();

    $endDate = \Carbon\Carbon::parse($data['end_date']);

    if ($endDate->lt($startDate)) {
        return response()->json([
            'message' => 'تاريخ نهاية التجديد يجب أن يكون بعد تاريخ البداية.',
        ], 422);
    }

    $newContract = \App\Models\Contract::create([
        'tenant_id' => $contract->tenant_id,
        'unit_id' => $contract->unit_id,
        'parking_spot_id' => $contract->parking_spot_id ?? null,
        'contract_number' => 'REN-' . $contract->id . '-' . now()->format('YmdHis'),
        'government_contract_number' => null,
        'start_date' => $startDate->toDateString(),
        'end_date' => $endDate->toDateString(),
        'rent_amount' => $data['rent_amount'] ?? $contract->rent_amount ?? 0,
        'parking_fee' => $data['parking_fee'] ?? $contract->parking_fee ?? 0,
        'services_fee' => $data['services_fee'] ?? $contract->services_fee ?? 0,
        'deposit_amount' => $data['deposit_amount'] ?? $contract->deposit_amount ?? 0,
        'payment_cycle' => $data['payment_cycle'] ?? $contract->payment_cycle ?? 'monthly',
        'status' => 'active',
        'source' => 'renewal',
        'notes' => $data['notes'] ?? ('تجديد للعقد رقم ' . ($contract->government_contract_number ?: $contract->contract_number ?: $contract->id)),
    ]);

    if (($data['close_old_contract'] ?? true) === true) {
        $contract->update(['status' => 'ended']);
    }

    if ($newContract->unit_id) {
        \App\Models\Unit::where('id', $newContract->unit_id)->update([
            'status' => 'rented',
            'rent_amount' => $newContract->rent_amount,
        ]);
    }

    $paymentsCount = (int) ($data['payments_count'] ?? 1);
    $totalRent = (float) ($newContract->rent_amount ?? 0);
    $paymentAmount = $paymentsCount > 0 ? round($totalRent / $paymentsCount, 2) : $totalRent;
    $cycle = $newContract->payment_cycle ?: 'monthly';

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

        \App\Models\Payment::create([
            'contract_id' => $newContract->id,
            'amount' => $paymentAmount,
            'due_date' => $dueDate->toDateString(),
            'status' => 'due',
            'notes' => 'دفعة منشأة تلقائيًا من تجديد العقد',
        ]);
    }

    return response()->json([
        'status' => 'ok',
        'message' => 'تم تجديد العقد وإنشاء الدفعات بنجاح',
        'old_contract' => $contract->fresh()->load(['tenant', 'unit.property.owner']),
        'new_contract' => $newContract->fresh()->load(['tenant', 'unit.property.owner', 'payments']),
    ], 201);
});


/*
|--------------------------------------------------------------------------
| Activity Feed
|--------------------------------------------------------------------------
| Non-destructive activity feed built from recent records.
*/

if (!function_exists('my_rentals_activity_add')) {
    function my_rentals_activity_add(array &$items, string $type, string $title, ?string $subtitle, $date, array $meta = []): void
    {
        if (!$date) {
            $date = now();
        }

        try {
            $carbon = $date instanceof \Carbon\Carbon ? $date : \Carbon\Carbon::parse($date);
        } catch (\Throwable $e) {
            $carbon = now();
        }

        $items[] = [
            'type' => $type,
            'title' => $title,
            'subtitle' => $subtitle,
            'happened_at' => $carbon->toDateTimeString(),
            'date_label' => $carbon->format('Y-m-d H:i'),
            'meta' => $meta,
        ];
    }
}

if (!function_exists('my_rentals_activity_payload')) {
    function my_rentals_activity_payload(?\App\Models\User $user = null): array
    {
        $isAdmin = true;
        $ownerId = null;

        if ($user) {
            $ownerId = $user->owner_id ?? null;
            $isAdmin = function_exists('my_rentals_is_admin_user')
                ? my_rentals_is_admin_user($user)
                : in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);
        }

        $items = [];

        $propertyQuery = \App\Models\Property::with('owner');
        if (!$isAdmin) {
            if (!$ownerId) {
                return [];
            }
            $propertyQuery->where('owner_id', $ownerId);
        }

        $properties = $propertyQuery->orderBy('created_at', 'desc')->limit(40)->get();
        $propertyIds = $properties->pluck('id');

        foreach ($properties as $property) {
            my_rentals_activity_add(
                $items,
                'property',
                'تم إضافة / تحديث عقار',
                ($property->name ?: 'عقار') . ' — ' . ($property->owner?->name ?: 'مالك غير محدد'),
                $property->updated_at ?: $property->created_at,
                [
                    'property_id' => $property->id,
                    'owner_id' => $property->owner_id,
                    'city' => $property->city,
                    'district' => $property->district,
                ]
            );
        }

        $unitQuery = \App\Models\Unit::with('property.owner');
        if (!$isAdmin) {
            $unitQuery->whereIn('property_id', $propertyIds);
        }

        $units = $unitQuery->orderBy('created_at', 'desc')->limit(40)->get();
        $unitIds = $units->pluck('id');

        foreach ($units as $unit) {
            my_rentals_activity_add(
                $items,
                'unit',
                'تم إضافة / تحديث وحدة',
                ($unit->property?->name ?: 'عقار') . ' — ' . ($unit->unit_number ?: 'وحدة'),
                $unit->updated_at ?: $unit->created_at,
                [
                    'unit_id' => $unit->id,
                    'property_id' => $unit->property_id,
                    'status' => $unit->status,
                ]
            );
        }

        $contractQuery = \App\Models\Contract::with(['tenant', 'unit.property.owner']);
        if (!$isAdmin) {
            $contractQuery->whereIn('unit_id', $unitIds);
        }

        $contracts = $contractQuery->orderBy('created_at', 'desc')->limit(40)->get();
        $contractIds = $contracts->pluck('id');

        foreach ($contracts as $contract) {
            my_rentals_activity_add(
                $items,
                'contract',
                'تم إنشاء / تحديث عقد',
                'عقد #' . ($contract->government_contract_number ?: $contract->contract_number ?: $contract->id) . ' — ' . ($contract->tenant?->name ?: 'مستأجر'),
                $contract->updated_at ?: $contract->created_at,
                [
                    'contract_id' => $contract->id,
                    'status' => $contract->status,
                    'property_name' => $contract->unit?->property?->name,
                    'unit_number' => $contract->unit?->unit_number,
                ]
            );
        }

        $paymentQuery = \App\Models\Payment::with(['contract.tenant', 'contract.unit.property.owner']);
        if (!$isAdmin) {
            $paymentQuery->whereIn('contract_id', $contractIds);
        }

        $payments = $paymentQuery->orderBy('updated_at', 'desc')->limit(50)->get();

        foreach ($payments as $payment) {
            $status = $payment->status === 'paid' ? 'مدفوعة' : ($payment->status === 'overdue' ? 'متأخرة' : 'مستحقة');

            my_rentals_activity_add(
                $items,
                'payment',
                'تحديث دفعة',
                $status . ' — ' . number_format((float) ($payment->amount ?? 0), 0) . ' ريال — ' . ($payment->contract?->tenant?->name ?: 'مستأجر'),
                $payment->updated_at ?: $payment->created_at,
                [
                    'payment_id' => $payment->id,
                    'status' => $payment->status,
                    'due_date' => $payment->due_date,
                    'amount' => $payment->amount,
                ]
            );
        }

        if (class_exists(\App\Models\Tenant::class)) {
            $tenantQuery = \App\Models\Tenant::query();

            if (!$isAdmin) {
                $tenantQuery->whereHas('contracts', function ($query) use ($unitIds) {
                    $query->whereIn('unit_id', $unitIds);
                });
            }

            foreach ($tenantQuery->orderBy('created_at', 'desc')->limit(30)->get() as $tenant) {
                my_rentals_activity_add(
                    $items,
                    'tenant',
                    'تم إضافة / تحديث مستأجر',
                    $tenant->name ?: 'مستأجر',
                    $tenant->updated_at ?: $tenant->created_at,
                    [
                        'tenant_id' => $tenant->id,
                        'phone' => $tenant->phone,
                    ]
                );
            }
        }

        if (class_exists(\App\Models\PropertyExpense::class) && \Illuminate\Support\Facades\Schema::hasTable('property_expenses')) {
            $expenseQuery = \App\Models\PropertyExpense::with(['property.owner', 'category']);

            if (!$isAdmin) {
                $expenseQuery->whereIn('property_id', $propertyIds);
            }

            foreach ($expenseQuery->orderBy('updated_at', 'desc')->limit(40)->get() as $expense) {
                my_rentals_activity_add(
                    $items,
                    'expense',
                    'تم إضافة / تحديث مصروف',
                    number_format((float) ($expense->amount ?? 0), 0) . ' ريال — ' . ($expense->property?->name ?: 'عقار') . ' — ' . ($expense->category?->name ?: 'مصروف'),
                    $expense->updated_at ?: $expense->created_at,
                    [
                        'expense_id' => $expense->id,
                        'property_id' => $expense->property_id,
                        'amount' => $expense->amount,
                    ]
                );
            }
        }

        if (class_exists(\App\Models\MaintenanceRequest::class) && \Illuminate\Support\Facades\Schema::hasTable('maintenance_requests')) {
            $maintenanceQuery = \App\Models\MaintenanceRequest::with(['property.owner', 'unit', 'tenant']);

            if (!$isAdmin) {
                $maintenanceQuery->whereIn('property_id', $propertyIds);
            }

            foreach ($maintenanceQuery->orderBy('updated_at', 'desc')->limit(40)->get() as $maintenance) {
                my_rentals_activity_add(
                    $items,
                    'maintenance',
                    'طلب صيانة',
                    ($maintenance->title ?: 'طلب صيانة') . ' — ' . ($maintenance->property?->name ?: 'عقار') . ' — ' . ($maintenance->status ?: 'open'),
                    $maintenance->updated_at ?: $maintenance->created_at,
                    [
                        'maintenance_request_id' => $maintenance->id,
                        'status' => $maintenance->status,
                        'priority' => $maintenance->priority,
                    ]
                );
            }
        }

        if (class_exists(\App\Models\ParkingSpot::class) && \Illuminate\Support\Facades\Schema::hasTable('parking_spots')) {
            $parkingQuery = \App\Models\ParkingSpot::with(['property.owner']);

            if (!$isAdmin) {
                $parkingQuery->whereIn('property_id', $propertyIds);
            }

            foreach ($parkingQuery->orderBy('updated_at', 'desc')->limit(40)->get() as $spot) {
                my_rentals_activity_add(
                    $items,
                    'parking',
                    'تحديث موقف',
                    ($spot->spot_number ?: 'موقف') . ' — ' . ($spot->property?->name ?: 'عقار') . ' — ' . ($spot->status ?: 'available'),
                    $spot->updated_at ?: $spot->created_at,
                    [
                        'parking_spot_id' => $spot->id,
                        'status' => $spot->status,
                        'monthly_fee' => $spot->monthly_fee,
                    ]
                );
            }
        }

        usort($items, function ($a, $b) {
            return strcmp($b['happened_at'], $a['happened_at']);
        });

        return array_slice($items, 0, 120);
    }
}

Route::get('/activity-feed', function () {
    return my_rentals_activity_payload(null);
});

Route::get('/my/activity-feed', function (\Illuminate\Http\Request $request) {
    $user = function_exists('my_rentals_current_user_for_scope')
        ? my_rentals_current_user_for_scope($request)
        : (function_exists('my_rentals_bearer_user') ? my_rentals_bearer_user($request) : null);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    return my_rentals_activity_payload($user);
});


/*
|--------------------------------------------------------------------------
| Data Health Checks
|--------------------------------------------------------------------------
| Read-only checks to discover incomplete or inconsistent records.
*/

if (!function_exists('my_rentals_data_health_payload')) {
    function my_rentals_data_health_payload(?\App\Models\User $user = null): array
    {
        $isAdmin = true;
        $ownerId = null;

        if ($user) {
            $ownerId = $user->owner_id ?? null;
            $isAdmin = function_exists('my_rentals_is_admin_user')
                ? my_rentals_is_admin_user($user)
                : in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);
        }

        $propertyQuery = \App\Models\Property::with('owner')->orderBy('id', 'desc');

        if (!$isAdmin) {
            if (!$ownerId) {
                return [
                    'summary' => [
                        'score' => 100,
                        'issues_count' => 0,
                        'warnings_count' => 0,
                        'checks_count' => 0,
                    ],
                    'checks' => [],
                ];
            }

            $propertyQuery->where('owner_id', $ownerId);
        }

        $properties = $propertyQuery->get();
        $propertyIds = $properties->pluck('id');

        $units = \App\Models\Unit::with('property.owner')
            ->whereIn('property_id', $propertyIds)
            ->orderBy('id', 'desc')
            ->get();

        $unitIds = $units->pluck('id');

        $contracts = \App\Models\Contract::with(['tenant', 'unit.property.owner'])
            ->whereIn('unit_id', $unitIds)
            ->orderBy('id', 'desc')
            ->get();

        $contractIds = $contracts->pluck('id');

        $payments = \App\Models\Payment::with(['contract.tenant', 'contract.unit.property.owner'])
            ->whereIn('contract_id', $contractIds)
            ->orderBy('due_date')
            ->get();

        $checks = [];

        $pushCheck = function (string $key, string $title, string $severity, $items) use (&$checks) {
            $items = collect($items)->values();

            $checks[] = [
                'key' => $key,
                'title' => $title,
                'severity' => $severity,
                'count' => $items->count(),
                'items' => $items->take(30)->values(),
            ];
        };

        $propertiesWithoutUnits = $properties->filter(function ($property) use ($units) {
            return $units->where('property_id', $property->id)->count() === 0;
        })->map(function ($property) {
            return [
                'id' => $property->id,
                'name' => $property->name,
                'owner_name' => $property->owner?->name,
                'city' => $property->city,
                'district' => $property->district,
                'message' => 'العقار لا يحتوي على أي وحدة.',
            ];
        });

        $pushCheck(
            'properties_without_units',
            'عقارات بدون وحدات',
            'warning',
            $propertiesWithoutUnits
        );

        $unitsMissingBasics = $units->filter(function ($unit) {
            return empty($unit->unit_number)
                || (int) ($unit->rooms_count ?? 0) === 0
                || (int) ($unit->bathrooms_count ?? 0) === 0;
        })->map(function ($unit) {
            return [
                'id' => $unit->id,
                'unit_number' => $unit->unit_number,
                'property_name' => $unit->property?->name,
                'rooms_count' => $unit->rooms_count,
                'bathrooms_count' => $unit->bathrooms_count,
                'message' => 'الوحدة ناقصة رقم أو عدد غرف/حمامات.',
            ];
        });

        $pushCheck(
            'units_missing_basics',
            'وحدات ناقصة البيانات الأساسية',
            'warning',
            $unitsMissingBasics
        );

        $activeContractUnitIds = $contracts
            ->where('status', 'active')
            ->pluck('unit_id')
            ->filter()
            ->unique();

        $rentedWithoutActiveContract = $units->filter(function ($unit) use ($activeContractUnitIds) {
            return ($unit->status === 'rented') && !$activeContractUnitIds->contains($unit->id);
        })->map(function ($unit) {
            return [
                'id' => $unit->id,
                'unit_number' => $unit->unit_number,
                'property_name' => $unit->property?->name,
                'status' => $unit->status,
                'message' => 'الوحدة حالتها مؤجرة لكن لا يوجد عقد نشط مرتبط بها.',
            ];
        });

        $pushCheck(
            'rented_units_without_active_contract',
            'وحدات مؤجرة بدون عقد نشط',
            'issue',
            $rentedWithoutActiveContract
        );

        $activeContractEnded = $contracts->filter(function ($contract) {
            if ($contract->status !== 'active' || !$contract->end_date) {
                return false;
            }

            return \Carbon\Carbon::parse($contract->end_date)->lt(now()->startOfDay());
        })->map(function ($contract) {
            return [
                'id' => $contract->id,
                'contract_number' => $contract->government_contract_number ?: $contract->contract_number ?: $contract->id,
                'tenant_name' => $contract->tenant?->name,
                'property_name' => $contract->unit?->property?->name,
                'unit_number' => $contract->unit?->unit_number,
                'end_date' => $contract->end_date,
                'message' => 'العقد نشط لكن تاريخ نهايته مضى.',
            ];
        });

        $pushCheck(
            'active_contracts_past_end_date',
            'عقود نشطة منتهية التاريخ',
            'issue',
            $activeContractEnded
        );

        $paymentsPastDueStillDue = $payments->filter(function ($payment) {
            if ($payment->status !== 'due' || !$payment->due_date) {
                return false;
            }

            return \Carbon\Carbon::parse($payment->due_date)->lt(now()->startOfDay());
        })->map(function ($payment) {
            return [
                'id' => $payment->id,
                'amount' => $payment->amount,
                'due_date' => $payment->due_date,
                'tenant_name' => $payment->contract?->tenant?->name,
                'property_name' => $payment->contract?->unit?->property?->name,
                'unit_number' => $payment->contract?->unit?->unit_number,
                'message' => 'الدفعة تاريخها مضى وما زالت حالتها مستحقة بدل متأخرة.',
            ];
        });

        $pushCheck(
            'payments_past_due_still_due',
            'دفعات يفترض تحويلها إلى متأخرة',
            'issue',
            $paymentsPastDueStillDue
        );

        $tenantsMissingPhone = \App\Models\Tenant::query()
            ->where(function ($query) {
                $query->whereNull('phone')->orWhere('phone', '');
            })
            ->when(!$isAdmin, function ($query) use ($unitIds) {
                $query->whereHas('contracts', function ($q) use ($unitIds) {
                    $q->whereIn('unit_id', $unitIds);
                });
            })
            ->orderBy('id', 'desc')
            ->get()
            ->map(function ($tenant) {
                return [
                    'id' => $tenant->id,
                    'name' => $tenant->name,
                    'national_id' => $tenant->national_id,
                    'message' => 'المستأجر لا يحتوي على رقم جوال.',
                ];
            });

        $pushCheck(
            'tenants_missing_phone',
            'مستأجرون بدون رقم جوال',
            'warning',
            $tenantsMissingPhone
        );

        $contractsWithoutPayments = $contracts->filter(function ($contract) use ($payments) {
            return $payments->where('contract_id', $contract->id)->count() === 0;
        })->map(function ($contract) {
            return [
                'id' => $contract->id,
                'contract_number' => $contract->government_contract_number ?: $contract->contract_number ?: $contract->id,
                'tenant_name' => $contract->tenant?->name,
                'property_name' => $contract->unit?->property?->name,
                'unit_number' => $contract->unit?->unit_number,
                'message' => 'العقد لا يحتوي على دفعات.',
            ];
        });

        $pushCheck(
            'contracts_without_payments',
            'عقود بدون دفعات',
            'issue',
            $contractsWithoutPayments
        );

        $issuesCount = collect($checks)
            ->where('severity', 'issue')
            ->sum('count');

        $warningsCount = collect($checks)
            ->where('severity', 'warning')
            ->sum('count');

        $checksCount = collect($checks)->sum('count');
        $score = max(0, 100 - ($issuesCount * 10) - ($warningsCount * 3));

        return [
            'summary' => [
                'score' => $score,
                'issues_count' => $issuesCount,
                'warnings_count' => $warningsCount,
                'checks_count' => $checksCount,
                'properties_count' => $properties->count(),
                'units_count' => $units->count(),
                'contracts_count' => $contracts->count(),
                'payments_count' => $payments->count(),
            ],
            'checks' => $checks,
        ];
    }
}

Route::get('/data-health', function () {
    return my_rentals_data_health_payload(null);
});

Route::get('/my/data-health', function (\Illuminate\Http\Request $request) {
    $user = function_exists('my_rentals_current_user_for_scope')
        ? my_rentals_current_user_for_scope($request)
        : (function_exists('my_rentals_bearer_user') ? my_rentals_bearer_user($request) : null);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    return my_rentals_data_health_payload($user);
});

Route::post('/data-health/fix-overdue-payments', function () {
    $updated = \App\Models\Payment::where('status', 'due')
        ->whereDate('due_date', '<', now()->toDateString())
        ->update(['status' => 'overdue']);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم تحديث الدفعات المتأخرة',
        'updated_count' => $updated,
    ]);
});
