<?php

use App\Enums\PermissionName;
use App\Enums\RoleName;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

it('seeds the default roles and permissions idempotently', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $this->seed(RolesAndPermissionsSeeder::class);

    expect(Role::query()->count())->toBe(count(RoleName::cases()))
        ->and(Permission::query()->count())->toBe(count(PermissionName::cases()));
});

it('allows management to adjust actual hours by default', function () {
    $this->seed(RolesAndPermissionsSeeder::class);

    $management = User::factory()->create();
    $management->assignRole(RoleName::Management->value);

    $teamLead = User::factory()->create();
    $teamLead->assignRole(RoleName::TeamLead->value);

    expect($management->can(PermissionName::AdjustActualHours->value))->toBeTrue()
        ->and($teamLead->can(PermissionName::AdjustActualHours->value))->toBeFalse();
});

it('grants administrators every registered permission', function () {
    $this->seed(RolesAndPermissionsSeeder::class);

    $admin = User::factory()->create();
    $admin->assignRole(RoleName::Admin->value);

    foreach (PermissionName::cases() as $permissionName) {
        expect($admin->can($permissionName->value))->toBeTrue();
    }
});
