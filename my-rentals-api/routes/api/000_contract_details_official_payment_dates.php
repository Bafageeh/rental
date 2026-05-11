<?php

use App\Services\RelationRecordService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (!function_exists('mr_official_contract_normalized_entity')) {
    function mr_official_contract_normalized_entity(string $entity): string
    {
        return in_array(strtolower(trim($entity)), ['contract', 'contracts'], true) ? 'contract' : strtolower(trim($entity));
    }
}

if (!function_exists('mr_official_payment_status_reference')) {
    function mr_official_payment_status_reference($payment): ?string
    {
        if (Schema::hasColumn('payments', 'payment_deadline') && !empty($payment->payment_deadline)) {
            return (string) $payment->payment_deadline;
        }

        if (!empty($payment->notes) && preg_match('/نهاية\s+مهلة\s+السداد\s*:?\s*(\d{4}-\d{2}-\d{2})/u', (string) $payment->notes, $matches)) {
            return $matches[1];
        }

        return !empty($payment->due_date) ? (string) $payment->due_date : null;
    }
}

if (!function_exists('mr_official_mark_overdue_only')) {
    function mr_official_mark_overdue_only(int $contractId): void
    {
        if (!Schema::hasTable('payments') || !Schema::hasColumn('payments', 'status')) {
            return;
        }

        $payments = DB::table('payments')
            ->where('contract_id', $contractId)
            ->whereNotNull('due_date')
            ->get();

        foreach ($payments as $payment) {
            if (in_array((string) ($payment->status ?? ''), ['paid', 'مدفوعة'], true)) {
                continue;
            }

            $reference = mr_official_payment_status_reference($payment);
            if (!$reference) {
                continue;
            }

            try {
                $status = Carbon::parse($reference)->startOfDay()->lt(Carbon::today()) ? 'overdue' : 'due';
                DB::table('payments')->where('id', $payment->id)->update(['status' => $status]);
            } catch (Throwable $e) {
                // keep current value
            }
        }
    }
}

if (!function_exists('mr_official_enrich_payment_item')) {
    function mr_official_enrich_payment_item(array $item): array
    {
        if (!Schema::hasTable('payments') || empty($item['id'])) {
            return $item;
        }

        $payment = DB::table('payments')->where('id', (int) $item['id'])->first();
        if (!$payment) {
            return $item;
        }

        $deadline = null;
        if (Schema::hasColumn('payments', 'payment_deadline') && !empty($payment->payment_deadline)) {
            $deadline = (string) $payment->payment_deadline;
        } elseif (!empty($payment->notes) && preg_match('/نهاية\s+مهلة\s+السداد\s*:?\s*(\d{4}-\d{2}-\d{2})/u', (string) $payment->notes, $matches)) {
            $deadline = $matches[1];
        } elseif (!empty($payment->due_date)) {
            try {
                $deadline = Carbon::parse($payment->due_date)->addDays(15)->toDateString();
            } catch (Throwable $e) {
                $deadline = null;
            }
        }

        $sequence = Schema::hasColumn('payments', 'sequence') ? ($payment->sequence ?? null) : null;
        $status = $payment->status ?? null;

        $item['entity'] = 'payment';
        $item['entity_title'] = 'الدفعة';
        $item['title'] = $sequence ? ('القسط ' . $sequence) : ('القسط ' . ($item['id'] ?? ''));
        $item['badge'] = function_exists('mrr_translate_value') ? (mrr_translate_value('status', $status) ?: $status) : $status;
        $item['amount'] = $payment->amount ?? null;
        $item['due_date'] = $payment->due_date ?? null;
        $item['paid_date'] = $payment->paid_date ?? null;
        $item['deadline_date'] = $deadline;
        $item['notes'] = $payment->notes ?? null;
        $item['status'] = $status;
        $item['route'] = null;

        $meta = [];
        if (($payment->amount ?? null) !== null && $payment->amount !== '') {
            $meta[] = 'المبلغ: ' . number_format((float) $payment->amount, 2) . ' ريال';
        }
        if ($deadline) {
            $meta[] = 'نهاية المهلة: ' . $deadline;
        }
        if (!empty($payment->paid_date)) {
            $meta[] = 'تاريخ السداد: ' . $payment->paid_date;
        }
        $item['meta'] = $meta;

        return $item;
    }
}

if (!function_exists('mr_official_sort_payment_sections')) {
    function mr_official_sort_payment_sections(array $payload): array
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

            $items = array_map('mr_official_enrich_payment_item', $items);
            usort($items, fn ($a, $b) => strcmp((string) ($a['due_date'] ?? ''), (string) ($b['due_date'] ?? '')));

            $payload['sections'][$sectionIndex]['title'] = 'دفعات هذا العقد';
            $payload['sections'][$sectionIndex]['items'] = $items;
            $payload['sections'][$sectionIndex]['count'] = count($items);
        }

        return $payload;
    }
}

Route::get('/relation-manager/related/{entity}/{id}', function (Request $request, string $entity, $id) {
    if (mr_official_contract_normalized_entity($entity) === 'contract') {
        mr_official_mark_overdue_only((int) $id);
    }

    $response = app(RelationRecordService::class)->show($request, $entity, $id);
    if (method_exists($response, 'getData')) {
        return response()->json(mr_official_sort_payment_sections($response->getData(true)), $response->getStatusCode());
    }
    return $response;
})->middleware('admin.only');

Route::get('/my/relation-manager/related/{entity}/{id}', function (Request $request, string $entity, $id) {
    if (mr_official_contract_normalized_entity($entity) === 'contract') {
        mr_official_mark_overdue_only((int) $id);
    }

    $response = app(RelationRecordService::class)->show($request, $entity, $id);
    if (method_exists($response, 'getData')) {
        return response()->json(mr_official_sort_payment_sections($response->getData(true)), $response->getStatusCode());
    }
    return $response;
});
