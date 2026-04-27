<?php

// PHASE2_ROUTE_MODULES: generated from routes/api.php on 2026-04-27-083758.
// Section: Auth & Permissions

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
| Auth & Permissions
|--------------------------------------------------------------------------
*/

if (!function_exists('myRentalsRequestToken')) {
    function myRentalsRequestToken(\Illuminate\Http\Request $request): ?string
    {
        $token = $request->bearerToken();

        if (!$token) {
            $authorization = $request->header('Authorization')
                ?: $request->server('HTTP_AUTHORIZATION')
                ?: $request->server('REDIRECT_HTTP_AUTHORIZATION')
                ?: '';

            if (is_string($authorization) && preg_match('/Bearer\\s+(.+)/i', $authorization, $matches)) {
                $token = trim($matches[1]);
            }
        }

        if (!$token) {
            $token = $request->header('X-Api-Token')
                ?: $request->server('HTTP_X_API_TOKEN')
                ?: $request->input('api_token')
                ?: $request->query('api_token');
        }

        if (!is_string($token)) {
            return null;
        }

        $token = trim($token);

        return $token !== '' ? $token : null;
    }
}

if (!function_exists('myRentalsApiUser')) {
    function myRentalsApiUser(\Illuminate\Http\Request $request) {
        if ($request->user()) {
            return $request->user();
        }

        $token = myRentalsRequestToken($request);

        if (!$token) {
            return null;
        }

        $query = \Illuminate\Support\Facades\DB::table('users');
        $hashedToken = hash('sha256', $token);
        $hasApiToken = \Illuminate\Support\Facades\Schema::hasColumn('users', 'api_token');
        $hasRememberToken = \Illuminate\Support\Facades\Schema::hasColumn('users', 'remember_token');

        if ($hasApiToken && $hasRememberToken) {
            $query->where(function ($q) use ($token, $hashedToken) {
                $q->where('api_token', $hashedToken)->orWhere('api_token', $token);
            });
        } elseif ($hasApiToken) {
            $query->where(function ($q) use ($token, $hashedToken) {
                $q->where('api_token', $hashedToken)->orWhere('api_token', $token);
            });
        } elseif ($hasRememberToken) {
            $query->where(function ($q) use ($token, $hashedToken) {
                $q->where('remember_token', $hashedToken)->orWhere('remember_token', $token);
            });
        } else {
            return null;
        }

        if (\Illuminate\Support\Facades\Schema::hasColumn('users', 'is_active')) {
            $query->where(function ($q) {
                $q->where('is_active', true)->orWhereNull('is_active');
            });
        }

        if (\Illuminate\Support\Facades\Schema::hasColumn('users', 'status')) {
            $query->where(function ($q) {
                $q->where('status', 'active')->orWhereNull('status');
            });
        }

        return $query->first();
    }
}


if (!function_exists('myRentalsEffectiveRole')) {
    function myRentalsEffectiveRole($user): string
    {
        $role = strtolower(trim((string) ($user->role ?? '')));
        $ownerId = $user->owner_id ?? null;

        /*
         * تصحيح مهم للصلاحيات:
         * المستخدمون القدامى الذين أُنشئوا قبل نظام حسابات الملاك قد تكون
         * قيمتهم role=owner بدون ربط owner_id. هذا ليس حساب مالك حقيقي،
         * لذلك نعامله كمدير حتى لا تُحجب شاشات الملاك والعقود والإدارة.
         * حساب المالك الحقيقي يجب أن يكون role=owner ومعه owner_id.
         */
        if ($role === '' || $role === 'null') {
            return 'admin';
        }

        if ($role === 'owner' && empty($ownerId)) {
            return 'admin';
        }

        return $role;
    }
}


if (!function_exists('myRentalsOwnerScopedPropertyIds')) {
    function myRentalsOwnerScopedPropertyIds($user) {
        $query = \Illuminate\Support\Facades\DB::table('properties');

        if ($user && ($user->role ?? null) === 'owner' && !empty($user->owner_id)) {
            $query->where('owner_id', $user->owner_id);
        }

        return $query->pluck('id')->all();
    }
}

// Legacy plain-token /auth/login closure removed. AuthController::login is the only login endpoint.


// Legacy /auth/logout closure removed. AuthController::logout is the only logout endpoint.


// Legacy /auth/me closure removed. AuthController::me is the only current-user endpoint.


