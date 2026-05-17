<?php

use App\Models\Owner;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/*
|--------------------------------------------------------------------------
| Admin User Accounts
|--------------------------------------------------------------------------
| شاشة #S-453: إدارة المستخدمين وربط حسابات الملاك.
*/

if (!function_exists('my_rentals_user_accounts_request_user')) {
    function my_rentals_user_accounts_request_user(Request $request): ?User
    {
        if ($request->user() instanceof User) {
            return $request->user();
        }

        if (function_exists('my_rentals_current_user_for_scope')) {
            $user = my_rentals_current_user_for_scope($request);
            if ($user instanceof User) {
                return $user;
            }
        }

        if (function_exists('my_rentals_bearer_user')) {
            $user = my_rentals_bearer_user($request);
            if ($user instanceof User) {
                return $user;
            }
        }

        if (function_exists('myRentalsApiUser')) {
            $user = myRentalsApiUser($request);
            if ($user) {
                return User::query()->find($user->id ?? null);
            }
        }

        return null;
    }
}

if (!function_exists('my_rentals_user_accounts_is_admin')) {
    function my_rentals_user_accounts_is_admin(?User $user): bool
    {
        if (!$user) {
            return false;
        }

        if (method_exists($user, 'isAdmin')) {
            return $user->isAdmin();
        }

        if (function_exists('my_rentals_is_admin_user')) {
            return my_rentals_is_admin_user($user);
        }

        $role = function_exists('my_rentals_effective_role')
            ? my_rentals_effective_role($user)
            : strtolower((string) ($user->role ?? 'admin'));

        return in_array($role, ['admin', 'manager', 'super_admin'], true);
    }
}

