<?php

use App\Http\Controllers\Api\PasswordOtpController;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

Route::post('api/auth/password/otp/request', [PasswordOtpController::class, 'requestOtp']);
Route::post('api/auth/password/otp/verify', [PasswordOtpController::class, 'verifyOtp']);
Route::post('api/auth/password/reset', [PasswordOtpController::class, 'resetPassword']);

if (!function_exists('mr_manager_register_normalize_phone')) {
    function mr_manager_register_normalize_phone(?string $phone): string
    {
        $phone = preg_replace('/\D+/', '', (string) $phone);
        if ($phone === '') return '';
        if (Str::startsWith($phone, '00')) $phone = substr($phone, 2);
        if (Str::startsWith($phone, '966')) return $phone;
        if (Str::startsWith($phone, '0')) return '966' . substr($phone, 1);
        if (Str::startsWith($phone, '5') && strlen($phone) === 9) return '966' . $phone;
        return $phone;
    }
}

if (!function_exists('mr_manager_register_local_phone')) {
    function mr_manager_register_local_phone(?string $phone): string
    {
        $phone = preg_replace('/\D+/', '', (string) $phone);
        if ($phone === '') return '';
        if (Str::startsWith($phone, '966')) return '0' . substr($phone, 3);
        if (Str::startsWith($phone, '5') && strlen($phone) === 9) return '0' . $phone;
        return $phone;
    }
}

