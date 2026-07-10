<?php

use App\Enums\PermissionName;
use App\Models\ActualAdjustment;
use App\Models\Allocation;
use App\Models\Person;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\TimeOff;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;

beforeEach(function () {
    Permission::findOrCreate(PermissionName::ViewManagement->value);
});

function managementViewer(): User
{
    $user = User::factory()->create();
    $user->givePermissionTo(PermissionName::ViewManagement->value);

    return $user;
}

it('redirects guests and forbids users without management access', function () {
    $this->get(route('management.index'))->assertRedirect(route('login'));

    $this->actingAs(User::factory()->create())
        ->get(route('management.index'))
        ->assertForbidden();
});

it('aggregates plan actual adjustments and approved leave against available capacity', function () {
    $user = managementViewer();
    $person = Person::factory()->create([
        'name' => 'Ana Utilizare',
        'job_role' => 'Developer',
        'default_monthly_capacity_hours' => 160,
    ]);
    $project = Project::factory()->create();

    Allocation::factory()->create([
        'person_id' => $person,
        'project_id' => $project,
        'role' => 'Backend Developer',
        'month' => '2026-07-01',
        'planned_hours' => 60,
    ]);
    Allocation::factory()->create([
        'person_id' => $person,
        'project_id' => $project,
        'role' => 'Tech Lead',
        'month' => '2026-07-01',
        'planned_hours' => 40,
    ]);
    TimeEntry::factory()->create([
        'person_id' => $person,
        'project_id' => $project,
        'started_at' => '2026-07-15 10:00:00',
        'duration_seconds' => 90 * 3600,
    ]);
    ActualAdjustment::factory()->create([
        'person_id' => $person,
        'project_id' => $project,
        'internal_label' => null,
        'month' => '2026-07-01',
        'hours_delta' => 10,
    ]);
    TimeOff::factory()->create([
        'person_id' => $person,
        'status' => 'approved',
        'start_date' => '2026-07-02',
        'end_date' => '2026-07-06',
    ]);

    $this->actingAs($user)
        ->get(route('management.index'))
        ->assertSuccessful()
        ->assertInertia(fn (Assert $page) => $page
            ->component('management/index')
            ->has('months')
            ->has('rows', 1)
            ->where('rows.0.person.id', $person->id)
            ->where('rows.0.person.name', 'Ana Utilizare')
            ->where('rows.0.person.jobRole', 'Developer')
            ->where('rows.0.person.isExternal', false)
            ->where('rows.0.projectIds', [$project->id])
            ->where('rows.0.hasInternalActual', false)
            ->where('rows.0.months.2026-07.grossCapacityHours', 160)
            ->where('rows.0.months.2026-07.leaveDays', 3)
            ->where('rows.0.months.2026-07.leaveHours', 24)
            ->where('rows.0.months.2026-07.availableCapacityHours', 136)
            ->where('rows.0.months.2026-07.plannedHours', 100)
            ->where('rows.0.months.2026-07.actualHours', 100)
            ->where('rows.0.months.2026-07.estimatedPercent', 73.53)
            ->where('rows.0.months.2026-07.actualPercent', 73.53)
            ->where('rows.0.months.2026-07.isFullyOnLeave', false)
            ->where('rows.0.months.2026-07.estimatedStatus', 'underloaded')
            ->where('rows.0.months.2026-07.actualStatus', 'underloaded'));
});

