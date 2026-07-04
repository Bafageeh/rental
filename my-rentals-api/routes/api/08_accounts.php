<?php

// PHASE2_ROUTE_MODULES: generated from routes/api.php on 2026-04-27-083758.
// Section: Owner Accounts

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
use Illuminate\Support\Str;

/*
|--------------------------------------------------------------------------
| Owner Accounts
|--------------------------------------------------------------------------
*/

if (! function_exists('myRentalsAccountUsernameFromEmail')) {
    function myRentalsAccountUsernameFromEmail(string $email): string
    {
        $base = strtolower(trim((string) Str::before($email, '@')));
        $base = preg_replace('/[^a-z0-9._-]+/', '', $base) ?: 'user';
        return substr($base, 0, 50);
    }
}

if (! function_exists('myRentalsUniqueUsername')) {
    function myRentalsUniqueUsername(string $base, ?int $ignoreUserId = null): string
    {
        $base = trim($base) !== '' ? $base : 'user';
        $username = $base;
        $counter = 1;

        while (\App\Models\User::query()
            ->when($ignoreUserId, fn ($query) => $query->where('id', '!=', $ignoreUserId))
            ->whereRaw('LOWER(username) = ?', [mb_strtolower($username)])
            ->exists()) {
            $counter++;
            $username = substr($base, 0, 45) . $counter;
        }

        return $username;
    }
}

if (! function_exists('myRentalsAccountCurrentUser')) {
    function myRentalsAccountCurrentUser(Request $request): ?\App\Models\User
    {
        $user = $request->user();
        if ($user instanceof \App\Models\User) return $user;
        if (function_exists('my_rentals_current_user_for_scope')) {
            $scoped = my_rentals_current_user_for_scope($request);
            if ($scoped instanceof \App\Models\User) return $scoped;
        }
        if (function_exists('my_rentals_bearer_user')) {
            $bearer = my_rentals_bearer_user($request);
            if ($bearer instanceof \App\Models\User) return $bearer;
        }
        return null;
    }
}

if (! function_exists('myRentalsAccountEffectiveRole')) {
    function myRentalsAccountEffectiveRole($user): string
    {
        if ($user && method_exists($user, 'effectiveRole')) return $user->effectiveRole();
        if (function_exists('myRentalsEffectiveRole')) return myRentalsEffectiveRole($user);
        $role = strtolower(trim((string) ($user->role ?? '')));
        return $role !== '' ? $role : 'admin';
    }
}

if (! function_exists('myRentalsAccountPhoneVariants')) {
    function myRentalsAccountPhoneVariants(?string $value): array
    {
        $digits = preg_replace('/\D+/', '', (string) $value) ?: '';
        if ($digits === '') return [];
        $variants = [$digits];
        if (str_starts_with($digits, '9665') && strlen($digits) === 12) {
            $variants[] = '0' . substr($digits, 3);
            $variants[] = substr($digits, 3);
        }
        if (str_starts_with($digits, '05') && strlen($digits) === 10) {
            $variants[] = '966' . substr($digits, 1);
            $variants[] = substr($digits, 1);
        }
        if (str_starts_with($digits, '5') && strlen($digits) === 9) {
            $variants[] = '05' . substr($digits, 1);
            $variants[] = '966' . $digits;
        }
        return array_values(array_unique(array_filter($variants)));
    }
}

if (! function_exists('myRentalsAccountDisplayPhone')) {
    function myRentalsAccountDisplayPhone(\App\Models\User $user): ?string
    {
        $source = trim((string) ($user->phone ?: $user->username ?: ''));
        $variants = myRentalsAccountPhoneVariants($source);
        foreach ($variants as $variant) {
            if (str_starts_with($variant, '05') && strlen($variant) === 10) return $variant;
        }
        return $variants[0] ?? ($source !== '' ? $source : null);
    }
}

if (! function_exists('myRentalsManagerOwnerIdentity')) {
    function myRentalsManagerOwnerIdentity(\App\Models\User $user): string
    {
        foreach ([$user->national_id ?? null, $user->username ?? null, $user->phone ?? null] as $value) {
            $digits = preg_replace('/\D+/', '', (string) $value) ?: '';
            if (strlen($digits) >= 6) return $digits;
        }
        return 'manager-' . (int) $user->id;
    }
}

