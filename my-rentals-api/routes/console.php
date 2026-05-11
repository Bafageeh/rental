<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// يتم فحص الرسائل المجدولة كل دقيقة، والوقت الفعلي محفوظ في قاعدة البيانات
// حتى يمكن تغييره من شاشة الرسائل المجدولة بدون تعديل الكود.
Schedule::command('scheduled-messages:run-due')
    ->everyMinute()
    ->timezone('Asia/Riyadh')
    ->withoutOverlapping()
    ->onOneServer();
