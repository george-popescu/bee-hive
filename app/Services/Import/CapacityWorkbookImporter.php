<?php

namespace App\Services\Import;

use App\Data\CapacityImportReconciliation;
use App\Data\CapacityImportReport;
use App\Models\Allocation;
use App\Models\Person;
use App\Models\Project;
use App\Services\Capacity\SettingsService;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use RuntimeException;
use UnexpectedValueException;

/**
 * @phpstan-type PersonRecord array{name: string, capacity_hours: float}
 * @phpstan-type ProjectRecord array{client: string, name: string}
 * @phpstan-type AllocationRecord array{client: string, project: string, person: string, role: string, month: CarbonImmutable, hours: float}
 * @phpstan-type Dataset array{
 *     people: array<string, PersonRecord>,
 *     projects: array<string, ProjectRecord>,
 *     allocations: array<string, AllocationRecord>,
 *     controls: array<string, array<string, float>>,
 *     imported_totals: array<string, array<string, float>>,
 *     months: array<string, CarbonImmutable>
 * }
 */
class CapacityWorkbookImporter
{
    public function __construct(private readonly SettingsService $settings) {}

    public function import(
        string $path,
        bool $persist = true,
        bool $replace = false,
    ): CapacityImportReport {
        if (! is_file($path) || ! is_readable($path)) {
            throw new RuntimeException("Capacity workbook is not readable: {$path}");
        }

        $workbook = IOFactory::load($path);

        try {
            $dataset = $this->readDataset($workbook);
            $reconciliations = $this->reconcile($dataset);
            $isReconciled = $this->allMatch($reconciliations);

            if ($persist && $isReconciled) {
                DB::transaction(fn () => $this->persist($dataset, $replace));
            }

            return new CapacityImportReport(
                peopleCount: count($dataset['people']),
                projectsCount: count($dataset['projects']),
                allocationsCount: count($dataset['allocations']),
                reconciliations: $reconciliations,
                persisted: $persist && $isReconciled,
            );
        } finally {
            $workbook->disconnectWorksheets();
        }
    }

    /** @return Dataset */
    private function readDataset(Spreadsheet $workbook): array
    {
        $peopleSheet = $this->sheet($workbook, 'Pe persoană');
        $allocationsSheet = $this->sheet($workbook, 'Alocări');

        $controlMonths = $this->monthColumns($peopleSheet, 3);
        $allocationMonths = $this->monthColumns($allocationsSheet, 5);
        $months = [];

        foreach (array_merge($controlMonths, $allocationMonths) as $month) {
            $months[$month->toDateString()] = $month;
        }

        $people = [];
        $controls = [];

        for ($row = 2; $row <= $peopleSheet->getHighestDataRow(); $row++) {
            $name = $this->text($peopleSheet->getCell([1, $row])->getCalculatedValue());

            if ($name === '') {
                continue;
            }

            $capacity = $this->hours(
                $peopleSheet->getCell([2, $row])->getCalculatedValue(),
                "Pe persoană!B{$row}",
            );

            $people[$name] = [
                'name' => $name,
                'capacity_hours' => $capacity,
            ];

            foreach ($controlMonths as $column => $month) {
                $monthKey = $month->toDateString();
                $controls[$name][$monthKey] = $this->hours(
                    $peopleSheet->getCell([$column, $row])->getCalculatedValue(),
                    'Pe persoană!'.Coordinate::stringFromColumnIndex($column).$row,
                );
            }
        }

        $projects = [];
        $allocations = [];
        $importedTotals = [];

        for ($row = 2; $row <= $allocationsSheet->getHighestDataRow(); $row++) {
            $client = $this->text($allocationsSheet->getCell([1, $row])->getCalculatedValue());
            $projectName = $this->text($allocationsSheet->getCell([2, $row])->getCalculatedValue());
            $personName = $this->text($allocationsSheet->getCell([3, $row])->getCalculatedValue());
            $role = $this->text($allocationsSheet->getCell([4, $row])->getCalculatedValue());

            if ($projectName === '' && $personName === '') {
                continue;
            }

            if ($client === '' || $projectName === '' || $personName === '') {
                throw new UnexpectedValueException("Incomplete allocation identity on row {$row}.");
            }

            if (! isset($people[$personName])) {
                $people[$personName] = [
                    'name' => $personName,
                    'capacity_hours' => $this->settings->defaultMonthlyCapacityHours(),
                ];
            }

            $projectKey = $this->key([$client, $projectName]);
            $projects[$projectKey] = ['client' => $client, 'name' => $projectName];

            foreach ($allocationMonths as $column => $month) {
                $cell = 'Alocări!'.Coordinate::stringFromColumnIndex($column).$row;
                $hours = $this->hours(
                    $allocationsSheet->getCell([$column, $row])->getCalculatedValue(),
                    $cell,
                );

                if ($hours < 0) {
                    throw new UnexpectedValueException("Negative planned hours in {$cell}.");
                }

                $monthKey = $month->toDateString();
                $importedTotals[$personName][$monthKey] = round(
                    ($importedTotals[$personName][$monthKey] ?? 0) + $hours,
                    2,
                );

                if ($hours === 0.0) {
                    continue;
                }

                $allocationKey = $this->key([
                    $client,
                    $projectName,
                    $personName,
                    $role,
                    $monthKey,
                ]);

                if (! isset($allocations[$allocationKey])) {
                    $allocations[$allocationKey] = [
                        'client' => $client,
                        'project' => $projectName,
                        'person' => $personName,
                        'role' => $role,
                        'month' => $month,
                        'hours' => 0,
                    ];
                }

                $allocations[$allocationKey]['hours'] = round(
                    $allocations[$allocationKey]['hours'] + $hours,
                    2,
                );
            }
        }

        return [
            'people' => $people,
            'projects' => $projects,
            'allocations' => $allocations,
            'controls' => $controls,
            'imported_totals' => $importedTotals,
            'months' => $months,
        ];
    }

