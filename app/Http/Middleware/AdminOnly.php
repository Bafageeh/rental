<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdminOnly
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $role = $user
            ? (method_exists($user, 'effectiveRole')
                ? $user->effectiveRole()
                : strtolower(trim((string) ($user->role ?? 'admin'))))
            : null;

        if (! $user || ! in_array($role, ['admin', 'manager', 'super_admin'], true)) {
            return response()->json([
                'status'  => 'error',
                'message' => 'هذا الإجراء متاح للمدير فقط',
            ], 403);
        }

        return $next($request);
    }
}
