<?php

use App\Enums\PermissionName;
use App\Models\Allocation;
use App\Models\Person;
use App\Models\Project;
use App\Models\Team;
use App\Models\User;
use Spatie\Permission\Models\Permission;

beforeEach(function () {
    Permission::findOrCreate(PermissionName::ManageAllocations->value);
});

function allocationEditor(): array
{
    $user = User::factory()->create();
    $user->givePermissionTo(PermissionName::ManageAllocations->value);
    $lead = Person::factory()->create(['user_id' => $user]);
    $person = Person::factory()->create();
    $team = Team::factory()->create();
    $team->people()->attach($lead, ['is_lead' => true]);
    $team->people()->attach($person);
    $project = Project::factory()->create();
    Allocation::factory()->create([
        'person_id' => $person,
        'project_id' => $project,
        'role' => 'Range',
        'month' => '2026-05-01',
    ]);
    Allocation::factory()->create([
        'person_id' => $person,
        'project_id' => $project,
        'role' => 'Range',
        'month' => '2026-12-01',
    ]);

    return [$user, $person, $project];
}

it('creates and updates one allocation cell idempotently with audit users', function () {
    [$user, $person, $project] = allocationEditor();
    $payload = [
        'person_id' => $person->id,
        'project_id' => $project->id,
        'role' => 'BE Dev',
        'month' => '2026-07',
        'planned_hours' => 41.25,
    ];

    $this->actingAs($user)->putJson(route('allocations.upsert'), $payload)
        ->assertSuccessful()
        ->assertJsonPath('allocation.planned_hours', 41.25);
    $this->actingAs($user)->putJson(route('allocations.upsert'), [...$payload, 'planned_hours' => 44.5])
        ->assertSuccessful()
        ->assertJsonPath('allocation.planned_hours', 44.5);

    $allocation = Allocation::query()
        ->where('person_id', $person->id)
        ->where('project_id', $project->id)
        ->where('role', 'BE Dev')
        ->whereDate('month', '2026-07-01')
        ->sole();

    expect($allocation->planned_hours)->toBe('44.50')
        ->and($allocation->created_by)->toBe($user->id)
        ->and($allocation->updated_by)->toBe($user->id);
});

it('prevents editing people outside the led team', function () {
    [$user, , $project] = allocationEditor();

    $this->actingAs($user)->putJson(route('allocations.upsert'), [
        'person_id' => Person::factory()->create()->id,
        'project_id' => $project->id,
        'role' => 'QA',
        'month' => '2026-07',
        'planned_hours' => 8,
    ])->assertForbidden();
});

it('validates quarter-hour steps and the active planning period', function () {
    [$user, $person, $project] = allocationEditor();

    $this->actingAs($user)->putJson(route('allocations.upsert'), [
        'person_id' => $person->id,
        'project_id' => $project->id,
        'role' => 'QA',
        'month' => '2026-07',
        'planned_hours' => 1.1,
    ])->assertUnprocessable()->assertJsonValidationErrors(['planned_hours']);

    $this->actingAs($user)->putJson(route('allocations.upsert'), [
        'person_id' => $person->id,
        'project_id' => $project->id,
        'role' => 'QA',
        'month' => '2027-01',
        'planned_hours' => 1.25,
    ])->assertUnprocessable()->assertJsonValidationErrors(['month']);
});

it('forbids users without allocation permission', function () {
    [, $person, $project] = allocationEditor();

    $this->actingAs(User::factory()->create())->putJson(route('allocations.upsert'), [
        'person_id' => $person->id,
        'project_id' => $project->id,
        'role' => 'QA',
        'month' => '2026-07',
        'planned_hours' => 8,
    ])->assertForbidden();
});
