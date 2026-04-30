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
            return;
        }

        $payments = DB::table('payments')
            ->where('contract_id', $contractId)
            ->orderBy('id')
            ->get();

        $count = $payments->count();
        if ($count <= 1) {
            return;
        }

        try {
            $start = Carbon::parse($contract->start_date)->startOfDay();
            $end = Carbon::parse($contract->end_date)->startOfDay();
            $firstDue = Carbon::parse($payments->first()->due_date)->startOfDay();
            $lastDue = Carbon::parse($payments->last()->due_date)->startOfDay();
        } catch (Throwable $e) {
            return;
        }

        // لا نعيد الحساب إلا إذا كان واضحًا أن كل الدفعات بقيت في سنة البداية رغم أن العقد يمتد للسنة التالية.
        // مثال المشكلة: بداية العقد 2025 ونهايته 2026 وآخر دفعة ظاهرة 2025 بدل 2026.
        $looksWrong = $end->year > $start->year && $lastDue->year <= $start->year;
        if (!$looksWrong) {
            return;
        }

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

            usort($items, function ($a, $b) {
                $aDate = (string) ($a['title'] ?? '');
                $bDate = (string) ($b['title'] ?? '');
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
