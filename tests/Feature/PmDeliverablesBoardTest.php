<?php

use App\Enums\PermissionName;
use App\Enums\ProjectBoardTemplate;
use App\Models\ClickUpList;
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
        'board_config' => [
            'excluded_task_ids' => [],
            'gantt_modules' => ['deliverable-included' => 'Backend'],
        ],
    ]);
    $laterTask = ClickUpTask::factory()->create([
        'project_id' => $project,
        'clickup_task_id' => 'later-deliverable',
        'name' => '[Forms] Integrare formulare',
        'status' => 'to do',
        'start_at' => '2026-08-31 09:00:00',
        'due_at' => '2026-09-02 18:00:00',
    ]);
    $undatedTask = ClickUpTask::factory()->create([
        'project_id' => $project,
        'clickup_task_id' => 'missing-start',
        'status' => 'to do',
        'start_at' => null,
        'due_at' => '2026-09-04 18:00:00',
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
            'utilizationPercent' => 20,
        ])
        ->and($response->inertiaProps('gantt.weeks'))->not->toBeEmpty()
        ->and($ganttRow)->toMatchArray([
            'id' => $task->id,
            'module' => 'Backend',
            'status' => 'in progress',
            'startDate' => '2026-07-06',
            'dueDate' => '2026-07-24',
        ])
        ->and(collect($response->inertiaProps('gantt.rows'))->pluck('id'))
        ->toContain($task->id, $laterTask->id)
        ->not->toContain($undatedTask->id)
        ->and(collect($response->inertiaProps('gantt.weeks'))->last())
        ->toMatchArray([
            'key' => '2026-08-31',
            'isoWeek' => 36,
            'monthKey' => '2026-08',
        ])
        ->and($response->inertiaProps('kpis.selectedTasks'))->toBe(1)
        ->and($response->inertiaProps('kpis.plannedNextWeekHours'))->toBe(8)
        ->and($response->inertiaProps('kpis.activeTasks'))->toBe(1)
        ->and($response->inertiaProps('kpis.todoTasks'))->toBe(2);
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

