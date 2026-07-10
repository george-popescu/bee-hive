<?php

use App\Models\Allocation;
use App\Models\Person;
use App\Services\Capacity\HoursAggregator;
use App\Services\Import\CapacityWorkbookImporter;
use Carbon\CarbonImmutable;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

function capacityWorkbookPath(): string
{
    return base_path('docs/Capacity alocation - pana in Dec 2026.xlsx');
}

it('reports the two control mismatches in the reference workbook without persisting', function () {
    $report = app(CapacityWorkbookImporter::class)->import(
        capacityWorkbookPath(),
    );

    expect($report->isReconciled())->toBeFalse()
        ->and($report->mismatches())->toHaveCount(2)
        ->and($report->mismatches()[0]->person)->toBe('Calin Stefanescu')
        ->and($report->mismatches()[0]->month->format('Y-m'))->toBe('2026-07')
        ->and($report->mismatches()[0]->difference())->toBe(5.0)
        ->and($report->mismatches()[1]->month->format('Y-m'))->toBe('2026-08')
        ->and($report->mismatches()[1]->difference())->toBe(-80.0)
        ->and($report->peopleCount)->toBe(15)
        ->and($report->projectsCount)->toBe(15)
        ->and($report->allocationsCount)->toBe(285)
        ->and($report->persisted)->toBeFalse()
        ->and(Person::query()->count())->toBe(0);
});

it('persists the reference workbook idempotently in canonical hours', function () {
    $workbook = IOFactory::load(capacityWorkbookPath());
    $controlSheet = $workbook->getSheetByName('Pe persoană');
    $controlSheet->setCellValue('E5', 85);
    $controlSheet->setCellValue('F5', 0);
    $path = tempnam(sys_get_temp_dir(), 'capacity-import-');

    if ($path === false) {
        throw new RuntimeException('Could not create a temporary workbook path.');
    }

    (new Xlsx($workbook))->save($path);
    $workbook->disconnectWorksheets();

    try {
        $importer = app(CapacityWorkbookImporter::class);
        $firstReport = $importer->import($path);
        $allocationCount = Allocation::query()->count();
        $secondReport = $importer->import($path);
        $alex = Person::query()->where('name', 'Alex Mateiu')->firstOrFail();

        expect($firstReport->persisted)->toBeTrue()
            ->and($secondReport->persisted)->toBeTrue()
            ->and($allocationCount)->toBe($firstReport->allocationsCount)
            ->and(Allocation::query()->count())->toBe($allocationCount)
            ->and($alex->default_monthly_capacity_hours)->toBe('138.00')
            ->and(app(HoursAggregator::class)->plannedForPerson(
                $alex,
                CarbonImmutable::parse('2026-05-01'),
            ))->toBe(82.8);
    } finally {
        @unlink($path);
    }
});

it('fails the command dry run on mismatches without database writes', function () {
    $this->artisan('capacity:import-workbook', ['--dry-run' => true])
        ->expectsOutputToContain('do not reconcile')
        ->assertFailed();

    expect(Person::query()->count())->toBe(0)
        ->and(Allocation::query()->count())->toBe(0);
});
