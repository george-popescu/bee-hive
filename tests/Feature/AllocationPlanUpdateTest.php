<?php

use App\Enums\PermissionName;
use App\Models\Allocation;
use App\Models\AuditLog;
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

it('moves an allocation between people projects and months with an audit record', function () {
    [$user, $person] = allocationEditor();
    $team = $person->teams()->firstOrFail();
    $targetPerson = Person::factory()->create();
    $team->people()->attach($targetPerson);
    $targetProject = Project::factory()->create();
    $allocation = $person->allocations()->whereDate('month', '2026-05-01')->sole();
    $originalHours = (float) $allocation->planned_hours;

    $this->actingAs($user)->putJson(route('allocations.update', $allocation), [
        'person_id' => $targetPerson->id,
        'project_id' => $targetProject->id,
        'role' => 'QA',
        'month' => '2026-07',
        'planned_hours' => 12.25,
    ])->assertSuccessful()
        ->assertJsonPath('allocation.id', $allocation->id)
        ->assertJsonPath('allocation.person_id', $targetPerson->id)
        ->assertJsonPath('allocation.project_id', $targetProject->id)
        ->assertJsonPath('allocation.month', '2026-07')
        ->assertJsonPath('allocation.planned_hours', 12.25);

    $allocation->refresh();

    expect($allocation->person_id)->toBe($targetPerson->id)
        ->and($allocation->project_id)->toBe($targetProject->id)
        ->and($allocation->role)->toBe('QA')
        ->and($allocation->month->format('Y-m'))->toBe('2026-07')
        ->and($allocation->planned_hours)->toBe('12.25');

    $audit = AuditLog::query()->where('action', 'allocation.updated')->sole();

    expect($audit->before)->toMatchArray([
        'person_id' => $person->id,
        'planned_hours' => $originalHours,
    ])->and($audit->after)->toMatchArray([
        'person_id' => $targetPerson->id,
        'project_id' => $targetProject->id,
        'planned_hours' => 12.25,
    ]);
});

it('stores an editable weekly distribution and planning comment', function () {
    [$user, $person, $project] = allocationEditor();

    $this->actingAs($user)->putJson(route('allocations.upsert'), [
        'person_id' => $person->id,
        'project_id' => $project->id,
        'role' => 'QA',
        'month' => '2026-07',
        'planned_hours' => 20,
        'weekly_hours' => [
            ['week_start' => '2026-07-06', 'hours' => 8],
            ['week_start' => '2026-07-13', 'hours' => 12],
        ],
        'planning_comment' => 'Pregătire release și suport QA.',
    ])->assertSuccessful()
        ->assertJsonPath('allocation.weekly_hours.1.hours', 12)
        ->assertJsonPath('allocation.planning_comment', 'Pregătire release și suport QA.');

    $allocation = Allocation::query()
        ->where('person_id', $person->id)
        ->where('project_id', $project->id)
        ->where('role', 'QA')
        ->whereDate('month', '2026-07-01')
        ->sole();

    expect($allocation->weekly_hours)->toBe([
        ['week_start' => '2026-07-06', 'hours' => 8],
        ['week_start' => '2026-07-13', 'hours' => 12],
    ])->and($allocation->planning_comment)->toBe('Pregătire release și suport QA.');
});

it('validates weekly distribution dates and monthly total', function () {
    [$user, $person, $project] = allocationEditor();

    $this->actingAs($user)->putJson(route('allocations.upsert'), [
        'person_id' => $person->id,
        'project_id' => $project->id,
        'role' => 'QA',
        'month' => '2026-07',
        'planned_hours' => 20,
        'weekly_hours' => [
            ['week_start' => '2026-07-07', 'hours' => 8],
            ['week_start' => '2026-08-10', 'hours' => 8],
        ],
    ])->assertUnprocessable()
        ->assertJsonValidationErrors([
            'weekly_hours',
            'weekly_hours.0.week_start',
            'weekly_hours.1.week_start',
        ]);
});

it('clears a stale weekly distribution when the monthly grid changes its total', function () {
    [$user, $person, $project] = allocationEditor();
    $allocation = Allocation::factory()->create([
        'person_id' => $person,
        'project_id' => $project,
        'role' => 'QA',
        'month' => '2026-07-01',
        'planned_hours' => 20,
        'weekly_hours' => [
            ['week_start' => '2026-07-06', 'hours' => 8],
            ['week_start' => '2026-07-13', 'hours' => 12],
        ],
        'planning_comment' => 'Comentariul rămâne relevant.',
    ]);

    $this->actingAs($user)->putJson(route('allocations.upsert'), [
        'person_id' => $person->id,
        'project_id' => $project->id,
        'role' => 'QA',
        'month' => '2026-07',
        'planned_hours' => 24,
    ])->assertSuccessful();

    $allocation->refresh();

    expect($allocation->planned_hours)->toBe('24.00')
        ->and($allocation->weekly_hours)->toBeNull()
        ->and($allocation->planning_comment)->toBe('Comentariul rămâne relevant.');
});

