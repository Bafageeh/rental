<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateApi
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $this->resolveToken($request);

        if (! $token) {
            return response()->json([
                'status'  => 'error',
                'message' => 'يجب تسجيل الدخول للوصول',
            ], 401);
        }

        $hashedToken = hash('sha256', $token);

        $query = User::query()->where(function ($query) use ($token, $hashedToken) {
            $query->where('api_token', $hashedToken)
                // توافق مؤقت مع الجلسات القديمة إذا كان التوكن محفوظًا كنص قبل تحديث الحماية.
                ->orWhere('api_token', $token);
        });

        if (Schema::hasColumn('users', 'status')) {
            $query->where(function ($q) {
                $q->where('status', 'active')->orWhereNull('status');
            });
        }

        if (Schema::hasColumn('users', 'is_active')) {
            $query->where(function ($q) {
                $q->where('is_active', true)->orWhereNull('is_active');
            });
        }

        $user = $query->first();

        if (! $user) {
            return response()->json([
                'status'  => 'error',
                'message' => 'جلسة غير صالحة، أعد تسجيل الدخول',
            ], 401);
        }

        if (($user->api_token ?? null) === $token) {
            $user->forceFill(['api_token' => $hashedToken])->save();
        }

        $request->setUserResolver(fn () => $user);
        $request->merge(['_auth_user' => $user]);

        return $next($request);
    }

    /**
     * بعض بيئات cPanel / Apache / PHP-FPM لا تمرر Authorization إلى Laravel كما هي.
     * لذلك نقرأ التوكن من أكثر من مصدر، والجوال سيرسل X-Api-Token كاحتياط.
     */
    private function resolveToken(Request $request): ?string
    {
        $token = $request->bearerToken();

        if (! $token) {
            $authorization = $request->header('Authorization')
                ?: $request->server('HTTP_AUTHORIZATION')
                ?: $request->server('REDIRECT_HTTP_AUTHORIZATION')
                ?: '';

            if (is_string($authorization) && preg_match('/Bearer\s+(.+)/i', $authorization, $matches)) {
                $token = trim($matches[1]);
            }
        }

        if (! $token) {
            $token = $request->header('X-Api-Token')
                ?: $request->server('HTTP_X_API_TOKEN')
                ?: $request->input('api_token')
                ?: $request->query('api_token');
        }

        if (! is_string($token)) {
            return null;
        }

        $token = trim($token);

        return $token !== '' ? $token : null;
    }
}
