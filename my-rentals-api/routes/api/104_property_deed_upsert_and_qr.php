<?php

/*
|--------------------------------------------------------------------------
| Legacy deed extractor disabled
|--------------------------------------------------------------------------
| The active deed upload route is registered in:
| routes/api/106_deed_398490000202_fields.php
|
| That route loads routes/api/105_visual_deed_rule.php and applies the
| visual deed rule requested by the user:
| A full green header row with more than one beige data row below it is a
| table. Otherwise, green labels and beige values are treated as normal
| fields.
|
| This file intentionally registers no duplicate /property-deeds/extract
| routes because Laravel keeps the last matching route for identical URI and
| method, which caused the old text-only parser to override the visual parser
| and return only the document number.
*/
