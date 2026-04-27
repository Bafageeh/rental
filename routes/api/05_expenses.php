<?php

// PHASE2_ROUTE_MODULES: generated from routes/api.php on 2026-04-27-083758.
// Section: Expenses

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ContractFileController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\OwnerDashboardController;
use App\Models\Contract;
use App\Models\Owner;
use App\Models\Payment;
use App\Models\Property;
use App\Models\Tenant;
use App\Models\Unit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

/*
|--------------------------------------------------------------------------
| Expenses
|--------------------------------------------------------------------------
*/

Route::get('/expense-categories', function () {
    return \App\Models\ExpenseCategory::orderBy('id')->get();
});

Route::get('/expenses', function (Request $request) {
    $query = \App\Models\PropertyExpense::with([
        'property.owner',
        'category',
    ]);

    if ($request->filled('property_id')) {
        $query->where('property_id', $request->integer('property_id'));
    }

    if ($request->filled('owner_id')) {
        $query->whereHas('property', function ($propertyQuery) use ($request) {
            $propertyQuery->where('owner_id', $request->integer('owner_id'));
        });
    }

    return $query
        ->orderBy('expense_date', 'desc')
        ->orderBy('id', 'desc')
        ->get();
});

Route::post('/expenses', function (Request $request) {
    $data = $request->validate([
        'property_id' => ['required', 'integer', 'exists:properties,id'],
        'expense_category_id' => ['nullable', 'integer', 'exists:expense_categories,id'],
        'amount' => ['required', 'numeric', 'min:0'],
        'expense_date' => ['required', 'date'],
        'title' => ['nullable', 'string', 'max:255'],
        'description' => ['nullable', 'string'],
    ]);

    $expense = \App\Models\PropertyExpense::create([
        'property_id' => $data['property_id'],
        'expense_category_id' => $data['expense_category_id'] ?? null,
        'amount' => $data['amount'],
        'expense_date' => $data['expense_date'],
        'title' => $data['title'] ?? null,
        'description' => $data['description'] ?? null,
    ]);

    return response()->json([
        'status' => 'ok',
        'message' => 'تم إضافة المصروف بنجاح',
        'expense' => $expense->fresh()->load([
            'property.owner',
            'category',
        ]),
    ], 201);
});
