<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class TenantReportController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        $role = method_exists($user, 'effectiveRole') ? $user->effectiveRole() : strtolower(trim((string) ($user->role ?? '')));

        if ($role !== 'tenant') {
            return response()->json([
                'status' => 'error',
                'message' => 'هذه الشاشة مخصصة للمستأجرين فقط.',
            ], 403);
        }

        $tenantId = Schema::hasColumn('users', 'tenant_id') ? (int) ($user->tenant_id ?? 0) : 0;
        if ($tenantId <= 0) {
            return response()->json([
                'status' => 'error',
                'message' => 'لا يوجد مستأجر مرتبط بهذا الحساب.',
            ], 404);
        }

        $contracts = Contract::with([
                'tenant:id,name,phone,national_id,nationality',
                'unit.property.owner',
                'payments' => fn ($q) => $q->orderBy('due_date')->orderBy('id'),
            ])
            ->where('tenant_id', $tenantId)
            ->orderByRaw("CASE WHEN status IN ('active', 'نشط') THEN 0 ELSE 1 END")
            ->orderByDesc('id')
            ->get();

        $activeContract = $contracts->first(function ($contract) {
            return in_array((string) ($contract->status ?? ''), ['active', 'نشط'], true);
        }) ?: $contracts->first();

        $today = now()->toDateString();
        $requiredDueTotal = 0.0;
        $paidTotal = 0.0;
        $installmentValue = 0.0;
        $upcoming = null;

        foreach ($contracts as $contract) {
            $contractRegularPayment = $this->number($contract->regular_payment_amount ?? 0);
            if ($installmentValue <= 0 && $contract === $activeContract && $contractRegularPayment > 0) {
                $installmentValue = $contractRegularPayment;
            }

            foreach ($contract->payments as $payment) {
                $amount = $this->number($payment->amount ?? 0);
                $paid = $this->number($payment->paid_amount ?? 0);
                $remaining = max(0, $amount - $paid);
                $dueDate = $payment->due_date ? (string) $payment->due_date : null;

                // قاعدة المتأخرات المطلوبة:
                // إجمالي المطلوب المستحق حتى اليوم - إجمالي المستلم، ثم تقسيم الناتج على قيمة الدفعة مع الجبر للأعلى.
                if ($dueDate && $dueDate <= $today) {
                    $requiredDueTotal += $amount;
                    if ($installmentValue <= 0 && $amount > 0) {
                        $installmentValue = $contractRegularPayment > 0 ? $contractRegularPayment : $amount;
                    }
                }

                $paidTotal += $paid;

                if ($remaining > 0.009 && $dueDate && $dueDate > $today) {
                    if (!$upcoming || $dueDate < $upcoming['due_date']) {
                        $upcoming = [
                            'due_date' => $dueDate,
                            'amount' => $amount,
                            'paid_amount' => $paid,
                            'remaining_amount' => $remaining,
                            'contract_id' => $contract->id,
                            'contract_number' => $contract->government_contract_number ?: $contract->contract_number,
                            'property_name' => $contract->unit?->property?->name,
                            'unit_number' => $contract->unit?->unit_number,
                        ];
                    }
                }
            }
        }

        if ($installmentValue <= 0 && $activeContract) {
            $installmentValue = $this->number($activeContract->regular_payment_amount ?? 0);
        }

        $overdueAmount = max(0, $requiredDueTotal - $paidTotal);
        $overdueCount = ($overdueAmount > 0.009 && $installmentValue > 0)
            ? (int) ceil($overdueAmount / $installmentValue)
            : 0;

        $openTicketsCount = 0;
        if (Schema::hasTable('chat_threads')) {
            $openTicketsCount = DB::table('chat_threads')
                ->where('tenant_id', $tenantId)
                ->where(function ($q) {
                    $q->whereNull('status')->orWhere('status', '<>', 'closed');
                })
                ->count();
        }

        return response()->json([
            'status' => 'ok',
            'data' => [
                'tenant' => [
                    'id' => $contracts->first()?->tenant?->id ?? $tenantId,
                    'name' => $contracts->first()?->tenant?->name ?? $user->name,
                    'phone' => $contracts->first()?->tenant?->phone ?? $user->phone,
                    'national_id' => $contracts->first()?->tenant?->national_id ?? $user->national_id,
                    'nationality' => $contracts->first()?->tenant?->nationality,
                ],
                'reports' => [
                    'overdue_payments_count' => $overdueCount,
                    'overdue_amount' => round($overdueAmount, 2),
                    'required_due_total' => round($requiredDueTotal, 2),
                    'paid_total' => round($paidTotal, 2),
                    'installment_value' => round($installmentValue, 2),
                    'next_payment_date' => $upcoming['due_date'] ?? null,
                    'next_payment' => $upcoming,
                    'open_tickets_count' => $openTicketsCount,
                    'contract_end_date' => $activeContract?->end_date ? (string) $activeContract->end_date : null,
                    'contract_number' => $activeContract ? ($activeContract->government_contract_number ?: $activeContract->contract_number) : null,
                    'contract_status' => $activeContract?->status,
                    'contracts_count' => $contracts->count(),
                ],
            ],
        ]);
    }

    private function number($value): float
    {
        $number = (float) str_replace(',', '', (string) ($value ?? 0));
        return is_finite($number) ? $number : 0.0;
    }
}
