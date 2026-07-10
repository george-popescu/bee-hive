<?php

use App\Contracts\ClickUpClient;
use App\Enums\PermissionName;
use App\Enums\RoleName;
use App\Models\AuditLog;
use App\Models\Person;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Services\ClickUp\PeopleSynchronizer;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

use function Pest\Laravel\mock;

beforeEach(function () {
    $this->withoutVite();

    foreach (PermissionName::cases() as $permissionName) {
        Permission::findOrCreate($permissionName->value);
    }
});

function adminRegressionUser(PermissionName $permission): User
{
    $user = User::factory()->create();
    $user->givePermissionTo($permission->value);

    return $user;
}

function failAdminRegressionAudit(): void
{
    mock(AuditLogger::class)
        ->shouldReceive('log')
        ->once()
        ->andThrow(new RuntimeException('Simulated audit failure.'));
}

it('prevents the final administrator from deleting their own profile', function () {
    $admin = User::factory()->create();
    $admin->assignRole(Role::findOrCreate(RoleName::Admin->value));

    $this->actingAs($admin)
        ->delete(route('profile.destroy'), ['password' => 'password'])
        ->assertSessionHasErrors(['password']);

    expect($admin->fresh())->not->toBeNull()
        ->and(User::role(RoleName::Admin->value)->count())->toBe(1);
});

it('requires role administration permission before assigning the admin role', function () {
    $editor = adminRegressionUser(PermissionName::ManageUsers);
    $target = User::factory()->create();
    Role::findOrCreate(RoleName::Admin->value);

    $this->actingAs($editor)
        ->putJson(route('admin_users.update', $target), [
            'role_names' => [RoleName::Admin->value],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['role_names']);

    expect($target->fresh()->hasRole(RoleName::Admin->value))->toBeFalse()
        ->and(AuditLog::query()->count())->toBe(0);
});

it('blocks privileged non admin roles from users-only administrators', function () {
    $editor = adminRegressionUser(PermissionName::ManageUsers);
    $target = User::factory()->create();
    $privilegedRole = Role::findOrCreate(RoleName::Management->value);
    $privilegedRole->givePermissionTo(PermissionName::ManageSettings->value);

    $this->actingAs($editor)
        ->putJson(route('admin_users.update', $target), [
            'role_names' => [RoleName::Management->value],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['role_names']);

    expect($target->fresh()->getRoleNames())->toBeEmpty()
        ->and(AuditLog::query()->count())->toBe(0);
});

it('does not expose security administration data to settings-only users', function () {
    $user = adminRegressionUser(PermissionName::ManageSettings);

    $this->actingAs($user)
        ->get(route('admin.index'))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/index', false)
            ->has('people')
            ->has('projects')
            ->has('managers')
            ->has('settings')
            ->missing('users')
            ->missing('roles')
            ->missing('permissions')
            ->missing('auditLogs'));
});

it('rolls back a user role mutation when its audit record cannot be written', function () {
    $this->withoutExceptionHandling();
    $editor = adminRegressionUser(PermissionName::ManageUsers);
    $target = User::factory()->create();
    $teamLead = Role::findOrCreate(RoleName::TeamLead->value);
    Role::findOrCreate(RoleName::Management->value);
    Role::findOrCreate(RoleName::Admin->value);
    $target->assignRole($teamLead);
    failAdminRegressionAudit();

    expect(fn () => $this->actingAs($editor)
        ->putJson(route('admin_users.update', $target), [
            'role_names' => [RoleName::Management->value],
        ]))->toThrow(RuntimeException::class, 'Simulated audit failure.');

    expect($target->fresh()->getRoleNames()->all())->toBe([RoleName::TeamLead->value])
        ->and(AuditLog::query()->count())->toBe(0);
});

it('rolls back a role permission mutation when its audit record cannot be written', function () {
    $this->withoutExceptionHandling();
    $editor = adminRegressionUser(PermissionName::ManageRolesAndPermissions);
    $role = Role::findOrCreate(RoleName::Management->value);
    $role->syncPermissions([PermissionName::ViewManagement->value]);
    failAdminRegressionAudit();

    expect(fn () => $this->actingAs($editor)
        ->putJson(route('admin_roles.update', $role), [
            'permission_names' => [PermissionName::ViewTeamLead->value],
        ]))->toThrow(RuntimeException::class, 'Simulated audit failure.');

    expect($role->fresh()->permissions()->pluck('name')->all())
        ->toBe([PermissionName::ViewManagement->value])
        ->and(AuditLog::query()->count())->toBe(0);
});

it('rolls back a person mutation when its audit record cannot be written', function () {
    $this->withoutExceptionHandling();
    $editor = adminRegressionUser(PermissionName::ManageSettings);
    $person = Person::factory()->create([
        'job_role' => 'Developer',
        'default_monthly_capacity_hours' => 138,
        'weekly_capacity_hours' => 40,
        'hourly_rate' => 50,
        'active' => true,
    ]);
    failAdminRegressionAudit();

    expect(fn () => $this->actingAs($editor)
        ->putJson(route('admin_people.update', $person), [
            'job_role' => 'Tech Lead',
            'default_monthly_capacity_hours' => 152,
            'weekly_capacity_hours' => 36,
            'hourly_rate' => 75,
            'active' => false,
        ]))->toThrow(RuntimeException::class, 'Simulated audit failure.');

    $person->refresh();

    expect($person->job_role)->toBe('Developer')
        ->and($person->default_monthly_capacity_hours)->toBe('138.00')
        ->and($person->weekly_capacity_hours)->toBe('40.00')
        ->and($person->hourly_rate)->toBe('50.00')
        ->and($person->active)->toBeTrue()
        ->and(AuditLog::query()->count())->toBe(0);
});

it('preserves an operational deactivation when the person is seen in clickup sync', function () {
    $person = Person::factory()->create([
        'clickup_user_id' => '12345',
        'name' => 'Ana Dezactivată',
        'email' => 'ana-old@example.test',
        'active' => false,
        'manually_inactive' => true,
        'is_external' => false,
    ]);
    mock(ClickUpClient::class)
        ->shouldReceive('members')
        ->once()
        ->andReturn([[
            'id' => '12345',
            'username' => 'Ana Dezactivată',
            'email' => 'ana-new@example.test',
        ]]);

    app(PeopleSynchronizer::class)->sync();

    $person->refresh();

    expect($person->active)->toBeFalse()
        ->and($person->is_external)->toBeFalse()
        ->and($person->email)->toBe('ana-new@example.test');
});
