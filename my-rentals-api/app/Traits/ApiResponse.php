<?php

namespace App\Traits;

use Illuminate\Http\JsonResponse;

trait ApiResponse
{
    protected function success($data = null, string $message = '', int $code = 200): JsonResponse
    {
        return response()->json([
            'status'  => 'ok',
            'message' => $message,
            'data'    => $data,
        ], $code);
    }

    protected function created($data = null, string $message = 'تمت الإضافة بنجاح'): JsonResponse
    {
        return $this->success($data, $message, 201);
    }

    protected function error(string $message = 'حدث خطأ', int $code = 400, $errors = null): JsonResponse
    {
        $body = ['status' => 'error', 'message' => $message];
        if ($errors) $body['errors'] = $errors;
        return response()->json($body, $code);
    }

    protected function notFound(string $message = 'العنصر غير موجود'): JsonResponse
    {
        return $this->error($message, 404);
    }

    protected function unauthorized(string $message = 'غير مصرح بالوصول'): JsonResponse
    {
        return $this->error($message, 401);
    }

    protected function forbidden(string $message = 'ليس لديك صلاحية'): JsonResponse
    {
        return $this->error($message, 403);
    }

    protected function paginated($paginator, string $message = ''): JsonResponse
    {
        return response()->json([
            'status'  => 'ok',
            'message' => $message,
            'data'    => $paginator->items(),
            'meta'    => [
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'per_page'     => $paginator->perPage(),
                'total'        => $paginator->total(),
            ],
        ]);
    }
}
