<?php

use App\Services\RelationRecordService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (!function_exists('mr_normalized_entity_key')) {
    function mr_normalized_entity_key(string $entity): string
    {
        return match (strtolower(trim($entity))) {
            'contracts', 'contract', 'عقد' => 'contract',
            default => strtolower(trim($entity)),
        };
    }
}

if (!function_exists('mr_mark_contract_overdue_payments')) {
    function mr_mark_contract_overdue_payments(int $contractId): void
    {
        if (!Schema::hasTable('payments') || !Schema::hasColumn('payments', 'contract_id') || !Schema::hasColumn('payments', 'due_date')) {
            return;
        }

        $query = DB::table('payments')
            ->where('contract_id', $contractId)
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', Carbon::today()->toDateString());

        if (Schema::hasColumn('payments', 'status')) {
            $query->where(function ($q) {
                $q->whereNull('status')->orWhereNotIn('status', ['paid', 'مدفوعة']);
            })->update(['status' => 'overdue']);
        }
    }
}

if (!function_exists('mr_repair_contract_payment_dates')) {
    function mr_repair_contract_payment_dates(int $contractId): void
    {
        if (!Schema::hasTable('contracts') || !Schema::hasTable('payments')) {
            return;
        }
        if (!Schema::hasColumn('payments', 'contract_id') || !Schema::hasColumn('payments', 'due_date')) {
            return;
        }

        $contract = DB::table('contracts')->where('id', $contractId)->first();
        if (!$contract || empty($contract->start_date) || empty($contract->end_date)) {
            mr_mark_contract_overdue_payments($contractId);
            return;
        }

        $payments = DB::table('payments')
            ->where('contract_id', $contractId)
            ->orderBy('id')
            ->get();

        $count = $payments->count();
        if ($count <= 1) {
            mr_mark_contract_overdue_payments($contractId);
            return;
        }

        try {
            $start = Carbon::parse($contract->start_date)->startOfDay();
            $end = Carbon::parse($contract->end_date)->startOfDay();
            $firstDue = Carbon::parse($payments->first()->due_date)->startOfDay();
            $lastDue = Carbon::parse($payments->last()->due_date)->startOfDay();
        } catch (Throwable $e) {
            mr_mark_contract_overdue_payments($contractId);
            return;
        }

        $looksWrong = $end->year > $start->year && $lastDue->year <= $start->year;
        if ($looksWrong) {
            $cycle = strtolower((string) ($contract->payment_cycle ?? 'monthly'));
            $stepMonths = match ($cycle) {
                'quarterly' => 3,
                'semi_annual', 'semiannual' => 6,
                'annual', 'yearly' => 12,
                default => 1,
            };

            foreach ($payments->values() as $index => $payment) {
                $due = $firstDue->copy()->addMonthsNoOverflow($index * $stepMonths);
                $updates = ['due_date' => $due->toDateString()];

                if (Schema::hasColumn('payments', 'notes')) {
                    $updates['notes'] = 'نهاية مهلة السداد: ' . $due->copy()->addDays(15)->toDateString();
                }

                DB::table('payments')->where('id', $payment->id)->update($updates);
            }
        }

        mr_mark_contract_overdue_payments($contractId);
    }
}

if (!function_exists('mr_payment_deadline_date')) {
    function mr_payment_deadline_date($dueDate): ?string
    {
        if (empty($dueDate)) {
            return null;
        }

        try {
            return Carbon::parse($dueDate)->addDays(15)->toDateString();
        } catch (Throwable $e) {
            return null;
        }
    }
}

if (!function_exists('mr_enrich_payment_related_item')) {
    function mr_enrich_payment_related_item(array $item): array
    {
        if (!Schema::hasTable('payments') || empty($item['id'])) {
            return $item;
        }

        $payment = DB::table('payments')->where('id', (int) $item['id'])->first();
        if (!$payment) {
            return $item;
        }

        $amount = $payment->amount ?? null;
        $dueDate = $payment->due_date ?? null;
        $paidDate = $payment->paid_date ?? null;
        $status = $payment->status ?? null;
        $notes = $payment->notes ?? null;
        $deadline = mr_payment_deadline_date($dueDate);

        $item['entity'] = 'payment';
        $item['entity_title'] = 'الدفعة';
        $item['title'] = $dueDate ?: ($item['title'] ?? ('دفعة #' . $payment->id));
        $item['subtitle'] = $notes ?: ($deadline ? ('نهاية مهلة السداد: ' . $deadline) : ($item['subtitle'] ?? null));
        $item['badge'] = function_exists('mrr_translate_value') ? (mrr_translate_value('status', $status) ?: $status) : $status;
        $item['amount'] = $amount;
        $item['due_date'] = $dueDate;
        $item['paid_date'] = $paidDate;
        $item['deadline_date'] = $deadline;
        $item['notes'] = $notes;
        $item['status'] = $status;
        $item['route'] = null;

        $meta = [];
        if ($amount !== null && $amount !== '') {
            $meta[] = 'المبلغ: ' . number_format((float) $amount, 2) . ' ريال';
        }
        if ($deadline) {
            $meta[] = 'نهاية المهلة: ' . $deadline;
        }
        if ($paidDate) {
            $meta[] = 'تاريخ السداد: ' . $paidDate;
        }
        $item['meta'] = $meta;

        return $item;
    }
}

if (!function_exists('mr_sort_contract_payment_sections')) {
    function mr_sort_contract_payment_sections(array $payload): array
    {
        if (($payload['entity'] ?? '') !== 'contract') {
            return $payload;
        }

        foreach (($payload['sections'] ?? []) as $sectionIndex => $section) {
            $items = $section['items'] ?? [];
            $isPaymentSection = ($section['entity'] ?? '') === 'payment'
                || str_contains((string) ($section['key'] ?? ''), 'payment')
                || str_contains((string) ($section['title'] ?? ''), 'دفعات');

            if (!$isPaymentSection) {
                continue;
            }

            $items = array_map('mr_enrich_payment_related_item', $items);

            usort($items, function ($a, $b) {
                $aDate = (string) ($a['due_date'] ?? $a['title'] ?? '');
                $bDate = (string) ($b['due_date'] ?? $b['title'] ?? '');
                return strcmp($aDate, $bDate);
            });

            $payload['sections'][$sectionIndex]['title'] = 'دفعات هذا العقد';
            $payload['sections'][$sectionIndex]['items'] = $items;
            $payload['sections'][$sectionIndex]['count'] = count($items);
        }

        return $payload;
    }
}

Route::get('/relation-manager/related/{entity}/{id}', function (Request $request, string $entity, $id) {
    if (mr_normalized_entity_key($entity) === 'contract') {
        mr_repair_contract_payment_dates((int) $id);
    }

    $response = app(RelationRecordService::class)->show($request, $entity, $id);
    if (method_exists($response, 'getData')) {
        return response()->json(mr_sort_contract_payment_sections($response->getData(true)), $response->getStatusCode());
    }
    return $response;
})->middleware('admin.only');

Route::get('/my/relation-manager/related/{entity}/{id}', function (Request $request, string $entity, $id) {
    if (mr_normalized_entity_key($entity) === 'contract') {
        mr_repair_contract_payment_dates((int) $id);
    }

    $response = app(RelationRecordService::class)->show($request, $entity, $id);
    if (method_exists($response, 'getData')) {
        return response()->json(mr_sort_contract_payment_sections($response->getData(true)), $response->getStatusCode());
    }
    return $response;
});
