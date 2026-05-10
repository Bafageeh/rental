<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TenantController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $query = Tenant::withCount(['contracts', 'contractFiles']);

        if ($s = $request->input('search')) {
            $query->where(fn ($q) => $q
                ->where('name', 'like', "%{$s}%")
                ->orWhere('phone', 'like', "%{$s}%")
                ->orWhere('national_id', 'like', "%{$s}%"));
        }

        return $this->paginated($query->orderBy('id', 'desc')->paginate(min((int) $request->input('per_page', 25), 100)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'        => ['required', 'string', 'max:255'],
            'phone'       => ['nullable', 'string', 'max:50'],
            'email'       => ['nullable', 'email', 'max:255'],
            'national_id' => ['nullable', 'string', 'max:50'],
            'nationality' => ['nullable', 'string', 'max:100'],
            'address'     => ['nullable', 'string'],
            'notes'       => ['nullable', 'string', 'max:2000'],
        ]);

        return $this->created(Tenant::create($data), 'تمت إضافة المستأجر');
    }

    public function show(Tenant $tenant): JsonResponse
    {
        return $this->success($tenant->load(['contracts.unit.property', 'contracts.payments']));
    }

    public function update(Request $request, Tenant $tenant): JsonResponse
    {
        $data = $request->validate([
            'name'        => ['sometimes', 'required', 'string', 'max:255'],
            'phone'       => ['nullable', 'string', 'max:50'],
            'email'       => ['nullable', 'email', 'max:255'],
            'national_id' => ['nullable', 'string', 'max:50'],
            'nationality' => ['nullable', 'string', 'max:100'],
            'address'     => ['nullable', 'string'],
            'notes'       => ['nullable', 'string', 'max:2000'],
        ]);

        $tenant->update($data);
        return $this->success($tenant->fresh(), 'تم التحديث');
    }

    public function destroy(Tenant $tenant): JsonResponse
    {
        if ($tenant->contracts()->where('status', 'active')->exists())
            return $this->error('لا يمكن حذف مستأجر لديه عقود نشطة', 422);

        $tenant->delete();
        return $this->success(null, 'تم الحذف');
    }
}
