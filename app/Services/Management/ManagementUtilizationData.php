<?php

namespace App\Services\Management;

use App\Enums\TimeOffStatus;
use App\Models\ActualAdjustment;
use App\Models\Allocation;
use App\Models\Person;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Services\Capacity\SettingsService;
use App\Services\Planning\PlanningPeriod;
use Carbon\CarbonImmutable;

/**
 * @phpstan-type UtilizationMonth array{availableCapacityHours: float, plannedHours: float, actualHours: float|null}
 * @phpstan-type UtilizationRow array{person: array{id: int, name: string, jobRole: string|null, isExternal: bool}, months: array<string, UtilizationMonth>, projectIds: list<int>, hasInternalActual: bool}
 * @phpstan-type UtilizationPayload array{months: list<array{key: string, label: string}>, defaultStartMonth: string, people: list<array{id: int, name: string}>, roles: list<string>, projects: list<array{id: int, label: string}>, rows: list<UtilizationRow>}
 */
class ManagementUtilizationData
{
    public function __construct(
        private readonly PlanningPeriod $period,
        private readonly SettingsService $settings,
    ) {}

    /**
     * @param  list<int>|null  $personIds
     * @param  list<int>|null  $projectIds
     * @return UtilizationPayload
     */
    public function build(?array $personIds = null, ?array $projectIds = null): array
    {
        $months = $this->period->months();
        $firstMonth = $months[0];
        $lastMonth = $months[count($months) - 1];
        $monthKeys = array_map(fn (CarbonImmutable $month): string => $month->format('Y-m'), $months);
        $people = Person::query()
            ->select([
                'id',
                'name',
                'job_role',
                'default_monthly_capacity_hours',
                'hourly_rate',
                'is_external',
            ])
            ->where('active', true)
            ->when($personIds !== null, fn ($query) => $query->whereIn('id', $personIds))
            ->with([
                'capacities' => fn ($query) => $query
                    ->select(['id', 'person_id', 'month', 'capacity_hours'])
                    ->whereBetween('month', [$firstMonth, $lastMonth]),
                'timeOffs' => fn ($query) => $query
                    ->select(['id', 'person_id', 'status', 'start_date', 'end_date'])
                    ->where('active', true)
                    ->whereDate('start_date', '<=', $lastMonth->endOfMonth()->toDateString())
                    ->whereDate('end_date', '>=', $firstMonth->toDateString()),
            ])
            ->orderBy('name')
            ->get()
            ->keyBy('id');
        $allocations = Allocation::query()
            ->select(['person_id', 'project_id', 'month', 'planned_hours'])
            ->whereIn('person_id', $people->keys())
            ->when($projectIds !== null, fn ($query) => $query->whereIn('project_id', $projectIds))
            ->whereBetween('month', [$firstMonth, $lastMonth])
            ->get();
        $timeEntries = TimeEntry::query()
            ->select(['person_id', 'project_id', 'started_at', 'duration_seconds'])
            ->whereIn('person_id', $people->keys())
            ->when($projectIds !== null, fn ($query) => $query->whereIn('project_id', $projectIds))
            ->whereBetween('started_at', [$firstMonth, $lastMonth->endOfMonth()])
            ->get();
        $adjustments = ActualAdjustment::query()
            ->select(['person_id', 'project_id', 'month', 'hours_delta'])
            ->whereIn('person_id', $people->keys())
            ->when($projectIds !== null, fn ($query) => $query->whereIn('project_id', $projectIds))
            ->whereBetween('month', [$firstMonth, $lastMonth])
            ->get();
        $planned = [];
        $actual = [];
        $actualSeen = [];
        $projectIds = [];
        $hasInternalActual = [];

        foreach ($allocations as $allocation) {
            $personId = (int) $allocation->person_id;
            $month = CarbonImmutable::parse($allocation->month)->format('Y-m');
            $planned[$personId][$month] = ($planned[$personId][$month] ?? 0.0) + (float) $allocation->planned_hours;
            $projectIds[$personId][(int) $allocation->project_id] = true;
        }

        foreach ($timeEntries as $entry) {
            $personId = (int) $entry->person_id;
            $month = CarbonImmutable::parse($entry->started_at)->format('Y-m');
            $actual[$personId][$month] = ($actual[$personId][$month] ?? 0.0) + ((int) $entry->duration_seconds) / 3600;
            $actualSeen[$personId][$month] = true;

            if ($entry->project_id === null) {
                $hasInternalActual[$personId] = true;
            } else {
                $projectIds[$personId][(int) $entry->project_id] = true;
            }
        }

        foreach ($adjustments as $adjustment) {
            $personId = (int) $adjustment->person_id;
            $month = CarbonImmutable::parse($adjustment->month)->format('Y-m');
            $actual[$personId][$month] = ($actual[$personId][$month] ?? 0.0) + (float) $adjustment->hours_delta;
            $actualSeen[$personId][$month] = true;

            if ($adjustment->project_id === null) {
                $hasInternalActual[$personId] = true;
            } else {
                $projectIds[$personId][(int) $adjustment->project_id] = true;
            }
        }

        $rows = $people
            ->map(fn (Person $person): array => $this->personRow(
                person: $person,
                monthKeys: $monthKeys,
                planned: $planned[$person->getKey()] ?? [],
                actual: $actual[$person->getKey()] ?? [],
                actualSeen: $actualSeen[$person->getKey()] ?? [],
                projectIds: array_map('intval', array_keys($projectIds[$person->getKey()] ?? [])),
                hasInternalActual: $hasInternalActual[$person->getKey()] ?? false,
            ))
            ->filter(fn (array $row): bool => $this->shouldDisplay($row))
            ->values();
        $visibleProjectIds = $rows
            ->flatMap(fn (array $row): array => $row['projectIds'])
            ->unique()
            ->values();
        $projects = Project::query()
            ->select(['id', 'client', 'name'])
            ->whereIn('id', $visibleProjectIds)
            ->orderBy('client')
            ->orderBy('name')
            ->get()
            ->map(fn (Project $project): array => [
                'id' => $project->getKey(),
                'label' => trim($project->client.' — '.$project->name, ' —'),
            ])
            ->values()
            ->all();

        return [
            'months' => array_map(fn (CarbonImmutable $month): array => [
                'key' => $month->format('Y-m'),
                'label' => $this->period->label($month),
            ], $months),
            'defaultStartMonth' => $this->defaultStartMonth($monthKeys),
            'people' => array_values($rows->map(fn (array $row): array => [
                'id' => $row['person']['id'],
                'name' => $row['person']['name'],
            ])->all()),
            'roles' => array_values($rows->pluck('person.jobRole')->filter()->unique()->sort()->values()->all()),
            'projects' => array_values($projects),
            'rows' => array_values($rows->all()),
        ];
    }

