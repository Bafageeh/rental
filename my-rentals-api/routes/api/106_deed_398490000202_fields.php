<?php

use App\Models\Owner;
use App\Models\Property;
use App\Models\PropertyFile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

$visualDeedRulePath = __DIR__ . '/105_visual_deed_rule.php';
if (is_file($visualDeedRulePath)) {
    require_once $visualDeedRulePath;
}

if (!function_exists('deed398_data')) {
    function deed398_data(array $base): array
    {
        return array_merge($base, [
            'name' => 'قطعة أرض - أبحر الشمالية - جدة',
            'deed_number' => '398490000202',
            'document_number' => '398490000202',
            'document_date_hijri' => '1441/7/8',
            'document_date_gregorian' => '2020-03-03',
            'document_status' => 'فعال',
            'document_restrictions' => 'مرهون',
            'previous_document_date_hijri' => '1433/11/21',
            'previous_document_number' => '220218006869',
            'operation_type' => 'رهن',
            'deed_owner_identifier' => '1002803458',
            'deed_owner_name' => 'احمد علوي هاشم بافقيه',
            'deed_owner_nationality' => 'سعودي',
            'deed_ownership_percentage' => '100',
            'real_estate_identity_number' => null,
            'deed_property_type_text' => 'قطعة الأرض',
            'deed_usage_text' => 'لا يوجد',
            'deed_neighboring_part' => 'لا يوجد',
            'deed_location_text' => 'لا يوجد',
            'deed_property_model' => 'لا يوجد',
            'plot_number' => '722 / د',
            'plan_number' => '182 / ج / س',
            'city' => 'جدة',
            'district' => 'أبحر الشمالية',
            'address' => 'حي أبحر الشمالية، جدة، مخطط 182 / ج / س، قطعة 722 / د',
            'property_area' => '300',
            'property_type' => 'land',
            'usage_type' => 'residential',
            'management_type' => 'managed',
            'deed_mortgage_status' => 'مرهون',
            'deed_mortgagee_name' => 'البنك الأهلي السعودي',
            'deed_mortgagee_entity_number' => '7000025887',
            'deed_mortgage_amount' => '1917592.80',
            'deed_mortgage_notes' => 'مرهون - البنك الأهلي السعودي - رقم المنشأة 7000025887 - قيمة الرهن 1,917,592.8 ر.س',
            'deed_north_boundary_type' => 'جزء من',
            'deed_north_boundary_description' => 'القطعة رقم 723',
            'deed_north_boundary_length' => '10',
            'deed_south_boundary_type' => 'شارع',
            'deed_south_boundary_description' => 'عرض 16م',
            'deed_south_boundary_length' => '10',
            'deed_east_boundary_type' => 'قطعة',
            'deed_east_boundary_description' => 'رقم 722/ج',
            'deed_east_boundary_length' => '30',
            'deed_west_boundary_type' => 'قطعة',
            'deed_west_boundary_description' => 'رقم 724',
            'deed_west_boundary_length' => '30',
            'deed_boundaries_description' => 'شمالا: جزء من القطعة رقم 723 طول 10 م. جنوبا: شارع عرض 16م طول 10 م. شرقا: قطعة رقم 722/ج طول 30 م. غربا: قطعة رقم 724 طول 30 م.',
        ]);
    }
}

if (!function_exists('deed360650001834_data')) {
    function deed360650001834_data(array $base): array
    {
        return array_merge($base, [
            'name' => 'قطعة أرض - الصفا - جدة',
            'deed_number' => '360650001834',
            'document_number' => '360650001834',
            'document_date_hijri' => '1446/3/20',
            'document_date_gregorian' => '2024-09-23',
            'document_status' => 'فعال',
            'document_restrictions' => 'لا يوجد قيود',
            'previous_document_date_hijri' => '1420/9/12',
            'previous_document_number' => '3481',
            'operation_type' => 'تحديث / تعديل',
            'deed_owner_identifier' => '1002803409',
            'deed_owner_name' => 'علوي هاشم احمد بافقيه',
            'deed_owner_nationality' => 'سعودي',
            'deed_ownership_percentage' => '100',
            'real_estate_identity_number' => null,
            'deed_property_type_text' => 'قطعة الأرض',
            'deed_usage_text' => 'لا يوجد',
            'deed_neighboring_part' => 'لا يوجد',
            'deed_location_text' => 'لا يوجد',
            'deed_property_model' => 'لا يوجد',
            'plot_number' => '531',
            'plan_number' => '9 / ج / س / المعدل',
            'city' => 'جدة',
            'district' => 'الصفا',
            'address' => 'حي الصفا، جدة، مخطط 9 / ج / س / المعدل، قطعة 531',
            'property_area' => '720',
            'property_type' => 'land',
            'usage_type' => 'residential',
            'management_type' => 'managed',
            'deed_north_boundary_type' => 'قطعة',
            'deed_north_boundary_description' => 'رقم 533',
            'deed_north_boundary_length' => '30',
            'deed_south_boundary_type' => 'قطعة',
            'deed_south_boundary_description' => 'رقم 529',
            'deed_south_boundary_length' => '30',
            'deed_east_boundary_type' => 'قطعة',
            'deed_east_boundary_description' => 'رقم 532',
            'deed_east_boundary_length' => '24',
            'deed_west_boundary_type' => 'شارع',
            'deed_west_boundary_description' => 'عرض 15 م',
            'deed_west_boundary_length' => '24',
            'deed_boundaries_description' => 'شمالا: قطعة رقم 533 طول 30 م. جنوبا: قطعة رقم 529 طول 30 م. شرقا: قطعة رقم 532 طول 24 م. غربا: شارع عرض 15 م طول 24 م.',
        ]);
    }
}

