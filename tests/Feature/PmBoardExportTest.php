<?php

use App\Enums\PermissionName;
use App\Enums\ProjectBoardTemplate;
use App\Models\ClickUpTask;
use App\Models\Person;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
use App\Models\WeeklyPlan;
use Spatie\Permission\Models\Permission;

beforeEach(function () {
    Permission::findOrCreate(PermissionName::ViewPmBoards->value);
    Permission::findOrCreate(PermissionName::ViewManagement->value);
});

it('protects the board csv export with the same permissions as the board', function () {
    $this->get(route('pm_board.export'))->assertRedirect(route('login'));

    $this->actingAs(User::factory()->create())
        ->get(route('pm_board.export'))
        ->assertForbidden();
});

it('exports every PM board section with the active scope and spreadsheet-safe values', function () {
    $user = User::factory()->create();
    $user->givePermissionTo(
        PermissionName::ViewPmBoards->value,
        PermissionName::ViewManagement->value,
    );
    $person = Person::factory()->create([
        'name' => 'Ana Developer',
        'weekly_capacity_hours' => 40,
    ]);
    $project = Project::factory()->create([
        'client' => 'Osiris',
        'name' => 'La Depozit',
        'contract_type' => ProjectBoardTemplate::Deliverables,
        'board_config' => ['gantt_modules' => ['safe-export-task' => 'CRM']],
    ]);
    $task = ClickUpTask::factory()->create([
        'project_id' => $project,
        'clickup_task_id' => 'safe-export-task',
        'name' => '=HYPERLINK("https://example.test")',
        'status' => 'in progress',
        'estimate_seconds' => 10 * 3600,
        'start_at' => '2026-07-06 09:00:00',
        'due_at' => '2026-07-24 18:00:00',
    ]);
    TimeEntry::factory()->create([
        'project_id' => $project,
        'click_up_task_id' => $task,
        'person_id' => $person,
        'started_at' => '2026-07-08 10:00:00',
        'duration_seconds' => 2 * 3600,
    ]);
    $plan = WeeklyPlan::query()->create([
        'project_id' => $project->id,
        'click_up_task_id' => $task->id,
        'week_start' => '2026-07-13',
        'selected' => true,
        'version' => 1,
        'created_by' => $user->id,
        'updated_by' => $user->id,
    ]);
    $plan->allocations()->create([
        'person_id' => $person->id,
        'hours' => 8,
        'created_by' => $user->id,
        'updated_by' => $user->id,
    ]);

    $response = $this->actingAs($user)->get(route('pm_board.export', [
        'project' => $project->id,
        'period' => 'week',
        'anchor' => '2026-07-08',
    ]));

    $response->assertOk()
        ->assertHeader('content-type', 'text/csv; charset=UTF-8')
        ->assertDownload('pm-board-osiris-la-depozit-2026-07-06.csv');

    $csv = $response->streamedContent();

    expect($csv)->toStartWith("\xEF\xBB\xBF")
        ->toContain('Key metrics')
        ->toContain('Hours over time')
        ->toContain('Hours by project')
        ->toContain('Project mix by person')
        ->toContain('Previous week / worked tasks')
        ->toContain('Work in progress and to do')
        ->toContain('People who worked')
        ->toContain('Resource planning')
        ->toContain('Gantt')
        ->toContain('CRM')
        ->toContain("'=HYPERLINK")
        ->not->toContain("\n=HYPERLINK");
});
