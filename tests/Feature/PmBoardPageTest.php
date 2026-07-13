<?php

use App\Enums\ClickUpLocationKind;
use App\Enums\PermissionName;
use App\Models\ClickUpFolder;
use App\Models\ClickUpList;
use App\Models\ClickUpTask;
use App\Models\Person;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;

beforeEach(function () {
    $this->withoutVite();

    Permission::findOrCreate(PermissionName::ViewPmBoards->value);
    Permission::findOrCreate(PermissionName::ViewManagement->value);
    Permission::findOrCreate(PermissionName::ManagePmPlanning->value);
    Permission::findOrCreate(PermissionName::SyncClickUp->value);
});

function globalPmBoardViewer(): User
{
    $user = User::factory()->create();
    $user->givePermissionTo(
        PermissionName::ViewPmBoards->value,
        PermissionName::ViewManagement->value,
    );

    return $user;
}

it('redirects guests and forbids users without board permission', function () {
    $this->get(route('pm_board.index'))->assertRedirect(route('login'));

    $this->actingAs(User::factory()->create())
        ->get(route('pm_board.index'))
        ->assertForbidden();
});

it('gives management global project access and filters projects by manager', function () {
    $user = globalPmBoardViewer();
    $firstManager = Person::factory()->create(['name' => 'Ana PM']);
    $secondManager = Person::factory()->create(['name' => 'Bogdan PM']);
    $firstProject = Project::factory()->create(['client' => 'Acme', 'name' => 'Portal']);
    $secondProject = Project::factory()->create(['client' => 'Beta', 'name' => 'Mobile']);
    $firstProject->managers()->attach($firstManager);
    $secondProject->managers()->attach($secondManager);

    $this->actingAs($user)
        ->get(route('pm_board.index', [
            'project' => $firstProject->id,
            'pm' => $firstManager->id,
            'period' => 'week',
            'anchor' => '2026-07-08',
        ]))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->component('pm-board/index', false)
            ->has('projects', 1)
            ->where('projects.0.id', $firstProject->id)
            ->has('managers', 2)
            ->where('selectedPmId', $firstManager->id)
            ->where('selectedProject.id', $firstProject->id));
});

it('limits a project manager to managed projects and forbids an outside project', function () {
    $user = User::factory()->create();
    $user->givePermissionTo(PermissionName::ViewPmBoards->value);
    $manager = Person::factory()->create(['user_id' => $user]);
    $managedProject = Project::factory()->create();
    $outsideProject = Project::factory()->create();
    $managedProject->managers()->attach($manager);

    $this->actingAs($user)
        ->get(route('pm_board.index', ['project' => $managedProject->id]))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->component('pm-board/index', false)
            ->has('projects', 1)
            ->where('projects.0.id', $managedProject->id)
            ->where('selectedProject.id', $managedProject->id));

    $this->actingAs($user)
        ->get(route('pm_board.index', ['project' => $outsideProject->id]))
        ->assertForbidden();
});