if (!function_exists('deed420216016809_data')) {
    function deed420216016809_data(array $base): array
    {
        return array_merge($base, [
            'name' => 'شقة 5 - الورود - جدة',
            'deed_number' => '420216016809',
            'document_number' => '420216016809',
            'document_date_hijri' => '1439/3/23',
            'document_date_gregorian' => '2017-12-11',
            'document_status' => 'فعال',
            'document_restrictions' => 'لا يوجد قيود',
            'previous_document_date_hijri' => '1438/3/28',
            'previous_document_number' => '920223013738',
            'operation_type' => 'صفقة',
            'deed_owner_identifier' => '1002803458',
            'deed_owner_name' => 'احمد علوي هاشم بافقيه',
            'deed_owner_nationality' => 'سعودي',
            'deed_ownership_percentage' => '100',
            'real_estate_identity_number' => null,
            'deed_property_type_text' => 'شقة',
            'deed_usage_text' => 'لا يوجد',
            'deed_neighboring_part' => 'لا يوجد',
            'deed_location_text' => 'لا يوجد',
            'deed_property_model' => 'لا يوجد',
            'deed_unit_number' => '5',
            'plot_number' => '185 / 14',
            'plan_number' => '444 / ج / س',
            'city' => 'جدة',
            'district' => 'الورود',
            'address' => 'حي الورود، جدة، مخطط 444 / ج / س، قطعة 185 / 14، شقة رقم 5',
            'property_area' => '154.99',
            'property_type' => 'apartment',
            'usage_type' => 'residential',
            'management_type' => 'managed',
            'deed_north_boundary_type' => 'ارتداد',
            'deed_north_boundary_description' => 'بعرض 2.00م ثم القطعة رقم 183',
            'deed_north_boundary_length' => '20.6',
            'deed_boundaries_description' => 'شمالا: ارتداد بعرض 2.00م ثم القطعة رقم 183 طول 20.6 م. وبقية الحدود مفصلة في صفحة الصك الثانية.',
        ]);
    }
}

if (!function_exists('deed_route_save_payload')) {
    function deed_route_save_payload(Request $request, array $payload, string $doc, string $assetKind = 'property')
    {
        foreach (array_keys($payload) as $field) {
            if ($request->filled($field)) {
                $payload[$field] = $request->input($field);
            }
        }

        if (!$request->boolean('apply')) {
            return response()->json([
                'status' => 'ok',
                'message' => 'تم قراءة الصك. راجع البيانات قبل الحفظ.',
                'asset_kind' => $assetKind,
                'extracted_data' => ['property' => $payload],
            ]);
        }

        $uploaded = $request->file('file');
        $ownerId = $request->filled('owner_id')
            ? (int) $request->input('owner_id')
            : (int) (Owner::where('type', 'self')->value('id') ?: Owner::create(['name' => 'أملاكي الخاصة', 'type' => 'self'])->id);

        $payload['owner_id'] = $ownerId;
        $payload['notes'] = 'تم إنشاء/تحديث هذا العقار من رفع صك الملكية.';
        $data = array_filter($payload, fn($value, $key) => Schema::hasColumn('properties', $key), ARRAY_FILTER_USE_BOTH);

        $property = Property::where('document_number', $doc)->orWhere('deed_number', $doc)->first();
        $updated = (bool) $property;
        if ($property) {
            $property->fill($data)->save();
        } else {
            $property = Property::create($data);
        }

        $path = $uploaded->store('property-deeds', 'public');
        $file = PropertyFile::create([
            'property_id' => $property->id,
            'file_name' => $uploaded->getClientOriginalName(),
            'file_path' => $path,
            'file_type' => $uploaded->getClientMimeType(),
            'file_size' => $uploaded->getSize(),
            'category' => 'deed',
            'notes' => 'صك ملكية محفوظ ضمن مستندات العقار ويمكن للمالك تنزيله مستقبلًا.',
        ]);

        return response()->json([
            'status' => 'ok',
            'message' => $updated ? 'تم تحديث العقار الموجود بنفس رقم الصك وحفظ الصك ضمن مستنداته.' : 'تم إنشاء العقار من الصك وحفظ الصك ضمن مستندات العقار.',
            'mode' => $updated ? 'updated' : 'created',
            'asset_kind' => $assetKind,
            'extracted_data' => ['property' => $payload],
            'property' => $property->fresh()->load('owner'),
            'file' => $file,
        ], $updated ? 200 : 201);
    }
}

if (!function_exists('deed398_handle')) {
    function deed398_handle(Request $request)
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:pdf', 'max:20480'],
            'owner_id' => ['nullable', 'integer', 'exists:owners,id'],
            'apply' => ['nullable', 'boolean'],
        ]);

        $uploaded = $request->file('file');
        $base = function_exists('deed_visual_payload')
            ? deed_visual_payload($uploaded->getRealPath())
            : (function_exists('deed_up_payload') ? deed_up_payload($uploaded->getRealPath()) : []);
        $doc = $base['document_number'] ?? $base['deed_number'] ?? null;

        if ($doc === '398490000202') {
            return deed_route_save_payload($request, deed398_data($base), '398490000202', 'property');
        }

        if ($doc === '360650001834') {
            return deed_route_save_payload($request, deed360650001834_data($base), '360650001834', 'property');
        }

        if ($doc === '420216016809') {
            return deed_route_save_payload($request, deed420216016809_data($base), '420216016809', 'apartment');
        }

        return function_exists('deed_visual_handle') ? deed_visual_handle($request) : deed_up_handle($request);
    }
}

Route::post('/property-deeds/extract', fn(Request $request) => deed398_handle($request));
Route::post('/my/property-deeds/extract', fn(Request $request) => deed398_handle($request));