    /**
     * @param  Dataset  $dataset
     * @return list<CapacityImportReconciliation>
     */
    private function reconcile(array $dataset): array
    {
        $people = array_unique(array_merge(
            array_keys($dataset['controls']),
            array_keys($dataset['imported_totals']),
        ));
        sort($people);

        $reconciliations = [];

        foreach ($people as $person) {
            foreach ($dataset['months'] as $monthKey => $month) {
                $reconciliations[] = new CapacityImportReconciliation(
                    person: $person,
                    month: $month,
                    expectedHours: $dataset['controls'][$person][$monthKey] ?? 0,
                    importedHours: $dataset['imported_totals'][$person][$monthKey] ?? 0,
                );
            }
        }

        return $reconciliations;
    }

    /** @param list<CapacityImportReconciliation> $reconciliations */
    private function allMatch(array $reconciliations): bool
    {
        foreach ($reconciliations as $reconciliation) {
            if (! $reconciliation->matches()) {
                return false;
            }
        }

        return true;
    }

    /** @param Dataset $dataset */
    private function persist(array $dataset, bool $replace): void
    {
        if ($replace) {
            Allocation::query()->delete();
        }

        $people = [];

        foreach ($dataset['people'] as $record) {
            $people[$record['name']] = Person::query()->updateOrCreate(
                ['name' => $record['name']],
                [
                    'default_monthly_capacity_hours' => $record['capacity_hours'],
                    'is_external' => false,
                    'active' => true,
                ],
            );
        }

        $projects = [];

        foreach ($dataset['projects'] as $key => $record) {
            $projects[$key] = Project::query()->firstOrCreate(
                ['client' => $record['client'], 'name' => $record['name']],
                ['board_visible' => true, 'active' => true],
            );
        }

        foreach ($dataset['allocations'] as $record) {
            $projectKey = $this->key([$record['client'], $record['project']]);

            $allocation = Allocation::query()
                ->whereBelongsTo($people[$record['person']])
                ->whereBelongsTo($projects[$projectKey])
                ->where('role', $record['role'])
                ->whereDate('month', $record['month']->toDateString())
                ->first();

            $allocation ??= new Allocation([
                'person_id' => $people[$record['person']]->getKey(),
                'project_id' => $projects[$projectKey]->getKey(),
                'role' => $record['role'],
                'month' => $record['month']->toDateString(),
            ]);
            $allocation->planned_hours = $record['hours'];
            $allocation->save();
        }
    }

    private function sheet(Spreadsheet $workbook, string $name): Worksheet
    {
        return $workbook->getSheetByName($name)
            ?? throw new UnexpectedValueException("Missing required worksheet: {$name}");
    }

    /** @return array<int, CarbonImmutable> */
    private function monthColumns(Worksheet $sheet, int $firstColumn): array
    {
        $monthNames = [
            'Ian' => 1,
            'Feb' => 2,
            'Mar' => 3,
            'Apr' => 4,
            'Mai' => 5,
            'Iun' => 6,
            'Iul' => 7,
            'Aug' => 8,
            'Sep' => 9,
            'Oct' => 10,
            'Nov' => 11,
            'Dec' => 12,
        ];
        $lastColumn = Coordinate::columnIndexFromString($sheet->getHighestDataColumn());
        $columns = [];

        for ($column = $firstColumn; $column <= $lastColumn; $column++) {
            $header = $this->text($sheet->getCell([$column, 1])->getValue());

            if (! preg_match('/^(Ian|Feb|Mar|Apr|Mai|Iun|Iul|Aug|Sep|Oct|Nov|Dec) (\d{4}) \(h\)$/u', $header, $matches)) {
                continue;
            }

            $columns[$column] = CarbonImmutable::create(
                (int) $matches[2],
                $monthNames[$matches[1]],
                1,
            )->startOfDay();
        }

        if ($columns === []) {
            throw new UnexpectedValueException("No monthly hour columns found in {$sheet->getTitle()}.");
        }

        return $columns;
    }

    private function text(mixed $value): string
    {
        $value = preg_replace('/\s+/u', ' ', trim((string) ($value ?? '')));

        return $value ?? '';
    }

    private function hours(mixed $value, string $cell): float
    {
        if ($value === null || $value === '' || $value === '-') {
            return 0.0;
        }

        if (! is_numeric($value)) {
            throw new UnexpectedValueException("Invalid hour value in {$cell}.");
        }

        return round((float) $value, 2);
    }

    /** @param list<string> $parts */
    private function key(array $parts): string
    {
        return implode("\u{001F}", $parts);
    }
}