it('builds weekly worked and upcoming metrics from period and lifetime hours', function () {
    $user = globalPmBoardViewer();
    $user->givePermissionTo(
        PermissionName::ManagePmPlanning->value,
        PermissionName::SyncClickUp->value,
    );
    $project = Project::factory()->create(['client' => 'Acme', 'name' => 'Portal']);
    $ana = Person::factory()->create(['name' => 'Ana']);
    $bogdan = Person::factory()->create(['name' => 'Bogdan']);
    $task = ClickUpTask::factory()->create([
        'project_id' => $project,
        'clickup_task_id' => 'task-weekly-metrics',
        'name' => 'Implementare autentificare',
        'status' => 'in progress',
        'estimate_seconds' => 10 * 3600,
        'tracked_seconds' => 12 * 3600,
        'start_at' => '2026-07-06 09:00:00',
        'due_at' => '2026-07-10 18:00:00',
    ]);
    $task->assignees()->attach($ana);

    TimeEntry::factory()->create([
        'click_up_task_id' => $task,
        'person_id' => $ana,
        'project_id' => $project,
        'started_at' => '2026-07-07 10:00:00',
        'duration_seconds' => 4 * 3600,
    ]);
    TimeEntry::factory()->create([
        'click_up_task_id' => $task,
        'person_id' => $bogdan,
        'project_id' => $project,
        'started_at' => '2026-07-09 10:00:00',
        'duration_seconds' => 3 * 3600,
    ]);
    TimeEntry::factory()->create([
        'click_up_task_id' => $task,
        'person_id' => $ana,
        'project_id' => $project,
        'started_at' => '2026-07-03 10:00:00',
        'duration_seconds' => 5 * 3600,
    ]);

    $this->actingAs($user)
        ->get(route('pm_board.index', [
            'project' => $project->id,
            'period' => 'week',
            'anchor' => '2026-07-08',
        ]))
        ->assertInertia(fn (Assert $page) => $page
            ->component('pm-board/index', false)
            ->where('period.start', '2026-07-06')
            ->where('period.end', '2026-07-12')
            ->where('period.label', '6 jul – 12 jul 2026')
            ->where('period.previousAnchor', '2026-07-01')
            ->where('period.nextAnchor', '2026-07-15')
            ->has('workedTasks', 1)
            ->where('workedTasks.0.id', $task->id)
            ->where('workedTasks.0.clickupId', 'task-weekly-metrics')
            ->where('workedTasks.0.url', 'https://app.clickup.com/t/task-weekly-metrics')
            ->where('workedTasks.0.owners', ['Ana'])
            ->where('workedTasks.0.estimateHours', 10)
            ->where('workedTasks.0.periodHours', 7)
            ->where('workedTasks.0.totalLoggedHours', 12)
            ->where('workedTasks.0.remainingHours', -2)
            ->where('workedTasks.0.progress', 120)
            ->where('workedTasks.0.isOverrun', true)
            ->has('upcomingTasks', 1)
            ->where('upcomingTasks.0.id', $task->id)
            ->where('upcomingTasks.0.remainingHours', -2)
            ->has('peopleWorked', 2)
            ->where('peopleWorked.0', ['name' => 'Ana', 'hours' => 4, 'tasks' => 1])
            ->where('peopleWorked.1', ['name' => 'Bogdan', 'hours' => 3, 'tasks' => 1])
            ->where('kpis', [
                'plannedHours' => 10,
                'actualHours' => 7,
                'workedTasks' => 1,
                'plannedTasks' => 1,
                'activeTasks' => 1,
                'todoTasks' => 0,
                'selectedTasks' => 0,
                'plannedNextWeekHours' => 0,
                'activePeople' => 2,
                'projects' => 1,
            ])
            ->where('sync', null)
            ->where('permissions.managePlanning', true)
            ->where('permissions.syncClickUp', true));
});

