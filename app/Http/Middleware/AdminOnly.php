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

        if (! $user || ! in_array($user->role ?? 'admin', ['admin', 'manager', 'super_admin'])) {
            return response()->json([
                'status'  => 'error',
                'message' => 'هذا الإجراء متاح للمدير فقط',
            ], 403);
        }

        return $next($request);
    }
}