if (! function_exists('myRentalsEnsureManagerOwner')) {
    function myRentalsEnsureManagerOwner(\App\Models\User $user): ?Owner
    {
        $role = strtolower(trim((string) ($user->role ?? '')));
        if ($role !== 'manager') return null;

        $identity = myRentalsManagerOwnerIdentity($user);
        $phone = myRentalsAccountDisplayPhone($user);
        $email = trim((string) ($user->email ?? '')) ?: null;
        $name = trim((string) ($user->name ?? '')) ?: ('مدير عقارات #' . $user->id);

        $query = Owner::withoutGlobalScopes();
        $owner = null;

        if (Schema::hasColumn('users', 'owner_id') && !empty($user->owner_id)) {
            $owner = (clone $query)->where('id', (int) $user->owner_id)->first();
        }

        if (!$owner && Schema::hasColumn('owners', 'manager_id')) {
            $owner = (clone $query)->where('manager_id', (int) $user->id)
                ->where(function ($q) use ($identity, $phone, $email, $name) {
                    $q->where('national_id', $identity);
                    if ($phone) {
                        $q->orWhereIn('phone', myRentalsAccountPhoneVariants($phone));
                    }
                    if ($email) $q->orWhere('email', $email);
                    $q->orWhere('name', $name);
                })
                ->first();
        }

        if (!$owner) {
            $owner = (clone $query)->where('national_id', $identity)->first();
        }

        if (!$owner && $phone) {
            $owner = (clone $query)->whereIn('phone', myRentalsAccountPhoneVariants($phone))->first();
        }

        if (!$owner && $email) {
            $owner = (clone $query)->where('email', $email)->first();
        }

        if (!$owner) {
            $payload = [
                'name' => $name,
                'phone' => $phone,
                'email' => $email,
                'national_id' => $identity,
                'type' => 'external',
                'notes' => 'تم إنشاؤه تلقائيًا لأن المستخدم مدير عقارات ويجب أن يظهر ضمن الملاك.',
            ];
            if (Schema::hasColumn('owners', 'manager_id')) {
                $payload['manager_id'] = (int) $user->id;
            }
            $owner = Owner::withoutGlobalScopes()->create($payload);
        } else {
            $changed = false;
            if (trim((string) ($owner->name ?? '')) === '' || str_starts_with((string) $owner->name, 'مدير عقارات #')) {
                $owner->name = $name; $changed = true;
            }
            if ($phone && empty($owner->phone)) { $owner->phone = $phone; $changed = true; }
            if ($email && empty($owner->email)) { $owner->email = $email; $changed = true; }
            if (empty($owner->national_id)) { $owner->national_id = $identity; $changed = true; }
            if (Schema::hasColumn('owners', 'manager_id') && (int) ($owner->manager_id ?? 0) !== (int) $user->id) {
                $owner->manager_id = (int) $user->id; $changed = true;
            }
            if (empty($owner->type) || in_array((string) $owner->type, ['manager', 'self', 'admin'], true)) {
                $owner->type = 'external'; $changed = true;
            }
            if ($changed) $owner->save();
        }

        if (Schema::hasColumn('users', 'owner_id') && (int) ($user->owner_id ?? 0) !== (int) $owner->id) {
            $user->owner_id = $owner->id;
            $user->save();
        }

        return $owner->fresh();
    }
}

if (! function_exists('myRentalsEnsureExistingManagersOwners')) {
    function myRentalsEnsureExistingManagersOwners(): void
    {
        \App\Models\User::query()
            ->where('role', 'manager')
            ->when(Schema::hasColumn('users', 'status'), fn ($q) => $q->where(function ($x) { $x->whereNull('status')->orWhere('status', '<>', 'disabled'); }))
            ->get()
            ->each(fn ($manager) => myRentalsEnsureManagerOwner($manager));
    }
}

