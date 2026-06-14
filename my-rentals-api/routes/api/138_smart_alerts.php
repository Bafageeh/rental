<?php

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (is_file(__DIR__ . '/130_manager_data_scope.php')) require_once __DIR__ . '/130_manager_data_scope.php';

if (!function_exists('mr_smart_role')) {
    function mr_smart_role($user): string
    {
        if (!$user) return '';
        return function_exists('mr_manager_scope_role') ? mr_manager_scope_role($user) : strtolower(trim((string) ($user->role ?? '')));
    }
}

if (!function_exists('mr_smart_is_admin')) {
    function mr_smart_is_admin($user): bool
    {
        $role = mr_smart_role($user);
        return in_array($role, ['admin', 'super_admin'], true) || (bool) ($user->is_admin ?? false);
    }
}

if (!function_exists('mr_smart_num')) {
    function mr_smart_num($value): float
    {
        if ($value === null || $value === '') return 0.0;
        return is_numeric($value) ? (float) $value : (float) str_replace(',', '', (string) $value);
    }
}

if (!function_exists('mr_smart_money')) {
    function mr_smart_money($value): string
    {
        return number_format((float) $value, 0) . ' ريال';
    }
}

if (!function_exists('mr_smart_date')) {
    function mr_smart_date($value): ?string
    {
        $text = substr(trim((string) ($value ?? '')), 0, 10);
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $text) ? $text : null;
    }
}

if (!function_exists('mr_smart_days')) {
    function mr_smart_days(?string $date): ?int
    {
        if (!$date) return null;
        try {
            return Carbon::today()->diffInDays(Carbon::parse($date)->startOfDay(), false);
        } catch (Throwable $e) {
            return null;
        }
    }
}

if (!function_exists('mr_smart_date_label')) {
    function mr_smart_date_label(?string $date): ?string
    {
        $days = mr_smart_days($date);
        if ($days === null) return $date;
        if ($days < 0) return 'متأخر ' . abs($days) . ' يوم';
        if ($days === 0) return 'اليوم';
        return 'باقي ' . $days . ' يوم';
    }
}

if (!function_exists('mr_smart_owner_ids')) {
    function mr_smart_owner_ids(Request $request): array
    {
        $user = $request->user();
        $role = mr_smart_role($user);

        if (mr_smart_is_admin($user)) {
            return Schema::hasTable('owners') ? DB::table('owners')->pluck('id')->map(fn ($id) => (int) $id)->all() : [];
        }

        if ($role === 'manager' && function_exists('mr_manager_scope_owner_ids')) {
            return mr_manager_scope_owner_ids($request);
        }

        if (!empty($user?->owner_id)) return [(int) $user->owner_id];
        return [];
    }
}

if (!function_exists('mr_smart_property_ids')) {
    function mr_smart_property_ids(Request $request, array $ownerIds): array
    {
        if (!Schema::hasTable('properties')) return [];
        $user = $request->user();
        if (mr_smart_is_admin($user)) {
            return DB::table('properties')->pluck('id')->map(fn ($id) => (int) $id)->all();
        }
        if (mr_smart_role($user) === 'manager' && function_exists('mr_manager_scope_property_ids')) {
            $ids = mr_manager_scope_property_ids($request);
            if (!empty($ids)) return $ids;
        }
        if (!empty($ownerIds) && Schema::hasColumn('properties', 'owner_id')) {
            return DB::table('properties')->whereIn('owner_id', $ownerIds)->pluck('id')->map(fn ($id) => (int) $id)->all();
        }
        return [];
    }
}

if (!function_exists('mr_smart_unit_ids')) {
    function mr_smart_unit_ids(Request $request, array $propertyIds): array
    {
        if (!Schema::hasTable('units')) return [];
        $user = $request->user();
        if (mr_smart_is_admin($user)) {
            return DB::table('units')->pluck('id')->map(fn ($id) => (int) $id)->all();
        }
        if (mr_smart_role($user) === 'manager' && function_exists('mr_manager_scope_unit_ids')) {
            $ids = mr_manager_scope_unit_ids($request);
            if (!empty($ids)) return $ids;
        }
        if (!empty($propertyIds) && Schema::hasColumn('units', 'property_id')) {
            return DB::table('units')->whereIn('property_id', $propertyIds)->pluck('id')->map(fn ($id) => (int) $id)->all();
        }
        return [];
    }
}

