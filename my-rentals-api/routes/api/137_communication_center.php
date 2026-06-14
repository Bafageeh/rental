<?php

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (is_file(__DIR__ . '/130_manager_data_scope.php')) require_once __DIR__ . '/130_manager_data_scope.php';

if (!function_exists('mr_comm_role')) {
    function mr_comm_role($user): string
    {
        if (!$user) return '';
        return function_exists('mr_manager_scope_role') ? mr_manager_scope_role($user) : strtolower(trim((string) ($user->role ?? '')));
    }
}

if (!function_exists('mr_comm_is_admin')) {
    function mr_comm_is_admin($user): bool
    {
        $role = mr_comm_role($user);
        return in_array($role, ['admin', 'super_admin'], true) || (bool) ($user->is_admin ?? false);
    }
}

if (!function_exists('mr_comm_num')) {
    function mr_comm_num($value): float
    {
        if ($value === null || $value === '') return 0.0;
        return is_numeric($value) ? (float) $value : (float) str_replace(',', '', (string) $value);
    }
}

if (!function_exists('mr_comm_date')) {
    function mr_comm_date($value): ?string
    {
        $text = substr(trim((string) ($value ?? '')), 0, 10);
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $text) ? $text : null;
    }
}

if (!function_exists('mr_comm_days')) {
    function mr_comm_days(?string $date): ?int
    {
        if (!$date) return null;
        try {
            return Carbon::today()->diffInDays(Carbon::parse($date)->startOfDay(), false);
        } catch (Throwable $e) {
            return null;
        }
    }
}

if (!function_exists('mr_comm_user_owner_ids')) {
    function mr_comm_user_owner_ids(Request $request): array
    {
        $user = $request->user();
        $role = mr_comm_role($user);

        if (mr_comm_is_admin($user)) {
            return Schema::hasTable('owners') ? DB::table('owners')->pluck('id')->map(fn ($id) => (int) $id)->all() : [];
        }

        if ($role === 'manager' && function_exists('mr_manager_scope_owner_ids')) {
            return mr_manager_scope_owner_ids($request);
        }

        if (!empty($user?->owner_id)) {
            return [(int) $user->owner_id];
        }

        return [];
    }
}

if (!function_exists('mr_comm_user_property_ids')) {
    function mr_comm_user_property_ids(Request $request, array $ownerIds): array
    {
        if (!Schema::hasTable('properties')) return [];
        $user = $request->user();

        if (mr_comm_is_admin($user)) {
            return DB::table('properties')->pluck('id')->map(fn ($id) => (int) $id)->all();
        }

        if (mr_comm_role($user) === 'manager' && function_exists('mr_manager_scope_property_ids')) {
            $ids = mr_manager_scope_property_ids($request);
            if (!empty($ids)) return $ids;
        }

        if (!empty($ownerIds) && Schema::hasColumn('properties', 'owner_id')) {
            return DB::table('properties')->whereIn('owner_id', $ownerIds)->pluck('id')->map(fn ($id) => (int) $id)->all();
        }

        return [];
    }
}

if (!function_exists('mr_comm_user_unit_ids')) {
    function mr_comm_user_unit_ids(Request $request, array $propertyIds): array
    {
        if (!Schema::hasTable('units')) return [];
        $user = $request->user();

        if (mr_comm_is_admin($user)) {
            return DB::table('units')->pluck('id')->map(fn ($id) => (int) $id)->all();
        }

        if (mr_comm_role($user) === 'manager' && function_exists('mr_manager_scope_unit_ids')) {
            $ids = mr_manager_scope_unit_ids($request);
            if (!empty($ids)) return $ids;
        }

        if (!empty($propertyIds) && Schema::hasColumn('units', 'property_id')) {
            return DB::table('units')->whereIn('property_id', $propertyIds)->pluck('id')->map(fn ($id) => (int) $id)->all();
        }

        return [];
    }
}

