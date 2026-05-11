<?php

namespace App\Services;

use App\Models\Contract;
use App\Models\Owner;
use App\Models\Payment;
use App\Models\Property;
use App\Models\Unit;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class EnhancedGovernmentContractImporter extends GovernmentContractImporter
{
    public function import(array $data, ?Owner $forcedOwner = null, ?Property $forcedProperty = null, ?Unit $forcedUnit = null): array
    {
        $result = parent::import($data, $forcedOwner, $forcedProperty, $forcedUnit);

        $contract = $result['contract'] ?? null;
        $payments = $data['payments'] ?? [];

        if ($contract instanceof Contract && $this->hasOfficialSchedule($payments)) {
            $this->syncOfficialPaymentSchedule($contract, $payments);
            $result['contract'] = $contract->fresh(['tenant', 'unit.property.owner', 'payments']);
            $result['payments_count'] = count($payments);
            $result['payments_source'] = $data['payments_source'] ?? 'official_ejar_schedule';
        }

        return $result;
    }

    private function hasOfficialSchedule(array $payments): bool
    {
        foreach ($payments as $payment) {
            if (!empty($payment['due_date']) && !empty($payment['amount'])) {
                return true;
            }
        }

        return false;
    }

    private function syncOfficialPaymentSchedule(Contract $contract, array $payments): void
    {
        $existing = Payment::where('contract_id', $contract->id)
            ->orderByRaw(Schema::hasColumn('payments', 'sequence') ? 'COALESCE(sequence, 999999)' : 'id')
            ->orderBy('due_date')
            ->orderBy('id')
            ->get()
            ->values();

        foreach (array_values($payments) as $index => $paymentData) {
            $sequence = (int) ($paymentData['sequence'] ?? ($index + 1));
            $dueDate = $this->dateOrNull($paymentData['due_date'] ?? null);
            $amount = $this->amountOrZero($paymentData['amount'] ?? 0);

            if (!$dueDate || $amount <= 0) {
                continue;
            }

            $payment = null;

            if (Schema::hasColumn('payments', 'sequence')) {
                $payment = Payment::where('contract_id', $contract->id)
                    ->where('sequence', $sequence)
                    ->first();
            }

            if (!$payment) {
                $payment = Payment::where('contract_id', $contract->id)
                    ->whereDate('due_date', $dueDate)
                    ->first();
            }

            if (!$payment) {
                $payment = $existing->get($index);
            }

            $updates = [
                'contract_id' => $contract->id,
                'sequence' => $sequence,
                'due_date' => $dueDate,
                'payment_deadline' => $this->dateOrNull($paymentData['payment_deadline'] ?? null),
                'due_date_hijri' => $paymentData['due_date_hijri'] ?? null,
                'payment_deadline_hijri' => $paymentData['payment_deadline_hijri'] ?? null,
                'rental_period_days' => isset($paymentData['rental_period_days']) ? (int) $paymentData['rental_period_days'] : null,
                'amount' => $amount,
                'notes' => $this->officialScheduleNote($paymentData),
            ];

            $updates = $this->onlyPaymentColumns($updates);

            if ($payment) {
                if (empty($payment->paid_date)) {
                    $updates['status'] = $this->autoStatus($updates['payment_deadline'] ?? null, $dueDate);
                }

                if (Schema::hasColumn('payments', 'updated_at')) {
                    $updates['updated_at'] = now();
                }

                DB::table('payments')->where('id', $payment->id)->update($updates);
            } else {
                $updates['status'] = $this->autoStatus($updates['payment_deadline'] ?? null, $dueDate);

                if (Schema::hasColumn('payments', 'created_at')) {
                    $updates['created_at'] = now();
                }
                if (Schema::hasColumn('payments', 'updated_at')) {
                    $updates['updated_at'] = now();
                }

                DB::table('payments')->insert($updates);
            }
        }
    }

    private function officialScheduleNote(array $paymentData): string
    {
        $parts = ['دفعة مستوردة من جدول سداد عقد إيجار الرسمي'];

        if (!empty($paymentData['payment_deadline'])) {
            $parts[] = 'نهاية مهلة السداد: ' . $paymentData['payment_deadline'];
        }

        if (!empty($paymentData['due_date_hijri'])) {
            $parts[] = 'الاستحقاق هجري: ' . $paymentData['due_date_hijri'];
        }

        if (!empty($paymentData['payment_deadline_hijri'])) {
            $parts[] = 'نهاية المهلة هجري: ' . $paymentData['payment_deadline_hijri'];
        }

        return implode(' | ', $parts);
    }

    private function autoStatus(?string $deadline, string $dueDate): string
    {
        $reference = $deadline ?: $dueDate;

        try {
            return Carbon::parse($reference)->startOfDay()->lt(Carbon::today()) ? 'overdue' : 'due';
        } catch (\Throwable $e) {
            return 'due';
        }
    }

    private function onlyPaymentColumns(array $payload): array
    {
        return array_filter(
            $payload,
            fn ($value, $key) => Schema::hasColumn('payments', $key),
            ARRAY_FILTER_USE_BOTH
        );
    }

    private function dateOrNull(mixed $value): ?string
    {
        $value = trim((string) $value);
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? $value : null;
    }

    private function amountOrZero(mixed $value): float
    {
        $value = str_replace(',', '', trim((string) $value));
        return is_numeric($value) ? round((float) $value, 2) : 0.0;
    }
}
