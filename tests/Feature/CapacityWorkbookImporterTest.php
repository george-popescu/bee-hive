<?php

use App\Models\Allocation;
use App\Models\Person;
use App\Services\Capacity\HoursAggregator;
use App\Services\Import\CapacityWorkbookImporter;
use Carbon\CarbonImmutable;

function capacityWorkbookPath(): string
{
    return base_path('docs/Capacity alocation - pana in Dec 2026.xlsx');
}

it('reconciles every person month in the reference workbook', function () {
    $report = app(CapacityWorkbookImporter::class)->import(
        capacityWorkbookPath(),
        persist: false,
    );

    expect($report->isReconciled())->toBeTrue()
        ->and($report->mismatches())->toBe([])
        ->and($report->peopleCount)->toBe(15)
        ->and($report->projectsCount)->toBe(15)
        ->and($report->allocationsCount)->toBe(285)
        ->and($report->persisted)->toBeFalse()
        ->and(Person::query()->count())->toBe(0);
});

it('persists the reference workbook idempotently in canonical hours', function () {
    $importer = app(CapacityWorkbookImporter::class);
    $firstReport = $importer->import(capacityWorkbookPath());
    $allocationCount = Allocation::query()->count();
    $secondReport = $importer->import(capacityWorkbookPath());
    $alex = Person::query()->where('name', 'Alex Mateiu')->firstOrFail();
    $calin = Person::query()->where('name', 'Calin Stefanescu')->firstOrFail();
    $hours = app(HoursAggregator::class);

    expect($firstReport->persisted)->toBeTrue()
        ->and($secondReport->persisted)->toBeTrue()
        ->and($allocationCount)->toBe($firstReport->allocationsCount)
        ->and(Allocation::query()->count())->toBe($allocationCount)
        ->and($alex->default_monthly_capacity_hours)->toBe('138.00')
        ->and($hours->plannedForPerson(
            $alex,
            CarbonImmutable::parse('2026-05-01'),
        ))->toBe(82.8)
        ->and($hours->plannedForPerson(
            $calin,
            CarbonImmutable::parse('2026-07-01'),
        ))->toBe(85.0)
        ->and($hours->plannedForPerson(
            $calin,
            CarbonImmutable::parse('2026-08-01'),
        ))->toBe(0.0);
});

it('supports a command dry run without database writes', function () {
    $this->artisan('capacity:import-workbook', ['--dry-run' => true])
        ->expectsOutputToContain('control totals match')
        ->assertSuccessful();

    expect(Person::query()->count())->toBe(0)
        ->and(Allocation::query()->count())->toBe(0);
});
