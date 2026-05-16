<?php

// PHASE2_ROUTE_MODULES: generated from routes/api.php on 2026-04-27-083758.
// Section: Expenses

use App\Models\Property;
use App\Models\Unit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

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
        'unit',
        'category',
    ]);

    if ($request->filled('unit_id')) {
        // مصروفات الوحدة أو الفرع مستقلة ولا تظهر إلا عند طلب نفس الوحدة.
        $query->where('unit_id', $request->integer('unit_id'));
    } elseif ($request->filled('property_id')) {
        $query->where('property_id', $request->integer('property_id'));

        $includeChildren = $request->boolean('include_children') || $request->boolean('total') || $request->input('scope') === 'total';

        if (!$includeChildren) {
            // العرض العادي للعقار: مصروفات العقار المباشرة فقط، بدون مصروفات الوحدات.
            $query->whereNull('unit_id');
        }
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
        'property_id' => ['required_without:unit_id', 'nullable', 'integer', 'exists:properties,id'],
        'unit_id' => ['nullable', 'integer', 'exists:units,id'],
        'expense_category_id' => ['nullable', 'integer', 'exists:expense_categories,id'],
        'amount' => ['required', 'numeric', 'min:0'],
        'expense_date' => ['required', 'date'],
        'title' => ['nullable', 'string', 'max:255'],
        'description' => ['nullable', 'string'],
    ]);

    $unit = null;
    if (!empty($data['unit_id'])) {
        $unit = Unit::query()->findOrFail((int) $data['unit_id']);
        $data['property_id'] = $unit->property_id;
    }

    Property::query()->findOrFail((int) $data['property_id']);

    $expense = \App\Models\PropertyExpense::create([
        'property_id' => $data['property_id'],
        'unit_id' => $unit?->id,
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
            'unit',
            'category',
        ]),
    ], 201);
});
