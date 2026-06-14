<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (is_file(__DIR__ . '/130_manager_data_scope.php')) require_once __DIR__ . '/130_manager_data_scope.php';
if (is_file(__DIR__ . '/121_owner_account_statement.php')) require_once __DIR__ . '/121_owner_account_statement.php';
if (is_file(__DIR__ . '/134_owner_bank_accounts.php')) require_once __DIR__ . '/134_owner_bank_accounts.php';

if (!function_exists('mrrp_num')) {
    function mrrp_num($value): float
    {
        if ($value === null || $value === '') return 0.0;
        return is_numeric($value) ? (float) $value : (float) str_replace(',', '', (string) $value);
    }
}

if (!function_exists('mrrp_role')) {
    function mrrp_role($user): string
    {
        return $user && function_exists('mr_manager_scope_role') ? mr_manager_scope_role($user) : strtolower(trim((string) ($user->role ?? '')));
    }
}

if (!function_exists('mrrp_is_admin')) {
    function mrrp_is_admin($user): bool
    {
        return in_array(mrrp_role($user), ['admin', 'super_admin'], true) || (bool) ($user->is_admin ?? false);
    }
}

if (!function_exists('mrrp_owner_ids')) {
    function mrrp_owner_ids(Request $request): array
    {
        if (function_exists('mr_owner_bank_accounts_owner_ids')) return mr_owner_bank_accounts_owner_ids($request);
        $user = $request->user();
        if (!$user || !Schema::hasTable('owners')) return [];
        if (mrrp_is_admin($user)) return DB::table('owners')->pluck('id')->map(fn($id) => (int) $id)->all();
        if (mrrp_role($user) === 'manager' && function_exists('mr_manager_scope_owner_ids')) return mr_manager_scope_owner_ids($request);
        return !empty($user->owner_id) ? [(int) $user->owner_id] : [];
    }
}

if (!function_exists('mrrp_property_ids_for_owner')) {
    function mrrp_property_ids_for_owner(int $ownerId): array
    {
        if (!Schema::hasTable('properties') || !Schema::hasColumn('properties', 'owner_id')) return [];
        return DB::table('properties')->where('owner_id', $ownerId)->pluck('id')->map(fn($id) => (int) $id)->all();
    }
}

if (!function_exists('mrrp_unit_ids_for_properties')) {
    function mrrp_unit_ids_for_properties(array $propertyIds): array
    {
        if (!$propertyIds || !Schema::hasTable('units') || !Schema::hasColumn('units', 'property_id')) return [];
        return DB::table('units')->whereIn('property_id', $propertyIds)->pluck('id')->map(fn($id) => (int) $id)->all();
    }
}

if (!function_exists('mrrp_contract_ids_for_units')) {
    function mrrp_contract_ids_for_units(array $unitIds): array
    {
        if (!$unitIds || !Schema::hasTable('contracts') || !Schema::hasColumn('contracts', 'unit_id')) return [];
        return DB::table('contracts')->whereIn('unit_id', $unitIds)->pluck('id')->map(fn($id) => (int) $id)->all();
    }
}

