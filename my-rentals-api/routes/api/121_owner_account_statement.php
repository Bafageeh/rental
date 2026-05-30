<?php

use App\Models\Owner;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;

if (!function_exists('mroa_num')) {
    function mroa_num($value): float
    {
        if ($value === null || $value === '') return 0.0;
        return is_numeric($value) ? (float) $value : (float) str_replace(',', '', (string) $value);
    }
}

if (!function_exists('mroa_date')) {
    function mroa_date($value): ?string
    {
        $text = substr(trim((string) ($value ?? '')), 0, 10);
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $text) ? $text : null;
    }
}

if (!function_exists('mroa_user')) {
    function mroa_user(Request $request)
    {
        if (function_exists('myRentalsApiUser')) return myRentalsApiUser($request);
        return $request->user();
    }
}

if (!function_exists('mroa_role')) {
    function mroa_role($user): string
    {
        if (function_exists('myRentalsEffectiveRole')) return myRentalsEffectiveRole($user);
        return strtolower(trim((string) ($user->role ?? 'admin'))) ?: 'admin';
    }
}

if (!function_exists('mroa_can_view_owner')) {
    function mroa_can_view_owner(Request $request, int $ownerId): bool
    {
        $user = mroa_user($request);
        if (!$user) return false;
        $role = mroa_role($user);
        if ($role === 'owner') return (int) ($user->owner_id ?? 0) === $ownerId;
        return true;
    }
}

