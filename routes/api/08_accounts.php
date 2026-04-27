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

/*
|--------------------------------------------------------------------------
| Owner Accounts
|--------------------------------------------------------------------------
*/

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
    $data = $request->validate([
        'owner_id' => ['required', 'integer', 'exists:owners,id'],
        'name' => ['required', 'string', 'max:255'],
        'email' => ['required', 'email', 'max:255', 'unique:users,email'],
        'password' => ['required', 'string', 'min:6'],
        'notes' => ['nullable', 'string'],
    ]);

    $user = new \App\Models\User();
    $user->name = $data['name'];
    $user->email = $data['email'];
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
            'email' => $user->email,
            'role' => $user->role ?? 'owner',
            'owner_id' => $user->owner_id ?? null,
            'status' => $user->status ?? $newStatus,
        ],
    ]);
});
