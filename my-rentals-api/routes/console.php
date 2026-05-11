<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('rent:send-overdue-whatsapp-report')
    ->dailyAt('18:25')
    ->timezone('Asia/Riyadh')
    ->withoutOverlapping()
    ->onOneServer();