it('uses calendar month boundaries and month navigation', function () {
    $user = globalPmBoardViewer();
    $project = Project::factory()->create();
    $task = ClickUpTask::factory()->create([
        'project_id' => $project,
        'status' => 'to do',
        'estimate_seconds' => 10 * 3600,
    ]);
    TimeEntry::factory()->create([
        'click_up_task_id' => $task,
        'project_id' => $project,
        'started_at' => '2026-07-30 10:00:00',
        'duration_seconds' => 2 * 3600,
    ]);

    $this->actingAs($user)
        ->get(route('pm_board.index', [
            'project' => $project->id,
            'period' => 'month',
            'anchor' => '2026-07-15',
        ]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('period.type', 'month')
            ->where('period.start', '2026-07-01')
            ->where('period.end', '2026-07-31')
            ->where('period.label', 'July 2026')
            ->where('period.previousAnchor', '2026-06-15')
            ->where('period.nextAnchor', '2026-08-15')
            ->where('workedTasks.0.periodHours', 2)
            ->has('summaryCharts.timeline', 5)
            ->where('summaryCharts.timeline.0.label', '1 jul–5 jul')
            ->where('summaryCharts.timeline.4.label', '27 jul–31 jul')
            ->where('summaryCharts.timeline.4.hours', 2));
});

it('uses Bucharest calendar boundaries while storing timestamps in UTC', function () {
    expect(config('app.timezone'))->toBe('Europe/Bucharest')
        ->and(config('database.connections.pgsql.timezone'))->toBe('UTC')
        ->and(CarbonImmutable::parse('2026-07-08')->startOfWeek()->utc()->toIso8601String())
        ->toBe('2026-07-05T21:00:00+00:00');

    $user = globalPmBoardViewer();
    $project = Project::factory()->create();
    $task = ClickUpTask::factory()->create(['project_id' => $project]);
    TimeEntry::factory()->create([
        'click_up_task_id' => $task,
        'project_id' => $project,
        'started_at' => '2026-07-05 21:30:00',
        'duration_seconds' => 2 * 3600,
    ]);

    $this->actingAs($user)
        ->get(route('pm_board.index', [
            'project' => $project->id,
            'period' => 'week',
            'anchor' => '2026-07-08',
        ]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('workedTasks.0.periodHours', 2)
            ->where('kpis.actualHours', 2));
});

it('orders projects by worked hours in the selected range', function () {
    $user = globalPmBoardViewer();
    $zeroHours = Project::factory()->create(['client' => 'Alpha', 'name' => 'Zero']);
    $twoHours = Project::factory()->create(['client' => 'Beta', 'name' => 'Two']);
    $fiveHours = Project::factory()->create(['client' => 'Gamma', 'name' => 'Five']);
    $laterHours = Project::factory()->create(['client' => 'Omega', 'name' => 'Later']);

    foreach ([[$twoHours, 2], [$fiveHours, 5]] as [$project, $hours]) {
        TimeEntry::factory()->create([
            'project_id' => $project,
            'started_at' => '2026-07-08 10:00:00',
            'duration_seconds' => $hours * 3600,
        ]);
    }

    TimeEntry::factory()->create([
        'project_id' => $laterHours,
        'started_at' => '2026-07-30 10:00:00',
        'duration_seconds' => 10 * 3600,
    ]);

    $this->actingAs($user)
        ->get(route('pm_board.index', [
            'project' => $twoHours->id,
            'period' => 'week',
            'anchor' => '2026-07-08',
        ]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('projects.0.id', $fiveHours->id)
            ->where('projects.0.periodHours', 5)
            ->where('projects.1.id', $twoHours->id)
            ->where('projects.1.periodHours', 2)
            ->where('projects.2.id', $zeroHours->id)
            ->where('projects.2.periodHours', 0)
            ->where('projects.3.id', $laterHours->id)
            ->where('projects.3.periodHours', 0));

    $this->actingAs($user)
        ->get(route('pm_board.index', [
            'project' => $twoHours->id,
            'period' => 'month',
            'anchor' => '2026-07-08',
        ]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('projects.0.id', $laterHours->id)
            ->where('projects.0.periodHours', 10)
            ->where('projects.1.id', $fiveHours->id)
            ->where('projects.2.id', $twoHours->id)
            ->where('projects.3.id', $zeroHours->id));
});

it('aggregates every visible project when no individual project is selected', function () {
    $user = globalPmBoardViewer();
    $person = Person::factory()->create(['name' => 'Ana']);
    $firstProject = Project::factory()->create(['client' => 'Acme', 'name' => 'Portal']);
    $secondProject = Project::factory()->create(['client' => 'Beta', 'name' => 'Mobile']);
    $firstTask = ClickUpTask::factory()->create([
        'project_id' => $firstProject,
        'name' => 'Task Acme',
        'status' => 'in progress',
    ]);
    $secondTask = ClickUpTask::factory()->create([
        'project_id' => $secondProject,
        'name' => 'Task Beta',
        'status' => 'to do',
    ]);

    foreach ([[$firstProject, $firstTask, 2], [$secondProject, $secondTask, 3]] as [$project, $task, $hours]) {
        TimeEntry::factory()->create([
            'project_id' => $project,
            'click_up_task_id' => $task,
            'person_id' => $person,
            'started_at' => '2026-07-08 10:00:00',
            'duration_seconds' => $hours * 3600,
        ]);
    }

    $this->actingAs($user)
        ->get(route('pm_board.index', [
            'period' => 'week',
            'anchor' => '2026-07-08',
        ]))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->where('allProjectsSelected', true)
            ->where('selectedProject', null)
            ->has('projects', 2)
            ->has('workedTasks', 2)
            ->where('workedTasks.0.projectLabel', 'Beta — Mobile')
            ->where('workedTasks.0.periodHours', 3)
            ->where('workedTasks.1.projectLabel', 'Acme — Portal')
            ->where('workedTasks.1.periodHours', 2)
            ->has('upcomingTasks', 2)
            ->where('peopleWorked.0', ['name' => 'Ana', 'hours' => 5, 'tasks' => 2])
            ->where('summaryCharts.projects', [
                ['label' => 'Beta — Mobile', 'hours' => 3],
                ['label' => 'Acme — Portal', 'hours' => 2],
            ])
            ->has('summaryCharts.timeline', 7)
            ->where('summaryCharts.timeline.2.label', 'Wed 8')
            ->where('summaryCharts.timeline.2.hours', 5)
            ->where('summaryCharts.timeline.2.projects', [
                ['label' => 'Beta — Mobile', 'hours' => 3],
                ['label' => 'Acme — Portal', 'hours' => 2],
            ])
            ->where('summaryCharts.people.0.key', 'person:'.$person->id)
            ->where('summaryCharts.people.0.name', 'Ana')
            ->where('summaryCharts.people.0.hours', 5)
            ->where('summaryCharts.people.0.tasks', 2)
            ->where('summaryCharts.people.0.projects', [
                ['label' => 'Beta — Mobile', 'hours' => 3],
                ['label' => 'Acme — Portal', 'hours' => 2],
            ])
            ->where('planning', null)
            ->where('gantt', null)
            ->where('kpis.actualHours', 5)
            ->where('kpis.workedTasks', 2)
            ->where('kpis.activePeople', 1)
            ->where('kpis.projects', 2));
});

it('aggregates a custom selection of multiple projects', function () {
    $user = globalPmBoardViewer();
    $firstProject = Project::factory()->create(['client' => 'Acme', 'name' => 'Portal']);
    $secondProject = Project::factory()->create(['client' => 'Beta', 'name' => 'Mobile']);
    $excludedProject = Project::factory()->create(['client' => 'Gamma', 'name' => 'Store']);

    foreach ([[$firstProject, 2], [$secondProject, 3], [$excludedProject, 7]] as [$project, $hours]) {
        $task = ClickUpTask::factory()->create(['project_id' => $project]);
        TimeEntry::factory()->create([
            'project_id' => $project,
            'click_up_task_id' => $task,
            'started_at' => '2026-07-08 10:00:00',
            'duration_seconds' => $hours * 3600,
        ]);
    }

    $this->actingAs($user)
        ->get(route('pm_board.index', [
            'selection' => 'custom',
            'projects' => [$firstProject->id, $secondProject->id],
            'period' => 'week',
            'anchor' => '2026-07-08',
        ]))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->where('allProjectsSelected', false)
            ->where('selectedProjectIds', [$secondProject->id, $firstProject->id])
            ->where('includeInternal', false)
            ->where('selectedProject', null)
            ->has('workedTasks', 2)
            ->where('kpis.actualHours', 5));
});

it('shows ClickUp calls and overhead as selectable internal activity', function () {
    $user = globalPmBoardViewer();
    $project = Project::factory()->create(['client' => 'Acme', 'name' => 'Portal']);
    $projectTask = ClickUpTask::factory()->create(['project_id' => $project]);
    $internalFolder = ClickUpFolder::factory()->create([
        'kind' => ClickUpLocationKind::Internal,
        'name' => 'BEE CODED Non-Project Tasks',
    ]);
    $internalList = ClickUpList::factory()->create([
        'click_up_folder_id' => $internalFolder,
        'project_id' => null,
        'name' => 'Overhead',
    ]);
    $internalTask = ClickUpTask::factory()->create([
        'project_id' => null,
        'clickup_list_id' => $internalList->clickup_list_id,
        'name' => 'Calls interne',
    ]);
    $unmappedList = ClickUpList::factory()->create(['project_id' => null]);
    $unmappedTask = ClickUpTask::factory()->create([
        'project_id' => null,
        'clickup_list_id' => $unmappedList->clickup_list_id,
        'name' => 'Proiect client nemapat',
    ]);

    foreach ([[$projectTask, $project, 2], [$internalTask, null, 4], [$unmappedTask, null, 8]] as [$task, $taskProject, $hours]) {
        TimeEntry::factory()->create([
            'project_id' => $taskProject,
            'click_up_task_id' => $task,
            'started_at' => '2026-07-08 10:00:00',
            'duration_seconds' => $hours * 3600,
        ]);
    }

    $this->actingAs($user)
        ->get(route('pm_board.index', [
            'selection' => 'custom',
            'include_internal' => true,
            'period' => 'week',
            'anchor' => '2026-07-08',
        ]))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->where('allProjectsSelected', false)
            ->where('selectedProjectIds', [])
            ->where('includeInternal', true)
            ->where('internalOption.available', true)
            ->where('internalOption.periodHours', 4)
            ->has('workedTasks', 1)
            ->where('workedTasks.0.name', 'Calls interne')
            ->where('workedTasks.0.projectLabel', 'Internal activities')
            ->where('kpis.actualHours', 4));

    $this->actingAs($user)
        ->get(route('pm_board.index', [
            'period' => 'week',
            'anchor' => '2026-07-08',
        ]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('allProjectsSelected', true)
            ->where('selectedProjectIds', [$project->id])
            ->where('includeInternal', true)
            ->has('workedTasks', 2)
            ->where('kpis.actualHours', 6));
});

it('keeps contributors with the same display name separate by stable identity', function () {
    $user = globalPmBoardViewer();
    $project = Project::factory()->create();
    $task = ClickUpTask::factory()->create(['project_id' => $project]);

    foreach ([['external-1', 2], ['external-2', 3]] as [$clickUpUserId, $hours]) {
        TimeEntry::factory()->create([
            'click_up_task_id' => $task,
            'person_id' => null,
            'clickup_user_id' => $clickUpUserId,
            'person_name' => 'Ana Pop',
            'project_id' => $project,
            'started_at' => '2026-07-08 10:00:00',
            'duration_seconds' => $hours * 3600,
        ]);
    }

    $this->actingAs($user)
        ->get(route('pm_board.index', [
            'project' => $project->id,
            'period' => 'week',
            'anchor' => '2026-07-08',
        ]))
        ->assertInertia(fn (Assert $page) => $page
            ->has('workedTasks.0.people', 2)
            ->has('peopleWorked', 2)
            ->where('kpis.activePeople', 2));
});