if (!function_exists('my_rentals_user_accounts_require_admin')) {
    function my_rentals_user_accounts_require_admin(Request $request): array
    {
        $user = my_rentals_user_accounts_request_user($request);

        if (!$user) {
            return [null, response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول مرة أخرى.'], 401)];
        }

        if (!my_rentals_user_accounts_is_admin($user)) {
            return [null, response()->json(['message' => 'هذه الشاشة متاحة للمدير فقط.'], 403)];
        }

        return [$user, null];
    }
}

if (!function_exists('my_rentals_user_accounts_normalize_role')) {
    function my_rentals_user_accounts_normalize_role(?string $role): string
    {
        $role = strtolower(trim((string) $role));
        $role = str_replace(['-', ' '], '_', $role);

        return match ($role) {
            'superadmin', 'super_admin' => 'super_admin',
            'manager', 'agent', 'property_manager' => 'manager',
            'owner', 'landlord', 'مالك', 'المالك' => 'owner',
            default => in_array($role, ['admin', 'super_admin', 'manager', 'owner'], true) ? $role : 'owner',
        };
    }
}

if (!function_exists('my_rentals_user_accounts_status')) {
    function my_rentals_user_accounts_status($value): string
    {
        $status = strtolower(trim((string) ($value ?? 'active')));

        return in_array($status, ['inactive', 'disabled', 'suspended', '0', 'false'], true) ? 'inactive' : 'active';
    }
}

if (!function_exists('my_rentals_user_accounts_role_label')) {
    function my_rentals_user_accounts_role_label(string $role): string
    {
        return match ($role) {
            'super_admin' => 'مدير عام',
            'admin' => 'مدير',
            'manager' => 'مدير عقارات',
            'owner' => 'مالك',
            default => $role,
        };
    }
}

if (!function_exists('my_rentals_user_accounts_email_exists')) {
    function my_rentals_user_accounts_email_exists(string $email, ?int $ignoreId = null): bool
    {
        if (!Schema::hasColumn('users', 'email')) {
            return false;
        }

        return User::query()
            ->where('email', $email)
            ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->exists();
    }
}

if (!function_exists('my_rentals_user_accounts_unique_email')) {
    function my_rentals_user_accounts_unique_email(?string $preferred, string $username, ?int $ignoreId = null): string
    {
        $preferred = trim((string) $preferred);

        if ($preferred !== '' && filter_var($preferred, FILTER_VALIDATE_EMAIL) && !my_rentals_user_accounts_email_exists($preferred, $ignoreId)) {
            return $preferred;
        }

        $base = Str::ascii($username);
        $base = strtolower(preg_replace('/[^a-z0-9._-]+/i', '', $base) ?: 'user');
        $base = trim($base, '._-') ?: 'user';

        for ($i = 0; $i < 20; $i++) {
            $suffix = $i === 0 ? '' : '-' . $i;
            $email = $base . $suffix . '@rental.local';

            if (!my_rentals_user_accounts_email_exists($email, $ignoreId)) {
                return $email;
            }
        }

        return 'user-' . now()->format('YmdHis') . '-' . Str::lower(Str::random(6)) . '@rental.local';
    }
}

if (!function_exists('my_rentals_user_accounts_owner_metrics')) {
    function my_rentals_user_accounts_owner_metrics(?int $ownerId): array
    {
        if (!$ownerId) {
            return [
                'properties_count' => 0,
                'units_count' => 0,
                'contracts_count' => 0,
            ];
        }

        $propertiesCount = Schema::hasTable('properties')
            ? DB::table('properties')->where('owner_id', $ownerId)->count()
            : 0;

        $unitsCount = 0;
        if (Schema::hasTable('units') && Schema::hasTable('properties')) {
            $unitsCount = DB::table('units')
                ->join('properties', 'properties.id', '=', 'units.property_id')
                ->where('properties.owner_id', $ownerId)
                ->count();
        }

        $contractsCount = 0;
        if (Schema::hasTable('contracts') && Schema::hasTable('units') && Schema::hasTable('properties')) {
            $contractsCount = DB::table('contracts')
                ->join('units', 'units.id', '=', 'contracts.unit_id')
                ->join('properties', 'properties.id', '=', 'units.property_id')
                ->where('properties.owner_id', $ownerId)
                ->count();
        }

        return [
            'properties_count' => (int) $propertiesCount,
            'units_count' => (int) $unitsCount,
            'contracts_count' => (int) $contractsCount,
        ];
    }
}

if (!function_exists('my_rentals_user_accounts_format')) {
    function my_rentals_user_accounts_format(User $user): array
    {
        $user->loadMissing('owner');

        $role = method_exists($user, 'effectiveRole')
            ? $user->effectiveRole()
            : my_rentals_user_accounts_normalize_role((string) ($user->role ?? 'owner'));

        $ownerId = $user->owner_id ? (int) $user->owner_id : null;
        $metrics = my_rentals_user_accounts_owner_metrics($ownerId);
        $status = my_rentals_user_accounts_status($user->status ?? 'active');

        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username ?? null,
            'email' => $user->email ?? null,
            'role' => $role,
            'role_label' => my_rentals_user_accounts_role_label($role),
            'owner_id' => $ownerId,
            'owner_name' => $user->owner?->name,
            'owner' => $user->owner ? [
                'id' => $user->owner->id,
                'name' => $user->owner->name,
                'phone' => $user->owner->phone ?? null,
                'email' => $user->owner->email ?? null,
            ] : null,
            'status' => $status,
            'status_label' => $status === 'active' ? 'نشط' : 'معطل',
            'is_active' => $status === 'active',
            'notes' => $user->notes ?? null,
            'last_login_at' => optional($user->last_login_at)->toDateTimeString(),
            'created_at' => optional($user->created_at)->toDateTimeString(),
            'updated_at' => optional($user->updated_at)->toDateTimeString(),
            ...$metrics,
        ];
    }
}

