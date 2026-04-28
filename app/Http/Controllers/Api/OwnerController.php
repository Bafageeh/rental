<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Owner;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OwnerController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $query = Owner::withCount('properties')->orderBy('type')->orderBy('name');

        if ($s = $request->input('search')) {
            $query->where(fn ($q) => $q
                ->where('name', 'like', "%{$s}%")
                ->orWhere('phone', 'like', "%{$s}%")
                ->orWhere('national_id', 'like', "%{$s}%"));
        }

        if ($t = $request->input('type')) {
            $query->where('type', $t);
        }

        return $this->paginated($query->paginate(min((int) $request->input('per_page', 25), 100)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'        => ['required', 'string', 'max:255'],
            'phone'       => ['nullable', 'string', 'max:50'],
            'email'       => ['nullable', 'email', 'max:255'],
            'national_id' => ['nullable', 'string', 'max:50'],
            'notes'       => ['nullable', 'string', 'max:2000'],
        ]);

        $data['type'] = $data['type'] ?? 'external';

        return $this->created(
            Owner::create($data)->loadCount('properties'),
            'تم إضافة المالك بنجاح'
        );
    }

    public function show(Owner $owner): JsonResponse
    {
        return $this->success($owner->load('properties.units')->loadCount('properties'));
    }

    public function update(Request $request, Owner $owner): JsonResponse
    {
        $data = $request->validate([
            'name'        => ['sometimes', 'required', 'string', 'max:255'],
            'phone'       => ['nullable', 'string', 'max:50'],
            'email'       => ['nullable', 'email', 'max:255'],
            'national_id' => ['nullable', 'string', 'max:50'],
            'notes'       => ['nullable', 'string', 'max:2000'],
        ]);

        $owner->update($data);
        return $this->success($owner->fresh()->loadCount('properties'), 'تم تحديث المالك');
    }

    public function destroy(Owner $owner): JsonResponse
    {
        if ($owner->properties()->exists()) {
            return $this->error('لا يمكن حذف مالك لديه عقارات', 422);
        }
        $owner->delete();
        return $this->success(null, 'تم الحذف');
    }

    public function summary(): JsonResponse
    {
        $owners = Owner::orderBy('type')->orderBy('name')->get();

        $rows = $owners->map(function ($owner) {
            $propIds     = DB::table('properties')->where('owner_id', $owner->id)->pluck('id');
            $unitIds     = DB::table('units')->whereIn('property_id', $propIds)->pluck('id');
            $contractIds = DB::table('contracts')->whereIn('unit_id', $unitIds)->where('status', 'active')->pluck('id');

            $paid    = (float) DB::table('payments')->whereIn('contract_id', $contractIds)->where('status', 'paid')->sum('amount');
            $due     = (float) DB::table('payments')->whereIn('contract_id', $contractIds)->where('status', 'due')->sum('amount');
            $overdue = (float) DB::table('payments')->whereIn('contract_id', $contractIds)->where('status', 'overdue')->sum('amount');
            $expenses= (float) DB::table('property_expenses')->whereIn('property_id', $propIds)->sum('amount');

            return [
                'owner_id'         => $owner->id,
                'owner_name'       => $owner->name,
                'owner_type'       => $owner->type,
                'properties_count' => $propIds->count(),
                'units_count'      => $unitIds->count(),
                'active_contracts' => $contractIds->count(),
                'paid_income'      => $paid,
                'due_income'       => $due,
                'overdue_income'   => $overdue,
                'expenses'         => $expenses,
                'net_income'       => $paid - $expenses,
            ];
        });

        return $this->success([
            'totals' => [
                'owners'      => $rows->count(),
                'properties'  => $rows->sum('properties_count'),
                'paid_income' => $rows->sum('paid_income'),
                'net_income'  => $rows->sum('net_income'),
            ],
            'owners' => $rows,
        ]);
    }
}
