<?php

use App\Enums\PermissionName;
use App\Http\Controllers\ActualAdjustmentController;
use App\Http\Controllers\AllocationController;
use App\Http\Controllers\ClickUpSyncController;
use App\Http\Controllers\ManagementController;
use App\Http\Controllers\PmBoardController;
use App\Http\Controllers\TeamLeadController;
use App\Http\Controllers\WeeklyPlanningController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');
    Route::get('team-lead', [TeamLeadController::class, 'index'])
        ->middleware('can:'.PermissionName::ViewTeamLead->value)
        ->name('team_lead.index');
    Route::get('management', [ManagementController::class, 'index'])
        ->middleware('can:'.PermissionName::ViewManagement->value)
        ->name('management.index');
    Route::get('pm-board', [PmBoardController::class, 'index'])
        ->middleware('can:'.PermissionName::ViewPmBoards->value)
        ->name('pm_board.index');
    Route::post('clickup/sync', [ClickUpSyncController::class, 'store'])
        ->middleware('can:'.PermissionName::SyncClickUp->value)
        ->name('clickup_sync.store');
    Route::put('weekly-planning', [WeeklyPlanningController::class, 'upsert'])
        ->middleware('can:'.PermissionName::ManagePmPlanning->value)
        ->name('weekly_planning.upsert');
    Route::put('allocations', [AllocationController::class, 'upsert'])
        ->middleware('can:'.PermissionName::ManageAllocations->value)
        ->name('allocations.upsert');
    Route::post('actual-adjustments', [ActualAdjustmentController::class, 'store'])
        ->middleware('can:'.PermissionName::AdjustActualHours->value)
        ->name('actual_adjustments.store');
    Route::post('actual-adjustments/{actualAdjustment}/reverse', [ActualAdjustmentController::class, 'reverse'])
        ->middleware('can:'.PermissionName::AdjustActualHours->value)
        ->name('actual_adjustments.reverse');
});

require __DIR__.'/settings.php';
