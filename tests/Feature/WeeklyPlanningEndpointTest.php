<?php

use App\Enums\PermissionName;
use App\Enums\ProjectBoardTemplate;
use App\Models\ClickUpTask;
use App\Models\Person;
use App\Models\Project;
use App\Models\User;
use App\Models\WeeklyPlan;
use App\Models\WeeklyPlanAllocation;
use Spatie\Permission\Models\Permission;

beforeEach(function () {
    Permission::findOrCreate(PermissionName::ManagePmPlanning->value);
});

function weeklyPlanningEditor(Project $project): User
{
    $user = User::factory()->create();
    $user->givePermissionTo(PermissionName::ManagePmPlanning->value);
    $manager = Person::factory()->create(['user_id' => $user]);
    $project->managers()->attach($manager);

    return $user;
}

function weeklyPlanningTask(Project $project): ClickUpTask
{
    return ClickUpTask::factory()->create([
        'project_id' => $project,
        'status' => 'in progress',
        'active' => true,
    ]);
}

function weeklyPlanningPayload(
    Project $project,
    ClickUpTask $task,
    array $allocations = [],
    array $overrides = [],
): array {
    return [
        'project_id' => $project->id,
        'click_up_task_id' => $task->id,
        'week_start' => '2026-07-06',
        'selected' => true,
        'allocations' => $allocations,
        'version' => null,
        ...$overrides,
    ];
}

it('redirects guests and forbids users without planning permission', function () {
    $project = Project::factory()->create(['contract_type' => ProjectBoardTemplate::Deliverables]);
    $task = weeklyPlanningTask($project);

    $this->put(route('weekly_planning.upsert'), weeklyPlanningPayload($project, $task))
        ->assertRedirect(route('login'));

    $this->actingAs(User::factory()->create())
        ->putJson(route('weekly_planning.upsert'), weeklyPlanningPayload($project, $task))
        ->assertForbidden();
});

it('forbids planning outside the project manager scope', function () {
    $managedProject = Project::factory()->create(['contract_type' => ProjectBoardTemplate::Deliverables]);
    $outsideProject = Project::factory()->create(['contract_type' => ProjectBoardTemplate::Deliverables]);
    $user = weeklyPlanningEditor($managedProject);
    $outsideTask = weeklyPlanningTask($outsideProject);

    $this->actingAs($user)
        ->putJson(
            route('weekly_planning.upsert'),
            weeklyPlanningPayload($outsideProject, $outsideTask),
        )
        ->assertForbidden();
});

it('validates monday project task ownership and eligible people', function () {
    $project = Project::factory()->create(['contract_type' => ProjectBoardTemplate::Deliverables]);
    $otherProject = Project::factory()->create(['contract_type' => ProjectBoardTemplate::Deliverables]);
    $user = weeklyPlanningEditor($project);
    $task = weeklyPlanningTask($project);
    $otherTask = weeklyPlanningTask($otherProject);
    $person = Person::factory()->create();
    $inactivePerson = Person::factory()->create(['active' => false]);
    $externalPerson = Person::factory()->create(['is_external' => true]);
    $notAllowedPerson = Person::factory()->create();
    $project->update(['board_config' => ['allowed_resource_names' => [$person->name]]]);

    $this->actingAs($user)
        ->putJson(route('weekly_planning.upsert'), weeklyPlanningPayload(
            $project,
            $task,
            [['person_id' => $person->id, 'hours' => 8]],
            ['week_start' => '2026-07-11'],
        ))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['week_start']);

    $this->actingAs($user)
        ->putJson(route('weekly_planning.upsert'), weeklyPlanningPayload($project, $otherTask))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['click_up_task_id']);

    foreach ([$inactivePerson, $externalPerson, $notAllowedPerson] as $ineligiblePerson) {
        $this->actingAs($user)
            ->putJson(route('weekly_planning.upsert'), weeklyPlanningPayload(
                $project,
                $task,
                [['person_id' => $ineligiblePerson->id, 'hours' => 8]],
            ))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['allocations.0.person_id']);
    }

    expect(WeeklyPlan::query()->count())->toBe(0)
        ->and(WeeklyPlanAllocation::query()->count())->toBe(0);
});

it('rejects time and materials, completed and configured excluded tasks', function () {
    $tmProject = Project::factory()->create(['contract_type' => ProjectBoardTemplate::TimeAndMaterials]);
    $tmTask = weeklyPlanningTask($tmProject);
    $tmUser = weeklyPlanningEditor($tmProject);

    $this->actingAs($tmUser)
        ->putJson(route('weekly_planning.upsert'), weeklyPlanningPayload($tmProject, $tmTask))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['project_id']);

    $project = Project::factory()->create([
        'contract_type' => ProjectBoardTemplate::Deliverables,
        'board_config' => ['excluded_task_ids' => ['recurring-task']],
    ]);
    $user = weeklyPlanningEditor($project);
    $excludedTask = ClickUpTask::factory()->create([
        'project_id' => $project,
        'clickup_task_id' => 'recurring-task',
        'status' => 'in progress',
    ]);
    $completedTask = ClickUpTask::factory()->create([
        'project_id' => $project,
        'status' => 'complete',
    ]);

    foreach ([$excludedTask, $completedTask] as $task) {
        $this->actingAs($user)
            ->putJson(route('weekly_planning.upsert'), weeklyPlanningPayload($project, $task))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['click_up_task_id']);
    }
});