Route::get('/auth/scoped-dashboard', function (\Illuminate\Http\Request $request) {
    $user = myRentalsApiUser($request);

    if (!$user) {
        return response()->json([
            'message' => 'غير مسجل الدخول',
        ], 401);
    }

    $propertyIds = myRentalsOwnerScopedPropertyIds($user);

    $unitIds = \Illuminate\Support\Facades\DB::table('units')
        ->whereIn('property_id', $propertyIds)
        ->pluck('id')
        ->all();

    $contractIds = \Illuminate\Support\Facades\DB::table('contracts')
        ->whereIn('unit_id', $unitIds)
        ->pluck('id')
        ->all();

    $paymentsBase = \Illuminate\Support\Facades\DB::table('payments')
        ->whereIn('contract_id', $contractIds);

    $totalPaid = (clone $paymentsBase)->where('status', 'paid')->sum('amount');
    $totalDue = (clone $paymentsBase)->whereIn('status', ['due', 'overdue'])->sum('amount');
    $overdueAmount = (clone $paymentsBase)->where('status', 'overdue')->sum('amount');
    $overdueCount = (clone $paymentsBase)->where('status', 'overdue')->count();

    $expenses = 0;
    if (\Illuminate\Support\Facades\Schema::hasTable('property_expenses')) {
        $expenses = \Illuminate\Support\Facades\DB::table('property_expenses')
            ->whereIn('property_id', $propertyIds)
            ->sum('amount');
    }

    $owners = [];
    if (($user->role ?? null) === 'owner' && !empty($user->owner_id)) {
        $owners = \Illuminate\Support\Facades\DB::table('owners')
            ->where('id', $user->owner_id)
            ->get();
    } else {
        $owners = \Illuminate\Support\Facades\DB::table('owners')
            ->orderBy('name')
            ->get();
    }

    return response()->json([
        'status' => 'ok',
        'scope' => [
            'role' => function_exists('myRentalsEffectiveRole') ? myRentalsEffectiveRole($user) : ($user->role ?? 'admin'),
            'owner_id' => $user->owner_id ?? null,
        ],
        'summary' => [
            'owners_count' => count($owners),
            'properties_count' => count($propertyIds),
            'units_count' => count($unitIds),
            'contracts_count' => count($contractIds),
            'active_contracts_count' => \Illuminate\Support\Facades\DB::table('contracts')
                ->whereIn('id', $contractIds)
                ->where('status', 'active')
                ->count(),
            'total_paid' => (float) $totalPaid,
            'total_due' => (float) $totalDue,
            'overdue_amount' => (float) $overdueAmount,
            'overdue_count' => $overdueCount,
            'total_expenses' => (float) $expenses,
            'net_income' => (float) $totalPaid - (float) $expenses,
        ],
        'owners' => $owners,
        'properties' => \Illuminate\Support\Facades\DB::table('properties')
            ->whereIn('id', $propertyIds)
            ->orderBy('id', 'desc')
            ->get(),
    ]);
});

/* AUTH_PERMISSIONS_PATCH_END */


/*
|--------------------------------------------------------------------------
| Scoped Current User Dashboard
|--------------------------------------------------------------------------
| This endpoint uses the Bearer token created by the login patch.
| Admin sees all data. Owner sees only properties linked to owner_id.
*/


if (!function_exists('my_rentals_effective_role')) {
    function my_rentals_effective_role($user): string
    {
        if (function_exists('myRentalsEffectiveRole')) {
            return myRentalsEffectiveRole($user);
        }

        $role = strtolower(trim((string) ($user->role ?? '')));
        $ownerId = $user->owner_id ?? null;

        if ($role === '' || $role === 'null') {
            return 'admin';
        }

        if ($role === 'owner' && empty($ownerId)) {
            return 'admin';
        }

        return $role;
    }
}

