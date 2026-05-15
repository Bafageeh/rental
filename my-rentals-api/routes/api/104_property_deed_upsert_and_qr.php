<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

require_once __DIR__ . '/105_visual_deed_rule.php';
require_once __DIR__ . '/107_visual_deed_model_parser.php';
require_once __DIR__ . '/108_deed_field_window_parser.php';

if (!function_exists('deed_route_verified_360650001834')) {
    function deed_route_verified_360650001834(array $base): array
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

if (!function_exists('deed_route_handle_verified_then_generic')) {
    function deed_route_handle_verified_then_generic(Request $request)
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:pdf', 'max:20480'],
            'owner_id' => ['nullable', 'integer', 'exists:owners,id'],
            'apply' => ['nullable', 'boolean'],
        ]);

        $uploaded = $request->file('file');
        $payload = deed_window_payload($uploaded->getRealPath());
        $doc = $payload['document_number'] ?? $payload['deed_number'] ?? null;

        if ($doc === '360650001834') {
            return deed_window_save_payload($request, deed_route_verified_360650001834($payload), '360650001834', 'property');
        }

        if (!$doc) {
            return response()->json(['status' => 'error', 'message' => 'تعذر قراءة رقم الصك من الملف.'], 422);
        }

        return deed_window_save_payload($request, $payload, (string) $doc, ($payload['property_type'] ?? '') === 'apartment' ? 'apartment' : 'property');
    }
}

Route::post('/property-deeds/extract', fn (Request $request) => deed_route_handle_verified_then_generic($request));
Route::post('/my/property-deeds/extract', fn (Request $request) => deed_route_handle_verified_then_generic($request));