it('builds a truthful annex board from dynamic task scopes and weekly plans', function () {
    $user = deliverablesBoardViewer();
    $owner = Person::factory()->create(['name' => 'Dana Developer']);
    $project = Project::factory()->create([
        'client' => 'Example Client',
        'name' => 'Delivery Platform',
        'contract_type' => ProjectBoardTemplate::Deliverables,
        'board_config' => [
            'annex_modules' => ['automation-task' => 'Automation'],
            'excluded_task_ids' => [],
        ],
    ]);
    $automationTask = ClickUpTask::factory()->create([
        'project_id' => $project,
        'clickup_task_id' => 'automation-task',
        'name' => 'Automate document flow',
        'status' => 'in progress',
        'estimate_seconds' => 8 * 3600,
        'tracked_seconds' => 5 * 3600,
        'start_at' => '2026-07-13 09:00:00',
        'due_at' => '2026-07-18 18:00:00',
    ]);
    $automationTask->assignees()->attach($owner);
    $gamificationTask = ClickUpTask::factory()->create([
        'project_id' => $project,
        'clickup_task_id' => 'gamification-task',
        'name' => '[Gamification] Build leaderboard',
        'status' => 'in progress',
        'estimate_seconds' => 10 * 3600,
        'tracked_seconds' => 4 * 3600,
        'start_at' => '2026-07-14 09:00:00',
        'due_at' => '2026-07-31 18:00:00',
    ]);
    $completedGamificationTask = ClickUpTask::factory()->create([
        'project_id' => $project,
        'clickup_task_id' => 'gamification-complete',
        'name' => '[Gamification] Define rewards',
        'status' => 'complete',
        'estimate_seconds' => 2 * 3600,
        'tracked_seconds' => 2 * 3600,
        'start_at' => '2026-07-01 09:00:00',
        'due_at' => '2026-07-10 18:00:00',
    ]);
    ClickUpTask::factory()->create([
        'project_id' => $project,
        'clickup_task_id' => 'unresolved-task',
        'name' => 'Clarify imported requirement',
        'status' => 'to do',
        'estimate_seconds' => null,
        'tracked_seconds' => null,
        'start_at' => null,
        'due_at' => null,
    ]);
    TimeEntry::factory()->create([
        'project_id' => $project,
        'click_up_task_id' => $automationTask,
        'person_id' => $owner,
        'started_at' => '2026-07-15 10:00:00',
        'duration_seconds' => 3 * 3600,
    ]);
    persistDeliverablesPlan($user, $project, $automationTask, $owner, '2026-07-13', 6);
    persistDeliverablesPlan($user, $project, $gamificationTask, $owner, '2026-07-20', 4);

    $response = $this->actingAs($user)->get(route('pm_board.index', [
        'project' => $project->id,
        'period' => 'week',
        'anchor' => '2026-07-15',
    ]));

    $response->assertSuccessful()->assertInertia(fn (Assert $page) => $page
        ->component('pm-board/index', false)
        ->where('selectedProject.template', ProjectBoardTemplate::Deliverables->value)
        ->has('annexBoard.annexes', 3)
        ->has('annexBoard.weeklyRows')
        ->has('annexBoard.agreedRows')
        ->has('annexBoard.timeline.rows')
        ->has('annexBoard.totals'));

    $annexBoard = $response->inertiaProps('annexBoard');
    $annexes = collect($annexBoard['annexes']);
    $automation = $annexes->firstWhere('label', 'Automation');
    $gamification = $annexes->firstWhere('label', 'Gamification');
    $unresolved = $annexes->firstWhere('scopeSource', 'missing');
    $currentWeek = collect($annexBoard['weeklyRows'])->firstWhere('taskId', $automationTask->id);
    $nextWeek = collect($annexBoard['agreedRows'])->firstWhere('taskId', $gamificationTask->id);

    expect($automation)->toMatchArray([
        'scopeSource' => 'configured',
        'contractIdentifier' => null,
        'contractBudgetHours' => null,
        'contractDeadline' => null,
        'estimatedBudgetHours' => 8.0,
        'consumedHours' => 5.0,
        'remainingEstimateHours' => 3.0,
        'completedTasks' => 0,
        'totalTasks' => 1,
        'deliveryProgress' => 0.0,
        'closestDueDate' => '2026-07-18',
    ])->and($gamification)->toMatchArray([
        'scopeSource' => 'task_name',
        'estimatedBudgetHours' => 12.0,
        'consumedHours' => 6.0,
        'remainingEstimateHours' => 6.0,
        'completedTasks' => 1,
        'totalTasks' => 2,
        'deliveryProgress' => 50.0,
    ])->and($unresolved)->not->toBeNull()
        ->and($unresolved['contractBudgetHours'])->toBeNull()
        ->and($unresolved['estimatedBudgetHours'])->toBeNull()
        ->and($unresolved['missingFields'])->toContain('annexScope', 'contractIdentifier', 'contractBudgetHours', 'contractDeadline')
        ->and($currentWeek)->toMatchArray([
            'plannedHours' => 6.0,
            'workedHours' => 3.0,
            'owners' => ['Dana Developer'],
        ])->and($nextWeek)->toMatchArray([
            'plannedHours' => 4.0,
            'remainingEstimateHours' => 6.0,
            'dueDate' => '2026-07-31',
        ])->and(collect($annexBoard['timeline']['rows'])->pluck('label'))
        ->toContain('Automation', 'Gamification')
        ->and($annexBoard['totals']['contractBudgetHours'])->toBeNull()
        ->and($annexBoard['totals']['contractDeadline'])->toBeNull()
        ->and($annexBoard['totals']['consumedHours'])->toEqual(11.0)
        ->and($annexBoard['totals']['closestDueDate'])->toBe('2026-07-18')
        ->and($annexBoard['totals']['taskCount'])->toBe(4);
});

