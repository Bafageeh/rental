<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class OwnerScope
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && ($user->role ?? 'admin') === 'owner' && ! empty($user->owner_id)) {
            $request->merge(['owner_scope_id' => $user->owner_id]);
        }

        return $next($request);
    }
}
