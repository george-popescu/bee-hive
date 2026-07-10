<?php

use App\Enums\PermissionName;
use App\Models\AuditLog;
use App\Models\Person;
use App\Models\Project;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;

beforeEach(function () {
    $this->withoutVite();

    foreach ([
        PermissionName::ManageSettings,
        PermissionName::ManageUsers,
        PermissionName::ManageRolesAndPermissions,
    ] as $permission) {
        Permission::findOrCreate($permission->value);
    }
});

function adminSettingsEditor(): User
{
    $user = User::factory()->create();
    $user->givePermissionTo(PermissionName::ManageSettings->value);

    return $user;
}

it('protects the admin page and exposes all administration collections', function () {
    $this->get(route('admin.index'))->assertRedirect(route('login'));

    $this->actingAs(User::factory()->create())
        ->get(route('admin.index'))
        ->assertForbidden();

    $user = adminSettingsEditor();
    $user->givePermissionTo([
        PermissionName::ManageUsers->value,
        PermissionName::ManageRolesAndPermissions->value,
    ]);
    Person::factory()->create();
    Project::factory()->create();

    $this->actingAs($user)
        ->get(route('admin.index'))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/index', false)
            ->has('people')
            ->has('projects')
            ->has('managers')
            ->has('users')
            ->has('roles')
            ->has('permissions')
            ->has('settings')
            ->has('auditLogs'));
});

it('updates only operational person fields and records before and after values', function () {
    $user = adminSettingsEditor();
    $linkedUser = User::factory()->create();
    $person = Person::factory()->create([
        'user_id' => $linkedUser,
        'clickup_user_id' => 'clickup-identity-1',
        'name' => 'Identitate ClickUp',
        'email' => 'clickup@example.test',
        'job_role' => 'Developer',
        'default_monthly_capacity_hours' => 138,
        'weekly_capacity_hours' => 40,
        'hourly_rate' => 50,
        'active' => true,
    ]);

    $this->actingAs($user)
        ->putJson(route('admin_people.update', $person), [
            'job_role' => 'Tech Lead',
            'default_monthly_capacity_hours' => 152,
            'weekly_capacity_hours' => 36,
            'hourly_rate' => 75.5,
            'active' => false,
            'user_id' => User::factory()->create()->id,
            'clickup_user_id' => 'changed-remotely',
            'name' => 'Nume schimbat',
            'email' => 'changed@example.test',
            'is_external' => true,
        ])
        ->assertSuccessful();

    $person->refresh();
    $audit = AuditLog::query()->sole();

    expect($person->job_role)->toBe('Tech Lead')
        ->and($person->default_monthly_capacity_hours)->toBe('152.00')
        ->and($person->weekly_capacity_hours)->toBe('36.00')
        ->and($person->hourly_rate)->toBe('75.50')
        ->and($person->active)->toBeFalse()
        ->and($person->manually_inactive)->toBeTrue()
        ->and($person->user_id)->toBe($linkedUser->id)
        ->and($person->clickup_user_id)->toBe('clickup-identity-1')
        ->and($person->name)->toBe('Identitate ClickUp')
        ->and($person->email)->toBe('clickup@example.test')
        ->and($person->is_external)->toBeFalse()
        ->and($audit->user_id)->toBe($user->id)
        ->and($audit->before)->toMatchArray([
            'job_role' => 'Developer',
            'default_monthly_capacity_hours' => 138,
            'weekly_capacity_hours' => 40,
            'hourly_rate' => 50,
            'active' => true,
        ])
        ->and($audit->after)->toMatchArray([
            'job_role' => 'Tech Lead',
            'default_monthly_capacity_hours' => 152,
            'weekly_capacity_hours' => 36,
            'hourly_rate' => 75.5,
            'active' => false,
        ]);
});

it('validates person capacity rate and role fields', function () {
    $person = Person::factory()->create();

    $this->actingAs(adminSettingsEditor())
        ->putJson(route('admin_people.update', $person), [
            'job_role' => str_repeat('x', 256),
            'default_monthly_capacity_hours' => -1,
            'weekly_capacity_hours' => -1,
            'hourly_rate' => -1,
            'active' => true,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors([
            'job_role',
            'default_monthly_capacity_hours',
            'weekly_capacity_hours',
            'hourly_rate',
        ]);

    expect(AuditLog::query()->count())->toBe(0);
});