if (!function_exists('mr_smart_contract_ids')) {
    function mr_smart_contract_ids(Request $request, array $unitIds): array
    {
        if (!Schema::hasTable('contracts')) return [];
        $user = $request->user();
        $query = DB::table('contracts');
        if (mr_smart_is_admin($user)) {
            return $query->pluck('id')->map(fn ($id) => (int) $id)->all();
        }
        if (mr_smart_role($user) === 'manager' && Schema::hasColumn('contracts', 'manager_id')) {
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

if (!function_exists('mr_smart_payment_alerts')) {
    function mr_smart_payment_alerts(array $contractIds): array
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
            ->whereIn('payments.contract_id', $contractIds);

        if (Schema::hasColumn('payments', 'paid_amount') && Schema::hasColumn('payments', 'amount')) {
            $query->whereRaw('COALESCE(payments.paid_amount,0) < COALESCE(payments.amount,0)');
        } elseif (Schema::hasColumn('payments', 'status')) {
            $query->whereNotIn('payments.status', ['paid', 'مدفوع', 'مدفوعة']);
        }
        if (Schema::hasColumn('payments', 'due_date')) {
            $query->whereDate('payments.due_date', '<=', now()->addDays(30)->toDateString());
        }

        return $query->select([
                'payments.id', DB::raw($amountCol . ' as amount'), DB::raw($paidCol . ' as paid_amount'), $dueCol, $statusCol,
                'properties.name as property_name', 'units.unit_number as unit_number', 'tenants.name as tenant_name'
            ])
            ->orderByRaw('COALESCE(payments.due_date, payments.id) asc')
            ->limit(100)
            ->get()
            ->map(function ($row) {
                $amount = mr_smart_num($row->amount ?? 0);
                $paid = mr_smart_num($row->paid_amount ?? 0);
                $remaining = max(0, $amount - $paid) ?: $amount;
                $date = mr_smart_date($row->due_date ?? null);
                $days = mr_smart_days($date);
                $severity = $days !== null && $days < 0 ? 'critical' : 'warning';
                return [
                    'type' => 'payment',
                    'severity' => $severity,
                    'title' => $severity === 'critical' ? 'دفعة إيجار متأخرة' : 'دفعة إيجار قريبة',
                    'subtitle' => trim(($row->tenant_name ? 'المستأجر: ' . $row->tenant_name . ' - ' : '') . 'المبلغ: ' . mr_smart_money($remaining)),
                    'alert_date' => $date,
                    'date_label' => mr_smart_date_label($date),
                    'meta' => [
                        'العقار' => $row->property_name ?: '-',
                        'الوحدة' => $row->unit_number ?: '-',
                        'الحالة' => $row->status ?: '-',
                    ],
                ];
            })->values()->all();
    }
}

if (!function_exists('mr_smart_contract_alerts')) {
    function mr_smart_contract_alerts(array $contractIds): array
    {
        if (empty($contractIds) || !Schema::hasTable('contracts') || !Schema::hasColumn('contracts', 'end_date')) return [];
        return DB::table('contracts')
            ->leftJoin('units', 'units.id', '=', 'contracts.unit_id')
            ->leftJoin('properties', 'properties.id', '=', 'units.property_id')
            ->leftJoin('tenants', 'tenants.id', '=', 'contracts.tenant_id')
            ->whereIn('contracts.id', $contractIds)
            ->whereDate('contracts.end_date', '<=', now()->addDays(60)->toDateString())
            ->select([
                'contracts.id', 'contracts.end_date', 'contracts.contract_number', 'contracts.government_contract_number',
                Schema::hasColumn('contracts', 'status') ? 'contracts.status' : DB::raw('NULL as status'),
                'properties.name as property_name', 'units.unit_number as unit_number', 'tenants.name as tenant_name'
            ])
            ->orderBy('contracts.end_date')
            ->limit(100)
            ->get()
            ->map(function ($row) {
                $date = mr_smart_date($row->end_date ?? null);
                $days = mr_smart_days($date);
                $severity = $days !== null && $days < 0 ? 'critical' : 'warning';
                return [
                    'type' => 'contract',
                    'severity' => $severity,
                    'title' => $severity === 'critical' ? 'عقد منتهي' : 'عقد قريب الانتهاء',
                    'subtitle' => ($row->tenant_name ? 'المستأجر: ' . $row->tenant_name : 'عقد يحتاج متابعة'),
                    'alert_date' => $date,
                    'date_label' => mr_smart_date_label($date),
                    'meta' => [
                        'رقم العقد' => $row->government_contract_number ?: ($row->contract_number ?: $row->id),
                        'العقار' => $row->property_name ?: '-',
                        'الوحدة' => $row->unit_number ?: '-',
                        'الحالة' => $row->status ?: '-',
                    ],
                ];
            })->values()->all();
    }
}

if (!function_exists('mr_smart_document_alerts')) {
    function mr_smart_document_alerts(array $propertyIds): array
    {
        if (empty($propertyIds) || !Schema::hasTable('properties')) return [];
        $query = DB::table('properties')->whereIn('id', $propertyIds);
        if (Schema::hasColumn('properties', 'deed_file_path')) {
            $query->where(function ($q) {
                $q->whereNull('deed_file_path')->orWhere('deed_file_path', '');
            });
        } elseif (Schema::hasColumn('properties', 'deed_pdf_path')) {
            $query->where(function ($q) {
                $q->whereNull('deed_pdf_path')->orWhere('deed_pdf_path', '');
            });
        } else {
            return [];
        }

        return $query->select(['id', 'name', 'city'])
            ->limit(50)
            ->get()
            ->map(fn ($row) => [
                'type' => 'document',
                'severity' => 'info',
                'title' => 'وثيقة عقار غير مرفوعة',
                'subtitle' => 'العقار: ' . ($row->name ?: ('#' . $row->id)),
                'alert_date' => null,
                'date_label' => 'معلومة',
                'meta' => ['المدينة' => $row->city ?: '-'],
            ])->values()->all();
    }
}

if (!function_exists('mr_smart_maintenance_alerts')) {
    function mr_smart_maintenance_alerts(Request $request, array $propertyIds, array $unitIds): array
    {
        if (!Schema::hasTable('maintenance_requests')) return [];
        $query = DB::table('maintenance_requests');
        if (Schema::hasColumn('maintenance_requests', 'property_id') && !empty($propertyIds)) {
            $query->whereIn('property_id', $propertyIds);
        } elseif (Schema::hasColumn('maintenance_requests', 'unit_id') && !empty($unitIds)) {
            $query->whereIn('unit_id', $unitIds);
        } elseif (!mr_smart_is_admin($request->user())) {
            $query->whereRaw('1 = 0');
        }
        if (Schema::hasColumn('maintenance_requests', 'status')) {
            $query->whereNotIn('status', ['closed', 'مغلق', 'منتهية', 'done', 'resolved']);
        }
        return $query->limit(50)->get()->map(function ($row) {
            $title = $row->title ?? $row->subject ?? 'طلب صيانة مفتوح';
            $created = mr_smart_date($row->created_at ?? null);
            return [
                'type' => 'maintenance',
                'severity' => 'warning',
                'title' => 'طلب صيانة مفتوح',
                'subtitle' => (string) $title,
                'alert_date' => $created,
                'date_label' => mr_smart_date_label($created),
                'meta' => [
                    'الحالة' => $row->status ?? '-',
                    'الأولوية' => $row->priority ?? '-',
                ],
            ];
        })->values()->all();
    }
}

$smartAlerts = function (Request $request) {
    $ownerIds = mr_smart_owner_ids($request);
    $propertyIds = mr_smart_property_ids($request, $ownerIds);
    $unitIds = mr_smart_unit_ids($request, $propertyIds);
    $contractIds = mr_smart_contract_ids($request, $unitIds);

    $items = array_merge(
        mr_smart_payment_alerts($contractIds),
        mr_smart_contract_alerts($contractIds),
        mr_smart_document_alerts($propertyIds),
        mr_smart_maintenance_alerts($request, $propertyIds, $unitIds)
    );

    usort($items, function ($a, $b) {
        $rank = ['critical' => 0, 'warning' => 1, 'info' => 2];
        $ra = $rank[$a['severity'] ?? 'info'] ?? 3;
        $rb = $rank[$b['severity'] ?? 'info'] ?? 3;
        if ($ra !== $rb) return $ra <=> $rb;
        return strcmp((string) ($a['alert_date'] ?? '9999-12-31'), (string) ($b['alert_date'] ?? '9999-12-31'));
    });

    return response()->json([
        'summary' => [
            'total' => count($items),
            'critical' => count(array_filter($items, fn ($item) => ($item['severity'] ?? '') === 'critical')),
            'warning' => count(array_filter($items, fn ($item) => ($item['severity'] ?? '') === 'warning')),
            'info' => count(array_filter($items, fn ($item) => ($item['severity'] ?? '') === 'info')),
        ],
        'items' => array_values($items),
    ]);
};

Route::get('/smart-alerts', $smartAlerts);
Route::get('/my/smart-alerts', $smartAlerts);
