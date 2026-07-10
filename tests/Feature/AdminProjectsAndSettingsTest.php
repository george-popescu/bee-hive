<?php

use App\Enums\PermissionName;
use App\Enums\ProjectBoardTemplate;
use App\Enums\SettingKey;
use App\Models\AuditLog;
use App\Models\Person;
use App\Models\Project;
use App\Models\Setting;
use App\Models\User;
use Spatie\Permission\Models\Permission;

beforeEach(function () {
    Permission::findOrCreate(PermissionName::ManageSettings->value);
});

function adminProjectSettingsEditor(): User
{
    $user = User::factory()->create();
    $user->givePermissionTo(PermissionName::ManageSettings->value);

    return $user;
}

it('forbids project updates without settings permission', function () {
    $this->actingAs(User::factory()->create())
        ->putJson(route('admin_projects.update', Project::factory()->create()), [])
        ->assertForbidden();
});

it('updates project configuration managers and audit history', function () {
    $user = adminProjectSettingsEditor();
    $project = Project::factory()->create([
        'contract_type' => ProjectBoardTemplate::TimeAndMaterials,
        'board_visible' => true,
        'active' => true,
        'board_config' => null,
    ]);
    $firstManager = Person::factory()->create(['name' => 'Ana Manager']);
    $secondManager = Person::factory()->create(['name' => 'Bogdan Manager']);
    Person::factory()->create(['name' => 'Ana Developer']);
    Person::factory()->create(['name' => 'Bogdan QA']);

    $this->actingAs($user)
        ->putJson(route('admin_projects.update', $project), [
            'contract_type' => 'deliverables',
            'board_visible' => false,
            'active' => false,
            'manager_ids' => [$firstManager->id, $secondManager->id],
            'excluded_task_ids' => ['recurring-1', 'recurring-2'],
            'allowed_resource_names' => ['Ana Developer', 'Bogdan QA'],
        ])
        ->assertSuccessful();

    $project->refresh();
    $audit = AuditLog::query()->sole();

    expect($project->contract_type)->toBe(ProjectBoardTemplate::Deliverables)
        ->and($project->board_visible)->toBeFalse()
        ->and($project->active)->toBeFalse()
        ->and($project->managers()->orderBy('people.id')->pluck('people.id')->all())->toBe([
            $firstManager->id,
            $secondManager->id,
        ])
        ->and($project->board_config)->toMatchArray([
            'excluded_task_ids' => ['recurring-1', 'recurring-2'],
            'allowed_resource_names' => ['Ana Developer', 'Bogdan QA'],
        ])
        ->and($audit->user_id)->toBe($user->id)
        ->and($audit->before)->toMatchArray([
            'contract_type' => 'tm',
            'board_visible' => true,
            'active' => true,
            'manager_ids' => [],
        ])
        ->and($audit->after)->toMatchArray([
            'contract_type' => 'deliverables',
            'board_visible' => false,
            'active' => false,
            'manager_ids' => [$firstManager->id, $secondManager->id],
        ]);
});

it('validates project template active distinct managers and unique board lists', function () {
    $project = Project::factory()->create();
    $inactiveManager = Person::factory()->create(['active' => false]);

    $this->actingAs(adminProjectSettingsEditor())
        ->putJson(route('admin_projects.update', $project), [
            'contract_type' => 'unsupported',
            'board_visible' => true,
            'active' => true,
            'manager_ids' => [$inactiveManager->id, $inactiveManager->id],
            'excluded_task_ids' => ['duplicate', 'duplicate'],
            'allowed_resource_names' => ['Ana', 'Ana'],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors([
            'contract_type',
            'manager_ids.0',
            'manager_ids.1',
            'excluded_task_ids.1',
            'allowed_resource_names.1',
        ]);

    expect(AuditLog::query()->count())->toBe(0);
});

it('updates planning and capacity settings with one audit record', function () {
    $user = adminProjectSettingsEditor();

    $this->actingAs($user)
        ->putJson(route('admin_settings.update'), [
            'active_period_start' => '2026-05',
            'active_period_end' => '2026-12',
            'default_monthly_capacity_hours' => 144,
            'hours_per_leave_day' => 7.5,
        ])
        ->assertSuccessful();

    expect(Setting::query()->where('key', SettingKey::ActivePeriodStart->value)->value('value'))
        ->toBe(['value' => '2026-05'])
        ->and(Setting::query()->where('key', SettingKey::ActivePeriodEnd->value)->value('value'))
        ->toBe(['value' => '2026-12'])
        ->and(Setting::query()->where('key', SettingKey::DefaultMonthlyCapacityHours->value)->value('value'))
        ->toBe(['value' => 144])
        ->and(Setting::query()->where('key', SettingKey::HoursPerLeaveDay->value)->value('value'))
        ->toBe(['value' => 7.5]);

    $audit = AuditLog::query()->sole();

    expect($audit->user_id)->toBe($user->id)
        ->and($audit->before)->toBeArray()
        ->and($audit->after)->toMatchArray([
            'active_period_start' => '2026-05',
            'active_period_end' => '2026-12',
            'default_monthly_capacity_hours' => 144,
            'hours_per_leave_day' => 7.5,
        ]);
});

it('validates settings period order and positive hour values', function () {
    $this->actingAs(adminProjectSettingsEditor())
        ->putJson(route('admin_settings.update'), [
            'active_period_start' => '2026-12',
            'active_period_end' => '2026-05',
            'default_monthly_capacity_hours' => 0,
            'hours_per_leave_day' => 0,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors([
            'active_period_end',
            'default_monthly_capacity_hours',
            'hours_per_leave_day',
        ]);

    expect(AuditLog::query()->count())->toBe(0);
});
