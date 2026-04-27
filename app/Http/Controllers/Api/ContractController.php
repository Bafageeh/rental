<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use App\Models\Payment;
use App\Models\Property;
use App\Models\Unit;
use App\Traits\ApiResponse;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ContractController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $query = Contract::with([
            'tenant', 'unit.property.owner', 'parkingSpot', 'files',
            'payments' => fn ($q) => $q->orderBy('due_date'),
        ]);

        if ($oid = $request->input('owner_scope_id')) {
            $pids = Property::where('owner_id', $oid)->pluck('id');
            $uids = Unit::whereIn('property_id', $pids)->pluck('id');
            $query->whereIn('unit_id', $uids);
        }

        if ($st  = $request->input('status'))    $query->where('status', $st);
        if ($tid = $request->input('tenant_id')) $query->where('tenant_id', $tid);
        if ($s   = $request->input('search'))
            $query->where(fn ($q) => $q
                ->where('contract_number', 'like', "%{$s}%")
                ->orWhereHas('tenant', fn ($t) => $t->where('name', 'like', "%{$s}%")));

        return $this->paginated($query->orderBy('id', 'desc')->paginate(min((int) $request->input('per_page', 20), 100)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'tenant_id'      => ['required', 'integer', 'exists:tenants,id'],
            'unit_id'        => ['required', 'integer', 'exists:units,id'],
            'contract_number'=> ['nullable', 'string', 'max:255'],
            'start_date'     => ['required', 'date'],
            'end_date'       => ['required', 'date', 'after_or_equal:start_date'],
            'rent_amount'    => ['required', 'numeric', 'min:0'],
            'parking_fee'    => ['nullable', 'numeric', 'min:0'],
            'services_fee'   => ['nullable', 'numeric', 'min:0'],
            'deposit_amount' => ['nullable', 'numeric', 'min:0'],
            'payment_cycle'  => ['nullable', 'string', 'in:monthly,quarterly,semi_annual,annual'],
            'payments_count' => ['nullable', 'integer', 'min:1', 'max:120'],
            'notes'          => ['nullable', 'string', 'max:2000'],
        ]);

        // Check unit not actively rented
        $hasActive = Contract::where('unit_id', $data['unit_id'])->where('status', 'active')->exists();
        if ($hasActive) return $this->error('الوحدة مؤجرة بعقد نشط', 422);

        $contract = DB::transaction(function () use ($data) {
            $contract = Contract::create([
                'tenant_id'       => $data['tenant_id'],
                'unit_id'         => $data['unit_id'],
                'contract_number' => $data['contract_number'] ?? ('MAN-' . now()->format('YmdHis')),
                'start_date'      => $data['start_date'],
                'end_date'        => $data['end_date'],
                'rent_amount'     => $data['rent_amount'],
                'parking_fee'     => $data['parking_fee'] ?? 0,
                'services_fee'    => $data['services_fee'] ?? 0,
                'deposit_amount'  => $data['deposit_amount'] ?? 0,
                'payment_cycle'   => $data['payment_cycle'] ?? 'monthly',
                'status'          => 'active',
                'source'          => 'manual',
                'notes'           => $data['notes'] ?? null,
            ]);

            Unit::where('id', $data['unit_id'])->update(['status' => 'rented', 'rent_amount' => $data['rent_amount']]);
            $this->generatePayments($contract, $data);

            return $contract;
        });

        return $this->created(
            $contract->fresh()->load(['tenant', 'unit.property.owner', 'payments']),
            'تم إنشاء العقد والدفعات'
        );
    }

    public function show(Contract $contract): JsonResponse
    {
        return $this->success($contract->load([
            'tenant', 'unit.property.owner', 'parkingSpot',
            'payments' => fn ($q) => $q->orderBy('due_date'), 'files',
        ]));
    }

    public function close(Contract $contract): JsonResponse
    {
        DB::transaction(function () use ($contract) {
            $contract->update(['status' => 'ended']);
            if ($contract->unit_id) Unit::where('id', $contract->unit_id)->update(['status' => 'available']);
        });

        return $this->success(
            $contract->fresh()->load(['tenant', 'unit.property.owner', 'payments']),
            'تم إغلاق العقد'
        );
    }

    public function activate(Contract $contract): JsonResponse
    {
        DB::transaction(function () use ($contract) {
            $contract->update(['status' => 'active']);
            if ($contract->unit_id) Unit::where('id', $contract->unit_id)->update(['status' => 'rented']);
        });

        return $this->success(
            $contract->fresh()->load(['tenant', 'unit.property.owner', 'payments']),
            'تم تفعيل العقد'
        );
    }

    private function generatePayments(Contract $contract, array $data): void
    {
        $count   = (int) ($data['payments_count'] ?? 1);
        $amount  = $count > 0 ? round((float) $data['rent_amount'] / $count, 2) : (float) $data['rent_amount'];
        $start   = Carbon::parse($data['start_date']);
        $months  = ['monthly' => 1, 'quarterly' => 3, 'semi_annual' => 6, 'annual' => 12][$data['payment_cycle'] ?? 'monthly'] ?? 1;

        for ($i = 0; $i < $count; $i++) {
            Payment::create([
                'contract_id' => $contract->id,
                'amount'      => $amount,
                'due_date'    => $start->copy()->addMonthsNoOverflow($i * $months)->toDateString(),
                'status'      => 'due',
            ]);
        }
    }
}