if (!function_exists('my_rentals_bearer_user')) {
    function my_rentals_bearer_user(\Illuminate\Http\Request $request): ?\App\Models\User
    {
        if ($request->user()) {
            return $request->user();
        }

        $authorization = $request->header('Authorization', '');

        if (!preg_match('/Bearer\s+(.+)/i', $authorization, $matches)) {
            return null;
        }

        $token = trim($matches[1]);

        if ($token === '') {
            return null;
        }

        $query = \App\Models\User::query();
        $hashedToken = hash('sha256', $token);

        $hasApiToken = \Illuminate\Support\Facades\Schema::hasColumn('users', 'api_token');
        $hasRememberToken = \Illuminate\Support\Facades\Schema::hasColumn('users', 'remember_token');

        if ($hasApiToken && $hasRememberToken) {
            $query->where(function ($q) use ($token, $hashedToken) {
                $q->where('api_token', $hashedToken)->orWhere('api_token', $token);
            });
        } elseif ($hasApiToken) {
            $query->where(function ($q) use ($token, $hashedToken) {
                $q->where('api_token', $hashedToken)->orWhere('api_token', $token);
            });
        } elseif ($hasRememberToken) {
            $query->where(function ($q) use ($token, $hashedToken) {
                $q->where('remember_token', $hashedToken)->orWhere('remember_token', $token);
            });
        } else {
            return null;
        }

        if (\Illuminate\Support\Facades\Schema::hasColumn('users', 'is_active')) {
            $query->where(function ($q) {
                $q->where('is_active', true)->orWhereNull('is_active');
            });
        }

        if (\Illuminate\Support\Facades\Schema::hasColumn('users', 'status')) {
            $query->where(function ($q) {
                $q->where('status', 'active')->orWhereNull('status');
            });
        }

        $user = $query->first();

        if ($user && function_exists('my_rentals_effective_role')) {
            $user->role = my_rentals_effective_role($user);
        }

        return $user;
    }
}


Route::get('/my/scope', function (\Illuminate\Http\Request $request) {
    $user = my_rentals_bearer_user($request);

    if (!$user) {
        return response()->json([
            'message' => 'غير مصرح. الرجاء تسجيل الدخول مرة أخرى.',
        ], 401);
    }

    $role = function_exists('my_rentals_effective_role') ? my_rentals_effective_role($user) : ($user->role ?? 'owner');
    $ownerId = $user->owner_id ?? null;
    $isAdmin = in_array($role, ['admin', 'manager', 'super_admin'], true);

    $propertyQuery = \App\Models\Property::with('owner')->withCount(['units']);

    if (!$isAdmin) {
        if (!$ownerId) {
            return response()->json([
                'status' => 'ok',
                'message' => 'حساب المالك غير مربوط بمالك محدد.',
                'user' => $user,
                'role' => $role,
                'owner_id' => $ownerId,
                'is_admin' => false,
                'summary' => [
                    'properties_count' => 0,
                    'units_count' => 0,
                    'contracts_count' => 0,
                    'active_contracts_count' => 0,
                    'payments_count' => 0,
                    'paid_income' => 0,
                    'due_income' => 0,
                    'overdue_income' => 0,
                    'expenses' => 0,
                    'net_income' => 0,
                ],
                'properties' => [],
                'units' => [],
                'contracts' => [],
                'payments' => [],
                'expenses' => [],
            ]);
        }

        $propertyQuery->where('owner_id', $ownerId);
    }

    $properties = $propertyQuery->orderBy('id', 'desc')->get();
    $propertyIds = $properties->pluck('id');

    $units = \App\Models\Unit::with('property.owner')
        ->whereIn('property_id', $propertyIds)
        ->orderBy('id', 'desc')
        ->get();

    $unitIds = $units->pluck('id');

    $contracts = \App\Models\Contract::with([
            'tenant',
            'unit.property.owner',
            'payments' => function ($query) {
                $query->orderBy('due_date');
            },
        ])
        ->whereIn('unit_id', $unitIds)
        ->orderBy('id', 'desc')
        ->get();

    $contractIds = $contracts->pluck('id');

    $payments = \App\Models\Payment::with([
            'contract.tenant',
            'contract.unit.property.owner',
        ])
        ->whereIn('contract_id', $contractIds)
        ->orderBy('due_date')
        ->get();

    $expenses = collect();

    if (class_exists(\App\Models\PropertyExpense::class) && \Illuminate\Support\Facades\Schema::hasTable('property_expenses')) {
        $expenses = \App\Models\PropertyExpense::with(['property.owner', 'category'])
            ->whereIn('property_id', $propertyIds)
            ->orderBy('expense_date', 'desc')
            ->orderBy('id', 'desc')
            ->get();
    }

    $paidIncome = (float) $payments->where('status', 'paid')->sum('amount');
    $dueIncome = (float) $payments->where('status', 'due')->sum('amount');
    $overdueIncome = (float) $payments->where('status', 'overdue')->sum('amount');
    $expensesTotal = (float) $expenses->sum('amount');

    return response()->json([
        'status' => 'ok',
        'user' => $user,
        'role' => $role,
        'owner_id' => $ownerId,
        'is_admin' => $isAdmin,
        'summary' => [
            'properties_count' => $properties->count(),
            'units_count' => $units->count(),
            'contracts_count' => $contracts->count(),
            'active_contracts_count' => $contracts->where('status', 'active')->count(),
            'payments_count' => $payments->count(),
            'paid_income' => $paidIncome,
            'due_income' => $dueIncome,
            'overdue_income' => $overdueIncome,
            'expenses' => $expensesTotal,
            'net_income' => $paidIncome - $expensesTotal,
        ],
        'properties' => $properties,
        'units' => $units,
        'contracts' => $contracts,
        'payments' => $payments->take(50)->values(),
        'expenses' => $expenses->take(50)->values(),
    ]);
});