if (!function_exists('my_rentals_user_accounts_validate_username')) {
    function my_rentals_user_accounts_validate_username(string $username): ?string
    {
        $username = trim($username);

        if ($username === '') {
            return 'رقم الدخول/اسم المستخدم مطلوب.';
        }

        if (!preg_match('/^[\pL\pN._-]+$/u', $username)) {
            return 'اسم المستخدم يقبل حروف وأرقام فقط، مع السماح بالنقطة والشرطة والشرطة السفلية.';
        }

        return null;
    }
}

Route::get('/my/user-accounts', function (Request $request) {
    [$admin, $error] = my_rentals_user_accounts_require_admin($request);
    if ($error) {
        return $error;
    }

    return User::query()
        ->with('owner')
        ->orderByRaw("CASE WHEN owner_id IS NULL THEN 0 ELSE 1 END")
        ->orderBy('id', 'desc')
        ->get()
        ->map(fn (User $user) => my_rentals_user_accounts_format($user))
        ->values();
});

Route::get('/my/user-accounts/lookups', function (Request $request) {
    [$admin, $error] = my_rentals_user_accounts_require_admin($request);
    if ($error) {
        return $error;
    }

    $owners = Owner::query()
        ->withCount('properties')
        ->orderBy('name')
        ->get()
        ->map(function (Owner $owner) {
            $metrics = my_rentals_user_accounts_owner_metrics((int) $owner->id);

            return [
                'id' => $owner->id,
                'name' => $owner->name,
                'phone' => $owner->phone ?? null,
                'email' => $owner->email ?? null,
                ...$metrics,
            ];
        })
        ->values();

    return response()->json([
        'status' => 'ok',
        'owners' => $owners,
        'roles' => [
            ['value' => 'owner', 'label' => 'مالك'],
            ['value' => 'manager', 'label' => 'مدير عقارات'],
            ['value' => 'admin', 'label' => 'مدير'],
        ],
        'statuses' => [
            ['value' => 'active', 'label' => 'نشط'],
            ['value' => 'inactive', 'label' => 'معطل'],
        ],
    ]);
});

Route::post('/my/user-accounts', function (Request $request) {
    [$admin, $error] = my_rentals_user_accounts_require_admin($request);
    if ($error) {
        return $error;
    }

    $rules = [
        'name' => ['required', 'string', 'max:255'],
        'username' => ['required', 'string', 'max:255', Rule::unique('users', 'username')],
        'email' => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')],
        'password' => ['required', 'string', 'min:6', 'max:255'],
        'role' => ['nullable', 'string', 'max:50'],
        'owner_id' => ['nullable', 'integer', 'exists:owners,id'],
        'status' => ['nullable', 'string', 'max:50'],
        'notes' => ['nullable', 'string', 'max:1000'],
    ];

    $data = $request->validate($rules);
    $username = trim((string) $data['username']);

    if ($message = my_rentals_user_accounts_validate_username($username)) {
        return response()->json(['message' => $message], 422);
    }

    $role = my_rentals_user_accounts_normalize_role($data['role'] ?? 'owner');
    $ownerId = $data['owner_id'] ?? null;

    if ($role === 'owner' && empty($ownerId)) {
        return response()->json(['message' => 'اختر المالك المرتبط بحساب المالك.'], 422);
    }

    $owner = $ownerId ? Owner::query()->find($ownerId) : null;
    $email = my_rentals_user_accounts_unique_email($data['email'] ?? ($owner->email ?? null), $username);

    $payload = [
        'name' => trim((string) $data['name']),
        'username' => $username,
        'email' => $email,
        'password' => Hash::make((string) $data['password']),
        'role' => $role,
        'owner_id' => $ownerId,
        'status' => my_rentals_user_accounts_status($data['status'] ?? 'active'),
    ];

    if (Schema::hasColumn('users', 'notes')) {
        $payload['notes'] = $data['notes'] ?? null;
    }

    $user = User::query()->create($payload);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم إنشاء الحساب بنجاح.',
        'data' => my_rentals_user_accounts_format($user),
        'account' => my_rentals_user_accounts_format($user),
    ], 201);
});

