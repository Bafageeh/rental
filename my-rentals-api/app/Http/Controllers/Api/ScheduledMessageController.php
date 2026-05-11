<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ScheduledMessageController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $items = [
            [
                'id' => 'daily_rent_overdue_whatsapp_report',
                'title' => 'قائمة المتأخرين عن دفع الإيجار',
                'description' => 'إرسال قائمة يومية للمدير تحتوي على المستأجرين المتأخرين عن السداد مع العقار والوحدة والعقد والمبلغ وتاريخ الاستحقاق.',
                'channel' => 'whatsapp',
                'channel_label' => 'واتساب',
                'recipient' => env('DAILY_RENT_OVERDUE_WHATSAPP_TO', '0500007650'),
                'command' => 'rent:send-overdue-whatsapp-report',
                'schedule' => [
                    'frequency' => 'daily',
                    'frequency_label' => 'يوميًا',
                    'time' => '18:25',
                    'timezone' => 'Asia/Riyadh',
                    'human' => 'يوميًا الساعة 6:25 مساءً بتوقيت الرياض',
                ],
                'status' => 'active',
                'status_label' => 'نشطة',
                'admin_only' => true,
            ],
        ];

        return response()->json([
            'data' => $items,
        ]);
    }
}
