<?php

use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;

if (!defined('MR_PAYMENT_UPDATE_PUSH_LISTENER_REGISTERED')) {
    define('MR_PAYMENT_UPDATE_PUSH_LISTENER_REGISTERED', true);

    DB::listen(function (QueryExecuted $event) {
        try {
            $originalSql = (string) ($event->sql ?? '');
            $sql = strtolower($originalSql);

            if (!str_contains($sql, 'update') || !str_contains($sql, 'payments')) {
                return;
            }

            $watchedPaymentFields = str_contains($sql, 'paid_amount')
                || str_contains($sql, 'paid_date')
                || str_contains($sql, 'amount')
                || str_contains($sql, 'due_date')
                || str_contains($sql, 'payment_deadline')
                || str_contains($sql, 'notes');

            if (!$watchedPaymentFields) {
                return;
            }

            $bindings = array_values($event->bindings ?? []);
            $paymentId = (int) end($bindings);
            if ($paymentId <= 0) {
                return;
            }

            $isPaidChange = str_contains($sql, 'paid_amount') || str_contains($sql, 'paid_date');

            if (function_exists('mr_push_notify_tenant_payment_changed')) {
                mr_push_notify_tenant_payment_changed($paymentId, $isPaidChange ? 'paid' : 'updated');
            }

            if ($isPaidChange && function_exists('mr_push_notify_owner_rent_payment')) {
                mr_push_notify_owner_rent_payment($paymentId);
            }
        } catch (Throwable $e) {
            report($e);
        }
    });
}