if (! function_exists('myRentalsAccountPayload')) {
    function myRentalsAccountPayload(\App\Models\User $user, ?\Illuminate\Support\Collection $owners = null): array
    {
        if (strtolower(trim((string) ($user->role ?? ''))) === 'manager') {
            myRentalsEnsureManagerOwner($user);
            $user = $user->fresh();
        }

        $owners = $owners ?: Owner::withoutGlobalScopes()->get(['id', 'name', 'type']);
        $owner = $owners->firstWhere('id', $user->owner_id ?? null);
        $status = $user->status ?? 'active';

        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => Schema::hasColumn('users', 'username') ? ($user->username ?? null) : null,
            'phone' => Schema::hasColumn('users', 'phone') ? ($user->phone ?? null) : null,
            'national_id' => Schema::hasColumn('users', 'national_id') ? ($user->national_id ?? null) : null,
            'email' => $user->email,
            'role' => function_exists('myRentalsEffectiveRole') ? myRentalsEffectiveRole($user) : ($user->role ?? 'admin'),
            'owner_id' => $user->owner_id ?? null,
            'owner_name' => $owner?->name,
            'status' => $status,
            'is_active' => !in_array($status, ['disabled', 'inactive', 'blocked'], true),
            'notes' => Schema::hasColumn('users', 'notes') ? ($user->notes ?? null) : null,
            'created_at' => $user->created_at,
            'updated_at' => $user->updated_at,
        ];
    }
}

if (! function_exists('myRentalsUpdateUserAccount')) {
    function myRentalsUpdateUserAccount(Request $request, \App\Models\User $user)
    {
        $input = $request->all();
        if (array_key_exists('password', $input) && trim((string) $input['password']) === '') unset($input['password']);

        $rules = [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255', 'unique:users,email,' . $user->id],
            'password' => ['sometimes', 'string', 'min:6'],
            'role' => ['sometimes', 'nullable', 'string', 'max:50'],
            'owner_id' => ['sometimes', 'nullable', 'integer', 'exists:owners,id'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'national_id' => ['sometimes', 'nullable', 'string', 'max:50'],
            'status' => ['sometimes', 'nullable', 'string', 'max:50'],
            'is_active' => ['sometimes', 'nullable'],
            'notes' => ['sometimes', 'nullable', 'string'],
        ];
        if (Schema::hasColumn('users', 'username')) $rules['username'] = ['sometimes', 'nullable', 'string', 'max:255', 'unique:users,username,' . $user->id];

        $validator = \Illuminate\Support\Facades\Validator::make($input, $rules);
        if ($validator->fails()) {
            return response()->json(['status' => 'error', 'message' => 'تعذر حفظ بيانات الحساب، راجع الحقول المدخلة.', 'errors' => $validator->errors()], 422);
        }

        $data = $validator->validated();
        if (array_key_exists('name', $data)) $user->name = $data['name'];
        if (array_key_exists('email', $data) && $data['email'] !== null) $user->email = $data['email'];
        if (Schema::hasColumn('users', 'username') && array_key_exists('username', $data)) {
            $baseUsername = trim((string) ($data['username'] ?? ''));
            if ($baseUsername === '') $baseUsername = $user->email ? myRentalsAccountUsernameFromEmail((string) $user->email) : 'user';
            $user->username = myRentalsUniqueUsername($baseUsername, $user->id);
        }
        if (Schema::hasColumn('users', 'phone') && array_key_exists('phone', $data)) $user->phone = $data['phone'] ?: null;
        if (Schema::hasColumn('users', 'national_id') && array_key_exists('national_id', $data)) $user->national_id = $data['national_id'] ?: null;
        if (array_key_exists('password', $data)) $user->password = \Illuminate\Support\Facades\Hash::make($data['password']);
        if (Schema::hasColumn('users', 'role') && array_key_exists('role', $data)) {
            $role = strtolower(trim((string) ($data['role'] ?? '')));
            $user->role = $role !== '' ? $role : ($user->role ?? 'owner');
        }
        if (Schema::hasColumn('users', 'owner_id') && array_key_exists('owner_id', $data)) {
            $user->owner_id = strtolower(trim((string) ($data['role'] ?? $user->role ?? ''))) === 'owner' ? ($data['owner_id'] ?: null) : ($user->owner_id ?: null);
        }
        if (Schema::hasColumn('users', 'status')) {
            if (array_key_exists('status', $data)) {
                $status = strtolower(trim((string) ($data['status'] ?? '')));
                $user->status = in_array($status, ['disabled', 'inactive', 'blocked'], true) ? 'disabled' : 'active';
            } elseif (array_key_exists('is_active', $data)) {
                $user->status = filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) === false ? 'disabled' : 'active';
            }
        }
        if (Schema::hasColumn('users', 'notes') && array_key_exists('notes', $data)) $user->notes = $data['notes'] ?? null;

        $user->save();
        $managerOwner = strtolower(trim((string) ($user->role ?? ''))) === 'manager' ? myRentalsEnsureManagerOwner($user) : null;

        return response()->json([
            'status' => 'ok',
            'message' => $managerOwner ? 'تم تحديث الحساب وربطه تلقائيًا كمالك ضمن قائمة الملاك.' : 'تم تحديث الحساب بنجاح',
            'user' => myRentalsAccountPayload($user->fresh()),
            'manager_owner' => $managerOwner,
        ]);
    }
}

