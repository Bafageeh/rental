<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use App\Models\Payment;
use App\Traits\ApiResponse;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AlertController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $today    = Carbon::today();
        $in30days = Carbon::today()->addDays(30);
        $in60days = Carbon::today()->addDays(60);
        $oid      = $request->input('owner_scope_id');

        $overdueQ = Payment::with(['contract.tenant', 'contract.unit.property.owner'])
            ->where(fn ($q) => $q
                ->where('status', 'overdue')
                ->orWhere(fn ($q2) => $q2->whereIn('status', ['due', 'pending'])->whereDate('due_date', '<', $today)))
            ->orderBy('due_date');

        $upcomingQ = Payment::with(['contract.tenant', 'contract.unit.property.owner'])
            ->whereNotIn('status', ['paid', 'cancelled'])
            ->whereDate('due_date', '>=', $today)
            ->whereDate('due_date', '<=', $in30days)
            ->orderBy('due_date');

        $endingQ = Contract::with(['tenant', 'unit.property.owner'])
            ->where('status', 'active')
            ->whereDate('end_date', '>=', $today)
            ->whereDate('end_date', '<=', $in60days)
            ->orderBy('end_date');

        if ($oid) {
            $pFilter = fn ($q) => $q->whereHas('contract.unit.property', fn ($p) => $p->where('owner_id', $oid));
            $overdueQ->where($pFilter);
            $upcomingQ->where($pFilter);
            $endingQ->whereHas('unit.property', fn ($q) => $q->where('owner_id', $oid));
        }

        $overdue  = $overdueQ->limit(50)->get();
        $upcoming = $upcomingQ->limit(50)->get();
        $ending   = $endingQ->limit(20)->get();

        return $this->success([
            'today'   => $today->toDateString(),
            'summary' => [
                'overdue_count'            => $overdue->count(),
                'overdue_total'            => round($overdue->sum('amount'), 2),
                'upcoming_count'           => $upcoming->count(),
                'upcoming_total'           => round($upcoming->sum('amount'), 2),
                'ending_contracts_count'   => $ending->count(),
            ],
            'overdue_payments'  => $overdue,
            'upcoming_payments' => $upcoming,
            'ending_contracts'  => $ending,
        ]);
    }
}
