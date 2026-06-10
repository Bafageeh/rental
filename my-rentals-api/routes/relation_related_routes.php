<?php

// تفاصيل السجلات والعلاقات التابعة.
// نحمّل override تفاصيل الوحدة أولاً لأن Laravel يعتمد أول مسار مطابق.
// ثم نحمّل override الخاص بتواريخ دفعات PDF الرسمية قبل أي override قديم.

require_once base_path('app/Support/RelationRelatedHelpers.php');

$unitDetailsOverride = base_path('routes/api/134_unit_details_arabic_labels_override.php');
if (is_file($unitDetailsOverride)) {
    require $unitDetailsOverride;
}

$officialOverride = base_path('routes/api/000_contract_details_official_payment_dates.php');
if (is_file($officialOverride)) {
    require $officialOverride;
    return;
}

$override = base_path('routes/api/107_contract_details_payments_override.php');
if (is_file($override)) {
    require $override;
}