if (!function_exists('mr_comm_user_contract_ids')) {
    function mr_comm_user_contract_ids(Request $request, array $unitIds): array
    {
        if (!Schema::hasTable('contracts')) return [];
        $user = $request->user();
        $query = DB::table('contracts');

        if (mr_comm_is_admin($user)) {
            return $query->pluck('id')->map(fn ($id) => (int) $id)->all();
        }

        if (mr_comm_role($user) === 'manager' && Schema::hasColumn('contracts', 'manager_id')) {
            $managerId = function_exists('mr_manager_scope_id') ? mr_manager_scope_id($request) : (int) ($user->id ?? 0);
            if ($managerId) $query->where('manager_id', $managerId);
        } elseif (!empty($unitIds) && Schema::hasColumn('contracts', 'unit_id')) {
            $query->whereIn('unit_id', $unitIds);
        } else {
            $query->whereRaw('1 = 0');
        }

        return $query->pluck('id')->map(fn ($id) => (int) $id)->all();
    }
}

if (!function_exists('mr_comm_payment_rows')) {
    function mr_comm_payment_rows(array $contractIds): array
    {
        if (empty($contractIds) || !Schema::hasTable('payments') || !Schema::hasTable('contracts')) return [];

        $amountCol = Schema::hasColumn('payments', 'amount') ? 'payments.amount' : '0';
        $paidCol = Schema::hasColumn('payments', 'paid_amount') ? 'payments.paid_amount' : '0';
        $dueCol = Schema::hasColumn('payments', 'due_date') ? 'payments.due_date' : DB::raw('NULL as due_date');
        $statusCol = Schema::hasColumn('payments', 'status') ? 'payments.status' : DB::raw('NULL as status');

        $query = DB::table('payments')
            ->leftJoin('contracts', 'contracts.id', '=', 'payments.contract_id')
            ->leftJoin('units', 'units.id', '=', 'contracts.unit_id')
            ->leftJoin('properties', 'properties.id', '=', 'units.property_id')
            ->leftJoin('tenants', 'tenants.id', '=', 'contracts.tenant_id')
            ->leftJoin('owners', 'owners.id', '=', 'properties.owner_id')
            ->whereIn('payments.contract_id', $contractIds);

        if (Schema::hasColumn('payments', 'paid_amount') && Schema::hasColumn('payments', 'amount')) {
            $query->whereRaw('COALESCE(payments.paid_amount,0) < COALESCE(payments.amount,0)');
        } elseif (Schema::hasColumn('payments', 'status')) {
            $query->whereNotIn('payments.status', ['paid', 'مدفوع', 'مدفوعة']);
        }

        if (Schema::hasColumn('payments', 'due_date')) {
            $query->whereDate('payments.due_date', '<=', now()->addDays(30)->toDateString());
        }

        $rows = $query->select([
                'payments.id',
                'payments.contract_id',
                DB::raw($amountCol . ' as amount'),
                DB::raw($paidCol . ' as paid_amount'),
                $dueCol,
                $statusCol,
                'contracts.contract_number',
                'contracts.government_contract_number',
                'tenants.id as tenant_id',
                'tenants.name as tenant_name',
                'tenants.phone as tenant_phone',
                'properties.name as property_name',
                'units.unit_number as unit_number',
                'owners.id as owner_id',
                'owners.name as owner_name',
                'owners.phone as owner_phone',
            ])
            ->orderByRaw('COALESCE(payments.due_date, payments.id) asc')
            ->limit(200)
            ->get();

        return $rows->map(function ($row) {
            $amount = mr_comm_num($row->amount ?? 0);
            $paid = mr_comm_num($row->paid_amount ?? 0);
            $remaining = max(0, $amount - $paid);
            $dueDate = mr_comm_date($row->due_date ?? null);
            $days = mr_comm_days($dueDate);
            $severity = $days !== null && $days < 0 ? 'late' : ($days !== null && $days <= 7 ? 'soon' : 'normal');
            $tenant = trim((string) ($row->tenant_name ?? 'المستأجر'));
            $property = trim((string) ($row->property_name ?? 'العقار'));
            $unit = trim((string) ($row->unit_number ?? '-'));
            $message = "مرحبًا {$tenant}\nنود تذكيركم بوجود دفعة إيجار مستحقة بمبلغ " . number_format($remaining ?: $amount, 0) . " ريال" . ($dueDate ? " بتاريخ {$dueDate}" : '') . "، للعقار {$property} - الوحدة {$unit}.\nشاكرين تعاونكم.";

            return [
                'id' => (int) $row->id,
                'type' => 'payment',
                'severity' => $severity,
                'title' => $severity === 'late' ? 'دفعة متأخرة' : 'تذكير سداد',
                'tenant_name' => $row->tenant_name,
                'tenant_phone' => $row->tenant_phone,
                'owner_name' => $row->owner_name,
                'owner_phone' => $row->owner_phone,
                'property_name' => $row->property_name,
                'unit_number' => $row->unit_number,
                'contract_number' => $row->government_contract_number ?: $row->contract_number,
                'amount' => $remaining ?: $amount,
                'due_date' => $dueDate,
                'status' => $row->status,
                'days' => $days,
                'message' => $message,
            ];
        })->values()->all();
    }
}

