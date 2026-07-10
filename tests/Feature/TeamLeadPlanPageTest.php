<?php

use App\Enums\PermissionName;
use App\Models\ActualAdjustment;
use App\Models\Allocation;
use App\Models\Person;
use App\Models\Project;
use App\Models\Team;
use App\Models\TimeEntry;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;

beforeEach(function () {
    Permission::findOrCreate(PermissionName::ViewTeamLead->value);
    Permission::findOrCreate(PermissionName::ViewManagement->value);
    Permission::findOrCreate(PermissionName::ManageAllocations->value);
    Permission::findOrCreate(PermissionName::AdjustActualHours->value);
});

it('redirects guests and forbids users without the view permission', function () {
    $this->get(route('team_lead.index'))->assertRedirect(route('login'));

    $this->actingAs(User::factory()->create())
        ->get(route('team_lead.index'))
        ->assertForbidden();
});

it('shows a team lead only the active people in teams they lead', function () {
    $user = User::factory()->create();
    $user->givePermissionTo(PermissionName::ViewTeamLead->value, PermissionName::ManageAllocations->value);
    $lead = Person::factory()->create(['user_id' => $user]);
    $visiblePerson = Person::factory()->create(['name' => 'Ana Vizibilă']);
    $hiddenPerson = Person::factory()->create(['name' => 'Bogdan Ascuns']);
    $team = Team::factory()->create();
    $team->people()->attach($lead, ['is_lead' => true]);
    $team->people()->attach($visiblePerson);
    $project = Project::factory()->create(['client' => 'Acme', 'name' => 'Portal']);
    Allocation::factory()->create([
        'person_id' => $visiblePerson,
        'project_id' => $project,
        'role' => 'BE Dev',
        'month' => '2026-05-01',
        'planned_hours' => 40,
    ]);
    Allocation::factory()->create([
        'person_id' => $visiblePerson,
        'project_id' => $project,
        'role' => 'BE Dev',
        'month' => '2026-12-01',
        'planned_hours' => 20,
    ]);
    Allocation::factory()->create([
        'person_id' => $hiddenPerson,
        'project_id' => $project,
        'month' => '2026-07-01',
    ]);

    $this->actingAs($user)
        ->get(route('team_lead.index'))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->component('team-lead/index')
            ->has('months', 8)
            ->where('months.0.key', '2026-05')
            ->where('months.7.key', '2026-12')
            ->has('planRows', 1)
            ->where('planRows.0.person.name', 'Ana Vizibilă')
            ->where('planRows.0.project.label', 'Acme — Portal')
            ->where('planRows.0.hours.2026-05', 40)
            ->where('comparisonRows.0.months.2026-05.actual', null)
            ->where('comparisonRows.0.months.2026-05.status', 'empty')
            ->where('permissions.manageAllocations', true));
});

it('gives management a global read-only scope', function () {
    $user = User::factory()->create();
    $user->givePermissionTo(PermissionName::ViewTeamLead->value, PermissionName::ViewManagement->value);
    $person = Person::factory()->create();
    Allocation::factory()->create([
        'person_id' => $person,
        'month' => '2026-07-01',
    ]);

    $this->actingAs($user)
        ->get(route('team_lead.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('planRows', 1)
            ->where('permissions.manageAllocations', false));
});

it('aggregates ClickUp hours and audited adjustments for comparison including internal and external work', function () {
    $user = User::factory()->create();
    $user->givePermissionTo(
        PermissionName::ViewTeamLead->value,
        PermissionName::ViewManagement->value,
        PermissionName::AdjustActualHours->value,
    );
    $person = Person::factory()->create([
        'name' => 'Ana Externă',
        'is_external' => true,
    ]);
    $project = Project::factory()->create(['client' => 'Acme', 'name' => 'Portal']);
    Allocation::factory()->create([
        'person_id' => $person,
        'project_id' => $project,
        'role' => 'BE Dev',
        'month' => '2026-05-01',
        'planned_hours' => 40,
    ]);
    Allocation::factory()->create([
        'person_id' => $person,
        'project_id' => $project,
        'role' => 'BE Dev',
        'month' => '2026-12-01',
        'planned_hours' => 0,
    ]);
    TimeEntry::factory()->create([
        'person_id' => $person,
        'project_id' => $project,
        'source_label' => 'Acme — Portal',
        'started_at' => '2026-05-12 09:00:00',
        'duration_seconds' => 36 * 3600,
    ]);
    TimeEntry::factory()->create([
        'person_id' => $person,
        'project_id' => null,
        'source_label' => 'Training',
        'started_at' => '2026-05-13 09:00:00',
        'duration_seconds' => 2 * 3600,
    ]);
    ActualAdjustment::factory()->create([
        'person_id' => $person,
        'project_id' => $project,
        'internal_label' => null,
        'month' => '2026-05-01',
        'hours_delta' => 4,
        'created_by' => $user,
        'created_by_name' => $user->name,
    ]);

    $this->actingAs($user)
        ->get(route('team_lead.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('comparisonRows', 2)
            ->where('comparisonRows.0.person.isExternal', true)
            ->where('comparisonRows.0.project.label', 'Acme — Portal')
            ->where('comparisonRows.0.months.2026-05.planned', 40)
            ->where('comparisonRows.0.months.2026-05.actual', 40)
            ->where('comparisonRows.0.months.2026-05.status', 'on-plan')
            ->where('comparisonRows.1.project.label', 'Training')
            ->where('comparisonRows.1.project.internal', true)
            ->where('comparisonRows.1.months.2026-05.planned', 0)
            ->where('comparisonRows.1.months.2026-05.actual', 2)
            ->where('comparisonRows.1.months.2026-05.status', 'unplanned')
            ->has('adjustments', 1)
            ->where('adjustments.0.hoursDelta', 4)
            ->where('adjustments.0.isReversed', false)
            ->where('permissions.adjustActualHours', true));
});
