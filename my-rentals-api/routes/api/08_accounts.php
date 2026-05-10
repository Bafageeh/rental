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

Route::get('/owner-accounts', function () {
    $owners = Owner::orderBy('name')->get(['id', 'name', 'type']);

    $users = \App\Models\User::query()
        ->orderBy('id', 'desc')
        ->get()
        ->map(function ($user) use ($owners) {
            $owner = $owners->firstWhere('id', $user->owner_id ?? null);

            return [
                'id' => $user->id,
                'name' => $user->name,
                'username' => Schema::hasColumn('users', 'username') ? ($user->username ?? null) : null,
                'email' => $user->email,
                'role' => function_exists('myRentalsEffectiveRole') ? myRentalsEffectiveRole($user) : ($user->role ?? 'admin'),
                'owner_id' => $user->owner_id ?? null,
                'owner_name' => $owner?->name,
                'status' => $user->status ?? 'active',
                'created_at' => $user->created_at,
            ];
        });

    return response()->json([
        'owners' => $owners,
        'users' => $users,
    ]);
});

Route::post('/owner-accounts', function (Request $request) {
    $rules = [
        'owner_id' => ['required', 'integer', 'exists:owners,id'],
        'name' => ['required', 'string', 'max:255'],
        'email' => ['required', 'email', 'max:255', 'unique:users,email'],
        'password' => ['required', 'string', 'min:6'],
        'notes' => ['nullable', 'string'],
    ];

    if (Schema::hasColumn('users', 'username')) {
        $rules['username'] = ['nullable', 'string', 'max:255', 'unique:users,username'];
    }

    $data = $request->validate($rules);

    $user = new \App\Models\User();
    $user->name = $data['name'];
    $user->email = $data['email'];

    if (Schema::hasColumn('users', 'username')) {
        $baseUsername = trim((string) ($data['username'] ?? ''));
        if ($baseUsername === '') {
            $baseUsername = myRentalsAccountUsernameFromEmail($data['email']);
        }
        $user->username = myRentalsUniqueUsername($baseUsername);
    }

    $user->password = \Illuminate\Support\Facades\Hash::make($data['password']);

    if (\Illuminate\Support\Facades\Schema::hasColumn('users', 'role')) {
        $user->role = 'owner';
    }

    if (\Illuminate\Support\Facades\Schema::hasColumn('users', 'owner_id')) {
        $user->owner_id = $data['owner_id'];
    }

    if (\Illuminate\Support\Facades\Schema::hasColumn('users', 'status')) {
        $user->status = 'active';
    }

    if (\Illuminate\Support\Facades\Schema::hasColumn('users', 'notes')) {
        $user->notes = $data['notes'] ?? null;
    }

    $user->save();

    return response()->json([
        'status' => 'ok',
        'message' => 'تم إنشاء حساب المالك بنجاح',
        'user' => [
            'id' => $user->id,
            'name' => $user->name,
            'username' => Schema::hasColumn('users', 'username') ? ($user->username ?? null) : null,
            'email' => $user->email,
            'role' => $user->role ?? 'owner',
            'owner_id' => $user->owner_id ?? null,
            'status' => $user->status ?? 'active',
        ],
    ], 201);
});

Route::post('/owner-accounts/{user}/toggle-status', function (\App\Models\User $user) {
    $newStatus = (($user->status ?? 'active') === 'active') ? 'disabled' : 'active';

    if (\Illuminate\Support\Facades\Schema::hasColumn('users', 'status')) {
        $user->status = $newStatus;
        $user->save();
    }

    return response()->json([
        'status' => 'ok',
        'message' => $newStatus === 'active' ? 'تم تفعيل الحساب' : 'تم تعطيل الحساب',
        'user' => [
            'id' => $user->id,
            'name' => $user->name,
            'username' => Schema::hasColumn('users', 'username') ? ($user->username ?? null) : null,
            'email' => $user->email,
            'role' => $user->role ?? 'owner',
            'owner_id' => $user->owner_id ?? null,
            'status' => $user->status ?? $newStatus,
        ],
    ]);
});
