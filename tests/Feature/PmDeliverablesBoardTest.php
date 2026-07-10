<?php

use App\Enums\PermissionName;
use App\Enums\ProjectBoardTemplate;
use App\Models\ClickUpTask;
use App\Models\Person;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
use App\Models\WeeklyPlan;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;

beforeEach(function () {
    $this->withoutVite();

    Permission::findOrCreate(PermissionName::ViewPmBoards->value);
    Permission::findOrCreate(PermissionName::ViewManagement->value);
});

function deliverablesBoardViewer(): User
{
    $user = User::factory()->create();
    $user->givePermissionTo(
        PermissionName::ViewPmBoards->value,
        PermissionName::ViewManagement->value,
    );

    return $user;
}

function persistDeliverablesPlan(
    User $user,
    Project $project,
    ClickUpTask $task,
    Person $person,
    string $weekStart,
    float $hours,
): WeeklyPlan {
    $plan = WeeklyPlan::query()->create([
        'project_id' => $project->id,
        'click_up_task_id' => $task->id,
        'week_start' => $weekStart,
        'selected' => true,
        'created_by' => $user->id,
        'updated_by' => $user->id,
    ]);
    $plan->allocations()->create([
        'person_id' => $person->id,
        'hours' => $hours,
    ]);

    return $plan;
}

it('adds weekly planning resources and gantt data to a deliverables board', function () {
    $user = deliverablesBoardViewer();
    $resource = Person::factory()->create([
        'name' => 'Ana Developer',
        'job_role' => 'Backend Developer',
        'weekly_capacity_hours' => 40,
    ]);
    Person::factory()->create([
        'weekly_capacity_hours' => 30,
        'is_external' => true,
    ]);
    Person::factory()->create([
        'weekly_capacity_hours' => 30,
        'active' => false,
    ]);
    $project = Project::factory()->create([
        'contract_type' => ProjectBoardTemplate::Deliverables,
        'board_config' => ['excluded_task_ids' => []],
    ]);
    $task = ClickUpTask::factory()->create([
        'project_id' => $project,
        'clickup_task_id' => 'deliverable-included',
        'name' => 'Implementare API',
        'status' => 'in progress',
        'start_at' => '2026-07-06 09:00:00',
        'due_at' => '2026-07-24 18:00:00',
    ]);
    persistDeliverablesPlan(
        $user,
        $project,
        $task,
        $resource,
        '2026-07-13',
        8,
    );

    $response = $this->actingAs($user)->get(route('pm_board.index', [
        'project' => $project->id,
        'period' => 'week',
        'anchor' => '2026-07-08',
    ]));

    $response->assertSuccessful()->assertInertia(fn (Assert $page) => $page
        ->component('pm-board/index', false)
        ->has('projects')
        ->has('workedTasks')
        ->has('upcomingTasks')
        ->has('peopleWorked')
        ->has('kpis')
        ->has('sync')
        ->has('permissions')
        ->has('planning.weekStart')
        ->has('planning.plans')
        ->has('planning.resources')
        ->has('planning.resourceTotals')
        ->has('gantt.weeks')
        ->has('gantt.rows'));

    $planning = $response->inertiaProps('planning');
    $plan = collect($planning['plans'])->firstWhere('taskId', $task->id);
    $resourceData = collect($planning['resources'])->firstWhere('id', $resource->id);
    $resourceTotal = collect($planning['resourceTotals'])->firstWhere('personId', $resource->id);
    $ganttRow = collect($response->inertiaProps('gantt.rows'))->firstWhere('id', $task->id);

    expect($planning['weekStart'])->toBe('2026-07-13')
        ->and($plan)->not->toBeNull()
        ->and($plan['selected'])->toBeTrue()
        ->and($plan['totalHours'])->toBe(8)
        ->and($plan['allocations'])->toBe([[
            'personId' => $resource->id,
            'name' => 'Ana Developer',
            'hours' => 8,
        ]])
        ->and($resourceData)->toMatchArray([
            'id' => $resource->id,
            'name' => 'Ana Developer',
            'jobRole' => 'Backend Developer',
            'weeklyCapacityHours' => 40,
        ])
        ->and($resourceTotal)->toMatchArray([
            'personId' => $resource->id,
            'plannedHours' => 8,
            'weeklyCapacityHours' => 40,
            'remainingHours' => 32,
        ])
        ->and($response->inertiaProps('gantt.weeks'))->not->toBeEmpty()
        ->and($ganttRow)->toMatchArray([
            'id' => $task->id,
            'status' => 'in progress',
            'startDate' => '2026-07-06',
            'dueDate' => '2026-07-24',
        ]);
});