if (! function_exists('myRentalsCreateUserAccount')) {
    function myRentalsCreateUserAccount(Request $request)
    {
        $rules = [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6'],
            'role' => ['nullable', 'string', 'max:50'],
            'owner_id' => ['nullable', 'integer', 'exists:owners,id'],
            'phone' => ['nullable', 'string', 'max:50'],
            'national_id' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string'],
        ];
        if (Schema::hasColumn('users', 'username')) $rules['username'] = ['nullable', 'string', 'max:255', 'unique:users,username'];
        $data = $request->validate($rules);
        $role = strtolower(trim((string) ($data['role'] ?? 'owner')));
        if ($role === '') $role = 'owner';
        if ($role === 'owner' && empty($data['owner_id'])) {
            return response()->json(['status' => 'error', 'message' => 'حساب المالك يجب ربطه بمالك.'], 422);
        }

        $user = new \App\Models\User();
        $user->name = $data['name'];
        $user->email = $data['email'] ?? myRentalsAccountUsernameFromEmail(($data['username'] ?? '') . '@rental.local') . '-' . now()->format('YmdHis') . '@rental.local';
        if (Schema::hasColumn('users', 'username')) {
            $baseUsername = trim((string) ($data['username'] ?? ''));
            if ($baseUsername === '') $baseUsername = trim((string) ($data['phone'] ?? '')) ?: myRentalsAccountUsernameFromEmail($user->email);
            $user->username = myRentalsUniqueUsername($baseUsername);
        }
        if (Schema::hasColumn('users', 'phone')) $user->phone = $data['phone'] ?? null;
        if (Schema::hasColumn('users', 'national_id')) $user->national_id = $data['national_id'] ?? null;
        $user->password = \Illuminate\Support\Facades\Hash::make($data['password']);
        if (Schema::hasColumn('users', 'role')) $user->role = $role;
        if (Schema::hasColumn('users', 'owner_id')) $user->owner_id = $role === 'owner' ? ($data['owner_id'] ?? null) : null;
        if (Schema::hasColumn('users', 'status')) $user->status = 'active';
        if (Schema::hasColumn('users', 'notes')) $user->notes = $data['notes'] ?? null;
        $user->save();

        $managerOwner = $role === 'manager' ? myRentalsEnsureManagerOwner($user) : null;
        $user = $user->fresh();

        return response()->json([
            'status' => 'ok',
            'message' => $managerOwner ? 'تم إنشاء مدير العقارات وإنشاؤه تلقائيًا كمالك ضمن قائمة الملاك.' : 'تم إنشاء الحساب بنجاح',
            'user' => myRentalsAccountPayload($user),
            'manager_owner' => $managerOwner,
        ], 201);
    }
}

Route::get('/owner-accounts', function () {
    myRentalsEnsureExistingManagersOwners();
    $owners = Owner::withoutGlobalScopes()->orderBy('name')->get(['id', 'name', 'type']);
    $users = \App\Models\User::query()->orderBy('id', 'desc')->get()->map(fn ($user) => myRentalsAccountPayload($user, $owners));
    return response()->json(['owners' => $owners, 'users' => $users]);
});

Route::get('/user-accounts', function () {
    myRentalsEnsureExistingManagersOwners();
    $owners = Owner::withoutGlobalScopes()->orderBy('name')->get(['id', 'name', 'type']);
    return \App\Models\User::query()->orderBy('id', 'desc')->get()->map(fn ($user) => myRentalsAccountPayload($user, $owners))->values();
});

