<?php

use App\Jobs\SyncClickUpWorkspace;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::job(new SyncClickUpWorkspace)
    ->dailyAt('10:25')
    ->timezone(config('app.timezone'))
    ->withoutOverlapping(30)
    ->onOneServer();

Schedule::command('db:backup')
    ->dailyAt('02:15')
    ->withoutOverlapping(120)
    ->onOneServer()
    ->runInBackground();
