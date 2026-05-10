<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExpenseCategory;
use App\Models\PropertyExpense;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExpenseController extends Controller
{
    use ApiResponse;

    public function categories(): JsonResponse
    {
        return $this->success(ExpenseCategory::orderBy('id')->get());
    }

    public function index(Request $request): JsonResponse
    {
        $query = PropertyExpense::with(['property.owner', 'category']);

        if ($oid = $request->input('owner_scope_id'))
            $query->whereHas('property', fn ($q) => $q->where('owner_id', $oid));
        if ($pid = $request->input('property_id'))
            $query->where('property_id', $pid);

        return $this->paginated($query->orderBy('expense_date', 'desc')->paginate(min((int) $request->input('per_page', 25), 100)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'property_id'         => ['required', 'integer', 'exists:properties,id'],
            'expense_category_id' => ['nullable', 'integer', 'exists:expense_categories,id'],
            'amount'              => ['required', 'numeric', 'min:0.01'],
            'expense_date'        => ['required', 'date'],
            'title'               => ['nullable', 'string', 'max:255'],
            'description'         => ['nullable', 'string', 'max:2000'],
        ]);

        return $this->created(
            PropertyExpense::create($data)->fresh()->load(['property.owner', 'category']),
            'تمت إضافة المصروف'
        );
    }
}
