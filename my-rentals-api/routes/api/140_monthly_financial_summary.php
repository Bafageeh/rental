<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

if (is_file(__DIR__ . '/142_unit_tools.php')) require_once __DIR__ . '/142_unit_tools.php';

$monthlyFinancialSummary = function (Request $request) {
    $year = (int) $request->query('year', now()->year);
    $months = [];
    for ($m = 1; $m <= 12; $m++) {
        $months[] = [
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
    return response()->json([
        'status' => 'ok',
        'year' => $year,
        'summary' => [
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
        ],
        'months' => $months,
    ]);
};

Route::get('/monthly-financial-summary', $monthlyFinancialSummary);
Route::get('/my/monthly-financial-summary', $monthlyFinancialSummary);
