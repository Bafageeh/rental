<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

require_once __DIR__ . '/console_overdue_table_report.php';
if (is_file(__DIR__ . '/console_assign_admin_data_to_manager.php')) {
    require_once __DIR__ . '/console_assign_admin_data_to_manager.php';
}

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

// بعد انتهاء العقد وعدم وجود عقد نشط: سؤال يومي الساعة 9 صباحًا حتى تتم الإجابة.
Schedule::call(function () {
    \App\Support\UnitContractExitFollowups::sendDailyReminders();
})
    ->name('unit-contract-exit-followups-9am')
    ->dailyAt('09:00')
    ->timezone('Asia/Riyadh')
    ->withoutOverlapping()
    ->onOneServer();
