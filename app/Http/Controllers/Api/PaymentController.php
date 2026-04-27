<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $query = Payment::with(['contract.tenant', 'contract.unit.property.owner']);

        if ($oid = $request->input('owner_scope_id'))
            $query->whereHas('contract.unit.property', fn ($q) => $q->where('owner_id', $oid));
        if ($st  = $request->input('status'))      $query->where('status', $st);
        if ($cid = $request->input('contract_id')) $query->where('contract_id', $cid);

        return $this->paginated($query->orderBy('due_date')->paginate(min((int) $request->input('per_page', 30), 100)));
    }

    public function markPaid(Payment $payment): JsonResponse
    {
        $payment->update(['status' => 'paid', 'paid_date' => now()->toDateString()]);
        return $this->success(
            $payment->fresh()->load(['contract.tenant', 'contract.unit.property.owner']),
            'تم تسجيل السداد'
        );
    }

    public function markDue(Payment $payment): JsonResponse
    {
        $payment->update(['status' => 'due', 'paid_date' => null]);
        return $this->success($payment->fresh()->load(['contract.tenant', 'contract.unit.property.owner']), 'تمت إعادة الحالة');
    }

    public function markOverdue(Payment $payment): JsonResponse
    {
        $payment->update(['status' => 'overdue', 'paid_date' => null]);
        return $this->success($payment->fresh()->load(['contract.tenant', 'contract.unit.property.owner']), 'تم تسجيل التأخر');
    }
}
