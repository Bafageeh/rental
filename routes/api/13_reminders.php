<?php

// PHASE2_ROUTE_MODULES: generated from routes/api.php on 2026-04-27-083758.
// Section: Payment Reminders

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
| Payment Reminders
|--------------------------------------------------------------------------
*/

if (!function_exists('my_rentals_format_reminder_payment')) {
    function my_rentals_format_reminder_payment(\App\Models\Payment $payment): array
    {
        $dueDate = $payment->due_date
            ? \Carbon\Carbon::parse($payment->due_date)
            : null;

        $today = now()->startOfDay();
        $daysLate = $dueDate ? $dueDate->diffInDays($today, false) : 0;

        $tenant = $payment->contract?->tenant;
        $unit = $payment->contract?->unit;
        $property = $unit?->property;

        $amount = (float) ($payment->amount ?? 0);
        $amountText = number_format($amount, 0) . ' ريال';

        $message = 'السلام عليكم';
        $message .= "\n";
        $message .= 'نود تذكيركم بوجود دفعة إيجار';
        $message .= "\n";
        $message .= 'المبلغ: ' . $amountText;
        $message .= "\n";
        $message .= 'تاريخ الاستحقاق: ' . ($payment->due_date ?: '-');

        if ($daysLate > 0) {
            $message .= "\n";
            $message .= 'الحالة: متأخرة منذ ' . $daysLate . ' يوم';
        } else {
            $message .= "\n";
            $message .= 'الحالة: مستحقة / قادمة';
        }

        if ($property?->name) {
            $message .= "\n";
            $message .= 'العقار: ' . $property->name;
        }

        if ($unit?->unit_number) {
            $message .= "\n";
            $message .= 'الوحدة: ' . $unit->unit_number;
        }

        $message .= "\n";
        $message .= 'شاكرين لكم سرعة السداد.';

        return [
            'id' => $payment->id,
            'amount' => $payment->amount,
            'due_date' => $payment->due_date,
            'paid_date' => $payment->paid_date,
            'status' => $payment->status,
            'days_late' => $daysLate,
            'is_overdue_by_date' => $daysLate > 0,
            'tenant_name' => $tenant?->name,
            'tenant_phone' => $tenant?->phone,
            'property_name' => $property?->name,
            'owner_name' => $property?->owner?->name,
            'unit_number' => $unit?->unit_number,
            'contract_number' => $payment->contract?->government_contract_number ?: $payment->contract?->contract_number,
            'message' => $message,
            'payment' => $payment,
        ];
    }
}

Route::get('/payment-reminders', function (\Illuminate\Http\Request $request) {
    $days = (int) $request->query('days', 30);
    $until = now()->addDays(max($days, 1))->toDateString();

    return \App\Models\Payment::with([
            'contract.tenant',
            'contract.unit.property.owner',
        ])
        ->whereIn('status', ['due', 'overdue'])
        ->whereDate('due_date', '<=', $until)
        ->orderBy('due_date')
        ->get()
        ->map(fn ($payment) => my_rentals_format_reminder_payment($payment))
        ->values();
});

Route::get('/my/payment-reminders', function (\Illuminate\Http\Request $request) {
    $user = function_exists('my_rentals_current_user_for_scope')
        ? my_rentals_current_user_for_scope($request)
        : (function_exists('my_rentals_bearer_user') ? my_rentals_bearer_user($request) : null);

    if (!$user) {
        return response()->json(['message' => 'غير مصرح. الرجاء تسجيل الدخول.'], 401);
    }

    $isAdmin = function_exists('my_rentals_is_admin_user')
        ? my_rentals_is_admin_user($user)
        : in_array($user->role ?? 'owner', ['admin', 'manager', 'super_admin'], true);

    $days = (int) $request->query('days', 30);
    $until = now()->addDays(max($days, 1))->toDateString();

    $query = \App\Models\Payment::with([
            'contract.tenant',
            'contract.unit.property.owner',
        ])
        ->whereIn('status', ['due', 'overdue'])
        ->whereDate('due_date', '<=', $until);

    if (!$isAdmin) {
        if (!$user->owner_id) {
            return [];
        }

        $propertyIds = \App\Models\Property::where('owner_id', $user->owner_id)->pluck('id');

        $query->whereHas('contract.unit', function ($q) use ($propertyIds) {
            $q->whereIn('property_id', $propertyIds);
        });
    }

    return $query
        ->orderBy('due_date')
        ->get()
        ->map(fn ($payment) => my_rentals_format_reminder_payment($payment))
        ->values();
});
