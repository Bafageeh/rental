<?php

use App\Models\Owner;
use App\Models\Property;
use App\Models\PropertyFile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Smalot\PdfParser\Parser;

if (!function_exists('deed_up_norm')) {
    function deed_up_norm(string $text): string
    {
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $text = preg_replace('/[\x{200E}\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}]/u', '', $text) ?? $text;
        $text = strtr($text, ['٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9']);
        $text = preg_replace('/[ \t]+/u', ' ', str_replace('ـ', ' ', $text)) ?? $text;
        return trim(preg_replace('/\n{2,}/u', "\n", $text) ?? $text);
    }
}

if (!function_exists('deed_up_match')) {
    function deed_up_match(array $patterns, string $text, int $group = 1): ?string
    {
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $text, $m)) {
                $value = trim((string) ($m[$group] ?? ''));
                $value = trim(preg_replace('/\s+/u', ' ', $value) ?? $value, " \t\n\r\0\x0B:-،؛");
                if ($value !== '' && $value !== '-') return $value;
            }
        }
        return null;
    }
}

if (!function_exists('deed_up_clean')) {
    function deed_up_clean($value, int $max = 255): ?string
    {
        $value = trim((string) $value);
        if ($value === '' || $value === '-') return null;
        return mb_substr(trim(preg_replace('/\s+/u', ' ', $value) ?? $value, " \t\n\r\0\x0B:-،؛"), 0, $max);
    }
}

if (!function_exists('deed_up_num')) {
    function deed_up_num($value) { $n = preg_replace('/[^0-9.]/', '', (string) $value); return $n === '' ? null : $n; }
}

if (!function_exists('deed_up_payload')) {
    function deed_up_payload(string $filePath): array
    {
        $text = deed_up_norm((new Parser())->parseFile($filePath)->getText());
        $doc = deed_up_match(['/رقم\s*الوثيقة\s*([0-9]{5,})/u','/الرقم\s*[:：]?\s*([0-9]{5,})/u','/\b([0-9]{10,})\b/u'], $text);
        $hDate = deed_up_match(['/تاريخ\s*الوثيقة\s*([0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2})/u'], $text);
        $gDate = deed_up_match(['/التاريخ\s*[:：]?\s*(20[0-9]{2}\/[0-9]{1,2}\/[0-9]{1,2})/u'], $text);
        $status = deed_up_match(['/الحالة\s*([\p{Arabic}A-Za-z ]+?)\s*(?:تاريخ|المساحة|$)/u'], $text);
        $restrictions = deed_up_match(['/القيود\s*([\p{Arabic}A-Za-z ]+?)\s*الحالة/u'], $text);
        $prevDate = deed_up_match(['/تاريخ\s*الوثيقة\s*السابقة\s*([0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2})/u'], $text);
        $prevNo = deed_up_match(['/رقم\s*الوثيقة\s*السابقة\s*([^\n]+?)(?:\n|الملاك|$)/u'], $text);
        $operation = deed_up_match(['/نوع\s*العملية\s*([^\n]+?)\s*رقم\s*الوثيقة\s*السابقة/u'], $text);
        $ownerName = deed_up_match(['/\n[0-9]{6,}\s+([\p{Arabic}\s]+?)\s+سعودي\s+100\s*%/u'], $text);
        $identity = deed_up_match(['/رقم\s*الهوية\s*العقارية\s*([0-9]{6,})/u'], $text);
        $city = deed_up_match(['/المدينة\s*([\p{Arabic}A-Za-z ]+?)\s*رقم\s*المخطط/u'], $text);
        $plan = deed_up_match(['/رقم\s*المخطط\s*([^\n]+?)\s*الحي/u'], $text);
        $district = deed_up_match(['/الحي\s*([\p{Arabic}A-Za-z0-9 ]+?)\s*رقم\s*القطعة/u'], $text);
        $plotBlock = deed_up_match(['/رقم\s*القطعة\s*([^\n]+?)\s*مساحة\s*العقار/u'], $text);
        $area = deed_up_match(['/مساحة\s*العقار\s*\(?\s*م\s*²?\)?\s*([0-9,.]+)/u','/المساحة\s*([0-9,.]+)/u'], $text);
        $typeText = deed_up_match(['/نوع\s*العقار\s*([^\n]+?)(?:\n|خريطة|الوصول|$)/u'], $text);
        $plot = deed_up_clean($plotBlock, 100); $block = null;
        if ($plotBlock && preg_match('/(.+?)\s+بلك\s+(.+)$/u', trim($plotBlock), $m)) { $plot = deed_up_clean($m[1], 100); $block = deed_up_clean($m[2], 100); }
        $city = deed_up_clean($city, 80); $district = deed_up_clean($district, 80);
        $ptype = (str_contains((string) $typeText, 'قطعة') || str_contains((string) $typeText, 'ارض') || str_contains((string) $typeText, 'أرض')) ? 'land' : 'building';
        $name = implode(' - ', array_filter([$ptype === 'land' ? 'قطعة أرض' : 'عقار', $district, $city]));
        return [
            'name' => deed_up_clean($name ?: ('عقار صك ' . $doc)), 'deed_number' => deed_up_clean($doc), 'document_number' => deed_up_clean($doc),
            'document_date_hijri' => deed_up_clean($hDate, 50), 'document_date_gregorian' => $gDate ? str_replace('/', '-', $gDate) : null,
            'document_status' => deed_up_clean($status, 100), 'document_restrictions' => deed_up_clean($restrictions),
            'previous_document_date_hijri' => deed_up_clean($prevDate, 50), 'previous_document_number' => deed_up_clean($prevNo), 'operation_type' => deed_up_clean($operation, 100),
            'real_estate_identity_number' => deed_up_clean($identity), 'real_estate_identity_map_url' => $identity ? ('https://srem.moj.gov.sa/rid/' . $identity) : null,
            'plan_number' => deed_up_clean($plan), 'plot_number' => $plot, 'block_number' => $block,
            'deed_owner_name' => deed_up_clean($ownerName), 'deed_owner_nationality' => 'سعودي', 'deed_ownership_percentage' => '100',
            'deed_source' => 'منصة البورصة العقارية', 'deed_issuer' => 'وزارة العدل', 'city' => $city, 'district' => $district,
            'address' => implode('، ', array_filter([$district ? 'حي '.$district : null, $city, $plan ? 'مخطط '.$plan : null, $plot ? 'قطعة '.$plot : null, $block ? 'بلك '.$block : null])),
            'property_area' => deed_up_num($area), 'property_type' => $ptype, 'usage_type' => 'residential', 'management_type' => 'managed', 'deed_raw_excerpt' => mb_substr($text, 0, 6000),
        ];
    }
}