if (!function_exists('mroa_ensure_tables')) {
    function mroa_ensure_tables(): void
    {
        if (!Schema::hasTable('owner_account_settings')) {
            Schema::create('owner_account_settings', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('owner_id')->unique();
                $table->decimal('initial_balance', 14, 2)->default(0);
                $table->date('initial_balance_date')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('owner_account_transfers')) {
            Schema::create('owner_account_transfers', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('owner_id')->index();
                $table->decimal('amount', 14, 2)->default(0);
                $table->date('transfer_date')->nullable();
                $table->string('method')->nullable();
                $table->string('bank')->nullable();
                $table->string('reference')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }
    }
}

if (!function_exists('mroa_owner_property_ids')) {
    function mroa_owner_property_ids(int $ownerId): array
    {
        if (!Schema::hasTable('properties') || !Schema::hasColumn('properties', 'owner_id')) return [];
        return DB::table('properties')->where('owner_id', $ownerId)->pluck('id')->map(fn ($id) => (int) $id)->all();
    }
}

if (!function_exists('mroa_owner_unit_ids')) {
    function mroa_owner_unit_ids(array $propertyIds): array
    {
        if (empty($propertyIds) || !Schema::hasTable('units') || !Schema::hasColumn('units', 'property_id')) return [];
        return DB::table('units')->whereIn('property_id', $propertyIds)->pluck('id')->map(fn ($id) => (int) $id)->all();
    }
}

if (!function_exists('mroa_owner_contract_ids')) {
    function mroa_owner_contract_ids(array $unitIds): array
    {
        if (empty($unitIds) || !Schema::hasTable('contracts') || !Schema::hasColumn('contracts', 'unit_id')) return [];
        return DB::table('contracts')->whereIn('unit_id', $unitIds)->pluck('id')->map(fn ($id) => (int) $id)->all();
    }
}

if (!function_exists('mroa_collected_rents')) {
    function mroa_collected_rents(array $contractIds): array
    {
        if (empty($contractIds) || !Schema::hasTable('payments')) return ['total' => 0, 'items' => []];

        $query = DB::table('payments')
            ->leftJoin('contracts', 'contracts.id', '=', 'payments.contract_id')
            ->leftJoin('units', 'units.id', '=', 'contracts.unit_id')
            ->leftJoin('properties', 'properties.id', '=', 'units.property_id')
            ->leftJoin('tenants', 'tenants.id', '=', 'contracts.tenant_id')
            ->whereIn('payments.contract_id', $contractIds);

        if (Schema::hasColumn('payments', 'status')) {
            $query->where(function ($q) {
                $q->where('payments.status', 'paid')->orWhere('payments.status', 'مدفوع')->orWhere('payments.status', 'مدفوعة');
                if (Schema::hasColumn('payments', 'paid_date')) $q->orWhereNotNull('payments.paid_date');
            });
        } elseif (Schema::hasColumn('payments', 'paid_date')) {
            $query->whereNotNull('payments.paid_date');
        }

        $amountColumn = Schema::hasColumn('payments', 'paid_amount') ? 'payments.paid_amount' : 'payments.amount';
        $items = $query->select([
                'payments.id',
                'payments.contract_id',
                DB::raw($amountColumn . ' as amount'),
                'payments.due_date',
                Schema::hasColumn('payments', 'paid_date') ? 'payments.paid_date' : DB::raw('NULL as paid_date'),
                'contracts.contract_number',
                'contracts.government_contract_number',
                'properties.name as property_name',
                'units.unit_number as unit_number',
                'tenants.name as tenant_name',
            ])
            ->orderByRaw('COALESCE(payments.paid_date, payments.due_date) desc')
            ->orderBy('payments.id', 'desc')
            ->get()
            ->map(function ($row) {
                $amount = mroa_num($row->amount ?? 0);
                return [
                    'id' => (int) $row->id,
                    'type' => 'rent',
                    'label' => 'إيجار محصل',
                    'amount' => $amount,
                    'date' => mroa_date($row->paid_date ?? null) ?: mroa_date($row->due_date ?? null),
                    'property_name' => $row->property_name,
                    'unit_number' => $row->unit_number,
                    'tenant_name' => $row->tenant_name,
                    'contract_number' => $row->government_contract_number ?: $row->contract_number,
                ];
            })
            ->values();

        return ['total' => (float) $items->sum('amount'), 'items' => $items];
    }
}

if (!function_exists('mroa_expenses')) {
    function mroa_expenses(array $propertyIds): array
    {
        if (empty($propertyIds) || !Schema::hasTable('property_expenses')) return ['total' => 0, 'items' => []];
        $items = DB::table('property_expenses')
            ->leftJoin('properties', 'properties.id', '=', 'property_expenses.property_id')
            ->leftJoin('units', 'units.id', '=', 'property_expenses.unit_id')
            ->leftJoin('expense_categories', 'expense_categories.id', '=', 'property_expenses.expense_category_id')
            ->whereIn('property_expenses.property_id', $propertyIds)
            ->select([
                'property_expenses.id',
                'property_expenses.amount',
                'property_expenses.expense_date',
                'property_expenses.title',
                'property_expenses.description',
                'properties.name as property_name',
                'units.unit_number as unit_number',
                'expense_categories.name as category_name',
            ])
            ->orderBy('property_expenses.expense_date', 'desc')
            ->orderBy('property_expenses.id', 'desc')
            ->get()
            ->map(function ($row) {
                return [
                    'id' => (int) $row->id,
                    'type' => 'expense',
                    'label' => $row->category_name ?: ($row->title ?: 'مصروف'),
                    'amount' => mroa_num($row->amount ?? 0),
                    'date' => mroa_date($row->expense_date ?? null),
                    'property_name' => $row->property_name,
                    'unit_number' => $row->unit_number,
                    'notes' => $row->description,
                ];
            })
            ->values();

        return ['total' => (float) $items->sum('amount'), 'items' => $items];
    }
}

if (!function_exists('mroa_transfers')) {
    function mroa_transfers(int $ownerId): array
    {
        mroa_ensure_tables();
        $items = DB::table('owner_account_transfers')
            ->where('owner_id', $ownerId)
            ->orderBy('transfer_date', 'desc')
            ->orderBy('id', 'desc')
            ->get()
            ->map(function ($row) {
                return [
                    'id' => (int) $row->id,
                    'type' => 'transfer',
                    'label' => 'حوالة للمالك',
                    'amount' => mroa_num($row->amount ?? 0),
                    'date' => mroa_date($row->transfer_date ?? null),
                    'method' => $row->method,
                    'bank' => $row->bank,
                    'reference' => $row->reference,
                    'notes' => $row->notes,
                ];
            })
            ->values();

        return ['total' => (float) $items->sum('amount'), 'items' => $items];
    }
}

if (!function_exists('mroa_statement_payload')) {
    function mroa_statement_payload(Owner $owner): array
    {
        mroa_ensure_tables();
        $ownerId = (int) $owner->id;
        $propertyIds = mroa_owner_property_ids($ownerId);
        $unitIds = mroa_owner_unit_ids($propertyIds);
        $contractIds = mroa_owner_contract_ids($unitIds);
        $settings = DB::table('owner_account_settings')->where('owner_id', $ownerId)->first();
        $initialBalance = mroa_num($settings->initial_balance ?? 0);
        $rents = mroa_collected_rents($contractIds);
        $expenses = mroa_expenses($propertyIds);
        $transfers = mroa_transfers($ownerId);
        $balance = $initialBalance + $rents['total'] - $expenses['total'] - $transfers['total'];

        $ledger = collect([])
            ->push([
                'id' => 0,
                'type' => 'initial',
                'label' => 'رصيد مبدئي',
                'amount' => $initialBalance,
                'date' => mroa_date($settings->initial_balance_date ?? null),
                'notes' => $settings->notes ?? null,
            ])
            ->merge($rents['items']->map(fn ($item) => array_merge($item, ['direction' => 'credit'])))
            ->merge($expenses['items']->map(fn ($item) => array_merge($item, ['direction' => 'debit'])))
            ->merge($transfers['items']->map(fn ($item) => array_merge($item, ['direction' => 'debit'])))
            ->map(function ($item) {
                $item['date'] = $item['date'] ?: '0000-00-00';
                $item['signed_amount'] = in_array($item['type'], ['expense', 'transfer'], true) ? -abs(mroa_num($item['amount'] ?? 0)) : mroa_num($item['amount'] ?? 0);
                return $item;
            })
            ->sortByDesc(fn ($item) => ($item['date'] ?: '0000-00-00') . '-' . str_pad((string) ($item['id'] ?? 0), 12, '0', STR_PAD_LEFT))
            ->values();

        return [
            'owner' => $owner,
            'settings' => [
                'initial_balance' => $initialBalance,
                'initial_balance_date' => mroa_date($settings->initial_balance_date ?? null),
                'notes' => $settings->notes ?? null,
            ],
            'summary' => [
                'initial_balance' => $initialBalance,
                'collected_rents' => $rents['total'],
                'expenses' => $expenses['total'],
                'transfers' => $transfers['total'],
                'balance' => $balance,
                'properties_count' => count($propertyIds),
                'units_count' => count($unitIds),
                'contracts_count' => count($contractIds),
            ],
            'rent_payments' => $rents['items'],
            'expenses' => $expenses['items'],
            'transfers' => $transfers['items'],
            'ledger' => $ledger,
        ];
    }
}

Route::get('/owners/{owner}/account-statement', function (Request $request, Owner $owner) {
    if (!mroa_can_view_owner($request, (int) $owner->id)) {
        return response()->json(['message' => 'غير مصرح بعرض حساب هذا المالك.'], 403);
    }
    return response()->json(mroa_statement_payload($owner));
});

Route::get('/my/owners/{owner}/account-statement', function (Request $request, Owner $owner) {
    if (!mroa_can_view_owner($request, (int) $owner->id)) {
        return response()->json(['message' => 'غير مصرح بعرض حساب هذا المالك.'], 403);
    }
    return response()->json(mroa_statement_payload($owner));
});

Route::post('/owners/{owner}/account-settings', function (Request $request, Owner $owner) {
    if (!mroa_can_view_owner($request, (int) $owner->id)) {
        return response()->json(['message' => 'غير مصرح بتعديل حساب هذا المالك.'], 403);
    }
    mroa_ensure_tables();
    $data = $request->validate([
        'initial_balance' => ['nullable', 'numeric'],
        'initial_balance_date' => ['nullable', 'date'],
        'notes' => ['nullable', 'string'],
    ]);
    DB::table('owner_account_settings')->updateOrInsert(
        ['owner_id' => $owner->id],
        [
            'initial_balance' => $data['initial_balance'] ?? 0,
            'initial_balance_date' => $data['initial_balance_date'] ?? null,
            'notes' => $data['notes'] ?? null,
            'updated_at' => now(),
            'created_at' => DB::raw('COALESCE(created_at, NOW())'),
        ]
    );
    return response()->json(['message' => 'تم حفظ الرصيد المبدئي.', 'data' => mroa_statement_payload($owner)]);
});

Route::post('/owners/{owner}/account-transfers', function (Request $request, Owner $owner) {
    if (!mroa_can_view_owner($request, (int) $owner->id)) {
        return response()->json(['message' => 'غير مصرح بتسجيل حوالة لهذا المالك.'], 403);
    }
    mroa_ensure_tables();
    $data = $request->validate([
        'amount' => ['required', 'numeric', 'min:0'],
        'transfer_date' => ['required', 'date'],
        'method' => ['nullable', 'string', 'max:100'],
        'bank' => ['nullable', 'string', 'max:120'],
        'reference' => ['nullable', 'string', 'max:120'],
        'notes' => ['nullable', 'string'],
    ]);
    DB::table('owner_account_transfers')->insert([
        'owner_id' => $owner->id,
        'amount' => $data['amount'],
        'transfer_date' => $data['transfer_date'],
        'method' => $data['method'] ?? null,
        'bank' => $data['bank'] ?? null,
        'reference' => $data['reference'] ?? null,
        'notes' => $data['notes'] ?? null,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    return response()->json(['message' => 'تم تسجيل الحوالة للمالك.', 'data' => mroa_statement_payload($owner)]);
});