Route::get('/my/user-accounts', function (Request $request) {
    myRentalsEnsureExistingManagersOwners();
    $user = myRentalsAccountCurrentUser($request);
    $owners = Owner::withoutGlobalScopes()->orderBy('name')->get(['id', 'name', 'type']);
    $query = \App\Models\User::query()->orderBy('id', 'desc');
    if ($user && myRentalsAccountEffectiveRole($user) === 'manager' && Schema::hasColumn('users', 'manager_id')) {
        $query->where(function ($q) use ($user) { $q->where('id', $user->id)->orWhere('manager_id', $user->id); });
    }
    return $query->get()->map(fn ($account) => myRentalsAccountPayload($account, $owners))->values();
});

Route::get('/my/owners', function (Request $request) {
    myRentalsEnsureExistingManagersOwners();
    $user = myRentalsAccountCurrentUser($request);
    $query = Owner::withCount('properties');
    if ($user && myRentalsAccountEffectiveRole($user) === 'manager' && Schema::hasColumn('owners', 'manager_id')) {
        $query->withoutGlobalScopes()->where('manager_id', $user->id);
    }
    return $query->orderBy('type')->orderBy('name')->get()->map(function ($owner) {
        $owner->units_count = Unit::whereHas('property', fn ($query) => $query->where('owner_id', $owner->id))->count();
        $owner->contracts_count = Contract::whereHas('unit.property', fn ($query) => $query->where('owner_id', $owner->id))->count();
        return $owner;
    })->values();
});

Route::post('/user-accounts', fn (Request $request) => myRentalsCreateUserAccount($request));

Route::post('/owner-accounts', function (Request $request) {
    $rules = [
        'owner_id' => ['required', 'integer', 'exists:owners,id'],
        'name' => ['required', 'string', 'max:255'],
        'email' => ['required', 'email', 'max:255', 'unique:users,email'],
        'password' => ['required', 'string', 'min:6'],
        'notes' => ['nullable', 'string'],
    ];
    if (Schema::hasColumn('users', 'username')) $rules['username'] = ['nullable', 'string', 'max:255', 'unique:users,username'];
    $data = $request->validate($rules);
    $request->merge(['role' => 'owner'] + $data);
    return myRentalsCreateUserAccount($request);
});

Route::post('/owner-accounts/{user}/update', fn (Request $request, \App\Models\User $user) => myRentalsUpdateUserAccount($request, $user));
Route::put('/owner-accounts/{user}', fn (Request $request, \App\Models\User $user) => myRentalsUpdateUserAccount($request, $user));
Route::patch('/owner-accounts/{user}', fn (Request $request, \App\Models\User $user) => myRentalsUpdateUserAccount($request, $user));
Route::post('/user-accounts/{user}/update', fn (Request $request, \App\Models\User $user) => myRentalsUpdateUserAccount($request, $user));
Route::put('/user-accounts/{user}', fn (Request $request, \App\Models\User $user) => myRentalsUpdateUserAccount($request, $user));
Route::patch('/user-accounts/{user}', fn (Request $request, \App\Models\User $user) => myRentalsUpdateUserAccount($request, $user));

Route::post('/owner-accounts/{user}/toggle-status', function (\App\Models\User $user) {
    $newStatus = (($user->status ?? 'active') === 'active') ? 'disabled' : 'active';
    if (Schema::hasColumn('users', 'status')) { $user->status = $newStatus; $user->save(); }
    return response()->json(['status' => 'ok', 'message' => $newStatus === 'active' ? 'تم تفعيل الحساب' : 'تم تعطيل الحساب', 'user' => myRentalsAccountPayload($user->fresh())]);
});
Route::post('/user-accounts/{user}/toggle-active', function (\App\Models\User $user) {
    $newStatus = (($user->status ?? 'active') === 'active') ? 'disabled' : 'active';
    if (Schema::hasColumn('users', 'status')) { $user->status = $newStatus; $user->save(); }
    return response()->json(['status' => 'ok', 'message' => $newStatus === 'active' ? 'تم تفعيل الحساب' : 'تم تعطيل الحساب', 'user' => myRentalsAccountPayload($user->fresh())]);
});
Route::post('/user-accounts/{user}/reset-password', function (Request $request, \App\Models\User $user) {
    $data = $request->validate(['password' => ['nullable', 'string', 'min:6']]);
    $user->password = \Illuminate\Support\Facades\Hash::make($data['password'] ?? '12345678');
    $user->save();
    return response()->json(['status' => 'ok', 'message' => 'تم تغيير كلمة المرور بنجاح']);
});
