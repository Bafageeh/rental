<?php

// PHASE2_ROUTE_MODULES: generated from routes/api.php on 2026-04-27-083758.
// Section: Owners

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
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/*
|--------------------------------------------------------------------------
| Owners
|--------------------------------------------------------------------------
*/

if (!function_exists('my_rentals_owner_account_clean_username')) {
    function my_rentals_owner_account_clean_username(?string $value): string
    {
        return trim((string) $value);
    }
}

if (!function_exists('my_rentals_owner_account_email_exists')) {
    function my_rentals_owner_account_email_exists(string $email, ?int $ignoreId = null): bool
    {
        if (!Schema::hasTable('users') || !Schema::hasColumn('users', 'email')) {
            return false;
        }

        return User::query()
            ->where('email', $email)
            ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->exists();
    }
}

if (!function_exists('my_rentals_owner_account_unique_email')) {
    function my_rentals_owner_account_unique_email(?string $preferred, string $username, ?int $ignoreId = null): string
    {
        $preferred = trim((string) $preferred);

        if ($preferred !== '' && filter_var($preferred, FILTER_VALIDATE_EMAIL) && !my_rentals_owner_account_email_exists($preferred, $ignoreId)) {
            return $preferred;
        }

        $base = Str::ascii($username);
        $base = strtolower(preg_replace('/[^a-z0-9._-]+/i', '', $base) ?: 'owner');
        $base = trim($base, '._-') ?: 'owner';

        for ($i = 0; $i < 50; $i++) {
            $suffix = $i === 0 ? '' : '-' . $i;
            $email = $base . $suffix . '@rental.local';

            if (!my_rentals_owner_account_email_exists($email, $ignoreId)) {
                return $email;
            }
        }

        return 'owner-' . now()->format('YmdHis') . '-' . Str::lower(Str::random(6)) . '@rental.local';
    }
}

if (!function_exists('my_rentals_create_or_link_owner_account')) {
    function my_rentals_create_or_link_owner_account(Owner $owner): array
    {
        if (!Schema::hasTable('users')) {
            return [null, 'لم يتم إنشاء حساب للمالك لأن جدول المستخدمين غير موجود.'];
        }

        if (!Schema::hasColumn('users', 'username')) {
            return [null, 'لم يتم إنشاء حساب للمالك لأن حقل اسم المستخدم غير موجود.'];
        }

        $username = my_rentals_owner_account_clean_username($owner->national_id ?? null);

        if ($username === '') {
            return [null, 'لم يتم إنشاء حساب للمالك لأن رقم الهوية غير مدخل.'];
        }

        $existingUser = User::query()->where('username', $username)->first();

        if ($existingUser) {
            $changed = false;

            if (Schema::hasColumn('users', 'owner_id') && empty($existingUser->owner_id)) {
                $existingUser->owner_id = $owner->id;
                $changed = true;
            }

            if (Schema::hasColumn('users', 'role') && empty($existingUser->role)) {
                $existingUser->role = 'owner';
                $changed = true;
            }

            if (Schema::hasColumn('users', 'status') && empty($existingUser->status)) {
                $existingUser->status = 'active';
                $changed = true;
            }

            if ($changed) {
                $existingUser->save();
            }

            if ((int) ($existingUser->owner_id ?? 0) === (int) $owner->id) {
                return [$existingUser, 'تم ربط حساب المالك الموجود مسبقًا.'];
            }

            return [$existingUser, 'يوجد حساب مستخدم بنفس رقم الهوية مسبقًا، راجع الربط من شاشة إدارة المستخدمين.'];
        }

        $payload = [
            'name' => $owner->name,
            'username' => $username,
            'email' => my_rentals_owner_account_unique_email($owner->email ?? null, $username),
            'password' => Hash::make('123456'),
        ];

        if (Schema::hasColumn('users', 'role')) {
            $payload['role'] = 'owner';
        }

        if (Schema::hasColumn('users', 'owner_id')) {
            $payload['owner_id'] = $owner->id;
        }

        if (Schema::hasColumn('users', 'status')) {
            $payload['status'] = 'active';
        }

        $user = User::query()->create($payload);

        return [$user, 'تم إنشاء حساب المالك تلقائيًا. اسم المستخدم هو رقم الهوية وكلمة المرور المبدئية 123456.'];
    }
}

Route::get('/owners', function () {
    return Owner::withCount('properties')
        ->orderBy('type')
        ->orderBy('name')
        ->get()
        ->map(function ($owner) {
            $owner->units_count = Unit::whereHas('property', function ($query) use ($owner) {
                $query->where('owner_id', $owner->id);
            })->count();

            $owner->contracts_count = Contract::whereHas('unit.property', function ($query) use ($owner) {
                $query->where('owner_id', $owner->id);
            })->count();

            $owner->has_rental_assets = ($owner->properties_count ?? 0) > 0 || $owner->units_count > 0 || $owner->contracts_count > 0;

            return $owner;
        });
});

Route::post('/owners', function (Request $request) {
    $data = $request->validate([
        'name' => ['required', 'string', 'max:255'],
        'phone' => ['nullable', 'string', 'max:50'],
        'email' => ['nullable', 'email', 'max:255'],
        'national_id' => ['nullable', 'string', 'max:50'],
        'type' => ['nullable', 'string', 'max:50'],
        'notes' => ['nullable', 'string'],
    ]);

    $owner = Owner::create([
        'name' => $data['name'],
        'phone' => $data['phone'] ?? null,
        'email' => $data['email'] ?? null,
        'national_id' => $data['national_id'] ?? null,
        'type' => $data['type'] ?? 'external',
        'notes' => $data['notes'] ?? null,
    ]);

    [$account, $accountMessage] = my_rentals_create_or_link_owner_account($owner);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم إضافة المالك بنجاح',
        'owner' => $owner,
        'account' => $account ? [
            'id' => $account->id,
            'name' => $account->name,
            'username' => $account->username ?? null,
            'email' => $account->email ?? null,
            'role' => $account->role ?? 'owner',
            'owner_id' => $account->owner_id ?? null,
            'status' => $account->status ?? 'active',
            'initial_password' => '123456',
        ] : null,
        'account_message' => $accountMessage,
    ], 201);
});



Route::get('/owners/{owner}/dashboard', [OwnerDashboardController::class, 'show']);
Route::get('/my/owners/{owner}/dashboard', [OwnerDashboardController::class, 'showScoped']);
