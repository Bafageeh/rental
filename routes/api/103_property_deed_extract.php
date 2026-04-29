<?php

/*
|--------------------------------------------------------------------------
| Legacy deed extractor shim
|--------------------------------------------------------------------------
| Kept only for backwards compatibility. The active extractor is implemented
| in 104_property_deed_upsert_and_qr.php so we do not register old duplicate
| routes that return incomplete deed fields.
*/

$activeExtractor = __DIR__ . '/104_property_deed_upsert_and_qr.php';
if (is_file($activeExtractor)) {
    require $activeExtractor;
}