if (!function_exists('mr_comm_contract_rows')) {
    function mr_comm_contract_rows(array $contractIds): array
    {
        if (empty($contractIds) || !Schema::hasTable('contracts')) return [];
        if (!Schema::hasColumn('contracts', 'end_date')) return [];

        $rows = DB::table('contracts')
            ->leftJoin('units', 'units.id', '=', 'contracts.unit_id')
            ->leftJoin('properties', 'properties.id', '=', 'units.property_id')
            ->leftJoin('tenants', 'tenants.id', '=', 'contracts.tenant_id')
            ->whereIn('contracts.id', $contractIds)
            ->whereDate('contracts.end_date', '<=', now()->addDays(60)->toDateString())
            ->select([
                'contracts.id',
                'contracts.contract_number',
                'contracts.government_contract_number',
                'contracts.end_date',
                Schema::hasColumn('contracts', 'status') ? 'contracts.status' : DB::raw('NULL as status'),
                'tenants.name as tenant_name',
                'tenants.phone as tenant_phone',
                'properties.name as property_name',
                'units.unit_number as unit_number',
            ])
            ->orderBy('contracts.end_date')
            ->limit(100)
            ->get();

        return $rows->map(function ($row) {
            $endDate = mr_comm_date($row->end_date ?? null);
            $days = mr_comm_days($endDate);
            $severity = $days !== null && $days < 0 ? 'expired' : ($days !== null && $days <= 15 ? 'soon' : 'normal');
            $tenant = trim((string) ($row->tenant_name ?? 'المستأجر'));
            $message = "مرحبًا {$tenant}\nنود إشعاركم بأن عقد الإيجار رقم " . ($row->government_contract_number ?: $row->contract_number ?: $row->id) . ($endDate ? " ينتهي بتاريخ {$endDate}" : '') . ".\nيرجى التواصل معنا لتجديد العقد أو إنهاء الإجراءات اللازمة.";
            return [
                'id' => (int) $row->id,
                'type' => 'contract',
                'severity' => $severity,
                'title' => $severity === 'expired' ? 'عقد منتهي' : 'تجديد عقد',
                'tenant_name' => $row->tenant_name,
                'tenant_phone' => $row->tenant_phone,
                'property_name' => $row->property_name,
                'unit_number' => $row->unit_number,
                'contract_number' => $row->government_contract_number ?: $row->contract_number,
                'end_date' => $endDate,
                'status' => $row->status,
                'days' => $days,
                'message' => $message,
            ];
        })->values()->all();
    }
}