/*
|--------------------------------------------------------------------------
| Owner Scoped Lists
|--------------------------------------------------------------------------
| Admin sees all. Owner sees only rows linked to users.owner_id.
*/

if (!function_exists('my_rentals_current_user_for_scope')) {
    function my_rentals_current_user_for_scope(\Illuminate\Http\Request $request): ?\App\Models\User
    {
        if ($request->user()) {
            return $request->user();
        }

        if (function_exists('my_rentals_bearer_user')) {
            return my_rentals_bearer_user($request);
        }

        $token = function_exists('myRentalsRequestToken') ? myRentalsRequestToken($request) : $request->bearerToken();

        if (!$token) {
            return null;
        }

        $query = \App\Models\User::query();

        if (\Illuminate\Support\Facades\Schema::hasColumn('users', 'api_token')) {
            $query->where(function ($q) use ($token) {
                $q->where('api_token', hash('sha256', $token))->orWhere('api_token', $token);
            });
        } elseif (\Illuminate\Support\Facades\Schema::hasColumn('users', 'remember_token')) {
            $query->where(function ($q) use ($token) {
                $q->where('remember_token', hash('sha256', $token))->orWhere('remember_token', $token);
            });
        } else {
            return null;
        }

        return $query->first();
    }
}

if (!function_exists('my_rentals_is_admin_user')) {
    function my_rentals_is_admin_user(?\App\Models\User $user): bool
    {
        if (!$user) {
            return false;
        }

        $role = function_exists('my_rentals_effective_role') ? my_rentals_effective_role($user) : ($user->role ?? 'owner');

        return in_array($role, ['admin', 'manager', 'super_admin'], true);
    }
}

if (!function_exists('my_rentals_owner_property_ids')) {
    function my_rentals_owner_property_ids(?\App\Models\User $user)
    {
        if (!$user) {
            return collect();
        }

        if (my_rentals_is_admin_user($user)) {
            return \App\Models\Property::query()->pluck('id');
        }

        if (!$user->owner_id) {
            return collect();
        }

        return \App\Models\Property::query()
            ->where('owner_id', $user->owner_id)
            ->pluck('id');
    }
}

