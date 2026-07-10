<?php

use App\Enums\PermissionName;
use App\Enums\RoleName;
use App\Models\AuditLog;
use App\Models\User;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (PermissionName::cases() as $permissionName) {
        Permission::findOrCreate($permissionName->value);
    }
});

function adminUserEditor(PermissionName $permission): User
{
    $user = User::factory()->create();
    $user->givePermissionTo($permission->value);

    return $user;
}

it('forbids user and role updates without their dedicated permissions', function () {
    $user = User::factory()->create();
    $role = Role::findOrCreate(RoleName::Management->value);

    $this->actingAs(User::factory()->create())
        ->putJson(route('admin_users.update', $user), ['role_names' => []])
        ->assertForbidden();

    $this->actingAs(User::factory()->create())
        ->putJson(route('admin_roles.update', $role), ['permission_names' => []])
        ->assertForbidden();
});

it('synchronizes user roles and records the change', function () {
    $editor = adminUserEditor(PermissionName::ManageUsers);
    $target = User::factory()->create();
    Role::findOrCreate(RoleName::Management->value);
    Role::findOrCreate(RoleName::ProjectManager->value);

    $this->actingAs($editor)
        ->putJson(route('admin_users.update', $target), [
            'role_names' => [RoleName::Management->value, RoleName::ProjectManager->value],
        ])
        ->assertSuccessful();

    expect($target->fresh()->getRoleNames()->sort()->values()->all())->toBe([
        RoleName::Management->value,
        RoleName::ProjectManager->value,
    ]);

    $audit = AuditLog::query()->sole();

    expect($audit->user_id)->toBe($editor->id)
        ->and($audit->before)->toMatchArray(['role_names' => []])
        ->and($audit->after)->toMatchArray([
            'role_names' => [RoleName::Management->value, RoleName::ProjectManager->value],
        ]);
});

it('does not allow removing the final administrator', function () {
    $editor = adminUserEditor(PermissionName::ManageUsers);
    $target = User::factory()->create();
    $adminRole = Role::findOrCreate(RoleName::Admin->value);
    Role::findOrCreate(RoleName::Management->value);
    $target->assignRole($adminRole);

    $this->actingAs($editor)
        ->putJson(route('admin_users.update', $target), [
            'role_names' => [RoleName::Management->value],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['role_names']);

    expect($target->fresh()->hasRole(RoleName::Admin->value))->toBeTrue()
        ->and(AuditLog::query()->count())->toBe(0);
});

it('synchronizes role permissions while preserving mandatory admin capabilities', function () {
    $editor = adminUserEditor(PermissionName::ManageRolesAndPermissions);
    $adminRole = Role::findOrCreate(RoleName::Admin->value);
    $requiredPermissions = [
        PermissionName::ManageUsers->value,
        PermissionName::ManageRolesAndPermissions->value,
        PermissionName::ManageSettings->value,
    ];
    $adminRole->syncPermissions($requiredPermissions);

    $this->actingAs($editor)
        ->putJson(route('admin_roles.update', $adminRole), [
            'permission_names' => [PermissionName::ViewManagement->value],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['permission_names']);

    $this->actingAs($editor)
        ->putJson(route('admin_roles.update', $adminRole), [
            'permission_names' => [
                ...$requiredPermissions,
                PermissionName::ViewManagement->value,
            ],
        ])
        ->assertSuccessful();

    expect($adminRole->fresh()->permissions->pluck('name')->sort()->values()->all())->toBe([
        PermissionName::ViewManagement->value,
        PermissionName::ManageRolesAndPermissions->value,
        PermissionName::ManageSettings->value,
        PermissionName::ManageUsers->value,
    ]);

    $audit = AuditLog::query()->sole();

    expect($audit->user_id)->toBe($editor->id)
        ->and($audit->before)->toMatchArray(['permission_names' => $requiredPermissions])
        ->and($audit->after)->toMatchArray([
            'permission_names' => [
                ...$requiredPermissions,
                PermissionName::ViewManagement->value,
            ],
        ]);
});