if (!function_exists('deed_up_handle')) {
    function deed_up_handle(Request $request) {
        $request->validate(['file'=>['required','file','mimes:pdf','max:20480'],'owner_id'=>['nullable','integer','exists:owners,id'],'apply'=>['nullable','boolean']]);
        $uploaded = $request->file('file'); $payload = deed_up_payload($uploaded->getRealPath());
        foreach (array_keys($payload) as $field) if ($request->filled($field)) $payload[$field] = $request->input($field);
        if (!$request->boolean('apply')) return response()->json(['status'=>'ok','message'=>'تم قراءة الصك. راجع البيانات قبل الحفظ.','extracted_data'=>['property'=>$payload]]);
        $owner = $request->filled('owner_id') ? (int)$request->input('owner_id') : (int)(Owner::where('type','self')->value('id') ?: Owner::create(['name'=>'أملاكي الخاصة','type'=>'self'])->id);
        $payload['owner_id'] = $owner; $payload['notes'] = 'تم إنشاء/تحديث هذا العقار من رفع صك الملكية.';
        $data = array_filter($payload, fn($v,$k)=>Schema::hasColumn('properties',$k), ARRAY_FILTER_USE_BOTH);
        $doc = $payload['document_number'] ?? $payload['deed_number'] ?? null;
        $property = $doc ? Property::where('document_number',$doc)->orWhere('deed_number',$doc)->first() : null;
        $updated = (bool)$property;
        if ($property) $property->fill($data)->save(); else $property = Property::create($data);
        $path = $uploaded->store('property-deeds','public');
        $file = PropertyFile::create(['property_id'=>$property->id,'file_name'=>$uploaded->getClientOriginalName(),'file_path'=>$path,'file_type'=>$uploaded->getClientMimeType(),'file_size'=>$uploaded->getSize(),'category'=>'deed','notes'=>'صك ملكية محفوظ ضمن مستندات العقار ويمكن للمالك تنزيله مستقبلًا.']);
        return response()->json(['status'=>'ok','message'=>$updated?'تم تحديث العقار الموجود بنفس رقم الصك وحفظ الصك ضمن مستنداته.':'تم إنشاء العقار من الصك وحفظ الصك ضمن مستندات العقار.','mode'=>$updated?'updated':'created','extracted_data'=>['property'=>$payload],'property'=>$property->fresh()->load('owner'),'file'=>$file], $updated?200:201);
    }
}

Route::post('/property-deeds/extract', fn(Request $request)=>deed_up_handle($request));
Route::post('/my/property-deeds/extract', fn(Request $request)=>deed_up_handle($request));
