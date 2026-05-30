<?php

use App\Models\Contract;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (!function_exists('mrsched_num')) {
    function mrsched_num($value): float
    {
        if ($value === null || $value === '') return 0.0;
        return is_numeric($value) ? (float) $value : (float) str_replace(',', '', (string) $value);
    }
}

if (!function_exists('mrsched_status')) {
    function mrsched_status($value): string
    {
        return trim(mb_strtolower((string) ($value ?? '')));
    }
}

if (!function_exists('mrsched_paid')) {
    function mrsched_paid($payment): bool
    {
        if (mrsched_num($payment->paid_amount ?? 0) > 0) return true;
        return !empty($payment->paid_date) && in_array(mrsched_status($payment->status ?? null), ['paid', 'مدفوع', 'مدفوعة', 'مسدد'], true);
    }
}

if (!function_exists('mrsched_date')) {
    function mrsched_date($value): ?string
    {
        $text = substr(trim((string) ($value ?? '')), 0, 10);
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $text) ? $text : null;
    }
}

if (!function_exists('mrsched_value')) {
    function mrsched_value(array $row, string $key, $default = null)
    {
        return array_key_exists($key, $row) ? $row[$key] : $default;
    }
}

if (!function_exists('mrsched_sync_statuses')) {
    function mrsched_sync_statuses(?int $contractId): void
    {
        if (!$contractId) return;
        if (function_exists('mrpec_sync_contract')) {
            mrpec_sync_contract($contractId);
            return;
        }
        if (function_exists('mrpay_sync_contract')) {
            mrpay_sync_contract($contractId);
        }
    }
}

if (!function_exists('mrsched_delete_extra_unpaid')) {
    function mrsched_delete_extra_unpaid(int $contractId, array $keptIds): int
    {
        $query = DB::table('payments')->where('contract_id', $contractId);
        if (!empty($keptIds)) {
            $query->whereNotIn('id', array_values(array_unique(array_map('intval', $keptIds))));
        }

        if (Schema::hasColumn('payments', 'paid_amount')) {
            $query->where(function ($q) {
                $q->whereNull('paid_amount')->orWhere('paid_amount', '<=', 0);
            });
        }
        if (Schema::hasColumn('payments', 'paid_date')) {
            $query->whereNull('paid_date');
        }
        if (Schema::hasColumn('payments', 'status')) {
            $query->where(function ($q) {
                $q->whereNull('status')
                    ->orWhereNotIn('status', ['paid', 'مدفوع', 'مدفوعة', 'مسدد']);
            });
        }

        return $query->delete();
    }
}

if (!function_exists('mrsched_sync_schedule')) {
    function mrsched_sync_schedule(Request $request, Contract $contract)
    {
        if (!Schema::hasTable('payments')) {
            return response()->json(['message' => 'جدول الدفعات غير موجود.'], 404);
        }

        $rows = $request->input('payments', $request->input('fields.payments', []));
        if (!is_array($rows)) $rows = [];
        $count = max(0, (int) $request->input('payments_count', $request->input('fields.payments_count', count($rows))));
        $rows = array_slice(array_values($rows), 0, $count);

        $existing = Payment::query()
            ->where('contract_id', $contract->id)
            ->orderBy('due_date')
            ->orderBy('id')
            ->get()
            ->keyBy('id');

        $keptIds = [];
        $deletedExtra = 0;
        DB::transaction(function () use ($rows, $contract, $existing, &$keptIds, &$deletedExtra) {
            $sequence = 1;
            foreach ($rows as $row) {
                if (!is_array($row)) continue;
                $id = (int) mrsched_value($row, 'id', 0);
                $payment = $id > 0 ? ($existing[$id] ?? null) : null;
                $amount = mrsched_num(mrsched_value($row, 'amount', 0));
                $dueDate = mrsched_date(mrsched_value($row, 'due_date', null));
                $notes = trim((string) mrsched_value($row, 'notes', ''));
                $status = trim((string) mrsched_value($row, 'status', 'due')) ?: 'due';

                if ($payment) {
                    $keptIds[] = (int) $payment->id;
                    if (mrsched_paid($payment)) {
                        $updates = [];
                        if (Schema::hasColumn('payments', 'sequence')) $updates['sequence'] = $sequence;
                        if (Schema::hasColumn('payments', 'status')) $updates['status'] = 'paid';
                        if (Schema::hasColumn('payments', 'remaining_amount')) $updates['remaining_amount'] = 0;
                        if (Schema::hasColumn('payments', 'updated_at')) $updates['updated_at'] = now();
                        if (!empty($updates)) DB::table('payments')->where('id', $payment->id)->update($updates);
                        $sequence++;
                        continue;
                    }

                    $updates = [];
                    if (Schema::hasColumn('payments', 'sequence')) $updates['sequence'] = $sequence;
                    if (Schema::hasColumn('payments', 'amount')) $updates['amount'] = $amount;
                    if (Schema::hasColumn('payments', 'due_date')) $updates['due_date'] = $dueDate;
                    if (Schema::hasColumn('payments', 'status')) $updates['status'] = in_array($status, ['paid', 'مدفوع', 'مدفوعة'], true) ? 'due' : $status;
                    if (Schema::hasColumn('payments', 'notes')) $updates['notes'] = $notes !== '' ? $notes : null;
                    if (Schema::hasColumn('payments', 'updated_at')) $updates['updated_at'] = now();
                    if (!empty($updates)) DB::table('payments')->where('id', $payment->id)->update($updates);
                } else {
                    $create = ['contract_id' => $contract->id];
                    if (Schema::hasColumn('payments', 'sequence')) $create['sequence'] = $sequence;
                    if (Schema::hasColumn('payments', 'amount')) $create['amount'] = $amount;
                    if (Schema::hasColumn('payments', 'due_date')) $create['due_date'] = $dueDate;
                    if (Schema::hasColumn('payments', 'status')) $create['status'] = in_array($status, ['paid', 'مدفوع', 'مدفوعة'], true) ? 'due' : ($status ?: 'due');
                    if (Schema::hasColumn('payments', 'notes')) $create['notes'] = $notes !== '' ? $notes : null;
                    if (Schema::hasColumn('payments', 'created_at')) $create['created_at'] = now();
                    if (Schema::hasColumn('payments', 'updated_at')) $create['updated_at'] = now();
                    $keptIds[] = (int) DB::table('payments')->insertGetId($create);
                }
                $sequence++;
            }

            $deletedExtra = mrsched_delete_extra_unpaid((int) $contract->id, $keptIds);
        });

        mrsched_sync_statuses((int) $contract->id);

        $fresh = Contract::query()
            ->with(['tenant', 'unit.property.owner', 'payments' => fn ($q) => $q->orderBy('due_date')->orderBy('id')])
            ->find($contract->id);

        if (function_exists('mrco_apply_contract_calc') && $fresh) {
            $fresh = mrco_apply_contract_calc($fresh);
        }

        return response()->json([
            'message' => 'تم تجهيز جدول الدفعات حسب العدد الجديد مع الحفاظ على الدفعات المدفوعة.',
            'requested_count' => $count,
            'kept_ids' => $keptIds,
            'deleted_extra_unpaid' => $deletedExtra,
            'actual_count' => $fresh?->payments?->count() ?? null,
            'contract' => $fresh,
        ]);
    }
}

Route::post('/contracts/{contract}/payment-schedule-sync', fn (Request $request, Contract $contract) => mrsched_sync_schedule($request, $contract));
Route::post('/my/contracts/{contract}/payment-schedule-sync', fn (Request $request, Contract $contract) => mrsched_sync_schedule($request, $contract));
