<?php

use App\Enums\PermissionName;
use App\Models\ActualAdjustment;
use App\Models\Allocation;
use App\Models\Person;
use App\Models\Project;
use App\Models\Team;
use App\Models\TimeEntry;
use App\Models\TimeOff;
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
            ->has('teams', 1)
            ->where('teams.0.id', $team->id)
            ->where('weekly.rows.0.teamIds', [$team->id])
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
        'effective_date' => '2026-05-21',
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
            ->where('adjustments.0.effectiveDate', '2026-05-21')
            ->where('adjustments.0.hoursDelta', 4)
            ->where('adjustments.0.isReversed', false)
            ->where('permissions.adjustActualHours', true));
});

it('builds weekly capacity from contract hours approved leave and monthly allocations', function () {
    $user = User::factory()->create();
    $user->givePermissionTo(PermissionName::ViewTeamLead->value, PermissionName::ViewManagement->value);
    $person = Person::factory()->create([
        'name' => 'Ana Planificată',
        'job_role' => 'BE Dev',
        'default_monthly_capacity_hours' => 160,
        'weekly_capacity_hours' => 40,
    ]);
    $project = Project::factory()->create(['client' => 'Acme', 'name' => 'Portal']);
    Allocation::factory()->create([
        'person_id' => $person,
        'project_id' => $project,
        'role' => 'BE Dev',
        'month' => '2026-07-01',
        'planned_hours' => 92,
    ]);
    TimeOff::factory()->create([
        'person_id' => $person,
        'status' => 'approved',
        'start_date' => '2026-07-14',
        'end_date' => '2026-07-14',
        'active' => true,
    ]);

    $this->actingAs($user)
        ->get(route('team_lead.index', ['week' => '2026-07-13']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('weekly.period.start', '2026-07-13')
            ->where('weekly.period.end', '2026-07-19')
            ->where('weekly.allocationMethod', 'weekly_with_monthly_fallback')
            ->where('weekly.rows.0.person.name', 'Ana Planificată')
            ->where('weekly.rows.0.contractHours', 40)
            ->where('weekly.rows.0.leaveHours', 8)
            ->where('weekly.rows.0.availableHours', 32)
            ->where('weekly.rows.0.allocatedHours', 20)
            ->where('weekly.rows.0.freeHours', 12)
            ->where('weekly.rows.0.allocations.0.label', 'Acme — Portal')
            ->where('capacityRows.0.months.2026-07.grossHours', 160)
            ->where('capacityRows.0.months.2026-07.leaveHours', 8)
            ->where('capacityRows.0.months.2026-07.availableHours', 152)
            ->where('capacityRows.0.months.2026-07.allocatedHours', 92)
            ->where('capacityRows.0.months.2026-07.actualHours', null)
            ->has('allocationEntries', 1));
});

it('uses saved weekly distribution before the monthly proration fallback', function () {
    $user = User::factory()->create();
    $user->givePermissionTo(PermissionName::ViewTeamLead->value, PermissionName::ViewManagement->value);
    $person = Person::factory()->create(['weekly_capacity_hours' => 40]);
    $project = Project::factory()->create(['client' => 'Acme', 'name' => 'Portal']);
    Allocation::factory()->create([
        'person_id' => $person,
        'project_id' => $project,
        'month' => '2026-07-01',
        'planned_hours' => 24,
        'weekly_hours' => [
            ['week_start' => '2026-07-06', 'hours' => 8],
            ['week_start' => '2026-07-13', 'hours' => 16],
        ],
        'planning_comment' => 'Prioritate pentru lansare.',
    ]);

    $this->actingAs($user)
        ->get(route('team_lead.index', ['week' => '2026-07-13']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('weekly.rows.0.allocatedHours', 16)
            ->where('weekly.rows.0.allocations.0.source', 'weekly')
            ->where('allocationEntries.0.weeklyHours.1.hours', 16)
            ->where('allocationEntries.0.planningComment', 'Prioritate pentru lansare.'));
});
