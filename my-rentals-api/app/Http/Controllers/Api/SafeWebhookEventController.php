<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WebhookEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Throwable;

class SafeWebhookEventController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        try {
            if (! Schema::hasTable('webhook_events')) {
                return response()->json([
                    'data' => [
                        'data' => [],
                        'current_page' => 1,
                        'per_page' => (int) $request->query('per_page', 30),
                        'total' => 0,
                    ],
                ]);
            }

            $query = WebhookEvent::query()->latest('id');

            if (Schema::hasColumn('webhook_events', 'provider') && $provider = $request->query('provider')) {
                $query->where('provider', $provider);
            }

            if (Schema::hasColumn('webhook_events', 'event_type') && $eventType = $request->query('event_type')) {
                $query->where('event_type', $eventType);
            }

            if (Schema::hasColumn('webhook_events', 'tenant_id') && Schema::hasTable('tenants')) {
                $query->with('tenant:id,name,phone');

                if ($tenantId = $request->query('tenant_id')) {
                    $query->where('tenant_id', $tenantId);
                }
            }

            if ($phone = $request->query('phone')) {
                $normalized = preg_replace('/\D+/', '', (string) $phone) ?: '';
                if ($normalized !== '' && Schema::hasColumn('webhook_events', 'source') && Schema::hasColumn('webhook_events', 'destination')) {
                    $query->where(function ($q) use ($normalized) {
                        $q->where('source', 'like', '%' . $normalized . '%')
                            ->orWhere('destination', 'like', '%' . $normalized . '%');
                    });
                }
            }

            return response()->json([
                'data' => $query->paginate(max(1, min(100, (int) $request->query('per_page', 30)))),
            ]);
        } catch (Throwable $e) {
            Log::error('Safe webhook events API failed; returning empty list', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            return response()->json([
                'data' => [
                    'data' => [],
                    'current_page' => 1,
                    'per_page' => (int) $request->query('per_page', 30),
                    'total' => 0,
                ],
                'fallback' => true,
            ]);
        }
    }
}
