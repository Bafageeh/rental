<?php

use App\Models\Contract;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

if (!function_exists('mrco_n')) {
    function mrco_n($v): float
    {
        if ($v === null || $v === '') return 0.0;
        return is_numeric($v) ? (float) $v : (float) str_replace(',', '', (string) $v);
    }
}

if (!function_exists('mrco_s')) {
    function mrco_s($v): string
    {
        return trim(mb_strtolower((string) ($v ?? '')));
    }
}

if (!function_exists('mrco_amt')) {
    function mrco_amt($p): float
    {
        return mrco_n($p->amount ?? $p->payment_amount ?? $p->due_amount ?? 0);
    }
}

if (!function_exists('mrco_paid')) {
    function mrco_paid($p): float
    {
        $paid = mrco_n($p->paid_amount ?? 0);
        if ($paid > 0) return $paid;
        if (!empty($p->paid_date)) return mrco_amt($p);
        return in_array(mrco_s($p->status ?? null), ['paid', 'مدفوع', 'مدفوعة', 'مسدد'], true) ? mrco_amt($p) : 0.0;
    }
}

if (!function_exists('mrco_due')) {
    function mrco_due($p): string
    {
        return substr((string) ($p->due_date ?? ''), 0, 10);
    }
}

if (!function_exists('mrco_apply_contract_calc')) {
    function mrco_apply_contract_calc($contract)
    {
        $payments = $contract->payments ? $contract->payments->sortBy([['due_date', 'asc'], ['id', 'asc']])->values() : collect();
        $today = now()->toDateString();
        $dueTotal = $payments->filter(fn ($p) => preg_match('/^\d{4}-\d{2}-\d{2}$/', mrco_due($p)) && mrco_due($p) <= $today)->sum(fn ($p) => mrco_amt($p));
        $paidTotal = $payments->sum(fn ($p) => mrco_paid($p));
        $lateAmount = max(0.0, $dueTotal - $paidTotal);
        $payValue = 0.0;
        foreach ($payments as $p) { $a = mrco_amt($p); if ($a > 0) { $payValue = $a; break; } }
        $lateCount = ($lateAmount > 0 && $payValue > 0) ? (int) ceil($lateAmount / $payValue) : 0;
        $remainingPaid = $paidTotal;
        $remainingLate = $lateAmount;
        $markedLate = 0;

        foreach ($payments as $p) {
            $amount = mrco_amt($p);
            $due = mrco_due($p);
            $isDue = preg_match('/^\d{4}-\d{2}-\d{2}$/', $due) && $due <= $today;
            if ($amount > 0 && $remainingPaid >= $amount) {
                $p->setAttribute('status', 'paid');
                $p->setAttribute('badge', 'مدفوعة');
                $p->setAttribute('paid_amount', $amount);
                $p->setAttribute('remaining_amount', 0);
                $remainingPaid -= $amount;
            } elseif ($isDue && $markedLate < $lateCount && $remainingLate > 0) {
                $rem = min($amount > 0 ? $amount : $remainingLate, $remainingLate);
                $p->setAttribute('status', 'overdue');
                $p->setAttribute('badge', 'متأخرة');
                $p->setAttribute('paid_amount', max(0, $remainingPaid));
                $p->setAttribute('remaining_amount', $rem);
                $remainingPaid = 0;
                $remainingLate -= $rem;
                $markedLate++;
            } else {
                $p->setAttribute('status', 'due');
                $p->setAttribute('badge', 'مستحقة');
                $p->setAttribute('paid_amount', 0);
                $p->setAttribute('remaining_amount', $amount);
            }
        }

        $contract->setRelation('payments', $payments);
        $contract->setAttribute('overdue_payments_count', $lateCount);
        $contract->setAttribute('overdue_amount', $lateAmount);
        $contract->setAttribute('paid_total_amount', $paidTotal);
        $contract->setAttribute('due_total_until_today', $dueTotal);
        return $contract;
    }
}

if (!function_exists('mrco_query')) {
    function mrco_query()
    {
        return Contract::query()->with(['tenant', 'unit.property.owner', 'parkingSpot', 'files', 'payments' => fn ($q) => $q->orderBy('due_date')->orderBy('id')]);
    }
}

if (!function_exists('mrco_list')) {
    function mrco_list(Request $request)
    {
        $q = mrco_query();
        if ($request->filled('unit_id')) $q->where('unit_id', (int) $request->input('unit_id'));
        if ($request->filled('property_id')) {
            $pid = (int) $request->input('property_id');
            $q->whereHas('unit', fn ($u) => $u->where('property_id', $pid));
        }
        if ($request->filled('status')) $q->where('status', $request->input('status'));
        return $q->orderByDesc('id')->get()->map(fn ($c) => mrco_apply_contract_calc($c))->values();
    }
}

Route::get('/contracts', fn (Request $request) => mrco_list($request));
Route::get('/my/contracts', fn (Request $request) => mrco_list($request));
Route::get('/contracts/{contract}', fn (Request $request, Contract $contract) => mrco_apply_contract_calc($contract->load(['tenant', 'unit.property.owner', 'parkingSpot', 'files', 'payments' => fn ($q) => $q->orderBy('due_date')->orderBy('id')])));
Route::get('/my/contracts/{contract}', fn (Request $request, Contract $contract) => mrco_apply_contract_calc($contract->load(['tenant', 'unit.property.owner', 'parkingSpot', 'files', 'payments' => fn ($q) => $q->orderBy('due_date')->orderBy('id')])));
Route::get('/units/{unit}/contracts', function (Request $request, \App\Models\Unit $unit) { $request->merge(['unit_id' => $unit->id]); return mrco_list($request); });
Route::get('/my/units/{unit}/contracts', function (Request $request, \App\Models\Unit $unit) { $request->merge(['unit_id' => $unit->id]); return mrco_list($request); });

$paymentEditRecalcFile = __DIR__ . '/118_payment_edit_cumulative_recalc.php';
if (is_file($paymentEditRecalcFile)) require_once $paymentEditRecalcFile;