Route::match(['put', 'patch', 'post'], '/my/user-accounts/{account}', function (Request $request, $account) {
    [$admin, $error] = my_rentals_user_accounts_require_admin($request);
    if ($error) {
        return $error;
    }

    $user = User::query()->findOrFail((int) $account);

    $rules = [
        'name' => ['sometimes', 'required', 'string', 'max:255'],
        'username' => ['sometimes', 'required', 'string', 'max:255', Rule::unique('users', 'username')->ignore($user->id)],
        'email' => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
        'password' => ['nullable', 'string', 'min:6', 'max:255'],
        'role' => ['nullable', 'string', 'max:50'],
        'owner_id' => ['nullable', 'integer', 'exists:owners,id'],
        'status' => ['nullable', 'string', 'max:50'],
        'notes' => ['nullable', 'string', 'max:1000'],
    ];

    $data = $request->validate($rules);

    if (array_key_exists('username', $data)) {
        $username = trim((string) $data['username']);

        if ($message = my_rentals_user_accounts_validate_username($username)) {
            return response()->json(['message' => $message], 422);
        }

        $user->username = $username;
    }

    if (array_key_exists('name', $data)) {
        $user->name = trim((string) $data['name']);
    }

    if (array_key_exists('role', $data)) {
        $user->role = my_rentals_user_accounts_normalize_role($data['role']);
    }

    if (array_key_exists('owner_id', $data)) {
        $user->owner_id = $data['owner_id'] ?: null;
    }

    $role = my_rentals_user_accounts_normalize_role((string) ($user->role ?? 'owner'));
    if ($role === 'owner' && empty($user->owner_id)) {
        return response()->json(['message' => 'حساب المالك يجب ربطه بمالك محدد.'], 422);
    }

    if (array_key_exists('status', $data)) {
        $user->status = my_rentals_user_accounts_status($data['status']);
    }

    if (array_key_exists('email', $data)) {
        $user->email = my_rentals_user_accounts_unique_email($data['email'] ?? null, (string) ($user->username ?? ('user' . $user->id)), $user->id);
    }

    if (!empty($data['password'])) {
        $user->password = Hash::make((string) $data['password']);
    }

    if (Schema::hasColumn('users', 'notes') && array_key_exists('notes', $data)) {
        $user->notes = $data['notes'];
    }

    $user->save();

    return response()->json([
        'status' => 'ok',
        'message' => 'تم تحديث الحساب بنجاح.',
        'data' => my_rentals_user_accounts_format($user),
        'account' => my_rentals_user_accounts_format($user),
    ]);
});

Route::post('/my/user-accounts/{account}/status', function (Request $request, $account) {
    [$admin, $error] = my_rentals_user_accounts_require_admin($request);
    if ($error) {
        return $error;
    }

    $user = User::query()->findOrFail((int) $account);
    $user->status = my_rentals_user_accounts_status($request->input('status', ($user->status ?? 'active') === 'active' ? 'inactive' : 'active'));
    $user->save();

    return response()->json([
        'status' => 'ok',
        'message' => 'تم تحديث حالة الحساب.',
        'data' => my_rentals_user_accounts_format($user),
        'account' => my_rentals_user_accounts_format($user),
    ]);
});

Route::post('/my/user-accounts/{account}/delete', function (Request $request, $account) {
    [$admin, $error] = my_rentals_user_accounts_require_admin($request);
    if ($error) {
        return $error;
    }

    $user = User::query()->findOrFail((int) $account);

    if ((int) $admin->id === (int) $user->id) {
        return response()->json(['message' => 'لا يمكن حذف الحساب المستخدم حاليًا.'], 422);
    }

    $user->delete();

    return response()->json([
        'status' => 'ok',
        'message' => 'تم حذف الحساب بنجاح.',
    ]);
});