it('keeps actual utilization null when the month has no reporting', function () {
    $user = managementViewer();
    $person = Person::factory()->create(['default_monthly_capacity_hours' => 160]);

    Allocation::factory()->create([
        'person_id' => $person,
        'month' => '2026-07-01',
        'planned_hours' => 80,
    ]);

    $this->actingAs($user)
        ->get(route('management.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('rows.0.months.2026-07.plannedHours', 80)
            ->where('rows.0.months.2026-07.estimatedPercent', 50)
            ->where('rows.0.months.2026-07.estimatedStatus', 'underloaded')
            ->where('rows.0.months.2026-07.actualHours', null)
            ->where('rows.0.months.2026-07.actualPercent', null)
            ->where('rows.0.months.2026-07.actualStatus', null));
});

it('marks a month with no available capacity as fully on leave', function () {
    $user = managementViewer();
    $person = Person::factory()->create(['default_monthly_capacity_hours' => 16]);

    Allocation::factory()->create([
        'person_id' => $person,
        'month' => '2026-07-01',
        'planned_hours' => 8,
    ]);
    TimeOff::factory()->create([
        'person_id' => $person,
        'status' => 'approved',
        'start_date' => '2026-07-01',
        'end_date' => '2026-07-02',
    ]);

    $this->actingAs($user)
        ->get(route('management.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('rows.0.months.2026-07.grossCapacityHours', 16)
            ->where('rows.0.months.2026-07.leaveDays', 2)
            ->where('rows.0.months.2026-07.leaveHours', 16)
            ->where('rows.0.months.2026-07.availableCapacityHours', 0)
            ->where('rows.0.months.2026-07.estimatedPercent', null)
            ->where('rows.0.months.2026-07.actualPercent', null)
            ->where('rows.0.months.2026-07.isFullyOnLeave', true)
            ->where('rows.0.months.2026-07.estimatedStatus', 'leave')
            ->where('rows.0.months.2026-07.actualStatus', 'leave'));
});

it('shows actual hours for an external person without calculating utilization', function () {
    $user = managementViewer();
    $person = Person::factory()->create([
        'is_external' => true,
        'default_monthly_capacity_hours' => 0,
    ]);
    $project = Project::factory()->create();

    TimeEntry::factory()->create([
        'person_id' => $person,
        'project_id' => $project,
        'started_at' => '2026-07-15 10:00:00',
        'duration_seconds' => 5 * 3600,
    ]);

    $this->actingAs($user)
        ->get(route('management.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('rows.0.person.id', $person->id)
            ->where('rows.0.person.isExternal', true)
            ->where('rows.0.months.2026-07.grossCapacityHours', 0)
            ->where('rows.0.months.2026-07.availableCapacityHours', 0)
            ->where('rows.0.months.2026-07.plannedHours', 0)
            ->where('rows.0.months.2026-07.actualHours', 5)
            ->where('rows.0.months.2026-07.estimatedPercent', null)
            ->where('rows.0.months.2026-07.actualPercent', null)
            ->where('rows.0.months.2026-07.isFullyOnLeave', false)
            ->where('rows.0.months.2026-07.estimatedStatus', null)
            ->where('rows.0.months.2026-07.actualStatus', null));
});

it('collects project ids from plan and actuals and flags internal actual work', function () {
    $user = managementViewer();
    $person = Person::factory()->create();
    $plannedProject = Project::factory()->create();
    $actualProject = Project::factory()->create();

    Allocation::factory()->create([
        'person_id' => $person,
        'project_id' => $plannedProject,
        'month' => '2026-07-01',
    ]);
    TimeEntry::factory()->create([
        'person_id' => $person,
        'project_id' => $actualProject,
        'started_at' => '2026-07-10 10:00:00',
    ]);
    ActualAdjustment::factory()->create([
        'person_id' => $person,
        'project_id' => null,
        'internal_label' => 'Training',
        'month' => '2026-07-01',
    ]);

    $this->actingAs($user)
        ->get(route('management.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('rows.0.projectIds', [$plannedProject->id, $actualProject->id])
            ->where('rows.0.hasInternalActual', true));
});

it('falls back to the allocation horizon from may through december', function () {
    $user = managementViewer();
    $person = Person::factory()->create();
    $project = Project::factory()->create();

    Allocation::factory()->create([
        'person_id' => $person,
        'project_id' => $project,
        'month' => '2026-05-01',
    ]);
    Allocation::factory()->create([
        'person_id' => $person,
        'project_id' => $project,
        'month' => '2026-12-01',
    ]);

    $this->actingAs($user)
        ->get(route('management.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('management/index')
            ->has('months', 8)
            ->where('months.0.key', '2026-05')
            ->where('months.7.key', '2026-12')
            ->has('rows.0.months.2026-05')
            ->has('rows.0.months.2026-12'));
});

it('classifies the agreed utilization color thresholds', function () {
    $user = managementViewer();
    $project = Project::factory()->create();
    $cases = [
        ['name' => 'A Zero', 'hours' => 0, 'status' => 'empty'],
        ['name' => 'B Nouăzeci', 'hours' => 90, 'status' => 'warning'],
        ['name' => 'C O sută cinci', 'hours' => 105, 'status' => 'warning'],
        ['name' => 'D Supraîncărcat', 'hours' => 106, 'status' => 'overloaded'],
    ];

    foreach ($cases as $case) {
        $person = Person::factory()->create([
            'name' => $case['name'],
            'default_monthly_capacity_hours' => 100,
            'hourly_rate' => 0,
        ]);
        Allocation::factory()->create([
            'person_id' => $person,
            'project_id' => $project,
            'month' => '2026-07-01',
            'planned_hours' => $case['hours'],
        ]);
        TimeEntry::factory()->create([
            'person_id' => $person,
            'project_id' => $project,
            'started_at' => '2026-07-15 10:00:00',
            'duration_seconds' => $case['hours'] * 3600,
        ]);
    }

    $this->actingAs($user)
        ->get(route('management.index'))
        ->assertInertia(function (Assert $page) use ($cases): void {
            $page->has('rows', count($cases));

            foreach ($cases as $index => $case) {
                $page->where("rows.{$index}.months.2026-07.estimatedStatus", $case['status'])
                    ->where("rows.{$index}.months.2026-07.actualStatus", $case['status']);
            }
        });
});
