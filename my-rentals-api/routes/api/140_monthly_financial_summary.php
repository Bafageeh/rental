<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (is_file(__DIR__ . '/130_manager_data_scope.php')) require_once __DIR__ . '/130_manager_data_scope.php';

$monthlyFinancialSummary = function (Request $request) {
    $user = $request->user();
    $role = $user && function_exists('mr_manager_scope_role') ? mr_manager_scope_role($user) : strtolower((string) ($user->role ?? ''));
    $isAdmin = in_array($role, ['admin', 'super_admin'], true) || (bool) ($user->is_admin ?? false);
    $year = (int) $request->query('year', now()->year);
    if ($year < 2000 || $year > 2100) $year = now()->year;
    $start = $year . '-01-01';
    $end = $year . '-12-31';
    $today = now()->toDateString();

    $months = [];
    for ($m = 1; $m <= 12; $m++) {
        $months[$m] = [
            'month' => $m,
            'expected_income' => 0,
            'paid_income' => 0,
            'due_income' => 0,
            'overdue_income' => 0,
            'expenses' => 0,
            'net_income' => 0,
            'payments_count' => 0,
            'receipts_count' => 0,
            'expenses_count' => 0,
            'utility_due' => 0,
            'utility_paid' => 0,
            'utility_overdue' => 0,
        ];
    }

    $ownerIds = [];
    if (Schema::hasTable('owners')) {
        if ($isAdmin) {
            $ownerIds = DB::table('owners')->pluck('id')->map(fn($id) => (int) $id)->all();
        } elseif ($role === 'manager' && function_exists('mr_manager_scope_owner_ids')) {
            $ownerIds = mr_manager_scope_owner_ids($request);
        } elseif (!empty($user->owner_id)) {
            $ownerIds = [(int) $user->owner_id];
        }
    }

    $propertyIds = [];
    if (Schema::hasTable('properties')) {
        if ($isAdmin) {
            $propertyIds = DB::table('properties')->pluck('id')->map(fn($id) => (int) $id)->all();
        } elseif ($role === 'manager' && function_exists('mr_manager_scope_property_ids')) {
            $propertyIds = mr_manager_scope_property_ids($request);
        } elseif ($ownerIds && Schema::hasColumn('properties', 'owner_id')) {
            $propertyIds = DB::table('properties')->whereIn('owner_id', $ownerIds)->pluck('id')->map(fn($id) => (int) $id)->all();
        }
    }

    $unitIds = [];
    if (Schema::hasTable('units')) {
        if ($isAdmin) {
            $unitIds = DB::table('units')->pluck('id')->map(fn($id) => (int) $id)->all();
        } elseif ($role === 'manager' && function_exists('mr_manager_scope_unit_ids')) {
            $unitIds = mr_manager_scope_unit_ids($request);
        } elseif ($propertyIds && Schema::hasColumn('units', 'property_id')) {
            $unitIds = DB::table('units')->whereIn('property_id', $propertyIds)->pluck('id')->map(fn($id) => (int) $id)->all();
        }
    }

    $contractIds = [];
    if (Schema::hasTable('contracts')) {
        $contractQuery = DB::table('contracts');
        if (!$isAdmin) {
            if ($role === 'manager' && Schema::hasColumn('contracts', 'manager_id')) {
                $contractQuery->where('manager_id', (int) $user->id);
            } elseif ($unitIds && Schema::hasColumn('contracts', 'unit_id')) {
                $contractQuery->whereIn('unit_id', $unitIds);
            } else {
                $contractQuery->whereRaw('1 = 0');
            }
        }
        $contractIds = $contractQuery->pluck('id')->map(fn($id) => (int) $id)->all();
    }

    if (Schema::hasTable('payments') && $contractIds) {
        $payments = DB::table('payments')->whereIn('contract_id', $contractIds)->whereBetween('due_date', [$start, $end])->get();
        foreach ($payments as $payment) {
            $m = (int) substr((string) $payment->due_date, 5, 2);
            if ($m < 1 || $m > 12) continue;
            $amount = (float) ($payment->amount ?? 0);
            $paid = (float) ($payment->paid_amount ?? 0);
            $remaining = isset($payment->remaining_amount) ? (float) $payment->remaining_amount : max($amount - $paid, 0);
            $status = strtolower((string) ($payment->status ?? ''));
            $months[$m]['expected_income'] += $amount;
            $months[$m]['payments_count']++;
            if ((string) $payment->due_date <= $today) $months[$m]['due_income'] += $amount;
            if ($status === 'paid') {
                $months[$m]['paid_income'] += $paid > 0 ? $paid : $amount;
                $months[$m]['receipts_count']++;
            } elseif ($paid > 0) {
                $months[$m]['paid_income'] += $paid;
                $months[$m]['overdue_income'] += max($remaining, 0);
                $months[$m]['receipts_count']++;
            } elseif ((string) $payment->due_date < $today || $status === 'overdue') {
                $months[$m]['overdue_income'] += $remaining > 0 ? $remaining : $amount;
            }
        }
    }

    if (Schema::hasTable('property_expenses') && $propertyIds) {
        $expenses = DB::table('property_expenses')->whereIn('property_id', $propertyIds)->whereBetween('expense_date', [$start, $end])->get();
        foreach ($expenses as $expense) {
            $m = (int) substr((string) $expense->expense_date, 5, 2);
            if ($m < 1 || $m > 12) continue;
            $months[$m]['expenses'] += (float) ($expense->amount ?? 0);
            $months[$m]['expenses_count']++;
        }
    }

    foreach ($months as $m => $row) {
        $months[$m]['net_income'] = $row['paid_income'] - $row['expenses'];
    }

    return response()->json([
        'status' => 'ok',
        'year' => $year,
        'summary' => [
            'expected_income' => array_sum(array_column($months, 'expected_income')),
            'paid_income' => array_sum(array_column($months, 'paid_income')),
            'due_income' => array_sum(array_column($months, 'due_income')),
            'overdue_income' => array_sum(array_column($months, 'overdue_income')),
            'expenses' => array_sum(array_column($months, 'expenses')),
            'net_income' => array_sum(array_column($months, 'net_income')),
            'payments_count' => array_sum(array_column($months, 'payments_count')),
            'receipts_count' => array_sum(array_column($months, 'receipts_count')),
            'expenses_count' => array_sum(array_column($months, 'expenses_count')),
            'utility_due' => 0,
            'utility_paid' => 0,
            'utility_overdue' => 0,
        ],
        'months' => array_values($months),
    ]);
};

Route::get('/monthly-financial-summary', $monthlyFinancialSummary);
Route::get('/my/monthly-financial-summary', $monthlyFinancialSummary);
