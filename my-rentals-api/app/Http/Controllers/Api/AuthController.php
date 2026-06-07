<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\User;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    use ApiResponse;

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'username' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string'],
        ]);

        $username = mb_strtolower(trim((string) $data['username']));

        $user = $this->findUserByLoginIdentifier($username);

        if (! $user) {
            return $this->error('اسم المستخدم أو كلمة المرور غير صحيحة', 401);
        }

        if ($this->isPasswordSetupRequired($user)) {
            return response()->json([
                'success' => false,
                'message' => 'لا توجد كلمة سر لهذا الحساب. اضغط نسيت كلمة السر أو أول دخول لإرسال رمز التحقق عبر واتساب.',
                'requires_password_setup' => true,
            ], 409);
        }

        if (! Hash::check($data['password'], (string) $user->password)) {
            return $this->error('اسم المستخدم أو كلمة المرور غير صحيحة', 401);
        }

        if (Schema::hasColumn('users', 'status') && (($user->status ?? 'active') !== 'active')) {
            return $this->error('الحساب معطل، تواصل مع المدير', 403);
        }

        if (Schema::hasColumn('users', 'is_active') && isset($user->is_active) && ! (bool) $user->is_active) {
            return $this->error('الحساب معطل، تواصل مع المدير', 403);
        }

        if (Schema::hasColumn('users', 'password_set_at') && empty($user->password_set_at)) {
            $user->forceFill(['password_set_at' => now()])->save();
        }

        $plainToken = Str::random(80);
        $user->forceFill([
            'api_token'     => hash('sha256', $plainToken),
            'last_login_at' => now(),
        ])->save();

        $user->refresh();

        return $this->success([
            'token' => $plainToken,
            'user'  => $this->userPayload($user),
        ], 'تم تسجيل الدخول بنجاح');
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->forceFill(['api_token' => null])->save();

        return $this->success(null, 'تم تسجيل الخروج');
    }

    public function me(Request $request): JsonResponse
    {
        return $this->success($this->userPayload($request->user()));
    }

    private function findUserByLoginIdentifier(string $identifier): ?User
    {
        $digits = preg_replace('/\D+/', '', $identifier) ?: $identifier;
        $phone = $this->normalizePhone($identifier);

        $user = User::query()
            ->where(function ($q) use ($identifier, $digits, $phone) {
                if (Schema::hasColumn('users', 'username')) {
                    $q->orWhereRaw('LOWER(username) = ?', [$identifier])
                        ->orWhere('username', $digits)
                        ->orWhere('username', $phone);
                }

                if (Schema::hasColumn('users', 'email')) {
                    $q->orWhereRaw('LOWER(email) = ?', [$identifier]);
                }

                if (Schema::hasColumn('users', 'phone')) {
                    $q->orWhere('phone', $identifier)
                        ->orWhere('phone', $digits)
                        ->orWhere('phone', $phone);
                }

                if (Schema::hasColumn('users', 'national_id')) {
                    $q->orWhere('national_id', $identifier)
                        ->orWhere('national_id', $digits);
                }
            })
            ->first();

        if ($user) {
            return $user;
        }

        $tenant = $this->findTenantByIdentifier($identifier);
        if (!$tenant) {
            return null;
        }

        $username = $tenant->national_id ?: $this->normalizePhone($tenant->phone) ?: $tenant->phone;
        if (!$username) {
            return null;
        }

        $payload = [
            'name' => $tenant->name ?: 'مستأجر',
            'username' => $username,
            'email' => $tenant->email ?: null,
            'password' => Hash::make(Str::random(32)),
            'role' => 'tenant',
            'status' => 'active',
        ];

        if (Schema::hasColumn('users', 'tenant_id')) $payload['tenant_id'] = $tenant->id;
        if (Schema::hasColumn('users', 'phone')) $payload['phone'] = $tenant->phone;
        if (Schema::hasColumn('users', 'national_id')) $payload['national_id'] = $tenant->national_id;
        if (Schema::hasColumn('users', 'password_set_at')) $payload['password_set_at'] = null;

        return User::create($payload);
    }

    private function findTenantByIdentifier(string $identifier): ?Tenant
    {
        $digits = preg_replace('/\D+/', '', $identifier) ?: $identifier;
        $phone = $this->normalizePhone($identifier);

        return Tenant::query()
            ->where(function ($q) use ($identifier, $digits, $phone) {
                $q->where('national_id', $identifier)
                    ->orWhere('national_id', $digits)
                    ->orWhere('phone', $identifier)
                    ->orWhere('phone', $digits)
                    ->orWhere('phone', $phone)
                    ->orWhere('phone', '0' . ltrim(preg_replace('/^966/', '', $phone), '0'));
            })
            ->orderByDesc('id')
            ->first();
    }

    private function isPasswordSetupRequired(User $user): bool
    {
        $role = method_exists($user, 'effectiveRole') ? $user->effectiveRole() : (string) ($user->role ?? '');

        return $role === 'tenant'
            && Schema::hasColumn('users', 'password_set_at')
            && empty($user->password_set_at);
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

    private function userPayload(User $user): array
    {
        return [
            'id'       => $user->id,
            'name'     => $user->name,
            'username' => Schema::hasColumn('users', 'username') ? ($user->username ?? null) : null,
            'email'    => $user->email,
            'role'     => method_exists($user, 'effectiveRole') ? $user->effectiveRole() : ($user->role ?? 'admin'),
            'owner_id' => $user->owner_id,
            'tenant_id' => Schema::hasColumn('users', 'tenant_id') ? ($user->tenant_id ?? null) : null,
            'phone' => Schema::hasColumn('users', 'phone') ? ($user->phone ?? null) : null,
            'national_id' => Schema::hasColumn('users', 'national_id') ? ($user->national_id ?? null) : null,
            'owner'    => $user->owner,
            'is_admin' => method_exists($user, 'isAdmin') ? $user->isAdmin() : in_array($user->role ?? 'admin', ['admin', 'manager', 'super_admin'], true),
            'is_tenant' => (method_exists($user, 'effectiveRole') ? $user->effectiveRole() : ($user->role ?? '')) === 'tenant',
        ];
    }
}
