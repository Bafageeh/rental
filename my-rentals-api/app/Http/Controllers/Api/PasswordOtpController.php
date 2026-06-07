<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use App\Models\Tenant;
use App\Models\User;
use App\Traits\ApiResponse;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class PasswordOtpController extends Controller
{
    use ApiResponse;

    public function requestOtp(Request $request): JsonResponse
    {
        try {
            $this->ensureOtpSchema();

            $data = $request->validate([
                'identifier' => ['required', 'string', 'max:255'],
                'purpose' => ['nullable', 'string', 'max:50'],
            ]);

            $identifier = trim((string) $data['identifier']);
            $user = $this->findOrCreateUserForIdentifier($identifier);

            if (!$user) {
                return $this->error('لم أجد حسابًا مرتبطًا برقم الهوية أو رقم الجوال المدخل.', 404);
            }

            if (Schema::hasColumn('users', 'status') && (($user->status ?? 'active') !== 'active')) {
                return $this->error('الحساب معطل، تواصل مع الإدارة.', 403);
            }

            $phone = $this->userPhone($user);
            if ($phone === '') {
                return $this->error('لا يوجد رقم جوال مرتبط بهذا الحساب لإرسال رمز التحقق.', 422);
            }

            $last = DB::table('password_reset_otps')
                ->where('user_id', $user->id)
                ->whereNull('used_at')
                ->latest('id')
                ->first();

            if ($last && !empty($last->created_at) && now()->diffInSeconds($last->created_at, false) > -60) {
                return $this->error('تم إرسال رمز تحقق قبل قليل. الرجاء الانتظار دقيقة قبل إعادة الإرسال.', 429);
            }

            $otp = (string) random_int(100000, 999999);
            $expiresMinutes = max(1, (int) env('WHATSAPP_OTP_EXPIRY_MINUTES', 5));

            DB::table('password_reset_otps')->insert([
                'user_id' => $user->id,
                'identifier' => $identifier,
                'phone' => $this->normalizePhone($phone),
                'otp_hash' => Hash::make($otp),
                'reset_token' => null,
                'attempts' => 0,
                'expires_at' => now()->addMinutes($expiresMinutes),
                'used_at' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $sendResult = $this->sendWhatsAppOtp($phone, $otp);

            if (!($sendResult['ok'] ?? false)) {
                return response()->json([
                    'success' => false,
                    'message' => 'تعذر إرسال رمز التحقق عبر واتساب. تأكد من إعدادات الواتساب.',
                    'send_result' => $sendResult,
                ], 502);
            }

            return $this->success([
                'identifier' => $identifier,
                'phone_masked' => $this->maskPhone($phone),
                'expires_in_minutes' => $expiresMinutes,
            ], 'تم إرسال رمز التحقق عبر واتساب');
        } catch (\Throwable $e) {
            Log::error('Password OTP request failed', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'تعذر إرسال رمز التحقق. ' . $e->getMessage(),
            ], 500);
        }
    }

    public function verifyOtp(Request $request): JsonResponse
    {
        $this->ensureOtpSchema();

        $data = $request->validate([
            'identifier' => ['required', 'string', 'max:255'],
            'otp' => ['required', 'string', 'min:4', 'max:10'],
        ]);

        $identifier = trim((string) $data['identifier']);
        $otp = preg_replace('/\D+/', '', (string) $data['otp']);
        $user = $this->findOrCreateUserForIdentifier($identifier, false);

        if (!$user) {
            return $this->error('الحساب غير موجود.', 404);
        }

        $row = DB::table('password_reset_otps')
            ->where('user_id', $user->id)
            ->whereNull('used_at')
            ->where('expires_at', '>=', now())
            ->latest('id')
            ->first();

        if (!$row) {
            return $this->error('رمز التحقق منتهي أو غير موجود. أعد طلب رمز جديد.', 422);
        }

        if ((int) ($row->attempts ?? 0) >= 5) {
            return $this->error('تم تجاوز عدد المحاولات المسموح. أعد طلب رمز جديد.', 429);
        }

        if (!Hash::check($otp, (string) $row->otp_hash)) {
            DB::table('password_reset_otps')->where('id', $row->id)->update([
                'attempts' => ((int) ($row->attempts ?? 0)) + 1,
                'updated_at' => now(),
            ]);

            return $this->error('رمز التحقق غير صحيح.', 422);
        }

        $resetToken = Str::random(64);
        DB::table('password_reset_otps')->where('id', $row->id)->update([
            'reset_token' => $resetToken,
            'updated_at' => now(),
        ]);

        return $this->success(['reset_token' => $resetToken], 'تم التحقق من الرمز. يمكنك الآن تعيين كلمة سر جديدة.');
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $this->ensureOtpSchema();

        $data = $request->validate([
            'reset_token' => ['required', 'string', 'min:20', 'max:255'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        $row = DB::table('password_reset_otps')
            ->where('reset_token', $data['reset_token'])
            ->whereNull('used_at')
            ->where('expires_at', '>=', now())
            ->latest('id')
            ->first();

        if (!$row) {
            return $this->error('جلسة تغيير كلمة السر منتهية. أعد طلب رمز جديد.', 422);
        }

        $user = User::find($row->user_id);
        if (!$user) {
            return $this->error('الحساب غير موجود.', 404);
        }

        $updates = ['password' => Hash::make((string) $data['password'])];
        if (Schema::hasColumn('users', 'password_set_at')) {
            $updates['password_set_at'] = now();
        }

        $user->forceFill($updates)->save();

        DB::table('password_reset_otps')->where('id', $row->id)->update([
            'used_at' => now(),
            'updated_at' => now(),
        ]);

        return $this->success(null, 'تم تعيين كلمة السر الجديدة بنجاح.');
    }

    public function tenantPayments(Request $request): JsonResponse
    {
        $user = $request->user();
        $role = method_exists($user, 'effectiveRole') ? $user->effectiveRole() : (string) ($user->role ?? '');

        if ($role !== 'tenant') {
            return $this->error('هذه الشاشة مخصصة للمستأجرين فقط.', 403);
        }

        $tenantId = Schema::hasColumn('users', 'tenant_id') ? (int) ($user->tenant_id ?? 0) : 0;
        if (!$tenantId) {
            return $this->error('لا يوجد مستأجر مرتبط بهذا الحساب.', 404);
        }

        $contracts = Contract::with([
                'tenant:id,name,phone,national_id,nationality',
                'unit.property.owner',
                'payments' => fn ($q) => $q->orderBy('due_date')->orderBy('id'),
            ])
            ->where('tenant_id', $tenantId)
            ->orderByRaw("CASE WHEN status IN ('active', 'نشط') THEN 0 ELSE 1 END")
            ->orderByDesc('id')
            ->get();

        $payments = [];
        foreach ($contracts as $contract) {
            foreach ($contract->payments as $payment) {
                $amount = $this->num($payment->amount ?? 0);
                $paid = $this->num($payment->paid_amount ?? 0);
                $remaining = max(0, $amount - $paid);
                $payments[] = [
                    'id' => $payment->id,
                    'contract_id' => $contract->id,
                    'contract_number' => $contract->government_contract_number ?: $contract->contract_number,
                    'property_name' => $contract->unit?->property?->name,
                    'unit_number' => $contract->unit?->unit_number,
                    'due_date' => $payment->due_date,
                    'paid_date' => $payment->paid_date,
                    'amount' => $amount,
                    'paid_amount' => $paid,
                    'remaining_amount' => $remaining,
                    'status' => $remaining <= 0.009 && $paid > 0 ? 'paid' : (($payment->due_date && $payment->due_date <= now()->toDateString()) ? 'overdue' : 'due'),
                    'notes' => $payment->notes,
                ];
            }
        }

        return $this->success([
            'tenant' => [
                'id' => $contracts->first()?->tenant?->id ?? $tenantId,
                'name' => $contracts->first()?->tenant?->name ?? $user->name,
            ],
            'contracts_count' => $contracts->count(),
            'payments' => $payments,
        ]);
    }

    private function ensureOtpSchema(): void
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

        if (!Schema::hasTable('users')) {
            return;
        }

        foreach ([
            'tenant_id' => fn (Blueprint $table) => $table->unsignedBigInteger('tenant_id')->nullable()->index(),
            'phone' => fn (Blueprint $table) => $table->string('phone')->nullable()->index(),
            'national_id' => fn (Blueprint $table) => $table->string('national_id')->nullable()->index(),
            'password_set_at' => fn (Blueprint $table) => $table->timestamp('password_set_at')->nullable(),
        ] as $column => $callback) {
            if (!Schema::hasColumn('users', $column)) {
                Schema::table('users', $callback);
            }
        }
    }

    private function findOrCreateUserForIdentifier(string $identifier, bool $createFromTenant = true): ?User
    {
        $this->ensureOtpSchema();
        $normalizedIdentifier = mb_strtolower(trim($identifier));
        $digits = preg_replace('/\D+/', '', $identifier) ?: $identifier;
        $phone = $this->normalizePhone($identifier);

        $query = User::query();
        $query->where(function ($q) use ($normalizedIdentifier, $identifier, $digits, $phone) {
            if (Schema::hasColumn('users', 'username')) {
                $q->orWhereRaw('LOWER(username) = ?', [$normalizedIdentifier])
                    ->orWhere('username', $digits)
                    ->orWhere('username', $phone)
                    ->orWhere('username', $this->localPhone($phone));
            }
            if (Schema::hasColumn('users', 'email')) {
                $q->orWhereRaw('LOWER(email) = ?', [$normalizedIdentifier]);
            }
            if (Schema::hasColumn('users', 'phone')) {
                $q->orWhere('phone', $identifier)
                    ->orWhere('phone', $digits)
                    ->orWhere('phone', $phone)
                    ->orWhere('phone', $this->localPhone($phone));
            }
            if (Schema::hasColumn('users', 'national_id')) {
                $q->orWhere('national_id', $identifier)->orWhere('national_id', $digits);
            }
        });

        $user = $query->first();
        if ($user || !$createFromTenant) {
            return $user;
        }

        $tenant = $this->findTenantByIdentifier($identifier);
        if (!$tenant) {
            return null;
        }

        $tenantPhone = $this->tenantValue($tenant, ['phone', 'mobile', 'mobile_number']);
        $tenantNationalId = $this->tenantValue($tenant, ['national_id', 'identity_number', 'id_number', 'iqama_number']);
        $tenantEmail = $this->tenantValue($tenant, ['email']);
        $username = $tenantNationalId ?: $this->normalizePhone($tenantPhone) ?: $tenantPhone;

        if (!$username) {
            return null;
        }

        $payload = [
            'name' => $this->tenantValue($tenant, ['name', 'tenant_name']) ?: 'مستأجر',
            'username' => $username,
            'email' => $tenantEmail ?: null,
            'password' => Hash::make(Str::random(32)),
            'role' => 'tenant',
            'status' => 'active',
        ];

        if (Schema::hasColumn('users', 'tenant_id')) $payload['tenant_id'] = $tenant->id;
        if (Schema::hasColumn('users', 'phone')) $payload['phone'] = $tenantPhone;
        if (Schema::hasColumn('users', 'national_id')) $payload['national_id'] = $tenantNationalId;
        if (Schema::hasColumn('users', 'password_set_at')) $payload['password_set_at'] = null;

        return User::create($payload);
    }

    private function findTenantByIdentifier(string $identifier): ?Tenant
    {
        if (!Schema::hasTable('tenants')) {
            return null;
        }

        $columns = Schema::getColumnListing('tenants');
        $digits = preg_replace('/\D+/', '', $identifier) ?: $identifier;
        $phone = $this->normalizePhone($identifier);
        $localPhone = $this->localPhone($phone);
        $identityColumns = array_values(array_intersect($columns, ['national_id', 'identity_number', 'id_number', 'iqama_number']));
        $phoneColumns = array_values(array_intersect($columns, ['phone', 'mobile', 'mobile_number', 'tenant_phone']));

        if (!$identityColumns && !$phoneColumns) {
            return null;
        }

        return Tenant::query()
            ->where(function ($q) use ($identifier, $digits, $phone, $localPhone, $identityColumns, $phoneColumns) {
                foreach ($identityColumns as $column) {
                    $q->orWhere($column, $identifier)->orWhere($column, $digits);
                }
                foreach ($phoneColumns as $column) {
                    $q->orWhere($column, $identifier)
                        ->orWhere($column, $digits)
                        ->orWhere($column, $phone)
                        ->orWhere($column, $localPhone);
                }
            })
            ->orderByDesc('id')
            ->first();
    }

    private function userPhone(User $user): string
    {
        if (Schema::hasColumn('users', 'phone') && !empty($user->phone)) {
            return (string) $user->phone;
        }

        if (Schema::hasColumn('users', 'tenant_id') && !empty($user->tenant_id)) {
            $tenant = Tenant::find($user->tenant_id);
            $tenantPhone = $tenant ? $this->tenantValue($tenant, ['phone', 'mobile', 'mobile_number', 'tenant_phone']) : '';
            if ($tenantPhone) return $tenantPhone;
        }

        if (!empty($user->owner?->phone)) return (string) $user->owner->phone;

        return '';
    }

    private function sendWhatsAppOtp(string $to, string $otp): array
    {
        $token = (string) (config('services.whatsapp.access_token') ?: env('WHATSAPP_ACCESS_TOKEN') ?: env('WHATSAPP_TOKEN'));
        $phoneNumberId = (string) (config('services.whatsapp.phone_number_id') ?: env('WHATSAPP_PHONE_NUMBER_ID'));
        $version = (string) (config('services.whatsapp.graph_version') ?: env('WHATSAPP_GRAPH_VERSION', 'v20.0'));
        $template = (string) env('WHATSAPP_OTP_TEMPLATE_NAME', 'rental_password_reset_otp');
        $language = (string) env('WHATSAPP_OTP_TEMPLATE_LANGUAGE', 'ar');
        $to = $this->normalizePhone($to);

        if ($token === '' || $phoneNumberId === '' || $to === '' || $template === '') {
            return ['ok' => false, 'reason' => 'missing_config', 'has_token' => $token !== '', 'has_phone_number_id' => $phoneNumberId !== '', 'to' => $to];
        }

        $payloads = [
            [
                'messaging_product' => 'whatsapp',
                'to' => $to,
                'type' => 'template',
                'template' => [
                    'name' => $template,
                    'language' => ['code' => $language],
                    'components' => [
                        ['type' => 'body', 'parameters' => [['type' => 'text', 'text' => $otp]]],
                        ['type' => 'button', 'sub_type' => 'COPY_CODE', 'index' => '0', 'parameters' => [['type' => 'coupon_code', 'coupon_code' => $otp]]],
                    ],
                ],
            ],
            [
                'messaging_product' => 'whatsapp',
                'to' => $to,
                'type' => 'template',
                'template' => [
                    'name' => $template,
                    'language' => ['code' => $language],
                    'components' => [
                        ['type' => 'body', 'parameters' => [['type' => 'text', 'text' => $otp]]],
                    ],
                ],
            ],
        ];

        foreach ($payloads as $index => $payload) {
            try {
                $response = Http::withToken($token)->post("https://graph.facebook.com/{$version}/{$phoneNumberId}/messages", $payload);
                $body = $response->json();
                $result = [
                    'ok' => $response->successful(),
                    'status' => $response->status(),
                    'to' => $to,
                    'attempt' => $index === 0 ? 'copy_code_button' : 'body_only',
                    'provider_message_id' => Arr::get($body, 'messages.0.id'),
                    'error' => Arr::get($body, 'error.message'),
                    'error_code' => Arr::get($body, 'error.code'),
                    'error_type' => Arr::get($body, 'error.type'),
                ];

                if ($response->successful()) {
                    Log::info('WhatsApp OTP sent', $result);
                    return $result;
                }

                Log::warning('WhatsApp OTP send failed', ['result' => $result, 'body' => $response->body()]);
            } catch (\Throwable $e) {
                Log::error('WhatsApp OTP exception', ['error' => $e->getMessage(), 'to' => $to]);
            }
        }

        return ['ok' => false, 'reason' => 'provider_failed', 'to' => $to];
    }

    private function normalizePhone(?string $phone): string
    {
        $phone = preg_replace('/\D+/', '', (string) $phone);
        if ($phone === '') return '';
        if (Str::startsWith($phone, '00')) $phone = substr($phone, 2);
        if (Str::startsWith($phone, '966')) return $phone;
        if (Str::startsWith($phone, '0')) return '966' . substr($phone, 1);
        if (Str::startsWith($phone, '5') && strlen($phone) === 9) return '966' . $phone;
        return $phone;
    }

    private function localPhone(?string $phone): string
    {
        $phone = preg_replace('/\D+/', '', (string) $phone);
        if ($phone === '') return '';
        if (Str::startsWith($phone, '966')) return '0' . substr($phone, 3);
        if (Str::startsWith($phone, '5') && strlen($phone) === 9) return '0' . $phone;
        return $phone;
    }

    private function maskPhone(string $phone): string
    {
        $normalized = $this->normalizePhone($phone);
        if (strlen($normalized) <= 4) return $normalized;
        return substr($normalized, 0, 4) . '****' . substr($normalized, -3);
    }

    private function tenantValue(Tenant $tenant, array $keys): string
    {
        foreach ($keys as $key) {
            $value = $tenant->getAttribute($key);
            if ($value !== null && trim((string) $value) !== '') {
                return trim((string) $value);
            }
        }
        return '';
    }

    private function num($value): float
    {
        if ($value === null || $value === '') return 0.0;
        return is_numeric($value) ? (float) $value : (float) str_replace(',', '', (string) $value);
    }
}
