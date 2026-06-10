<?php

use App\Services\RelationRecordService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

if (!function_exists('mr_unit_details_ar_label')) {
    function mr_unit_details_ar_label(string $key, string $fallback): string
    {
        $map = [
            'property_id' => 'العقار',
            'owner_id' => 'المالك',
            'parent_unit_id' => 'الوحدة الأصلية',
            'unit_scope' => 'نطاق الوحدة',
            'unit_number' => 'رقم الوحدة',
            'floor' => 'الدور',
            'type' => 'النوع',
            'rent_amount' => 'قيمة الإيجار',
            'status' => 'الحالة',
            'is_furnished' => 'الوحدة مفروشة',
            'furnishing_status' => 'حالة التأثيث',
            'is_subdivided' => 'الوحدة مقسمة',
            'rooms_count' => 'عدد الغرف',
            'bathrooms_count' => 'عدد دورات المياه',
            'has_kitchen' => 'يوجد مطبخ',
            'kitchen_type' => 'نوع المطبخ',
            'is_kitchen_installed' => 'المطبخ مركب',
            'kitchen_cabinets_installed' => 'دواليب المطبخ مركبة',
            'has_living_room' => 'توجد صالة',
            'is_rooftop' => 'سطح',
            'orientation' => 'الاتجاه',
            'ac_units_count' => 'عدد المكيفات',
            'electricity_meter_number' => 'رقم عداد الكهرباء',
            'water_meter_number' => 'رقم عداد المياه',
            'gas_meter_number' => 'رقم عداد الغاز',
            'area' => 'المساحة',
            'deed_number' => 'رقم الصك',
            'document_number' => 'رقم الوثيقة',
            'document_date_hijri' => 'تاريخ الوثيقة هجري',
            'document_status' => 'حالة الوثيقة',
            'city' => 'المدينة',
            'district' => 'الحي',
            'address' => 'العنوان',
            'notes' => 'ملاحظات',
        ];

        return $map[$key] ?? $fallback;
    }
}

if (!function_exists('mr_unit_details_clean_value')) {
    function mr_unit_details_clean_value(string $key, $value)
    {
        $boolKeys = [
            'is_furnished', 'is_subdivided', 'has_kitchen', 'is_kitchen_installed',
            'kitchen_cabinets_installed', 'has_living_room', 'is_rooftop',
        ];

        if (in_array($key, $boolKeys, true)) {
            $text = strtolower(trim((string) $value));
            if (in_array($text, ['1', 'true', 'yes', 'نعم'], true)) return 'نعم';
            if (in_array($text, ['0', 'false', 'no', 'لا'], true)) return 'لا';
        }

        return $value;
    }
}

if (!function_exists('mr_unit_details_postprocess')) {
    function mr_unit_details_postprocess(array $payload): array
    {
        $skipKeys = ['manager_id', 'deleted_at', 'created_at', 'updated_at'];
        $preferred = ['property_id', 'unit_number', 'floor', 'type', 'rent_amount', 'status'];

        $fields = collect($payload['fields'] ?? [])
            ->filter(fn ($field) => !in_array((string) ($field['key'] ?? ''), $skipKeys, true))
            ->map(function ($field) {
                $key = (string) ($field['key'] ?? '');
                $field['label'] = mr_unit_details_ar_label($key, (string) ($field['label'] ?? $key));
                $field['value'] = mr_unit_details_clean_value($key, $field['value'] ?? null);
                return $field;
            })
            ->sortBy(function ($field) use ($preferred) {
                $key = (string) ($field['key'] ?? '');
                $index = array_search($key, $preferred, true);
                return $index === false ? 100 : $index;
            })
            ->values()
            ->all();

        $payload['entity_title'] = 'الوحدة';
        $payload['fields'] = $fields;

        return $payload;
    }
}

Route::get('/relation-manager/related/unit/{id}', function (Request $request, $id) {
    $response = app(RelationRecordService::class)->show($request, 'unit', $id);
    if (method_exists($response, 'getData')) {
        return response()->json(mr_unit_details_postprocess($response->getData(true)), $response->getStatusCode());
    }
    return $response;
})->middleware('admin.only');

Route::get('/my/relation-manager/related/unit/{id}', function (Request $request, $id) {
    $response = app(RelationRecordService::class)->show($request, 'unit', $id);
    if (method_exists($response, 'getData')) {
        return response()->json(mr_unit_details_postprocess($response->getData(true)), $response->getStatusCode());
    }
    return $response;
});