Route::get('/my/owners', function (\Illuminate\Http\Request $request) {
    $user = my_rentals_current_user_for_scope($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $query = \App\Models\Owner::withCount('properties')
        ->orderBy('type')
        ->orderBy('name');

    if (!my_rentals_is_admin_user($user)) {
        if (!$user->owner_id) {
            return [];
        }

        $query->where('id', $user->owner_id);
    }

    return $query->get()->map(function ($owner) {
        $owner->units_count = \App\Models\Unit::whereHas('property', function ($query) use ($owner) {
            $query->where('owner_id', $owner->id);
        })->count();

        $owner->contracts_count = \App\Models\Contract::whereHas('unit.property', function ($query) use ($owner) {
            $query->where('owner_id', $owner->id);
        })->count();

        $owner->has_rental_assets = ($owner->properties_count ?? 0) > 0 || $owner->units_count > 0 || $owner->contracts_count > 0;

        return $owner;
    });
});

Route::get('/my/properties', function (\Illuminate\Http\Request $request) {
    $user = my_rentals_current_user_for_scope($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $query = \App\Models\Property::with(['owner'])
        ->withCount(['units', 'parkingSpots', 'expenses', 'files'])
        ->orderBy('id', 'desc');

    if (!my_rentals_is_admin_user($user)) {
        if (!$user->owner_id) {
            return [];
        }

        $query->where('owner_id', $user->owner_id);
    }

    if ($request->filled('property_id')) {
        $query->where('id', $request->integer('property_id'));
    }

    return $query->get();
});

Route::get('/my/units', function (\Illuminate\Http\Request $request) {
    $user = my_rentals_current_user_for_scope($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $propertyIds = my_rentals_owner_property_ids($user);

    $query = \App\Models\Unit::with(['property.owner', 'parentUnit'])
        ->whereIn('property_id', $propertyIds);

    if ($request->filled('property_id')) {
        $query->where('property_id', $request->integer('property_id'));
    }

    return $query
        ->orderBy('id', 'desc')
        ->get();
});

Route::get('/my/contracts', function (\Illuminate\Http\Request $request) {
    $user = my_rentals_current_user_for_scope($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $propertyIds = my_rentals_owner_property_ids($user);

    $query = \App\Models\Contract::with([
            'tenant',
            'unit.property.owner',
            'parkingSpot',
            'files',
            'payments' => function ($query) {
                $query->orderBy('due_date');
            },
        ])
        ->whereHas('unit', function ($query) use ($propertyIds) {
            $query->whereIn('property_id', $propertyIds);
        });

    if ($request->filled('property_id')) {
        $propertyId = (int) $request->input('property_id');
        $query->whereHas('unit', function ($unitQuery) use ($propertyId, $propertyIds) {
            $unitQuery->where('property_id', $propertyId)
                ->whereIn('property_id', $propertyIds);
        });
    }

    if ($request->filled('unit_id')) {
        $query->where('unit_id', (int) $request->input('unit_id'));
    }

    if ($request->filled('search')) {
        $search = trim((string) $request->input('search'));
        $query->where(function ($searchQuery) use ($search) {
            $searchQuery
                ->where('contract_number', 'like', "%{$search}%")
                ->orWhere('government_contract_number', 'like', "%{$search}%")
                ->orWhereHas('tenant', function ($tenantQuery) use ($search) {
                    $tenantQuery->where('name', 'like', "%{$search}%");
                })
                ->orWhereHas('unit', function ($unitQuery) use ($search) {
                    $unitQuery->where('unit_number', 'like', "%{$search}%");
                })
                ->orWhereHas('unit.property', function ($propertyQuery) use ($search) {
                    $propertyQuery->where('name', 'like', "%{$search}%");
                });
        });
    }

    return $query
        ->orderBy('id', 'desc')
        ->get();
});

Route::get('/my/payments', function (\Illuminate\Http\Request $request) {
    $user = my_rentals_current_user_for_scope($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $propertyIds = my_rentals_owner_property_ids($user);

    return \App\Models\Payment::with([
            'contract.tenant',
            'contract.unit.property.owner',
        ])
        ->whereHas('contract.unit', function ($query) use ($propertyIds) {
            $query->whereIn('property_id', $propertyIds);
        })
        ->orderBy('due_date')
        ->get();
});

Route::get('/my/expenses', function (\Illuminate\Http\Request $request) {
    $user = my_rentals_current_user_for_scope($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    if (!class_exists(\App\Models\PropertyExpense::class) || !\Illuminate\Support\Facades\Schema::hasTable('property_expenses')) {
        return [];
    }

    $propertyIds = my_rentals_owner_property_ids($user);

    $query = \App\Models\PropertyExpense::with(['property.owner', 'category'])
        ->whereIn('property_id', $propertyIds);

    if ($request->filled('property_id')) {
        $query->where('property_id', $request->integer('property_id'));
    }

    if ($request->filled('owner_id')) {
        $query->whereHas('property', function ($propertyQuery) use ($request) {
            $propertyQuery->where('owner_id', $request->integer('owner_id'));
        });
    }

    return $query
        ->orderBy('expense_date', 'desc')
        ->orderBy('id', 'desc')
        ->get();
});

Route::get('/my/tenants', function (\Illuminate\Http\Request $request) {
    $user = my_rentals_current_user_for_scope($request);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    if (my_rentals_is_admin_user($user)) {
        return \App\Models\Tenant::withCount(['contracts', 'contractFiles'])
            ->orderBy('id', 'desc')
            ->get();
    }

    $propertyIds = my_rentals_owner_property_ids($user);

    return \App\Models\Tenant::withCount(['contracts', 'contractFiles'])
        ->whereHas('contracts.unit', function ($query) use ($propertyIds) {
            $query->whereIn('property_id', $propertyIds);
        })
        ->orderBy('id', 'desc')
        ->get();
});