if (!function_exists('mr_comm_tenant_statements')) {
    function mr_comm_tenant_statements(array $paymentRows): array
    {
        $grouped = [];
        foreach ($paymentRows as $row) {
            $key = (string) ($row['tenant_phone'] ?: $row['tenant_name'] ?: $row['id']);
            if (!isset($grouped[$key])) {
                $grouped[$key] = [
                    'id' => count($grouped) + 1,
                    'type' => 'tenant_statement',
                    'severity' => 'normal',
                    'title' => 'كشف مستأجر',
                    'tenant_name' => $row['tenant_name'],
                    'tenant_phone' => $row['tenant_phone'],
                    'balance' => 0,
                    'overdue' => 0,
                    'message' => '',
                ];
            }
            $amount = mr_comm_num($row['amount'] ?? 0);
            $grouped[$key]['balance'] += $amount;
            if (($row['days'] ?? 0) < 0) $grouped[$key]['overdue'] += $amount;
        }

        return array_values(array_map(function ($item) {
            $name = $item['tenant_name'] ?: 'المستأجر';
            $item['message'] = "مرحبًا {$name}\nإجمالي الرصيد المستحق لديكم: " . number_format((float) $item['balance'], 0) . " ريال.\nالمتأخر الحالي: " . number_format((float) $item['overdue'], 0) . " ريال.";
            return $item;
        }, $grouped));
    }
}

if (!function_exists('mr_comm_owner_statements')) {
    function mr_comm_owner_statements(array $ownerIds, array $paymentRows): array
    {
        if (empty($ownerIds) || !Schema::hasTable('owners')) return [];
        $owners = DB::table('owners')->whereIn('id', $ownerIds)->select(['id', 'name', 'phone'])->get()->keyBy('id');
        $totals = [];
        foreach ($paymentRows as $row) {
            $ownerId = (int) ($row['owner_id'] ?? 0);
            if (!$ownerId) continue;
            $totals[$ownerId] = ($totals[$ownerId] ?? 0) + mr_comm_num($row['amount'] ?? 0);
        }

        return collect($totals)->map(function ($balance, $ownerId) use ($owners) {
            $owner = $owners->get((int) $ownerId);
            $name = $owner->name ?? 'المالك';
            return [
                'id' => (int) $ownerId,
                'type' => 'owner_statement',
                'severity' => 'normal',
                'title' => 'كشف مالك',
                'owner_name' => $name,
                'owner_phone' => $owner->phone ?? null,
                'balance' => (float) $balance,
                'message' => "مرحبًا {$name}\nيوجد رصيد أو مبالغ مرتبطة بحسابكم بقيمة " . number_format((float) $balance, 0) . " ريال.\nيمكنكم مراجعة كشف حساب المالك من التطبيق.",
            ];
        })->values()->all();
    }
}

$communicationData = function (Request $request) {
    $ownerIds = mr_comm_user_owner_ids($request);
    $propertyIds = mr_comm_user_property_ids($request, $ownerIds);
    $unitIds = mr_comm_user_unit_ids($request, $propertyIds);
    $contractIds = mr_comm_user_contract_ids($request, $unitIds);

    $paymentRows = mr_comm_payment_rows($contractIds);
    $contractRows = mr_comm_contract_rows($contractIds);
    $tenantRows = mr_comm_tenant_statements($paymentRows);
    $ownerRows = mr_comm_owner_statements($ownerIds, $paymentRows);

    return response()->json([
        'summary' => [
            'payment_reminders' => count($paymentRows),
            'contract_renewals' => count($contractRows),
            'tenant_statements' => count($tenantRows),
            'owner_statements' => count($ownerRows),
        ],
        'payment_reminders' => $paymentRows,
        'contract_renewals' => $contractRows,
        'tenant_statements' => $tenantRows,
        'owner_statements' => $ownerRows,
        'settings' => [
            'company_name' => config('app.name', 'إيجاراتي'),
            'payment_reminder_days' => 30,
            'contract_renewal_days' => 60,
        ],
    ]);
};

Route::get('/communication-center/data', $communicationData);
Route::get('/my/communication-center/data', $communicationData);
