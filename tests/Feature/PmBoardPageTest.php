<?php

use App\Enums\PermissionName;
use App\Models\ClickUpTask;
use App\Models\Person;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
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
            ->where('period.label', '6 iul – 12 iul 2026')
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
            ->where('period.label', 'Iulie 2026')
            ->where('period.previousAnchor', '2026-06-15')
            ->where('period.nextAnchor', '2026-08-15')
            ->where('workedTasks.0.periodHours', 2));
});
