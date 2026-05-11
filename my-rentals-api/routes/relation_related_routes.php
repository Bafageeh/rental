<?php

// تفاصيل السجلات والعلاقات التابعة.
// نحمّل override الخاص بتواريخ دفعات PDF الرسمية قبل أي override قديم لأن Laravel يعتمد أول مسار مطابق.

require_once base_path('app/Support/RelationRelatedHelpers.php');

$officialOverride = base_path('routes/api/000_contract_details_official_payment_dates.php');
if (is_file($officialOverride)) {
    require $officialOverride;
    return;
}

$override = base_path('routes/api/107_contract_details_payments_override.php');
if (is_file($override)) {
    require $override;
}
