<?php

// تفاصيل السجلات والعلاقات التابعة.
// نستخدم override خاص بالعقود حتى تظهر التبويبة باسم الدفعات وتُراجع تواريخ الدفعات عند فتح العقد.

require_once base_path('app/Support/RelationRelatedHelpers.php');

$override = base_path('routes/api/107_contract_details_payments_override.php');
if (is_file($override)) {
    require $override;
}
