<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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

        $user = null;
        if (Schema::hasColumn('users', 'username')) {
            $user = User::query()
                ->whereRaw('LOWER(username) = ?', [$username])
                ->first();
        }

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return $this->error('اسم المستخدم أو كلمة المرور غير صحيحة', 401);
        }

        if (Schema::hasColumn('users', 'status') && (($user->status ?? 'active') !== 'active')) {
            return $this->error('الحساب معطل، تواصل مع المدير', 403);
        }

        if (Schema::hasColumn('users', 'is_active') && isset($user->is_active) && ! (bool) $user->is_active) {
            return $this->error('الحساب معطل، تواصل مع المدير', 403);
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

    private function userPayload(User $user): array
    {
        return [
            'id'       => $user->id,
            'name'     => $user->name,
            'username' => Schema::hasColumn('users', 'username') ? ($user->username ?? null) : null,
            'email'    => $user->email,
            'role'     => method_exists($user, 'effectiveRole') ? $user->effectiveRole() : ($user->role ?? 'admin'),
            'owner_id' => $user->owner_id,
            'owner'    => $user->owner,
            'is_admin' => method_exists($user, 'isAdmin') ? $user->isAdmin() : in_array($user->role ?? 'admin', ['admin', 'manager', 'super_admin'], true),
        ];
    }
}