if (!function_exists('mr_manager_register_ensure_schema')) {
    function mr_manager_register_ensure_schema(): void
    {
        if (!Schema::hasTable('password_reset_otps')) {
            Schema::create('password_reset_otps', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id')->index();
                $table->string('identifier')->nullable()->index();
                $table->string('phone')->nullable()->index();
                $table->string('otp_hash');
                $table->string('reset_token')->nullable()->index();
                $table->unsignedTinyInteger('attempts')->default(0);
                $table->timestamp('expires_at')->nullable()->index();
                $table->timestamp('used_at')->nullable()->index();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('users')) return;
        foreach ([
            'phone' => fn (Blueprint $table) => $table->string('phone')->nullable()->index(),
            'national_id' => fn (Blueprint $table) => $table->string('national_id')->nullable()->index(),
            'password_set_at' => fn (Blueprint $table) => $table->timestamp('password_set_at')->nullable(),
            'status' => fn (Blueprint $table) => $table->string('status')->default('active')->index(),
            'api_token' => fn (Blueprint $table) => $table->string('api_token', 100)->nullable()->index(),
            'last_login_at' => fn (Blueprint $table) => $table->timestamp('last_login_at')->nullable(),
        ] as $column => $callback) {
            if (!Schema::hasColumn('users', $column)) {
                Schema::table('users', $callback);
            }
        }
    }
}

if (!function_exists('mr_manager_register_find_user_by_phone')) {
    function mr_manager_register_find_user_by_phone(string $phone): ?User
    {
        mr_manager_register_ensure_schema();

        $normalized = mr_manager_register_normalize_phone($phone);
        $local = mr_manager_register_local_phone($normalized);
        $digits = preg_replace('/\D+/', '', $phone) ?: $phone;

        return User::query()->where(function ($q) use ($phone, $normalized, $local, $digits) {
            if (Schema::hasColumn('users', 'username')) {
                $q->orWhere('username', $phone)
                    ->orWhere('username', $digits)
                    ->orWhere('username', $normalized)
                    ->orWhere('username', $local);
            }
            if (Schema::hasColumn('users', 'phone')) {
                $q->orWhere('phone', $phone)
                    ->orWhere('phone', $digits)
                    ->orWhere('phone', $normalized)
                    ->orWhere('phone', $local);
            }
        })->orderByDesc('id')->first();
    }
}

if (!function_exists('mr_manager_register_send_otp')) {
    function mr_manager_register_send_otp(string $to, string $otp): array
    {
        $token = (string) (config('services.whatsapp.access_token') ?: env('WHATSAPP_ACCESS_TOKEN') ?: env('WHATSAPP_TOKEN'));
        $phoneNumberId = (string) (config('services.whatsapp.phone_number_id') ?: env('WHATSAPP_PHONE_NUMBER_ID'));
        $version = (string) (config('services.whatsapp.graph_version') ?: env('WHATSAPP_GRAPH_VERSION', 'v20.0'));
        $template = (string) env('WHATSAPP_OTP_TEMPLATE_NAME', 'rental_password_reset_otp');
        $language = (string) env('WHATSAPP_OTP_TEMPLATE_LANGUAGE', 'ar');
        $to = mr_manager_register_normalize_phone($to);

        if ($token === '' || $phoneNumberId === '' || $to === '' || $template === '') {
            return ['ok' => false, 'reason' => 'missing_config', 'has_token' => $token !== '', 'has_phone_number_id' => $phoneNumberId !== '', 'to' => $to];
        }

        $payload = [
            'messaging_product' => 'whatsapp',
            'to' => $to,
            'type' => 'template',
            'template' => [
                'name' => $template,
                'language' => ['code' => $language],
                'components' => [[
                    'type' => 'body',
                    'parameters' => [['type' => 'text', 'text' => $otp]],
                ], [
                    'type' => 'button',
                    'sub_type' => 'url',
                    'index' => '0',
                    'parameters' => [['type' => 'text', 'text' => $otp]],
                ]],
            ],
        ];

        try {
            $response = Http::withToken($token)->post("https://graph.facebook.com/{$version}/{$phoneNumberId}/messages", $payload);
            $body = $response->json();
            $result = [
                'ok' => $response->successful(),
                'status' => $response->status(),
                'to' => $to,
                'provider_message_id' => Arr::get($body, 'messages.0.id'),
                'error' => Arr::get($body, 'error.message'),
                'error_code' => Arr::get($body, 'error.code'),
            ];
            if ($response->successful()) return $result;
            Log::warning('Manager register OTP send failed', ['result' => $result, 'body' => $response->body()]);
            return $result;
        } catch (Throwable $e) {
            Log::error('Manager register OTP exception', ['error' => $e->getMessage(), 'to' => $to]);
            return ['ok' => false, 'reason' => 'exception', 'message' => $e->getMessage(), 'to' => $to];
        }
    }
}

Route::post('api/auth/manager/register/request', function (Request $request) {
    mr_manager_register_ensure_schema();

    $data = $request->validate([
        'phone' => ['required', 'string', 'max:30'],
        'name' => ['nullable', 'string', 'max:255'],
    ]);

    $phone = mr_manager_register_normalize_phone($data['phone']);
    $localPhone = mr_manager_register_local_phone($phone);
    if ($phone === '' || !Str::startsWith($phone, '9665') || strlen($phone) !== 12) {
        return response()->json(['success' => false, 'message' => 'أدخل رقم جوال سعودي صحيح يبدأ بـ 05.'], 422);
    }

    $name = trim((string) ($data['name'] ?? '')) ?: 'مدير عقارات';
    $user = mr_manager_register_find_user_by_phone($phone);
    if ($user && strtolower((string) ($user->role ?? '')) !== 'manager') {
        return response()->json(['success' => false, 'message' => 'رقم الجوال مرتبط بحساب آخر. استخدم تسجيل الدخول أو تواصل مع الإدارة.'], 422);
    }
    if ($user && (($user->status ?? 'active') === 'active') && !empty($user->password_set_at)) {
        return response()->json(['success' => false, 'message' => 'يوجد حساب مدير عقارات بهذا الجوال. استخدم تسجيل الدخول أو نسيت كلمة السر.'], 422);
    }

    if (!$user) {
        $payload = [
            'name' => $name,
            'username' => $localPhone ?: $phone,
            'email' => 'manager+' . sha1($phone) . '@rental.local',
            'password' => Hash::make(Str::random(40)),
            'role' => 'manager',
            'status' => 'pending',
        ];
        if (Schema::hasColumn('users', 'phone')) $payload['phone'] = $phone;
        if (Schema::hasColumn('users', 'password_set_at')) $payload['password_set_at'] = null;
        $user = User::create($payload);
    } else {
        $updates = ['name' => $name, 'role' => 'manager', 'status' => 'pending'];
        if (Schema::hasColumn('users', 'username')) $updates['username'] = $localPhone ?: $phone;
        if (Schema::hasColumn('users', 'phone')) $updates['phone'] = $phone;
        $user->forceFill($updates)->save();
    }

    $last = DB::table('password_reset_otps')->where('user_id', $user->id)->whereNull('used_at')->latest('id')->first();
    if ($last && !empty($last->created_at) && now()->diffInSeconds($last->created_at, false) > -60) {
        return response()->json(['success' => false, 'message' => 'تم إرسال رمز قبل قليل. الرجاء الانتظار دقيقة قبل إعادة الإرسال.'], 429);
    }

    $otp = (string) random_int(100000, 999999);
    $expiresMinutes = max(1, (int) env('WHATSAPP_OTP_EXPIRY_MINUTES', 5));
    DB::table('password_reset_otps')->insert([
        'user_id' => $user->id,
        'identifier' => 'manager_register:' . $phone,
        'phone' => $phone,
        'otp_hash' => Hash::make($otp),
        'reset_token' => null,
        'attempts' => 0,
        'expires_at' => now()->addMinutes($expiresMinutes),
        'used_at' => null,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $sendResult = mr_manager_register_send_otp($phone, $otp);
    if (!($sendResult['ok'] ?? false)) {
        return response()->json(['success' => false, 'message' => 'تعذر إرسال رمز التحقق عبر واتساب.', 'send_result' => $sendResult], 502);
    }

    return response()->json(['success' => true, 'data' => ['phone_masked' => substr($phone, 0, 4) . '****' . substr($phone, -3), 'expires_in_minutes' => $expiresMinutes], 'message' => 'تم إرسال رمز التحقق عبر واتساب']);
});

Route::post('api/auth/manager/register/verify', function (Request $request) {
    mr_manager_register_ensure_schema();

    $data = $request->validate([
        'phone' => ['required', 'string', 'max:30'],
        'otp' => ['required', 'string', 'min:4', 'max:10'],
    ]);

    $phone = mr_manager_register_normalize_phone($data['phone']);
    $user = mr_manager_register_find_user_by_phone($phone);
    if (!$user || strtolower((string) ($user->role ?? '')) !== 'manager') {
        return response()->json(['success' => false, 'message' => 'لم يتم العثور على طلب تسجيل لهذا الجوال.'], 404);
    }

    $row = DB::table('password_reset_otps')
        ->where('user_id', $user->id)
        ->where('phone', $phone)
        ->whereNull('used_at')
        ->where('expires_at', '>=', now())
        ->latest('id')
        ->first();

    if (!$row) return response()->json(['success' => false, 'message' => 'رمز التحقق منتهي أو غير موجود.'], 422);
    if ((int) ($row->attempts ?? 0) >= 5) return response()->json(['success' => false, 'message' => 'تم تجاوز عدد المحاولات. أعد إرسال الرمز.'], 429);

    $otp = preg_replace('/\D+/', '', (string) $data['otp']);
    if (!Hash::check($otp, (string) $row->otp_hash)) {
        DB::table('password_reset_otps')->where('id', $row->id)->update(['attempts' => ((int) ($row->attempts ?? 0)) + 1, 'updated_at' => now()]);
        return response()->json(['success' => false, 'message' => 'رمز التحقق غير صحيح.'], 422);
    }

    $resetToken = 'manager:' . Str::random(80);
    DB::table('password_reset_otps')->where('id', $row->id)->update(['reset_token' => $resetToken, 'updated_at' => now()]);

    return response()->json(['success' => true, 'data' => ['reset_token' => $resetToken], 'message' => 'تم التحقق من الرمز. أدخل الرقم السري الجديد.']);
});

Route::post('api/auth/manager/register/complete', function (Request $request) {
    mr_manager_register_ensure_schema();

    $data = $request->validate([
        'phone' => ['required', 'string', 'max:30'],
        'reset_token' => ['required', 'string', 'min:20', 'max:255'],
        'password' => ['required', 'string', 'min:6', 'confirmed'],
        'name' => ['nullable', 'string', 'max:255'],
    ]);

    $phone = mr_manager_register_normalize_phone($data['phone']);
    $user = mr_manager_register_find_user_by_phone($phone);
    if (!$user || strtolower((string) ($user->role ?? '')) !== 'manager') {
        return response()->json(['success' => false, 'message' => 'طلب التسجيل غير موجود.'], 404);
    }

    $row = DB::table('password_reset_otps')
        ->where('user_id', $user->id)
        ->where('phone', $phone)
        ->where('reset_token', $data['reset_token'])
        ->whereNull('used_at')
        ->where('expires_at', '>=', now())
        ->latest('id')
        ->first();

    if (!$row) return response()->json(['success' => false, 'message' => 'جلسة التسجيل منتهية. أعد طلب رمز جديد.'], 422);

    $updates = [
        'password' => Hash::make((string) $data['password']),
        'role' => 'manager',
        'status' => 'active',
    ];
    if (Schema::hasColumn('users', 'password_set_at')) $updates['password_set_at'] = now();
    if (!empty($data['name'])) $updates['name'] = trim((string) $data['name']);
    $user->forceFill($updates)->save();

    DB::table('password_reset_otps')->where('id', $row->id)->update(['used_at' => now(), 'updated_at' => now()]);

    return response()->json(['success' => true, 'message' => 'تم إنشاء حساب مدير العقارات. يمكنك تسجيل الدخول برقم الجوال وكلمة السر.']);
});

Route::middleware(['auth.api'])->group(function () {
    Route::get('api/tenant/payments', [PasswordOtpController::class, 'tenantPayments']);
});