it('deletes only scoped allocations and keeps an audit record', function () {
    [$user, $person] = allocationEditor();
    $allocation = $person->allocations()->whereDate('month', '2026-05-01')->sole();

    $this->actingAs($user)
        ->deleteJson(route('allocations.destroy', $allocation))
        ->assertSuccessful()
        ->assertJsonPath('deleted', true);

    expect(Allocation::query()->whereKey($allocation->id)->exists())->toBeFalse();

    $audit = AuditLog::query()->where('action', 'allocation.deleted')->sole();

    expect($audit->auditable_id)->toBe($allocation->id)
        ->and($audit->before)->toMatchArray(['person_id' => $person->id])
        ->and($audit->after)->toBe([]);

    $outside = Allocation::factory()->create(['month' => '2026-07-01']);

    $this->actingAs($user)
        ->deleteJson(route('allocations.destroy', $outside))
        ->assertForbidden();

    expect($outside->fresh())->not->toBeNull();
});

it('reconciles a person month atomically with create update delete and audit records', function () {
    [$user, $person, $project] = allocationEditor();
    $projectToRemove = Project::factory()->create();
    $replacementProject = Project::factory()->create();
    $allocationToUpdate = Allocation::factory()->create([
        'person_id' => $person,
        'project_id' => $project,
        'role' => 'BE Dev',
        'month' => '2026-07-01',
        'planned_hours' => 8,
    ]);
    $allocationToRemove = Allocation::factory()->create([
        'person_id' => $person,
        'project_id' => $projectToRemove,
        'role' => 'QA',
        'month' => '2026-07-01',
        'planned_hours' => 4,
    ]);

    $this->actingAs($user)->putJson(route('allocations.replace_person_month'), [
        'person_id' => $person->id,
        'month' => '2026-07',
        'allocations' => [
            [
                'id' => $allocationToUpdate->id,
                'project_id' => $replacementProject->id,
                'role' => 'BE Dev',
                'planned_hours' => 16,
                'weekly_hours' => [
                    ['week_start' => '2026-06-29', 'hours' => 4],
                    ['week_start' => '2026-07-06', 'hours' => 12],
                ],
                'planning_comment' => 'Mutat pe proiectul aprobat.',
            ],
            [
                'project_id' => $projectToRemove->id,
                'role' => 'QA',
                'planned_hours' => 8,
                'weekly_hours' => [
                    ['week_start' => '2026-07-13', 'hours' => 8],
                ],
            ],
        ],
    ])->assertSuccessful()
        ->assertJsonCount(2, 'allocations')
        ->assertJsonPath('allocations.0.planned_hours', 16)
        ->assertJsonPath('allocations.0.planning_comment', 'Mutat pe proiectul aprobat.');

    expect($allocationToUpdate->refresh()->project_id)->toBe($replacementProject->id)
        ->and($allocationToUpdate->planned_hours)->toBe('16.00')
        ->and($allocationToRemove->fresh())->toBeNull()
        ->and(Allocation::query()
            ->whereBelongsTo($person)
            ->whereDate('month', '2026-07-01')
            ->count())->toBe(2)
        ->and(AuditLog::query()->where('action', 'allocation.updated')->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'allocation.deleted')->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'allocation.upserted')->count())->toBe(1);
});

it('rolls back the person month draft when one allocation is invalid', function () {
    [$user, $person, $project] = allocationEditor();
    $allocation = Allocation::factory()->create([
        'person_id' => $person,
        'project_id' => $project,
        'role' => 'BE Dev',
        'month' => '2026-07-01',
        'planned_hours' => 8,
    ]);

    $this->actingAs($user)->putJson(route('allocations.replace_person_month'), [
        'person_id' => $person->id,
        'month' => '2026-07',
        'allocations' => [
            [
                'id' => $allocation->id,
                'project_id' => $project->id,
                'role' => 'BE Dev',
                'planned_hours' => 8.1,
                'weekly_hours' => [
                    ['week_start' => '2026-07-06', 'hours' => 8.1],
                ],
            ],
        ],
    ])->assertUnprocessable()
        ->assertJsonValidationErrors(['allocations.0.weekly_hours.0.hours']);

    expect($allocation->refresh()->planned_hours)->toBe('8.00')
        ->and(AuditLog::query()->count())->toBe(0);
});

it('protects person month replacement by permission and team scope', function () {
    [$user, $person, $project] = allocationEditor();
    $payload = [
        'person_id' => $person->id,
        'month' => '2026-07',
        'allocations' => [[
            'project_id' => $project->id,
            'role' => 'QA',
            'planned_hours' => 8,
            'weekly_hours' => [['week_start' => '2026-07-06', 'hours' => 8]],
        ]],
    ];

    $this->actingAs(User::factory()->create())
        ->putJson(route('allocations.replace_person_month'), $payload)
        ->assertForbidden();

    $this->actingAs($user)
        ->putJson(route('allocations.replace_person_month'), [
            ...$payload,
            'person_id' => Person::factory()->create()->id,
        ])->assertForbidden();
});
