<?php

use App\Models\Owner;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

if (!function_exists('mroa_am_fn')) {
    function mroa_am_fn($value): string
    {
        return trim((string) ($value ?? ''));
    }
}

if (!function_exists('mroa_am_norm')) {
    function mroa_am_norm($value): string
    {
        $text = mb_strtolower(mroa_am_fn($value));
        $text = str_replace(['أ', 'إ', 'آ'], 'ا', $text);
        $text = str_replace(['ة', 'ى'], ['ه', 'ي'], $text);
        return preg_replace('/\s+/u', ' ', $text) ?: '';
    }
}

if (!function_exists('mroa_am_rows')) {
    function mroa_am_rows(): array
    {
        return [
            ['amount' => 3845, 'transfer_date' => '2023-10-29', 'bank' => 'الأهلي', 'notes' => 'شقة ٢'],
            ['amount' => 1415, 'transfer_date' => '2023-11-20', 'bank' => 'الراجحي', 'notes' => 'شقة ٢'],
            ['amount' => 1950, 'transfer_date' => '2023-11-21', 'bank' => 'الراجحي', 'notes' => 'شقة ٢'],
            ['amount' => 1800, 'transfer_date' => '2023-12-30', 'bank' => 'الأهلي', 'notes' => 'شقة ٢'],
            ['amount' => 2310, 'transfer_date' => '2024-01-24', 'bank' => 'الراجحي', 'notes' => 'شقة ٢'],
            ['amount' => 2500, 'transfer_date' => '2024-02-24', 'bank' => 'شحن بطاقة تركي', 'notes' => null],
            ['amount' => 1200, 'transfer_date' => '2024-03-29', 'bank' => 'الراجحي', 'notes' => null],
            ['amount' => 800, 'transfer_date' => '2024-04-01', 'bank' => 'الراجحي', 'notes' => 'الكل'],
            ['amount' => 1000, 'transfer_date' => '2024-04-28', 'bank' => 'الأهلي', 'notes' => null],
            ['amount' => 3000, 'transfer_date' => '2024-05-02', 'bank' => 'الراجحي', 'notes' => null],
            ['amount' => 1650, 'transfer_date' => null, 'bank' => 'الراجحي', 'notes' => 'التاريخ غير ظاهر في الصورة'],
            ['amount' => 4642, 'transfer_date' => '2024-07-03', 'bank' => 'الراجحي', 'notes' => 'الكل'],
            ['amount' => 1775, 'transfer_date' => '2024-08-01', 'bank' => 'الراجحي', 'notes' => '٢'],
            ['amount' => 1150, 'transfer_date' => '2024-08-02', 'bank' => 'الراجحي', 'notes' => '٩'],
            ['amount' => 3363, 'transfer_date' => '2024-08-28', 'bank' => 'الراجحي', 'notes' => '٢'],
            ['amount' => 3000, 'transfer_date' => '2024-09-16', 'bank' => 'الراجحي', 'notes' => '٩'],
            ['amount' => 2250, 'transfer_date' => '2024-10-07', 'bank' => 'الراجحي', 'notes' => null],
            ['amount' => 3500, 'transfer_date' => '2024-11-04', 'bank' => 'الراجحي', 'notes' => null],
            ['amount' => 2000, 'transfer_date' => '2024-11-07', 'bank' => 'الراجحي', 'notes' => null],
            ['amount' => 5000, 'transfer_date' => '2024-12-09', 'bank' => 'الراجحي', 'notes' => null],
            ['amount' => 1000, 'transfer_date' => '2024-12-10', 'bank' => 'الراجحي', 'notes' => null],
            ['amount' => 6000, 'transfer_date' => '2025-01-06', 'bank' => 'الراجحي', 'notes' => null],
            ['amount' => 1500, 'transfer_date' => '2025-01-12', 'bank' => 'الراجحي', 'notes' => null],
            ['amount' => 2400, 'transfer_date' => '2025-01-22', 'bank' => 'الراجحي', 'notes' => '٢'],
            ['amount' => 5000, 'transfer_date' => '2025-02-15', 'bank' => 'الراجحي', 'notes' => null],
            ['amount' => 3500, 'transfer_date' => '2025-03-06', 'bank' => 'الراجحي', 'notes' => null],
            ['amount' => 4000, 'transfer_date' => '2025-03-30', 'bank' => 'الراجحي', 'notes' => null],
            ['amount' => 1500, 'transfer_date' => '2025-04-13', 'bank' => 'الراجحي', 'notes' => null],
            ['amount' => 3000, 'transfer_date' => '2025-05-05', 'bank' => 'الراجحي', 'notes' => null],
            ['amount' => 4000, 'transfer_date' => '2025-06-22', 'bank' => 'الراجحي', 'notes' => null],
            ['amount' => 3000, 'transfer_date' => '2025-07-05', 'bank' => 'الراجحي', 'notes' => null],
            ['amount' => 6500, 'transfer_date' => '2025-09-29', 'bank' => 'الراجحي', 'notes' => null],
            ['amount' => 6400, 'transfer_date' => '2026-01-19', 'bank' => 'الراجحي', 'notes' => 'شقة ٩'],
            ['amount' => 2450, 'transfer_date' => '2026-02-08', 'bank' => 'الراجحي', 'notes' => 'شقة ٢'],
        ];
    }
}

if (!function_exists('mroa_am_import_for_owner')) {
    function mroa_am_import_for_owner(Owner $owner): array
    {
        if (function_exists('mroa_ensure_tables')) mroa_ensure_tables();

        $ownerName = mroa_am_norm($owner->name ?? '');
        $isAmalOwner = str_contains($ownerName, 'امال') && str_contains($ownerName, 'بافقيه');
        if (!$isAmalOwner) {
            return ['imported' => 0, 'skipped' => 0, 'message' => 'هذا المالك ليس أمال علوي بافقيه.'];
        }

        $imported = 0;
        $skipped = 0;
        foreach (mroa_am_rows() as $index => $row) {
            $exists = DB::table('owner_account_transfers')
                ->where('owner_id', $owner->id)
                ->where('amount', $row['amount'])
                ->when($row['transfer_date'] === null, fn ($q) => $q->whereNull('transfer_date'), fn ($q) => $q->where('transfer_date', $row['transfer_date']))
                ->where('bank', $row['bank'])
                ->where('reference', 'amal-image-import-' . ($index + 1))
                ->exists();

            if ($exists) {
                $skipped++;
                continue;
            }

            DB::table('owner_account_transfers')->insert([
                'owner_id' => $owner->id,
                'amount' => $row['amount'],
                'transfer_date' => $row['transfer_date'],
                'method' => 'تم التحويل لأمال',
                'bank' => $row['bank'],
                'reference' => 'amal-image-import-' . ($index + 1),
                'notes' => $row['notes'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $imported++;
        }

        return ['imported' => $imported, 'skipped' => $skipped, 'total' => count(mroa_am_rows())];
    }
}

Route::post('/owners/{owner}/import-amal-transfers', function (Request $request, Owner $owner) {
    if (function_exists('mroa_can_view_owner') && !mroa_can_view_owner($request, (int) $owner->id)) {
        return response()->json(['message' => 'غير مصرح.'], 403);
    }
    $result = mroa_am_import_for_owner($owner);
    return response()->json(['message' => 'تمت معالجة حوالات أمال من الصورة.', 'result' => $result]);
});