it('excludes configured tasks only from upcoming and planning while retaining worked history', function () {
    $user = deliverablesBoardViewer();
    $resource = Person::factory()->create(['weekly_capacity_hours' => 40]);
    $project = Project::factory()->create([
        'contract_type' => ProjectBoardTemplate::Deliverables,
        'board_config' => ['excluded_task_ids' => ['excluded-recurring-task']],
    ]);
    $includedTask = ClickUpTask::factory()->create([
        'project_id' => $project,
        'clickup_task_id' => 'included-task',
        'name' => 'Task inclus',
        'status' => 'to do',
        'start_at' => '2026-07-06 09:00:00',
        'due_at' => '2026-07-17 18:00:00',
    ]);
    $excludedTask = ClickUpTask::factory()->create([
        'project_id' => $project,
        'clickup_task_id' => 'excluded-recurring-task',
        'name' => 'Task recurent exclus',
        'status' => 'in progress',
        'start_at' => '2026-07-06 09:00:00',
        'due_at' => '2026-07-31 18:00:00',
    ]);
    TimeEntry::factory()->create([
        'project_id' => $project,
        'click_up_task_id' => $excludedTask,
        'person_id' => $resource,
        'started_at' => '2026-07-08 10:00:00',
        'duration_seconds' => 2 * 3600,
    ]);
    persistDeliverablesPlan(
        $user,
        $project,
        $includedTask,
        $resource,
        '2026-07-13',
        8,
    );
    persistDeliverablesPlan(
        $user,
        $project,
        $excludedTask,
        $resource,
        '2026-07-13',
        4,
    );

    $response = $this->actingAs($user)->get(route('pm_board.index', [
        'project' => $project->id,
        'period' => 'week',
        'anchor' => '2026-07-08',
    ]));

    $workedIds = collect($response->inertiaProps('workedTasks'))->pluck('clickupId');
    $upcomingIds = collect($response->inertiaProps('upcomingTasks'))->pluck('clickupId');
    $plannedTaskIds = collect($response->inertiaProps('planning.plans'))->pluck('taskId');
    $ganttIds = collect($response->inertiaProps('gantt.rows'))->pluck('id');

    expect($workedIds)->toContain('excluded-recurring-task')
        ->and($upcomingIds)->toContain('included-task')
        ->and($upcomingIds)->not->toContain('excluded-recurring-task')
        ->and($plannedTaskIds)->toContain($includedTask->id)
        ->and($plannedTaskIds)->not->toContain($excludedTask->id)
        ->and($ganttIds)->toContain($includedTask->id, $excludedTask->id);
});

it('loads independent persisted plans for each following week', function () {
    $user = deliverablesBoardViewer();
    $resource = Person::factory()->create(['weekly_capacity_hours' => 40]);
    $project = Project::factory()->create([
        'contract_type' => ProjectBoardTemplate::Deliverables,
        'board_config' => ['excluded_task_ids' => []],
    ]);
    $task = ClickUpTask::factory()->create([
        'project_id' => $project,
        'status' => 'in progress',
    ]);
    persistDeliverablesPlan($user, $project, $task, $resource, '2026-07-13', 8);
    persistDeliverablesPlan($user, $project, $task, $resource, '2026-07-20', 3);

    $firstWeek = $this->actingAs($user)->get(route('pm_board.index', [
        'project' => $project->id,
        'period' => 'week',
        'anchor' => '2026-07-08',
    ]));
    $secondWeek = $this->actingAs($user)->get(route('pm_board.index', [
        'project' => $project->id,
        'period' => 'week',
        'anchor' => '2026-07-15',
    ]));

    expect($firstWeek->inertiaProps('planning.weekStart'))->toBe('2026-07-13')
        ->and(data_get($firstWeek->inertiaProps('planning.plans'), '0.totalHours'))->toBe(8)
        ->and($secondWeek->inertiaProps('planning.weekStart'))->toBe('2026-07-20')
        ->and(data_get($secondWeek->inertiaProps('planning.plans'), '0.totalHours'))->toBe(3);
});
