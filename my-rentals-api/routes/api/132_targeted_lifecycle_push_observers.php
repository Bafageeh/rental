<?php

use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;

if (!function_exists('mr_lifecycle_push_observers_register')) {
    function mr_lifecycle_push_observers_register(): void
    {
        static $registered = false;
        if ($registered) return;
        $registered = true;

        if (class_exists(\App\Models\Payment::class)) {
            \App\Models\Payment::updated(function ($payment) {
                try {
                    $tenantFields = ['amount', 'due_date', 'payment_deadline', 'paid_amount', 'paid_date', 'notes'];
                    $tenantChanged = method_exists($payment, 'wasChanged') && collect($tenantFields)->contains(fn ($field) => $payment->wasChanged($field));
                    $paidChanged = method_exists($payment, 'wasChanged') && ($payment->wasChanged('paid_amount') || $payment->wasChanged('paid_date'));

                    if ($tenantChanged && function_exists('mr_push_notify_tenant_payment_changed')) {
                        $paidAmount = (float) str_replace(',', '', (string) ($payment->paid_amount ?? 0));
                        mr_push_notify_tenant_payment_changed($payment, $paidAmount > 0 ? 'paid' : 'updated');
                    }

                    if ($paidChanged && function_exists('mr_push_notify_owner_rent_payment')) {
                        $paidAmount = (float) str_replace(',', '', (string) ($payment->paid_amount ?? 0));
                        if ($paidAmount > 0) {
                            mr_push_notify_owner_rent_payment($payment);
                        }
                    }
                } catch (Throwable $e) {
                    report($e);
                }
            });
        }

        if (class_exists(\App\Models\Contract::class)) {
            \App\Models\Contract::created(function ($contract) {
                try {
                    $source = strtolower(trim((string) ($contract->source ?? '')));
                    if ($source === 'renewal' && function_exists('mr_push_notify_tenant_contract_renewed')) {
                        mr_push_notify_tenant_contract_renewed($contract);
                    }
                } catch (Throwable $e) {
                    report($e);
                }
            });
        }

        if (class_exists(\App\Models\PropertyExpense::class)) {
            \App\Models\PropertyExpense::created(function ($expense) {
                try {
                    if (function_exists('mr_push_notify_owner_expense')) {
                        mr_push_notify_owner_expense($expense);
                    }
                } catch (Throwable $e) {
                    report($e);
                }
            });
        }

        DB::listen(function (QueryExecuted $event) {
            try {
                $sql = strtolower($event->sql ?? '');
                if (!str_contains($sql, 'insert') || !str_contains($sql, 'owner_account_transfers')) {
                    return;
                }

                if (!function_exists('mr_push_notify_owner_transfer')) {
                    return;
                }

                $bindings = array_values($event->bindings ?? []);
                $ownerId = 0;
                $amount = 0;

                if (preg_match('/owner_id[^)]*amount/i', $event->sql ?? '')) {
                    $ownerId = (int) ($bindings[0] ?? 0);
                    $amount = $bindings[1] ?? 0;
                } elseif (preg_match('/amount[^)]*owner_id/i', $event->sql ?? '')) {
                    $amount = $bindings[0] ?? 0;
                    $ownerId = (int) ($bindings[5] ?? $bindings[1] ?? 0);
                }

                if ($ownerId > 0) {
                    mr_push_notify_owner_transfer($ownerId, $amount);
                }
            } catch (Throwable $e) {
                report($e);
            }
        });
    }
}

mr_lifecycle_push_observers_register();
