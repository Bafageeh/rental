<?php

namespace App\Http\Middleware;

use App\Models\Property;
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
        $isProfilePath = $request->is('api/profile/*') || $request->is('profile/*');

        if ($isScopedOwnerPath || $isAuthPath || $isProfilePath) {
            return $next($request);
        }

        $role = method_exists($user, 'effectiveRole')
            ? $user->effectiveRole()
            : strtolower(trim((string) ($user->role ?? 'owner')));

        if (in_array($role, ['admin', 'manager', 'super_admin'], true)) {
            return $next($request);
        }

        // شاشة تفاصيل العقار القديمة تستخدم /properties/{id}.
        // نسمح لحساب المالك فقط إذا كان العقار المطلوب مرتبطًا بنفس owner_id،
        // وبهذا لا يرى المالك عقارات غيره ولا يتعطل فتح التفاصيل من شاشة عقاراتي.
        if ($request->isMethod('get') && ($request->is('api/properties/*') || $request->is('properties/*'))) {
            $propertyId = $request->route('property') ?: $request->segment($request->is('api/*') ? 3 : 2);

            if ($propertyId && !empty($user->owner_id)) {
                $ownsProperty = Property::query()
                    ->whereKey($propertyId)
                    ->where('owner_id', $user->owner_id)
                    ->exists();

                if ($ownsProperty) {
                    return $next($request);
                }
            }
        }

        return response()->json([
            'status'  => 'error',
            'message' => 'هذا المسار عام وغير مفلتر. استخدم مسارات /my الخاصة بحسابك.',
        ], 403);
    }
}
