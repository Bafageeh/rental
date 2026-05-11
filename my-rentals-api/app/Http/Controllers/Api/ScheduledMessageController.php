<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ScheduledMessage;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ScheduledMessageController extends Controller
{
    use ApiResponse;

    public function index(Request $request): JsonResponse
    {
        $this->ensureDefaults();

        $items = ScheduledMessage::query()
            ->orderBy('id')
            ->get()
            ->map(fn (ScheduledMessage $message) => $this->serializeMessage($message))
            ->values();

        return response()->json([
            'data' => $items,
        ]);
    }

    public function update(Request $request, string $key): JsonResponse
    {
        $this->ensureDefaults();

        $data = $request->validate([
            'time' => ['required', 'date_format:H:i'],
            'status' => ['nullable', Rule::in(['active', 'paused'])],
            'recipient' => ['nullable', 'string', 'max:30'],
        ]);

        $message = ScheduledMessage::query()->where('key', $key)->firstOrFail();

        $message->forceFill([
            'time' => $data['time'],
            'status' => $data['status'] ?? $message->status,
            'recipient' => $data['recipient'] ?? $message->recipient,
            // عند تغيير الوقت نسمح له بالعمل مرة أخرى حسب الوقت الجديد إذا لم يكن نفذ اليوم بعد ذلك الوقت.
            // إذا كان قد نفذ اليوم، سيبقى محميًا من التكرار حتى اليوم التالي.
        ])->save();

        return response()->json([
            'data' => $this->serializeMessage($message->fresh()),
            'message' => 'تم تحديث وقت الرسالة المجدولة بنجاح.',
        ]);
    }

    private function ensureDefaults(): void
    {
        ScheduledMessage::dailyRentOverdueReport();
    }

    private function serializeMessage(ScheduledMessage $message): array
    {
        $time = $message->time ?: '18:25';
        $timezone = $message->timezone ?: 'Asia/Riyadh';

        return [
            'id' => $message->key,
            'key' => $message->key,
            'title' => $message->title,
            'description' => $message->description,
            'channel' => $message->channel,
            'channel_label' => $message->channel === 'whatsapp' ? 'واتساب' : $message->channel,
            'recipient' => $message->recipient,
            'command' => $message->command,
            'schedule' => [
                'frequency' => $message->frequency,
                'frequency_label' => $message->frequency === 'daily' ? 'يوميًا' : $message->frequency,
                'time' => $time,
                'timezone' => $timezone,
                'human' => 'يوميًا الساعة ' . $this->formatArabicTime($time) . ' بتوقيت الرياض',
            ],
            'status' => $message->status,
            'status_label' => $message->status === 'active' ? 'نشطة' : 'متوقفة',
            'last_sent_date' => $message->last_sent_date,
            'last_sent_at' => optional($message->last_sent_at)->toDateTimeString(),
            'admin_only' => true,
        ];
    }

    private function formatArabicTime(string $time): string
    {
        [$hour, $minute] = array_map('intval', explode(':', $time));
        $period = $hour >= 12 ? 'مساءً' : 'صباحًا';
        $hour12 = $hour % 12;
        if ($hour12 === 0) {
            $hour12 = 12;
        }

        return $hour12 . ':' . str_pad((string) $minute, 2, '0', STR_PAD_LEFT) . ' ' . $period;
    }
}