if (!function_exists('mrrp_ensure_payout_table')) {
    function mrrp_ensure_payout_table(): void
    {
        if (function_exists('mroa_ensure_tables')) mroa_ensure_tables();
        if (!Schema::hasTable('owner_account_transfers')) {
            Schema::create('owner_account_transfers', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('owner_id')->index();
                $table->unsignedBigInteger('owner_bank_account_id')->nullable()->index();
                $table->decimal('amount', 14, 2)->default(0);
                $table->date('transfer_date')->nullable();
                $table->date('period_start')->nullable();
                $table->date('period_end')->nullable();
                $table->string('method')->nullable();
                $table->string('bank')->nullable();
                $table->string('reference')->nullable();
                $table->string('status')->default('paid')->index();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
            return;
        }
        Schema::table('owner_account_transfers', function (Blueprint $table) {
            if (!Schema::hasColumn('owner_account_transfers', 'owner_bank_account_id')) $table->unsignedBigInteger('owner_bank_account_id')->nullable()->index();
            if (!Schema::hasColumn('owner_account_transfers', 'period_start')) $table->date('period_start')->nullable();
            if (!Schema::hasColumn('owner_account_transfers', 'period_end')) $table->date('period_end')->nullable();
            if (!Schema::hasColumn('owner_account_transfers', 'status')) $table->string('status')->default('paid')->index();
            if (!Schema::hasColumn('owner_account_transfers', 'created_at')) $table->timestamp('created_at')->nullable();
            if (!Schema::hasColumn('owner_account_transfers', 'updated_at')) $table->timestamp('updated_at')->nullable();
        });
    }
}

if (!function_exists('mrrp_owner_balance')) {
    function mrrp_owner_balance(int $ownerId): array
    {
        $owner = Schema::hasTable('owners') ? DB::table('owners')->where('id', $ownerId)->first() : null;
        $propertyIds = mrrp_property_ids_for_owner($ownerId);
        $unitIds = mrrp_unit_ids_for_properties($propertyIds);
        $contractIds = mrrp_contract_ids_for_units($unitIds);

        $paidIncome = 0.0;
        if ($contractIds && Schema::hasTable('payments')) {
            $paidColumn = Schema::hasColumn('payments', 'paid_amount') ? 'paid_amount' : 'amount';
            $paidIncome = (float) DB::table('payments')
                ->whereIn('contract_id', $contractIds)
                ->where(function ($q) {
                    $q->where('status', 'paid')->orWhere('status', 'مدفوع')->orWhere('status', 'مدفوعة');
                    if (Schema::hasColumn('payments', 'paid_date')) $q->orWhereNotNull('paid_date');
                })
                ->sum($paidColumn);
        }

        $expenses = $propertyIds && Schema::hasTable('property_expenses') ? (float) DB::table('property_expenses')->whereIn('property_id', $propertyIds)->sum('amount') : 0.0;
        mrrp_ensure_payout_table();
        $paidPayouts = (float) DB::table('owner_account_transfers')->where('owner_id', $ownerId)->where('status', 'paid')->sum('amount');
        $pendingPayouts = (float) DB::table('owner_account_transfers')->where('owner_id', $ownerId)->where('status', 'pending')->sum('amount');
        $accounts = Schema::hasTable('owner_bank_accounts') ? DB::table('owner_bank_accounts')->where('owner_id', $ownerId)->orderByDesc('is_default')->orderByDesc('is_active')->get() : collect();
        $default = $accounts->firstWhere('is_default', 1) ?: $accounts->first();

        return [
            'owner_id' => $ownerId,
            'owner_name' => $owner->name ?? 'مالك',
            'properties_count' => count($propertyIds),
            'paid_income' => $paidIncome,
            'expenses' => $expenses,
            'net_income' => $paidIncome - $expenses,
            'paid_payouts' => $paidPayouts,
            'pending_payouts' => $pendingPayouts,
            'remaining_balance' => ($paidIncome - $expenses) - $paidPayouts,
            'bank_accounts_count' => $accounts->count(),
            'default_bank_account_id' => $default->id ?? null,
            'default_bank_name' => $default->bank_name ?? null,
            'default_iban' => $default->iban ?? null,
            'bank_accounts' => $accounts->map(fn($a) => [
                'id' => (int) $a->id,
                'bank_name' => $a->bank_name,
                'account_name' => $a->account_name,
                'iban' => $a->iban,
                'account_number' => $a->account_number,
                'is_default' => (bool) ($a->is_default ?? false),
                'is_active' => (bool) ($a->is_active ?? true),
            ])->values(),
        ];
    }
}

$rentRoll = function (Request $request) {
    $ownerIds = mrrp_owner_ids($request);
    if (!$ownerIds || !Schema::hasTable('contracts')) return response()->json(['summary' => [], 'items' => []]);

    $query = DB::table('contracts')
        ->leftJoin('units', 'units.id', '=', 'contracts.unit_id')
        ->leftJoin('properties', 'properties.id', '=', 'units.property_id')
        ->leftJoin('owners', 'owners.id', '=', 'properties.owner_id')
        ->leftJoin('tenants', 'tenants.id', '=', 'contracts.tenant_id')
        ->whereIn('owners.id', $ownerIds)
        ->where(function ($q) {
            $q->where('contracts.status', 'active')->orWhere('contracts.status', 'نشط')->orWhereNull('contracts.status');
        })
        ->select([
            'contracts.*', 'units.unit_number', 'units.floor', 'units.type as unit_type',
            'properties.id as property_id', 'properties.name as property_name', 'properties.city', 'properties.district', 'properties.property_type',
            'owners.id as owner_id', 'owners.name as owner_name', 'owners.phone as owner_phone',
            'tenants.id as tenant_id', 'tenants.name as tenant_name', 'tenants.phone as tenant_phone', 'tenants.national_id as tenant_national_id',
        ])
        ->orderBy('owners.name')
        ->orderBy('properties.name')
        ->orderBy('units.unit_number')
        ->get();

    $contractIds = $query->pluck('id')->map(fn($id) => (int) $id)->all();
    $paymentGroups = $contractIds && Schema::hasTable('payments') ? DB::table('payments')->whereIn('contract_id', $contractIds)->get()->groupBy('contract_id') : collect();
    $today = now()->toDateString();

    $items = $query->map(function ($row) use ($paymentGroups, $today) {
        $payments = $paymentGroups->get($row->id, collect());
        $paymentsTotal = (float) $payments->sum('amount');
        $receivedTotal = (float) $payments->where('status', 'paid')->sum(fn($p) => mrrp_num($p->paid_amount ?? $p->amount ?? 0));
        $overdueTotal = (float) $payments->filter(fn($p) => (($p->status ?? '') === 'overdue') || ((string) ($p->due_date ?? '') < $today && ($p->status ?? '') !== 'paid'))->sum(fn($p) => mrrp_num($p->remaining_amount ?? $p->amount ?? 0));
        $next = $payments->filter(fn($p) => ($p->status ?? '') !== 'paid' && (string) ($p->due_date ?? '') >= $today)->sortBy('due_date')->first();
        $rent = mrrp_num($row->rent_amount ?? 0);
        $parking = mrrp_num($row->parking_fee ?? 0);
        $services = mrrp_num($row->services_fee ?? 0);
        return [
            'id' => (int) $row->id,
            'contract_number' => $row->government_contract_number ?: ($row->contract_number ?: $row->id),
            'status' => $row->status,
            'start_date' => $row->start_date,
            'end_date' => $row->end_date,
            'rent_amount' => $rent,
            'parking_fee' => $parking,
            'services_fee' => $services,
            'monthly_total' => $rent + $parking + $services,
            'payment_cycle' => $row->payment_cycle,
            'payments_total' => $paymentsTotal,
            'received_total' => $receivedTotal,
            'remaining_total' => max($paymentsTotal - $receivedTotal, 0),
            'overdue_total' => $overdueTotal,
            'next_due_date' => $next->due_date ?? null,
            'next_due_amount' => $next ? mrrp_num($next->remaining_amount ?? $next->amount ?? 0) : null,
            'tenant' => ['id' => $row->tenant_id, 'name' => $row->tenant_name, 'phone' => $row->tenant_phone, 'national_id' => $row->tenant_national_id],
            'unit' => ['id' => $row->unit_id, 'unit_number' => $row->unit_number, 'floor' => $row->floor, 'type' => $row->unit_type],
            'property' => ['id' => $row->property_id, 'name' => $row->property_name, 'city' => $row->city, 'district' => $row->district, 'property_type' => $row->property_type],
            'owner' => ['id' => $row->owner_id, 'name' => $row->owner_name, 'phone' => $row->owner_phone],
        ];
    })->values();

    return response()->json([
        'summary' => [
            'contracts_count' => $items->count(),
            'monthly_rent' => $items->sum('rent_amount'),
            'monthly_parking' => $items->sum('parking_fee'),
            'monthly_services' => $items->sum('services_fee'),
            'monthly_total' => $items->sum('monthly_total'),
            'payments_total' => $items->sum('payments_total'),
            'received_total' => $items->sum('received_total'),
            'remaining_total' => $items->sum('remaining_total'),
            'overdue_total' => $items->sum('overdue_total'),
        ],
        'items' => $items,
    ]);
};

$payoutSummary = function (Request $request) {
    mrrp_ensure_payout_table();
    return response()->json(collect(mrrp_owner_ids($request))->map(fn($id) => mrrp_owner_balance((int) $id))->values());
};

$payoutIndex = function (Request $request) {
    mrrp_ensure_payout_table();
    $ownerIds = mrrp_owner_ids($request);
    if (!$ownerIds) return response()->json([]);
    $rows = DB::table('owner_account_transfers as t')
        ->leftJoin('owners as o', 'o.id', '=', 't.owner_id')
        ->leftJoin('owner_bank_accounts as b', 'b.id', '=', 't.owner_bank_account_id')
        ->whereIn('t.owner_id', $ownerIds)
        ->select(['t.*', 'o.name as owner_name', 'b.bank_name', 'b.account_name', 'b.iban', 'b.account_number'])
        ->orderByDesc('t.transfer_date')
        ->orderByDesc('t.id')
        ->limit(100)
        ->get()
        ->map(fn($r) => [
            'id' => (int) $r->id,
            'owner_id' => (int) $r->owner_id,
            'owner_name' => $r->owner_name,
            'owner_bank_account_id' => $r->owner_bank_account_id ? (int) $r->owner_bank_account_id : null,
            'bank_name' => $r->bank_name ?: $r->bank,
            'account_name' => $r->account_name,
            'iban' => $r->iban,
            'account_number' => $r->account_number,
            'amount' => mrrp_num($r->amount ?? 0),
            'payout_date' => $r->transfer_date,
            'period_start' => $r->period_start,
            'period_end' => $r->period_end,
            'method' => $r->method,
            'reference_number' => $r->reference,
            'status' => $r->status ?: 'paid',
            'notes' => $r->notes,
        ])->values();
    return response()->json($rows);
};

Route::get('/rent-roll', $rentRoll);
Route::get('/my/rent-roll', $rentRoll);
Route::get('/owner-payouts-bank/summary', $payoutSummary);
Route::get('/my/owner-payouts-bank/summary', $payoutSummary);
Route::get('/owner-payouts-bank', $payoutIndex);
Route::get('/my/owner-payouts-bank', $payoutIndex);

Route::post('/owner-payouts-bank', function (Request $request) {
    mrrp_ensure_payout_table();
    $data = $request->validate([
        'owner_id' => ['required', 'integer'],
        'owner_bank_account_id' => ['nullable', 'integer'],
        'amount' => ['required', 'numeric', 'min:0'],
        'payout_date' => ['nullable', 'date'],
        'period_start' => ['nullable', 'date'],
        'period_end' => ['nullable', 'date'],
        'method' => ['nullable', 'string'],
        'reference_number' => ['nullable', 'string'],
        'status' => ['nullable', 'string'],
        'notes' => ['nullable', 'string'],
    ]);
    $ownerId = (int) $data['owner_id'];
    if (!in_array($ownerId, mrrp_owner_ids($request), true)) return response()->json(['message' => 'هذا المالك خارج نطاق حسابك.'], 403);
    $bank = !empty($data['owner_bank_account_id']) && Schema::hasTable('owner_bank_accounts') ? DB::table('owner_bank_accounts')->where('id', $data['owner_bank_account_id'])->where('owner_id', $ownerId)->first() : null;
    DB::table('owner_account_transfers')->insert([
        'owner_id' => $ownerId,
        'owner_bank_account_id' => $bank->id ?? null,
        'amount' => $data['amount'],
        'transfer_date' => $data['payout_date'] ?? now()->toDateString(),
        'period_start' => $data['period_start'] ?? null,
        'period_end' => $data['period_end'] ?? null,
        'method' => $data['method'] ?? 'bank_transfer',
        'bank' => $bank->bank_name ?? null,
        'reference' => $data['reference_number'] ?? null,
        'status' => $data['status'] ?? 'paid',
        'notes' => $data['notes'] ?? null,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    return response()->json(['status' => 'ok', 'message' => 'تم تسجيل الحوالة.'], 201);
});

Route::post('/owner-payouts-bank/{id}/status', function (Request $request, int $id) {
    mrrp_ensure_payout_table();
    $status = $request->input('status', 'paid');
    $row = DB::table('owner_account_transfers')->where('id', $id)->first();
    if (!$row) return response()->json(['message' => 'الحوالة غير موجودة.'], 404);
    if (!in_array((int) $row->owner_id, mrrp_owner_ids($request), true)) return response()->json(['message' => 'خارج نطاق حسابك.'], 403);
    DB::table('owner_account_transfers')->where('id', $id)->update(['status' => $status, 'updated_at' => now()]);
    return response()->json(['status' => 'ok']);
});
