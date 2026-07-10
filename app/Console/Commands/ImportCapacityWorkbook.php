<?php

namespace App\Console\Commands;

use App\Data\CapacityImportReconciliation;
use App\Services\Import\CapacityWorkbookImporter;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('capacity:import-workbook
    {path=docs/Capacity alocation - pana in Dec 2026.xlsx : Workbook path, relative to the project or absolute}
    {--dry-run : Parse and reconcile without writing to the database}
    {--replace : Delete all existing allocations before importing the reconciled workbook}')]
#[Description('Import and reconcile the initial monthly capacity workbook')]
class ImportCapacityWorkbook extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(CapacityWorkbookImporter $importer): int
    {
        $path = (string) $this->argument('path');

        if (! str_starts_with($path, DIRECTORY_SEPARATOR)) {
            $path = base_path($path);
        }

        $dryRun = (bool) $this->option('dry-run');
        $report = $importer->import(
            path: $path,
            persist: ! $dryRun,
            replace: ! $dryRun && (bool) $this->option('replace'),
        );

        $this->components->info(sprintf(
            '%d people, %d projects and %d monthly allocations parsed.',
            $report->peopleCount,
            $report->projectsCount,
            $report->allocationsCount,
        ));

        if (! $report->isReconciled()) {
            $this->components->error('Workbook totals do not reconcile. Nothing was imported.');
            $this->table(
                ['Person', 'Month', 'Expected', 'Imported', 'Difference'],
                array_map(
                    fn (CapacityImportReconciliation $item): array => [
                        $item->person,
                        $item->month->format('Y-m'),
                        number_format($item->expectedHours, 2, '.', ''),
                        number_format($item->importedHours, 2, '.', ''),
                        number_format($item->difference(), 2, '.', ''),
                    ],
                    $report->mismatches(),
                ),
            );

            return self::FAILURE;
        }

        $this->components->info(sprintf(
            'All %d person-month control totals match.',
            count($report->reconciliations),
        ));

        if ($dryRun) {
            $this->components->warn('Dry run: the database was not changed.');
        } else {
            $this->components->info('Capacity workbook imported successfully.');
        }

        return self::SUCCESS;
    }
}
