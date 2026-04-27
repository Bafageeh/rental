<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnforceApiAccessScope
{
    /**
     * يمنع حسابات الملاك من استخدام المسارات العامة غير المفلترة مثل /properties و /payments.
     * المسارات العامة تبقى للإدارة فقط، أما حساب المالك فيستخدم /my/* المفلترة حسب owner_id.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'status'  => 'error',
                'message' => 'يجب تسجيل الدخول للوصول',
            ], 401);
        }

        $isScopedOwnerPath = $request->is('api/my/*') || $request->is('my/*');
        $isAuthPath = $request->is('api/auth/*') || $request->is('auth/*');

        if ($isScopedOwnerPath || $isAuthPath) {
            return $next($request);
        }

        $role = method_exists($user, 'effectiveRole')
            ? $user->effectiveRole()
            : strtolower(trim((string) ($user->role ?? 'owner')));

        if (! in_array($role, ['admin', 'manager', 'super_admin'], true)) {
            return response()->json([
                'status'  => 'error',
                'message' => 'هذا المسار عام وغير مفلتر. استخدم مسارات /my الخاصة بحسابك.',
            ], 403);
        }

        return $next($request);
    }
}
