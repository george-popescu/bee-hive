<?php

use App\Enums\PermissionName;
use App\Http\Controllers\ActualAdjustmentController;
use App\Http\Controllers\Admin\AdminController;
use App\Http\Controllers\Admin\AdminPersonController;
use App\Http\Controllers\Admin\AdminProjectController;
use App\Http\Controllers\Admin\AdminRoleController;
use App\Http\Controllers\Admin\AdminSettingController;
use App\Http\Controllers\Admin\AdminUserController;
use App\Http\Controllers\AllocationController;
use App\Http\Controllers\ClickUpSyncController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\LocaleController;
use App\Http\Controllers\ManagementController;
use App\Http\Controllers\PmBoardController;
use App\Http\Controllers\TeamLeadController;
use App\Http\Controllers\WeeklyPlanningController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');
Route::put('locale', LocaleController::class)->name('locale.update');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');
    Route::get('team-lead', [TeamLeadController::class, 'index'])
        ->middleware('can:'.PermissionName::ViewTeamLead->value)
        ->name('team_lead.index');
    Route::get('management', [ManagementController::class, 'index'])
        ->middleware('can:'.PermissionName::ViewManagement->value)
        ->name('management.index');
    Route::get('pm-board', [PmBoardController::class, 'index'])
        ->middleware('can:'.PermissionName::ViewPmBoards->value)
        ->name('pm_board.index');
    Route::get('pm-board/export.csv', [PmBoardController::class, 'export'])
        ->middleware('can:'.PermissionName::ViewPmBoards->value)
        ->name('pm_board.export');
    Route::post('clickup/sync', [ClickUpSyncController::class, 'store'])
        ->middleware('can:'.PermissionName::SyncClickUp->value)
        ->name('clickup_sync.store');
    Route::put('weekly-planning', [WeeklyPlanningController::class, 'upsert'])
        ->middleware('can:'.PermissionName::ManagePmPlanning->value)
        ->name('weekly_planning.upsert');
    Route::delete('weekly-planning', [WeeklyPlanningController::class, 'clear'])
        ->middleware('can:'.PermissionName::ManagePmPlanning->value)
        ->name('weekly_planning.clear');
    Route::get('admin', AdminController::class)->name('admin.index');
    Route::middleware('throttle:60,1')->group(function () {
        Route::put('admin/people/{person}', [AdminPersonController::class, 'update'])
            ->middleware('can:'.PermissionName::ManageSettings->value)
            ->name('admin_people.update');
        Route::put('admin/projects/{project}', [AdminProjectController::class, 'update'])
            ->middleware('can:'.PermissionName::ManageSettings->value)
            ->name('admin_projects.update');
        Route::put('admin/users/{user}', [AdminUserController::class, 'update'])
            ->middleware('can:'.PermissionName::ManageUsers->value)
            ->name('admin_users.update');
        Route::put('admin/roles/{role}', [AdminRoleController::class, 'update'])
            ->middleware('can:'.PermissionName::ManageRolesAndPermissions->value)
            ->name('admin_roles.update');
        Route::put('admin/settings', [AdminSettingController::class, 'update'])
            ->middleware('can:'.PermissionName::ManageSettings->value)
            ->name('admin_settings.update');
    });
    Route::put('allocations', [AllocationController::class, 'upsert'])
        ->middleware('can:'.PermissionName::ManageAllocations->value)
        ->name('allocations.upsert');
    Route::put('allocations/{allocation}', [AllocationController::class, 'update'])
        ->middleware('can:'.PermissionName::ManageAllocations->value)
        ->name('allocations.update');
    Route::delete('allocations/{allocation}', [AllocationController::class, 'destroy'])
        ->middleware('can:'.PermissionName::ManageAllocations->value)
        ->name('allocations.destroy');
    Route::post('actual-adjustments', [ActualAdjustmentController::class, 'store'])
        ->middleware('can:'.PermissionName::AdjustActualHours->value)
        ->name('actual_adjustments.store');
    Route::post('actual-adjustments/{actualAdjustment}/reverse', [ActualAdjustmentController::class, 'reverse'])
        ->middleware('can:'.PermissionName::AdjustActualHours->value)
        ->name('actual_adjustments.reverse');
});

require __DIR__.'/settings.php';