it('upserts one audited weekly plan and synchronizes nonzero allocations', function () {
    $project = Project::factory()->create(['contract_type' => ProjectBoardTemplate::Deliverables]);
    $task = weeklyPlanningTask($project);
    $firstUser = weeklyPlanningEditor($project);
    $firstPerson = Person::factory()->create();
    $secondPerson = Person::factory()->create();

    $this->actingAs($firstUser)
        ->putJson(route('weekly_planning.upsert'), weeklyPlanningPayload(
            $project,
            $task,
            [
                ['person_id' => $firstPerson->id, 'hours' => 8],
                ['person_id' => $secondPerson->id, 'hours' => 4],
            ],
        ))
        ->assertSuccessful();

    $plan = WeeklyPlan::query()->sole();

    expect($plan->project_id)->toBe($project->id)
        ->and($plan->click_up_task_id)->toBe($task->id)
        ->and($plan->week_start->toDateString())->toBe('2026-07-06')
        ->and($plan->selected)->toBeTrue()
        ->and($plan->version)->toBe(1)
        ->and($plan->created_by)->toBe($firstUser->id)
        ->and($plan->updated_by)->toBe($firstUser->id)
        ->and($plan->allocations()->pluck('hours', 'person_id')->all())->toBe([
            $firstPerson->id => '8.00',
            $secondPerson->id => '4.00',
        ]);

    $secondUser = weeklyPlanningEditor($project);

    $this->actingAs($secondUser)
        ->putJson(route('weekly_planning.upsert'), weeklyPlanningPayload(
            $project,
            $task,
            [
                ['person_id' => $firstPerson->id, 'hours' => 0],
                ['person_id' => $secondPerson->id, 'hours' => 6],
            ],
            ['selected' => false, 'version' => $plan->version],
        ))
        ->assertSuccessful();

    $plan->refresh();

    expect(WeeklyPlan::query()->count())->toBe(1)
        ->and($plan->selected)->toBeFalse()
        ->and($plan->version)->toBe(2)
        ->and($plan->created_by)->toBe($firstUser->id)
        ->and($plan->updated_by)->toBe($secondUser->id)
        ->and($plan->allocations()->pluck('hours', 'person_id')->all())->toBe([
            $secondPerson->id => '6.00',
        ]);
});

it('keeps an existing plan unchanged when one allocation is invalid', function () {
    $project = Project::factory()->create(['contract_type' => ProjectBoardTemplate::Deliverables]);
    $task = weeklyPlanningTask($project);
    $user = weeklyPlanningEditor($project);
    $person = Person::factory()->create();
    $inactivePerson = Person::factory()->create(['active' => false]);

    $this->actingAs($user)
        ->putJson(route('weekly_planning.upsert'), weeklyPlanningPayload(
            $project,
            $task,
            [['person_id' => $person->id, 'hours' => 8]],
        ))
        ->assertSuccessful();

    $this->actingAs($user)
        ->putJson(route('weekly_planning.upsert'), weeklyPlanningPayload(
            $project,
            $task,
            [
                ['person_id' => $person->id, 'hours' => 12],
                ['person_id' => $inactivePerson->id, 'hours' => 4],
            ],
        ))
        ->assertUnprocessable();

    expect(WeeklyPlan::query()->count())->toBe(1)
        ->and(WeeklyPlan::query()->sole()->allocations()->pluck('hours', 'person_id')->all())
        ->toBe([$person->id => '8.00']);
});

it('rejects a stale optimistic locking timestamp', function () {
    $project = Project::factory()->create(['contract_type' => ProjectBoardTemplate::Deliverables]);
    $task = weeklyPlanningTask($project);
    $user = weeklyPlanningEditor($project);
    $person = Person::factory()->create();
    $allocations = [['person_id' => $person->id, 'hours' => 8]];

    $this->actingAs($user)
        ->putJson(
            route('weekly_planning.upsert'),
            weeklyPlanningPayload($project, $task, $allocations),
        )
        ->assertSuccessful();

    $staleVersion = WeeklyPlan::query()->sole()->version;
    $this->travel(1)->seconds();

    $this->actingAs($user)
        ->putJson(route('weekly_planning.upsert'), weeklyPlanningPayload(
            $project,
            $task,
            [['person_id' => $person->id, 'hours' => 10]],
            ['version' => $staleVersion],
        ))
        ->assertSuccessful();

    $this->actingAs($user)
        ->putJson(route('weekly_planning.upsert'), weeklyPlanningPayload(
            $project,
            $task,
            [['person_id' => $person->id, 'hours' => 12]],
            ['version' => $staleVersion],
        ))
        ->assertConflict();

    expect(WeeklyPlan::query()->sole()->allocations()->value('hours'))->toBe('10.00');
});