    /**
     * @param  list<string>  $monthKeys
     * @param  array<string, float>  $planned
     * @param  array<string, float>  $actual
     * @param  array<string, bool>  $actualSeen
     * @param  list<int>  $projectIds
     * @return UtilizationRow&array<string, mixed>
     */
    private function personRow(
        Person $person,
        array $monthKeys,
        array $planned,
        array $actual,
        array $actualSeen,
        array $projectIds,
        bool $hasInternalActual,
    ): array {
        $capacityOverrides = $person->capacities->keyBy(
            fn ($capacity): string => CarbonImmutable::parse($capacity->month)->format('Y-m'),
        );
        $leaveDates = $this->leaveDates($person, $monthKeys);
        $monthData = [];

        foreach ($monthKeys as $month) {
            $grossHours = $person->is_external
                ? 0.0
                : (float) ($capacityOverrides->has($month)
                    ? $capacityOverrides->get($month)->capacity_hours
                    : $person->default_monthly_capacity_hours);
            $leaveDays = $person->is_external ? 0 : count($leaveDates[$month] ?? []);
            $leaveHours = round($leaveDays * $this->settings->hoursPerLeaveDay(), 2);
            $availableHours = max(0, round($grossHours - $leaveHours, 2));
            $plannedHours = round($planned[$month] ?? 0.0, 2);
            $actualHours = isset($actualSeen[$month]) ? round($actual[$month] ?? 0.0, 2) : null;
            $estimatedPercent = $person->is_external ? null : $this->percent($plannedHours, $availableHours);
            $actualPercent = $person->is_external || $actualHours === null
                ? null
                : $this->percent($actualHours, $availableHours);
            $isFullyOnLeave = ! $person->is_external && $grossHours > 0 && $availableHours <= 0 && $leaveHours > 0;

            $monthData[$month] = [
                'grossCapacityHours' => $grossHours,
                'leaveDays' => $leaveDays,
                'leaveHours' => $leaveHours,
                'availableCapacityHours' => $availableHours,
                'plannedHours' => $plannedHours,
                'actualHours' => $actualHours,
                'estimatedPercent' => $estimatedPercent,
                'actualPercent' => $actualPercent,
                'isFullyOnLeave' => $isFullyOnLeave,
                'estimatedStatus' => $isFullyOnLeave ? 'leave' : $this->status($estimatedPercent),
                'actualStatus' => $isFullyOnLeave ? 'leave' : $this->status($actualPercent),
            ];
        }

        return [
            'person' => [
                'id' => $person->getKey(),
                'name' => $person->name,
                'jobRole' => $person->job_role,
                'isExternal' => $person->is_external,
            ],
            'projectIds' => $projectIds,
            'hasInternalActual' => $hasInternalActual,
            'hourlyRate' => (float) $person->hourly_rate,
            'months' => $monthData,
        ];
    }

