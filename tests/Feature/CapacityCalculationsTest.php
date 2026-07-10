<?php

use App\Data\MonthlyUtilization;
use App\Enums\PlanVarianceStatus;
use App\Models\ActualAdjustment;
use App\Models\Allocation;
use App\Models\Person;
use App\Models\PersonCapacity;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\TimeOff;
use App\Services\Capacity\AvailableCapacityCalculator;
use App\Services\Capacity\HoursAggregator;
use App\Services\Capacity\PlanVarianceCalculator;
use App\Services\Capacity\UtilizationCalculator;
use Carbon\CarbonImmutable;

it('calculates available capacity using working leave days and a monthly override', function () {
    $month = CarbonImmutable::parse('2026-07-01');
    $person = Person::factory()->create(['default_monthly_capacity_hours' => 138]);

    PersonCapacity::factory()->create([
        'person_id' => $person,
        'month' => $month,
        'capacity_hours' => 160,
    ]);

    TimeOff::factory()->create([
        'person_id' => $person,
        'status' => 'approved',
        'start_date' => '2026-07-02',
        'end_date' => '2026-07-06',
    ]);

    TimeOff::factory()->create([
        'person_id' => $person,
        'status' => 'requires approval',
        'start_date' => '2026-07-07',
        'end_date' => '2026-07-08',
    ]);

    $calculator = app(AvailableCapacityCalculator::class);

    expect($calculator->grossHours($person, $month))->toBe(160.0)
        ->and($calculator->leaveWorkingDays($person, $month))->toBe(3)
        ->and($calculator->leaveHours($person, $month))->toBe(24.0)
        ->and($calculator->availableHours($person, $month))->toBe(136.0);
});

it('does not count overlapping leave dates twice', function () {
    $month = CarbonImmutable::parse('2026-07-01');
    $person = Person::factory()->create();

    TimeOff::factory()->create([
        'person_id' => $person,
        'status' => 'approved',
        'start_date' => '2026-06-30',
        'end_date' => '2026-07-03',
    ]);

    TimeOff::factory()->create([
        'person_id' => $person,
        'status' => 'complete',
        'start_date' => '2026-07-03',
        'end_date' => '2026-07-06',
    ]);

    expect(app(AvailableCapacityCalculator::class)->leaveWorkingDays($person, $month))->toBe(4);
});

it('aggregates planned and actual hours without turning missing reporting into zero', function () {
    $month = CarbonImmutable::parse('2026-07-01');
    $person = Person::factory()->create();
    $project = Project::factory()->create();

    Allocation::factory()->create([
        'person_id' => $person,
        'project_id' => $project,
        'role' => 'Developer',
        'month' => $month,
        'planned_hours' => 40,
    ]);
    Allocation::factory()->create([
        'person_id' => $person,
        'project_id' => $project,
        'role' => 'Tech Lead',
        'month' => $month,
        'planned_hours' => 28,
    ]);

    TimeEntry::factory()->create([
        'person_id' => $person,
        'project_id' => $project,
        'started_at' => '2026-07-15 10:00:00',
        'duration_seconds' => 31 * 3600,
    ]);

    ActualAdjustment::factory()->create([
        'person_id' => $person,
        'project_id' => $project,
        'month' => $month,
        'hours_delta' => 3,
    ]);

    $hours = app(HoursAggregator::class);

    expect($hours->plannedForPerson($person, $month))->toBe(68.0)
        ->and($hours->plannedForProject($person, $project, $month))->toBe(68.0)
        ->and($hours->actualForPerson($person, $month))->toBe(34.0)
        ->and($hours->actualForProject($person, $project, $month))->toBe(34.0)
        ->and($hours->actualForProject($person, null, $month))->toBeNull()
        ->and($hours->actualForPerson($person, $month->addMonth()))->toBeNull();
});

it('calculates utilization against available capacity', function () {
    $month = CarbonImmutable::parse('2026-07-01');
    $person = Person::factory()->create(['default_monthly_capacity_hours' => 160]);
    $project = Project::factory()->create();

    TimeOff::factory()->create([
        'person_id' => $person,
        'status' => 'on leave',
        'start_date' => '2026-07-02',
        'end_date' => '2026-07-06',
    ]);
    Allocation::factory()->create([
        'person_id' => $person,
        'project_id' => $project,
        'month' => $month,
        'planned_hours' => 68,
    ]);
    TimeEntry::factory()->create([
        'person_id' => $person,
        'project_id' => $project,
        'started_at' => '2026-07-15 10:00:00',
        'duration_seconds' => 34 * 3600,
    ]);

    $metrics = app(UtilizationCalculator::class)->forMonth($person, $month);

    expect($metrics->grossCapacityHours)->toBe(160.0)
        ->and($metrics->leaveHours)->toBe(24.0)
        ->and($metrics->availableCapacityHours)->toBe(136.0)
        ->and($metrics->plannedHours)->toBe(68.0)
        ->and($metrics->actualHours)->toBe(34.0)
        ->and($metrics->estimatedPercent)->toBe(50.0)
        ->and($metrics->actualPercent)->toBe(25.0)
        ->and($metrics->isFullyOnLeave)->toBeFalse();
});

it('returns leave state instead of utilization when no capacity remains', function () {
    $month = CarbonImmutable::parse('2026-07-01');
    $person = Person::factory()->create(['default_monthly_capacity_hours' => 8]);

    TimeOff::factory()->create([
        'person_id' => $person,
        'status' => 'approved',
        'start_date' => '2026-07-01',
        'end_date' => '2026-07-01',
    ]);

    $metrics = app(UtilizationCalculator::class)->forMonth($person, $month);

    expect($metrics->availableCapacityHours)->toBe(0.0)
        ->and($metrics->estimatedPercent)->toBeNull()
        ->and($metrics->actualPercent)->toBeNull()
        ->and($metrics->isFullyOnLeave)->toBeTrue();
});

it('averages actual utilization only over months with reporting', function () {
    $calculator = app(UtilizationCalculator::class);
    $month = CarbonImmutable::parse('2026-07-01');
    $metrics = [
        new MonthlyUtilization($month, 100, 0, 100, 50, 25, 50, 25, false),
        new MonthlyUtilization($month->addMonth(), 100, 0, 100, 100, null, 100, null, false),
    ];

    expect($calculator->estimatedAverage($metrics))->toBe(75.0)
        ->and($calculator->actualAverage($metrics))->toBe(25.0);
});

it('classifies plan variance boundaries', function (
    float $planned,
    float $actual,
    PlanVarianceStatus $expected,
) {
    expect(app(PlanVarianceCalculator::class)->classify($planned, $actual))->toBe($expected);
})->with([
    'minus ten percent is on plan' => [100, 90, PlanVarianceStatus::OnPlan],
    'plus ten percent is on plan' => [100, 110, PlanVarianceStatus::OnPlan],
    'minus twenty five percent is neutral' => [100, 75, PlanVarianceStatus::Neutral],
    'below minus twenty five percent is significant' => [100, 74.99, PlanVarianceStatus::SignificantVariance],
    'plus twenty five percent is neutral' => [100, 125, PlanVarianceStatus::Neutral],
    'above plus twenty five percent is significant' => [100, 125.01, PlanVarianceStatus::SignificantVariance],
    'hours without plan are unplanned' => [0, 5, PlanVarianceStatus::Unplanned],
    'no plan and no actual is empty' => [0, 0, PlanVarianceStatus::Empty],
]);