it('separates configured deliverable estimates from operational consumption without double counting', function () {
    $user = deliverablesBoardViewer();
    $deliveryOwner = Person::factory()->create(['name' => 'Delivery Owner']);
    $operator = Person::factory()->create(['name' => 'Operational Contributor']);
    $unrelatedContributor = Person::factory()->create(['name' => 'Unrelated Contributor']);
    $project = Project::factory()->create([
        'client' => 'Example Contract Client',
        'name' => 'CRM Delivery',
        'contract_type' => ProjectBoardTemplate::Deliverables,
        'board_config' => [
            'annex_budget_list_names' => ['Features'],
            'annex_operational_list_names' => ['Backlog'],
            'excluded_task_ids' => [],
        ],
    ]);
    ClickUpList::factory()->create([
        'project_id' => $project,
        'clickup_list_id' => 'features-list',
        'name' => 'Features',
    ]);
    ClickUpList::factory()->create([
        'project_id' => $project,
        'clickup_list_id' => 'backlog-list',
        'name' => 'Backlog',
    ]);
    ClickUpList::factory()->create([
        'project_id' => $project,
        'clickup_list_id' => 'archive-list',
        'name' => 'Archive',
    ]);
    $firstDeliverable = ClickUpTask::factory()->create([
        'project_id' => $project,
        'clickup_list_id' => 'features-list',
        'clickup_task_id' => 'deliverable-parent-one',
        'name' => 'Architecture deliverable',
        'status' => 'to do',
        'estimate_seconds' => 100 * 3600,
        'tracked_seconds' => null,
        'start_at' => '2026-07-14 09:00:00',
        'due_at' => null,
    ]);
    $firstDeliverable->assignees()->attach($deliveryOwner);
    $secondDeliverable = ClickUpTask::factory()->create([
        'project_id' => $project,
        'clickup_list_id' => 'features-list',
        'clickup_task_id' => 'deliverable-parent-two',
        'name' => 'Handover deliverable',
        'status' => 'to do',
        'estimate_seconds' => 50 * 3600,
        'tracked_seconds' => null,
        'start_at' => null,
        'due_at' => null,
    ]);
    $firstOperationalTask = ClickUpTask::factory()->create([
        'project_id' => $project,
        'clickup_list_id' => 'backlog-list',
        'clickup_task_id' => 'operational-child-one',
        'name' => 'Implement architecture',
        'status' => 'in progress',
        'estimate_seconds' => 100 * 3600,
        'tracked_seconds' => null,
        'start_at' => '2026-07-13 09:00:00',
        'due_at' => null,
    ]);
    $secondOperationalTask = ClickUpTask::factory()->create([
        'project_id' => $project,
        'clickup_list_id' => 'backlog-list',
        'clickup_task_id' => 'operational-child-two',
        'name' => 'Prepare handover',
        'status' => 'in progress',
        'estimate_seconds' => 50 * 3600,
        'tracked_seconds' => null,
        'start_at' => '2026-07-13 09:00:00',
        'due_at' => null,
    ]);

    foreach ([[$firstOperationalTask, 10], [$secondOperationalTask, 6]] as [$task, $hours]) {
        TimeEntry::factory()->create([
            'project_id' => $project,
            'click_up_task_id' => $task,
            'person_id' => $operator,
            'started_at' => '2026-07-15 10:00:00',
            'duration_seconds' => $hours * 3600,
        ]);
    }
    TimeEntry::factory()->create([
        'project_id' => $project,
        'click_up_task_id' => $firstDeliverable,
        'person_id' => $deliveryOwner,
        'started_at' => '2026-07-15 10:00:00',
        'duration_seconds' => 2 * 3600,
    ]);
    $unrelatedTask = ClickUpTask::factory()->create([
        'project_id' => $project,
        'clickup_list_id' => 'archive-list',
        'clickup_task_id' => 'archived-reference',
        'name' => 'Archived reference material',
        'status' => 'to do',
        'estimate_seconds' => null,
        'tracked_seconds' => null,
    ]);
    TimeEntry::factory()->create([
        'project_id' => $project,
        'click_up_task_id' => $unrelatedTask,
        'person_id' => $unrelatedContributor,
        'started_at' => '2026-07-15 10:00:00',
        'duration_seconds' => 3 * 3600,
    ]);

    $response = $this->actingAs($user)->get(route('pm_board.index', [
        'project' => $project->id,
        'period' => 'month',
        'anchor' => '2026-07-15',
    ]));

    $annexBoard = $response->inertiaProps('annexBoard');
    $validation = $annexBoard['validation'];
    $issues = collect($validation['issues'])->keyBy('field');

    expect($annexBoard['totals'])->toMatchArray([
        'contractBudgetHours' => null,
        'contractDeadline' => null,
        'estimatedBudgetHours' => 150.0,
        'consumedHours' => 16.0,
        'remainingEstimateHours' => 134.0,
    ])->and($validation)->toMatchArray([
        'enabled' => true,
        'budgetSourceLabels' => ['Features'],
        'operationalSourceLabels' => ['Backlog'],
    ])->and($validation['deliverables'])->toHaveCount(2)
        ->and(collect($validation['deliverables'])->pluck('taskId'))
        ->toContain($firstDeliverable->id, $secondDeliverable->id)
        ->not->toContain($firstOperationalTask->id, $secondOperationalTask->id)
        ->and(collect($validation['deliverables'])->sum('estimateHours'))->toEqual(150.0)
        ->and($validation['people'])->toContain('Delivery Owner', 'Operational Contributor')
        ->not->toContain('Unrelated Contributor')
        ->and($issues->get('contractIdentifier'))->toMatchArray(['count' => 1])
        ->and($issues->get('contractDeadline'))->toMatchArray(['count' => 1])
        ->and($issues->get('owners'))->toMatchArray(['count' => 1])
        ->and($issues->get('startDate'))->toMatchArray(['count' => 1])
        ->and($issues->get('dueDate'))->toMatchArray(['count' => 2]);
});