    /**
     * @param  list<string>  $monthKeys
     * @return array<string, array<string, true>>
     */
    private function leaveDates(Person $person, array $monthKeys): array
    {
        $dates = [];
        $periodStart = CarbonImmutable::createFromFormat('!Y-m', $monthKeys[0]);
        $periodEnd = CarbonImmutable::createFromFormat('!Y-m', $monthKeys[count($monthKeys) - 1])->endOfMonth();

        foreach ($person->timeOffs as $timeOff) {
            if (! TimeOffStatus::reducesCapacityFor($timeOff->status)) {
                continue;
            }

            $start = CarbonImmutable::parse($timeOff->start_date)->max($periodStart);
            $end = CarbonImmutable::parse($timeOff->end_date)->min($periodEnd);

            for ($date = $start; $date->lessThanOrEqualTo($end); $date = $date->addDay()) {
                if ($date->isWeekday()) {
                    $dates[$date->format('Y-m')][$date->toDateString()] = true;
                }
            }
        }

        return $dates;
    }

    /** @param array<string, mixed> $row */
    private function shouldDisplay(array $row): bool
    {
        if ($row['person']['isExternal'] || $row['hourlyRate'] > 0) {
            return true;
        }

        foreach ($row['months'] as $month) {
            if ($month['grossCapacityHours'] > 0 || $month['plannedHours'] > 0 || $month['actualHours'] !== null) {
                return true;
            }
        }

        return false;
    }

    private function percent(float $hours, float $availableHours): ?float
    {
        return $availableHours <= 0 ? null : round(($hours / $availableHours) * 100, 2);
    }

    private function status(?float $percent): ?string
    {
        if ($percent === null) {
            return null;
        }

        if ($percent > 105) {
            return 'overloaded';
        }

        if ($percent >= 90) {
            return 'warning';
        }

        return $percent > 0 ? 'underloaded' : 'empty';
    }

    /** @param list<string> $monthKeys */
    private function defaultStartMonth(array $monthKeys): string
    {
        $currentMonth = now()->startOfMonth()->format('Y-m');

        foreach ($monthKeys as $month) {
            if ($month >= $currentMonth) {
                return $month;
            }
        }

        return $monthKeys[max(0, count($monthKeys) - 6)];
    }
}
