<?php

use App\Enums\PermissionName;
use App\Models\Allocation;
use App\Models\Person;
use App\Models\Project;
use App\Models\Team;
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
