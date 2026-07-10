<?php

use App\Enums\PermissionName;
use App\Http\Controllers\AllocationController;
use App\Http\Controllers\TeamLeadController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');
    Route::get('team-lead', [TeamLeadController::class, 'index'])
        ->middleware('can:'.PermissionName::ViewTeamLead->value)
        ->name('team_lead.index');
    Route::put('allocations', [AllocationController::class, 'upsert'])
        ->middleware('can:'.PermissionName::ManageAllocations->value)
        ->name('allocations.upsert');
});

require __DIR__.'/settings.php';
