<?php

use App\Support\UnitContractExitFollowups;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

if (is_file(__DIR__ . '/130_manager_data_scope.php')) require_once __DIR__ . '/130_manager_data_scope.php';

if (!function_exists('mr_contract_exit_role')) {
    function mr_contract_exit_role($user): string
    {
        if (!$user) return '';
        $raw = method_exists($user, 'effectiveRole') ? $user->effectiveRole() : ($user->role ?? '');
        $role = strtolower(trim((string) $raw));
        $role = str_replace(['-', ' '], '_', $role);

        return match ($role) {
            '', 'null' => 'admin',
            'admin', 'administrator', 'ادمن', 'أدمن', 'إدمن' => 'admin',
            'superadmin', 'super_admin', 'system_admin' => 'super_admin',
            'manager', 'agent', 'property_manager', 'مدير_العقارات' => 'manager',
            'owner', 'landlord', 'مالك', 'المالك' => 'owner',
            default => $role,
        };
    }
}

if (!function_exists('mr_contract_exit_can_access_property')) {
    function mr_contract_exit_can_access_property(Request $request, int $propertyId): bool
    {
        $user = $request->user();
        if (!$user || $propertyId <= 0 || !Schema::hasTable('properties')) return false;

        $role = mr_contract_exit_role($user);
        if (in_array($role, ['admin', 'super_admin'], true) || (bool) ($user->is_admin ?? false)) return true;

        if ($role === 'manager') {
            return function_exists('mr_manager_scope_record_exists')
                ? mr_manager_scope_record_exists('properties', $propertyId, $request)
                : DB::table('properties')->where('id', $propertyId)->where('manager_id', (int) $user->id)->exists();
        }

        if ($role === 'owner' && !empty($user->owner_id)) {
            return DB::table('properties')->where('id', $propertyId)->where('owner_id', (int) $user->owner_id)->exists();
        }

        return false;
    }
}

Route::get('/properties/{property}/unit-contract-exit-statuses', function (Request $request, $property) {
    $propertyId = (int) $property;
    if (!mr_contract_exit_can_access_property($request, $propertyId)) {
        return response()->json(['status' => 'error', 'message' => 'غير مصرح بعرض متابعة هذه الوحدات.'], 403);
    }

    return response()->json([
        'status' => 'ok',
        'property_id' => $propertyId,
        'items' => UnitContractExitFollowups::propertyStatuses($propertyId),
    ]);
});

Route::post('/units/{unit}/contract-exit-decision', function (Request $request, $unit) {
    $unitId = (int) $unit;
    if ($unitId <= 0 || !Schema::hasTable('units')) {
        return response()->json(['status' => 'error', 'message' => 'الوحدة غير موجودة.'], 404);
    }

    $propertyId = (int) (DB::table('units')->where('id', $unitId)->value('property_id') ?? 0);
    if ($propertyId <= 0 || !mr_contract_exit_can_access_property($request, $propertyId)) {
        return response()->json(['status' => 'error', 'message' => 'غير مصرح بتحديث متابعة هذه الوحدة.'], 403);
    }

    $data = $request->validate([
        'decision' => ['required', 'string', 'in:wants_renewal,vacated'],
        'contract_id' => ['nullable', 'integer', 'min:1'],
    ]);

    try {
        $item = UnitContractExitFollowups::recordDecision(
            $unitId,
            (string) $data['decision'],
            (int) ($request->user()?->id ?? 0),
            isset($data['contract_id']) ? (int) $data['contract_id'] : null,
        );
    } catch (\RuntimeException $e) {
        return response()->json(['status' => 'error', 'message' => $e->getMessage()], 409);
    }

    return response()->json([
        'status' => 'ok',
        'property_id' => $propertyId,
        'item' => $item,
    ]);
});
