<?php

namespace App\Services;

use App\Models\Contract;
use App\Models\Payment;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class OfficialPaymentScheduleSynchronizer
{
    public function sync(int|Contract|null $contract, array $payments): int
    {
        $contract = $contract instanceof Contract ? $contract : Contract::find((int) $contract);
        if (!$contract) {
            return 0;
        }

        $schedule = $this->normalizeSchedule($payments);
        if (!$schedule) {
            return 0;
        }

        $existing = Payment::where('contract_id', $contract->id)
            ->orderByRaw(Schema::hasColumn('payments', 'sequence') ? 'COALESCE(sequence, 999999)' : 'id')
            ->orderBy('due_date')
            ->orderBy('id')
            ->get()
            ->values();

        $usedPaymentIds = [];
        $count = 0;

        foreach ($schedule as $index => $row) {
            $payment = $this->findTargetPayment($contract->id, $row, $existing, $index, $usedPaymentIds);
            $updates = $this->payload($contract->id, $row, $payment);

            if ($payment) {
                if (Schema::hasColumn('payments', 'updated_at')) {
                    $updates['updated_at'] = now();
                }
                DB::table('payments')->where('id', $payment->id)->update($updates);
                $usedPaymentIds[] = (int) $payment->id;
            } else {
                if (Schema::hasColumn('payments', 'created_at')) {
                    $updates['created_at'] = now();
                }
                if (Schema::hasColumn('payments', 'updated_at')) {
                    $updates['updated_at'] = now();
                }
                $usedPaymentIds[] = (int) DB::table('payments')->insertGetId($updates);
            }

            $count++;
        }

        return $count;
    }

    private function normalizeSchedule(array $payments): array
    {
        $schedule = [];

        foreach (array_values($payments) as $index => $payment) {
            if (!is_array($payment)) {
                continue;
            }

            $dueDate = $this->dateOrNull($payment['due_date'] ?? null);
            $amount = $this->amountOrNull($payment['amount'] ?? null);

            if (!$dueDate || $amount === null || $amount <= 0) {
                continue;
            }

            $schedule[] = [
                'sequence' => (int) ($payment['sequence'] ?? ($index + 1)),
                'due_date' => $dueDate,
                'payment_deadline' => $this->dateOrNull($payment['payment_deadline'] ?? null),
                'due_date_hijri' => $this->stringOrNull($payment['due_date_hijri'] ?? null),
                'payment_deadline_hijri' => $this->stringOrNull($payment['payment_deadline_hijri'] ?? null),
                'rental_period_days' => isset($payment['rental_period_days']) && $payment['rental_period_days'] !== '' ? (int) $payment['rental_period_days'] : null,
                'amount' => $amount,
                'source' => $payment['source'] ?? 'official_ejar_schedule',
            ];
        }

        usort($schedule, fn (array $a, array $b) => [$a['sequence'], $a['due_date']] <=> [$b['sequence'], $b['due_date']]);
        return $schedule;
    }

    private function findTargetPayment(int $contractId, array $row, $existing, int $index, array $usedPaymentIds): ?Payment
    {
        if (Schema::hasColumn('payments', 'sequence')) {
            $bySequence = Payment::where('contract_id', $contractId)
                ->where('sequence', $row['sequence'])
                ->first();

            if ($bySequence && !in_array((int) $bySequence->id, $usedPaymentIds, true)) {
                return $bySequence;
            }
        }

        $byDueDate = Payment::where('contract_id', $contractId)
            ->whereDate('due_date', $row['due_date'])
            ->first();

        if ($byDueDate && !in_array((int) $byDueDate->id, $usedPaymentIds, true)) {
            return $byDueDate;
        }

        $byIndex = $existing->get($index);
        if ($byIndex && !in_array((int) $byIndex->id, $usedPaymentIds, true)) {
            return $byIndex;
        }

        return null;
    }

    private function payload(int $contractId, array $row, ?Payment $payment): array
    {
        $payload = [
            'contract_id' => $contractId,
            'sequence' => $row['sequence'],
            'due_date' => $row['due_date'],
            'payment_deadline' => $row['payment_deadline'],
            'due_date_hijri' => $row['due_date_hijri'],
            'payment_deadline_hijri' => $row['payment_deadline_hijri'],
            'rental_period_days' => $row['rental_period_days'],
            'amount' => $row['amount'],
            'notes' => $this->note($row),
        ];

        if (!$payment || empty($payment->paid_date)) {
            $payload['status'] = $this->status($row['payment_deadline'], $row['due_date']);
        }

        return array_filter(
            $payload,
            fn ($value, $key) => Schema::hasColumn('payments', $key),
            ARRAY_FILTER_USE_BOTH
        );
    }

    private function note(array $row): string
    {
        $parts = ['دفعة مستوردة من جدول سداد عقد إيجار الرسمي'];
        if ($row['payment_deadline']) {
            $parts[] = 'نهاية مهلة السداد: ' . $row['payment_deadline'];
        }
        if ($row['due_date_hijri']) {
            $parts[] = 'الاستحقاق هجري: ' . $row['due_date_hijri'];
        }
        if ($row['payment_deadline_hijri']) {
            $parts[] = 'نهاية المهلة هجري: ' . $row['payment_deadline_hijri'];
        }
        return implode(' | ', $parts);
    }

    private function status(?string $deadline, string $dueDate): string
    {
        try {
            return Carbon::parse($deadline ?: $dueDate)->startOfDay()->lt(Carbon::today()) ? 'overdue' : 'due';
        } catch (\Throwable $e) {
            return 'due';
        }
    }

    private function dateOrNull(mixed $value): ?string
    {
        $value = trim((string) $value);
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? $value : null;
    }

    private function amountOrNull(mixed $value): ?float
    {
        $value = str_replace(',', '', trim((string) $value));
        return is_numeric($value) ? round((float) $value, 2) : null;
    }

    private function stringOrNull(mixed $value): ?string
    {
        $value = trim((string) $value);
        return $value !== '' ? $value : null;
    }
}
