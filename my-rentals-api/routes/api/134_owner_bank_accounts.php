<?php

use App\Models\Owner;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (is_file(__DIR__ . '/130_manager_data_scope.php')) {
    require_once __DIR__ . '/130_manager_data_scope.php';
}

if (!function_exists('mr_owner_bank_accounts_ensure_table')) {
    function mr_owner_bank_accounts_ensure_table(): void
    {
        if (!Schema::hasTable('owner_bank_accounts')) {
            Schema::create('owner_bank_accounts', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('owner_id')->index();
                $table->string('bank_name')->nullable();
                $table->string('account_name')->nullable();
                $table->string('iban')->nullable();
                $table->string('account_number')->nullable();
                $table->boolean('is_default')->default(false)->index();
                $table->boolean('is_active')->default(true)->index();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
            return;
        }

        Schema::table('owner_bank_accounts', function (Blueprint $table) {
            if (!Schema::hasColumn('owner_bank_accounts', 'owner_id')) $table->unsignedBigInteger('owner_id')->nullable()->index();
            if (!Schema::hasColumn('owner_bank_accounts', 'bank_name')) $table->string('bank_name')->nullable();
            if (!Schema::hasColumn('owner_bank_accounts', 'account_name')) $table->string('account_name')->nullable();
            if (!Schema::hasColumn('owner_bank_accounts', 'iban')) $table->string('iban')->nullable();
            if (!Schema::hasColumn('owner_bank_accounts', 'account_number')) $table->string('account_number')->nullable();
            if (!Schema::hasColumn('owner_bank_accounts', 'is_default')) $table->boolean('is_default')->default(false)->index();
            if (!Schema::hasColumn('owner_bank_accounts', 'is_active')) $table->boolean('is_active')->default(true)->index();
            if (!Schema::hasColumn('owner_bank_accounts', 'notes')) $table->text('notes')->nullable();
            if (!Schema::hasColumn('owner_bank_accounts', 'created_at')) $table->timestamp('created_at')->nullable();
            if (!Schema::hasColumn('owner_bank_accounts', 'updated_at')) $table->timestamp('updated_at')->nullable();
        });
    }
}

if (!function_exists('mr_owner_bank_accounts_scoped_owners')) {
    function mr_owner_bank_accounts_scoped_owners(Request $request)
    {
        $user = $request->user();
        $role = strtolower((string) ($user->role ?? ''));

        $query = Owner::query()->orderBy('name');

        if ($role === 'owner' && Schema::hasColumn('users', 'owner_id') && !empty($user->owner_id)) {
            $query->where('id', $user->owner_id);
        } elseif (function_exists('mr_manager_scope_apply')) {
            mr_manager_scope_apply($query, 'owners', $request);
        }

        $columns = ['id', 'name', 'phone', 'email'];
        if (Schema::hasColumn('owners', 'national_id')) $columns[] = 'national_id';

        return $query->get(array_values(array_unique($columns)));
    }
}

if (!function_exists('mr_owner_bank_accounts_owner_ids')) {
    function mr_owner_bank_accounts_owner_ids(Request $request): array
    {
        return mr_owner_bank_accounts_scoped_owners($request)->pluck('id')->map(fn ($id) => (int) $id)->all();
    }
}

if (!function_exists('mr_owner_bank_accounts_abort_unless_owner_allowed')) {
    function mr_owner_bank_accounts_abort_unless_owner_allowed(Request $request, $ownerId): void
    {
        $ownerId = (int) $ownerId;
        $allowed = mr_owner_bank_accounts_owner_ids($request);
        if ($ownerId <= 0 || !in_array($ownerId, $allowed, true)) {
            abort(response()->json([
                'status' => 'error',
                'message' => 'هذا المالك خارج نطاق حسابك الحالي.',
            ], 403));
        }
    }
}

if (!function_exists('mr_owner_bank_accounts_query')) {
    function mr_owner_bank_accounts_query(Request $request)
    {
        mr_owner_bank_accounts_ensure_table();
        $allowedOwnerIds = mr_owner_bank_accounts_owner_ids($request);

        return DB::table('owner_bank_accounts as oba')
            ->leftJoin('owners as o', 'o.id', '=', 'oba.owner_id')
            ->select([
                'oba.id',
                'oba.owner_id',
                'o.name as owner_name',
                'oba.bank_name',
                'oba.account_name',
                'oba.iban',
                'oba.account_number',
                'oba.is_default',
                'oba.is_active',
                'oba.notes',
                'oba.created_at',
                'oba.updated_at',
            ])
            ->when(!empty($allowedOwnerIds), fn ($query) => $query->whereIn('oba.owner_id', $allowedOwnerIds))
            ->when(empty($allowedOwnerIds), fn ($query) => $query->whereRaw('1 = 0'));
    }
}

if (!function_exists('mr_owner_bank_accounts_payload')) {
    function mr_owner_bank_accounts_payload($row): array
    {
        return [
            'id' => (int) $row->id,
            'owner_id' => (int) $row->owner_id,
            'owner_name' => $row->owner_name ?? null,
            'bank_name' => $row->bank_name ?? null,
            'account_name' => $row->account_name ?? null,
            'iban' => $row->iban ?? null,
            'account_number' => $row->account_number ?? null,
            'is_default' => (bool) ($row->is_default ?? false),
            'is_active' => (bool) ($row->is_active ?? true),
            'notes' => $row->notes ?? null,
            'created_at' => $row->created_at ?? null,
            'updated_at' => $row->updated_at ?? null,
        ];
    }
}

if (!function_exists('mr_owner_bank_accounts_find_or_abort')) {
    function mr_owner_bank_accounts_find_or_abort(Request $request, int $id): array
    {
        mr_owner_bank_accounts_ensure_table();
        $record = DB::table('owner_bank_accounts')->where('id', $id)->first();
        if (!$record) {
            abort(response()->json(['message' => 'الحساب البنكي غير موجود.'], 404));
        }
        mr_owner_bank_accounts_abort_unless_owner_allowed($request, $record->owner_id ?? 0);
        return (array) $record;
    }
}

$ownerBankAccountIndex = function (Request $request) {
    return response()->json(
        mr_owner_bank_accounts_query($request)
            ->orderByDesc('oba.is_default')
            ->orderByDesc('oba.is_active')
            ->orderByDesc('oba.id')
            ->get()
            ->map(fn ($row) => mr_owner_bank_accounts_payload($row))
            ->values()
    );
};

Route::get('/owner-bank-accounts', $ownerBankAccountIndex);
Route::get('/my/owner-bank-accounts', $ownerBankAccountIndex);

Route::get('/my/owners', function (Request $request) {
    return response()->json(mr_owner_bank_accounts_scoped_owners($request)->values());
});

Route::post('/owner-bank-accounts', function (Request $request) {
    mr_owner_bank_accounts_ensure_table();

    $data = $request->validate([
        'owner_id' => ['required', 'integer', 'exists:owners,id'],
        'bank_name' => ['required', 'string', 'max:255'],
        'account_name' => ['nullable', 'string', 'max:255'],
        'iban' => ['nullable', 'string', 'max:255'],
        'account_number' => ['nullable', 'string', 'max:255'],
        'is_default' => ['nullable', 'boolean'],
        'is_active' => ['nullable', 'boolean'],
        'notes' => ['nullable', 'string'],
    ]);

    mr_owner_bank_accounts_abort_unless_owner_allowed($request, $data['owner_id']);

    $isDefault = (bool) ($data['is_default'] ?? false);
    if ($isDefault) {
        DB::table('owner_bank_accounts')->where('owner_id', $data['owner_id'])->update(['is_default' => false, 'updated_at' => now()]);
    }

    $id = DB::table('owner_bank_accounts')->insertGetId([
        'owner_id' => $data['owner_id'],
        'bank_name' => $data['bank_name'],
        'account_name' => $data['account_name'] ?? null,
        'iban' => $data['iban'] ?? null,
        'account_number' => $data['account_number'] ?? null,
        'is_default' => $isDefault,
        'is_active' => (bool) ($data['is_active'] ?? true),
        'notes' => $data['notes'] ?? null,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم إضافة الحساب البنكي.',
        'account' => mr_owner_bank_accounts_payload(mr_owner_bank_accounts_query($request)->where('oba.id', $id)->first()),
    ], 201);
});

Route::post('/owner-bank-accounts/{id}/update', function (Request $request, int $id) {
    $record = mr_owner_bank_accounts_find_or_abort($request, $id);

    $data = $request->validate([
        'owner_id' => ['required', 'integer', 'exists:owners,id'],
        'bank_name' => ['required', 'string', 'max:255'],
        'account_name' => ['nullable', 'string', 'max:255'],
        'iban' => ['nullable', 'string', 'max:255'],
        'account_number' => ['nullable', 'string', 'max:255'],
        'is_default' => ['nullable', 'boolean'],
        'is_active' => ['nullable', 'boolean'],
        'notes' => ['nullable', 'string'],
    ]);

    mr_owner_bank_accounts_abort_unless_owner_allowed($request, $data['owner_id']);

    $isDefault = (bool) ($data['is_default'] ?? false);
    if ($isDefault) {
        DB::table('owner_bank_accounts')->where('owner_id', $data['owner_id'])->where('id', '!=', $id)->update(['is_default' => false, 'updated_at' => now()]);
    }

    DB::table('owner_bank_accounts')->where('id', $id)->update([
        'owner_id' => $data['owner_id'],
        'bank_name' => $data['bank_name'],
        'account_name' => $data['account_name'] ?? null,
        'iban' => $data['iban'] ?? null,
        'account_number' => $data['account_number'] ?? null,
        'is_default' => $isDefault,
        'is_active' => (bool) ($data['is_active'] ?? true),
        'notes' => $data['notes'] ?? null,
        'updated_at' => now(),
    ]);

    return response()->json(['status' => 'ok', 'message' => 'تم تحديث الحساب البنكي.']);
});

Route::post('/owner-bank-accounts/{id}/set-default', function (Request $request, int $id) {
    $record = mr_owner_bank_accounts_find_or_abort($request, $id);
    $ownerId = (int) ($record['owner_id'] ?? 0);
    DB::table('owner_bank_accounts')->where('owner_id', $ownerId)->update(['is_default' => false, 'updated_at' => now()]);
    DB::table('owner_bank_accounts')->where('id', $id)->update(['is_default' => true, 'is_active' => true, 'updated_at' => now()]);

    return response()->json(['status' => 'ok', 'message' => 'تم تعيين الحساب الافتراضي.']);
});

Route::post('/owner-bank-accounts/{id}/toggle-active', function (Request $request, int $id) {
    $record = mr_owner_bank_accounts_find_or_abort($request, $id);
    $newStatus = !((bool) ($record['is_active'] ?? true));
    DB::table('owner_bank_accounts')->where('id', $id)->update(['is_active' => $newStatus, 'updated_at' => now()]);

    return response()->json(['status' => 'ok', 'message' => $newStatus ? 'تم تفعيل الحساب.' : 'تم تعطيل الحساب.']);
});
