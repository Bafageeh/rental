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
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
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

        $managerId = function_exists('mr_manager_scope_id') ? mr_manager_scope_id(request()) : null;
        $existingUser = User::query()->where('username', $username)->first();

        if ($existingUser && $managerId && Schema::hasColumn('users', 'manager_id') && (int) ($existingUser->manager_id ?? 0) !== $managerId) {
            return [null, 'رقم الهوية مستخدم في حساب آخر. لا يمكن ربط مالك خارج نطاق مدير العقارات الحالي.'];
        }

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

            if (Schema::hasColumn('users', 'manager_id') && $managerId && empty($existingUser->manager_id)) {
                $existingUser->manager_id = $managerId;
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

        if (Schema::hasColumn('users', 'manager_id') && $managerId) {
            $payload['manager_id'] = $managerId;
        }

        if (Schema::hasColumn('users', 'status')) {
            $payload['status'] = 'active';
        }

        $user = User::query()->create($payload);

        return [$user, 'تم إنشاء حساب المالك تلقائيًا. اسم المستخدم هو رقم الهوية وكلمة المرور المبدئية 123456.'];
    }
}

if (!function_exists('my_rentals_owner_added_whatsapp_config')) {
    function my_rentals_owner_added_whatsapp_config(array $configKeys, array $envKeys = [], string $default = ''): string
    {
        foreach ($configKeys as $key) {
            $value = config($key);
            if ($value !== null && trim((string) $value) !== '') return trim((string) $value);
        }

        foreach ($envKeys as $key) {
            $value = env($key);
            if ($value !== null && trim((string) $value) !== '') return trim((string) $value);
        }

        return $default;
    }
}

if (!function_exists('my_rentals_owner_added_whatsapp_phone')) {
    function my_rentals_owner_added_whatsapp_phone(?string $phone): string
    {
        $digits = preg_replace('/\D+/', '', (string) $phone) ?: '';
        if (str_starts_with($digits, '00')) $digits = substr($digits, 2);
        if (str_starts_with($digits, '05') && strlen($digits) === 10) return '966' . substr($digits, 1);
        if (str_starts_with($digits, '5') && strlen($digits) === 9) return '966' . $digits;
        return $digits;
    }
}

if (!function_exists('my_rentals_owner_added_whatsapp_manager_name')) {
    function my_rentals_owner_added_whatsapp_manager_name(Request $request): string
    {
        $user = $request->user();
        $name = trim((string) ($user->name ?? ''));
        return $name !== '' ? $name : 'مدير العقارات';
    }
}

if (!function_exists('my_rentals_send_owner_added_whatsapp_template')) {
    function my_rentals_send_owner_added_whatsapp_template(Owner $owner, Request $request): array
    {
        $to = my_rentals_owner_added_whatsapp_phone($owner->phone ?? null);
        $token = my_rentals_owner_added_whatsapp_config(['services.whatsapp.access_token'], ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_TOKEN', 'META_WHATSAPP_ACCESS_TOKEN', 'META_ACCESS_TOKEN']);
        $phoneNumberId = my_rentals_owner_added_whatsapp_config(['services.whatsapp.phone_number_id'], ['WHATSAPP_PHONE_NUMBER_ID', 'META_WHATSAPP_PHONE_NUMBER_ID', 'META_PHONE_NUMBER_ID']);
        $version = my_rentals_owner_added_whatsapp_config(['services.whatsapp.graph_version'], ['WHATSAPP_GRAPH_VERSION', 'META_GRAPH_VERSION'], 'v20.0');
        $templateName = env('WHATSAPP_OWNER_ADDED_TEMPLATE', 'owner_added_ejarati');
        $language = env('WHATSAPP_OWNER_ADDED_TEMPLATE_LANGUAGE', 'ar');

        if ($to === '' || $token === '' || $phoneNumberId === '') {
            $result = [
                'ok' => false,
                'reason' => 'missing_config_or_phone',
                'has_phone' => $to !== '',
                'has_token' => $token !== '',
                'has_phone_number_id' => $phoneNumberId !== '',
            ];
            Log::warning('Owner added WhatsApp template was not sent', ['owner_id' => $owner->id, 'result' => $result]);
            return $result;
        }

        try {
            $response = Http::withToken($token)->post("https://graph.facebook.com/{$version}/{$phoneNumberId}/messages", [
                'messaging_product' => 'whatsapp',
                'to' => $to,
                'type' => 'template',
                'template' => [
                    'name' => $templateName,
                    'language' => ['code' => $language],
                    'components' => [[
                        'type' => 'body',
                        'parameters' => [
                            ['type' => 'text', 'text' => (string) $owner->name],
                        ],
                    ]],
                ],
            ]);

            $body = $response->json() ?: [];
            $result = [
                'ok' => $response->successful(),
                'status' => $response->status(),
                'template' => $templateName,
                'to' => $to,
                'provider_message_id' => data_get($body, 'messages.0.id'),
                'error' => data_get($body, 'error.message'),
                'error_code' => data_get($body, 'error.code'),
            ];

            if ($response->successful()) {
                Log::info('Owner added WhatsApp template sent', ['owner_id' => $owner->id, 'result' => $result]);
            } else {
                Log::warning('Owner added WhatsApp template failed', ['owner_id' => $owner->id, 'result' => $result, 'body' => $response->body()]);
            }

            return $result;
        } catch (Throwable $e) {
            $result = ['ok' => false, 'reason' => 'exception', 'to' => $to, 'error' => $e->getMessage()];
            Log::error('Owner added WhatsApp template exception', ['owner_id' => $owner->id, 'result' => $result]);
            return $result;
        }
    }
}

Route::get('/owners', function (Request $request) {
    $query = Owner::withCount('properties');
    if (function_exists('mr_manager_scope_apply')) mr_manager_scope_apply($query, 'owners', $request);

    return $query
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
        'national_id' => ['required', 'string', 'max:50'],
        'type' => ['nullable', 'string', 'max:50'],
        'notes' => ['nullable', 'string'],
    ], [
        'national_id.required' => 'رقم هوية المالك مطلوب لإنشاء حساب دخول تلقائي.',
    ]);

    $owner = Owner::create([
        'name' => $data['name'],
        'phone' => $data['phone'] ?? null,
        'email' => $data['email'] ?? null,
        'national_id' => trim((string) $data['national_id']),
        'type' => $data['type'] ?? 'external',
        'notes' => $data['notes'] ?? null,
    ]);

    if (function_exists('mr_manager_scope_set_record')) mr_manager_scope_set_record('owners', $owner->id, $request);
    $owner = $owner->fresh();

    [$account, $accountMessage] = my_rentals_create_or_link_owner_account($owner);
    $whatsappResult = my_rentals_send_owner_added_whatsapp_template($owner, $request);

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
            'manager_id' => $account->manager_id ?? null,
            'status' => $account->status ?? 'active',
            'initial_password' => '123456',
        ] : null,
        'account_message' => $accountMessage,
        'owner_added_whatsapp' => $whatsappResult,
    ], 201);
});



Route::get('/owners/{owner}/dashboard', function (Request $request, Owner $owner) {
    if (function_exists('mr_manager_scope_abort_unless_record')) mr_manager_scope_abort_unless_record('owners', $owner->id, $request);
    return app(OwnerDashboardController::class)->show($owner);
});
Route::get('/my/owners/{owner}/dashboard', [OwnerDashboardController::class, 'showScoped']);
