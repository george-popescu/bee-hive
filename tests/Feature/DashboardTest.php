<?php

use App\Enums\PermissionName;
use App\Enums\SyncRunStatus;
use App\Models\Allocation;
use App\Models\Person;
use App\Models\Project;
use App\Models\SyncRun;
use App\Models\Team;
use App\Models\TimeEntry;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;

beforeEach(function () {
    Permission::findOrCreate(PermissionName::ViewManagement->value);
    Permission::findOrCreate(PermissionName::ViewPmBoards->value);
    Permission::findOrCreate(PermissionName::ViewTeamLead->value);
});

test('guests are redirected to the login page', function () {
    $response = $this->get(route('dashboard'));
    $response->assertRedirect(route('login'));
});

test('authenticated users can visit the dashboard', function () {
    $user = User::factory()->create();
    SyncRun::factory()->create([
        'status' => SyncRunStatus::Failed,
        'error_message' => 'Sensitive ClickUp error details',
    ]);
    $this->actingAs($user);

    $response = $this->get(route('dashboard'));
    $response->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('dashboard')
        ->where('dashboard.scope.mode', 'empty')
        ->where('dashboard.kpis.people', 0)
        ->where('dashboard.sync', null));
});

it('builds an executive company overview from the active month', function () {
    $this->travelTo('2026-07-11 12:00:00');
    $user = User::factory()->create();
    $user->givePermissionTo(PermissionName::ViewManagement->value);
    $person = Person::factory()->create([
        'name' => 'Ana Developer',
        'default_monthly_capacity_hours' => 160,
    ]);
    $inactivePerson = Person::factory()->create([
        'active' => false,
        'default_monthly_capacity_hours' => 160,
    ]);
    $project = Project::factory()->create([
        'client' => 'Acme',
        'name' => 'Portal',
    ]);
    Allocation::factory()->create([
        'person_id' => $person,
        'project_id' => $project,
        'month' => '2026-07-01',
        'planned_hours' => 120,
    ]);
    TimeEntry::factory()->create([
        'person_id' => $person,
        'project_id' => $project,
        'started_at' => '2026-07-08 09:00:00',
        'duration_seconds' => 90 * 3600,
    ]);
    Allocation::factory()->create([
        'person_id' => $inactivePerson,
        'project_id' => $project,
        'month' => '2026-07-01',
        'planned_hours' => 80,
    ]);
    TimeEntry::factory()->create([
        'person_id' => $inactivePerson,
        'project_id' => $project,
        'started_at' => '2026-07-08 09:00:00',
        'duration_seconds' => 40 * 3600,
    ]);
    SyncRun::factory()->create([
        'status' => SyncRunStatus::Succeeded,
        'started_at' => '2026-07-11 10:00:00',
        'finished_at' => '2026-07-11 10:02:00',
    ]);

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->where('dashboard.scope.label', 'Toată compania')
            ->where('dashboard.focusMonth.key', '2026-07')
            ->where('dashboard.kpis.capacityHours', 160)
            ->where('dashboard.kpis.plannedHours', 120)
            ->where('dashboard.kpis.actualHours', 90)
            ->where('dashboard.kpis.planningPercent', 75)
            ->where('dashboard.kpis.utilizationPercent', 56.3)
            ->where('dashboard.kpis.activePeople', 1)
            ->has('dashboard.projects', 1)
            ->where('dashboard.projects.0.label', 'Acme — Portal')
            ->where('dashboard.projects.0.plannedHours', 120)
            ->where('dashboard.projects.0.actualHours', 90)
            ->where('dashboard.attention.0.name', 'Ana Developer')
            ->where('dashboard.attention.0.status', 'under')
            ->where('dashboard.sync.status', 'succeeded'));
});

it('limits a project manager dashboard to managed projects', function () {
    $this->travelTo('2026-07-11 12:00:00');
    $user = User::factory()->create();
    $user->givePermissionTo(PermissionName::ViewPmBoards->value);
    $manager = Person::factory()->create(['user_id' => $user]);
    $visiblePerson = Person::factory()->create([
        'name' => 'Ana Vizibilă',
        'default_monthly_capacity_hours' => 160,
    ]);
    $hiddenPerson = Person::factory()->create([
        'name' => 'Bogdan Ascuns',
        'default_monthly_capacity_hours' => 160,
    ]);
    $managedProject = Project::factory()->create([
        'client' => 'Acme',
        'name' => 'Portal',
    ]);
    $outsideProject = Project::factory()->create([
        'client' => 'Secret',
        'name' => 'Outside',
    ]);
    $managedProject->managers()->attach($manager);

    Allocation::factory()->create([
        'person_id' => $visiblePerson,
        'project_id' => $managedProject,
        'month' => '2026-07-01',
        'planned_hours' => 40,
    ]);
    TimeEntry::factory()->create([
        'person_id' => $visiblePerson,
        'project_id' => $managedProject,
        'started_at' => '2026-07-08 09:00:00',
        'duration_seconds' => 10 * 3600,
    ]);
    Allocation::factory()->create([
        'person_id' => $hiddenPerson,
        'project_id' => $outsideProject,
        'month' => '2026-07-01',
        'planned_hours' => 150,
    ]);
    TimeEntry::factory()->create([
        'person_id' => $hiddenPerson,
        'project_id' => $outsideProject,
        'started_at' => '2026-07-08 09:00:00',
        'duration_seconds' => 80 * 3600,
    ]);

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->where('dashboard.scope.label', 'Proiectele mele')
            ->where('dashboard.kpis.people', 1)
            ->where('dashboard.kpis.plannedHours', 40)
            ->where('dashboard.kpis.actualHours', 10)
            ->has('dashboard.projects', 1)
            ->where('dashboard.projects.0.label', 'Acme — Portal')
            ->where('dashboard.attention.0.name', 'Ana Vizibilă'));
});

it('limits a team lead dashboard to people in teams they lead', function () {
    $this->travelTo('2026-07-11 12:00:00');
    $user = User::factory()->create();
    $user->givePermissionTo(PermissionName::ViewTeamLead->value);
    $lead = Person::factory()->create([
        'user_id' => $user,
        'default_monthly_capacity_hours' => 160,
    ]);
    $visiblePerson = Person::factory()->create(['default_monthly_capacity_hours' => 160]);
    $hiddenPerson = Person::factory()->create(['default_monthly_capacity_hours' => 160]);
    $team = Team::factory()->create();
    $project = Project::factory()->create();
    $team->people()->attach($lead, ['is_lead' => true]);
    $team->people()->attach($visiblePerson);

    Allocation::factory()->create([
        'person_id' => $visiblePerson,
        'project_id' => $project,
        'month' => '2026-07-01',
        'planned_hours' => 60,
    ]);
    Allocation::factory()->create([
        'person_id' => $hiddenPerson,
        'project_id' => $project,
        'month' => '2026-07-01',
        'planned_hours' => 140,
    ]);

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->where('dashboard.scope.label', 'Echipa mea')
            ->where('dashboard.kpis.people', 2)
            ->where('dashboard.kpis.capacityHours', 320)
            ->where('dashboard.kpis.plannedHours', 60));
});
