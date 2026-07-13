<?php

namespace App\Services\Dashboard;

use App\Enums\PermissionName;
use App\Enums\SyncRunStatus;
use App\Models\ActualAdjustment;
use App\Models\Allocation;
use App\Models\Project;
use App\Models\SyncRun;
use App\Models\TimeEntry;
use App\Models\User;
use App\Services\Management\ManagementUtilizationData;
use App\Services\Planning\PlanningPeriod;
use App\Services\PmBoard\PmBoardScope;
use App\Services\TeamLead\TeamLeadScope;
use Carbon\CarbonImmutable;

/**
 * @phpstan-import-type UtilizationRow from ManagementUtilizationData
 */
class DashboardData
{
    public function __construct(
        private readonly ManagementUtilizationData $utilizationData,
        private readonly PlanningPeriod $period,
        private readonly TeamLeadScope $teamLeadScope,
        private readonly PmBoardScope $pmBoardScope,
        private readonly DashboardDataQuality $dataQuality,
    ) {}

    /** @return array<string, mixed> */
    public function for(User $user, ?string $requestedMonth = null): array
    {
        [$personIds, $projectIds, $scope] = $this->scope($user);
        $utilization = $this->utilizationData->build($personIds, $projectIds);
        $planningMonths = $this->period->months();
        $focusMonthDate = $this->focusMonth(
            months: $planningMonths,
            requestedMonth: $requestedMonth,
            defaultMonth: $utilization['defaultStartMonth'],
        );
        $focusMonth = $focusMonthDate->format('Y-m');
        $reporting = $this->reportingPeriod($focusMonthDate);
        $rows = collect($utilization['rows']);
        $activePersonIds = array_values($rows
            ->pluck('person.id')
            ->map(fn (mixed $id): int => (int) $id)
            ->values()
            ->all());
        $actualByPerson = $this->actualHoursByPerson(
            personIds: $activePersonIds,
            projectIds: $projectIds,
            start: $reporting['start'],
            end: $reporting['end'],
        );
        $focusRows = $rows->map(function (array $row) use ($actualByPerson, $focusMonth): array {
            $month = $row['months'][$focusMonth] ?? $this->emptyMonth();
            $personId = (int) $row['person']['id'];

            return [
                'person' => $row['person'],
                'availableCapacityHours' => (float) $month['availableCapacityHours'],
                'plannedHours' => (float) $month['plannedHours'],
                'actualHours' => array_key_exists($personId, $actualByPerson)
                    ? $actualByPerson[$personId]
                    : null,
            ];
        });
        $focusRowValues = array_values($focusRows->all());
        $capacity = round((float) $focusRows->sum('availableCapacityHours'), 2);
        $capacityToDate = round($capacity * $reporting['progress'], 2);
        $planned = round((float) $focusRows->sum('plannedHours'), 2);
        $actual = round((float) $focusRows->sum(fn (array $row): float => (float) ($row['actualHours'] ?? 0)), 2);
        $activePeople = $focusRows->filter(fn (array $row): bool => (float) ($row['actualHours'] ?? 0) > 0)->count();
        $forecast = $reporting['progress'] > 0
            ? round($actual / $reporting['progress'], 2)
            : null;
        $trend = collect($utilization['months'])
            ->map(fn (array $month): array => $this->trendMonth(array_values($rows->all()), $month))
            ->map(function (array $month) use ($activePeople, $actual, $actualByPerson, $focusMonth): array {
                if ($month['key'] !== $focusMonth) {
                    return $month;
                }

                return [
                    ...$month,
                    'actualHours' => $actualByPerson === [] ? null : $actual,
                    'activePeople' => $activePeople,
                ];
            })
            ->values();

        return [
            'scope' => $scope,
            'period' => $this->periodData($planningMonths, $focusMonthDate, $reporting),
            'focusMonth' => [
                'key' => $focusMonth,
                'label' => $this->period->label($focusMonthDate),
            ],
            'kpis' => [
                'capacityHours' => $capacity,
                'capacityToDateHours' => $capacityToDate,
                'plannedHours' => $planned,
                'actualHours' => $actual,
                'utilizationPercent' => $this->nullablePercent($actual, $capacityToDate),
                'monthlyUtilizationPercent' => $this->percent($actual, $capacity),
                'planningPercent' => $this->percent($planned, $capacity),
                'forecastHours' => $forecast,
                'forecastVsPlanHours' => $forecast === null ? null : round($forecast - $planned, 2),
                'paceStatus' => $this->paceStatus($forecast, $planned),
                'activePeople' => $activePeople,
                'people' => $focusRows->count(),
            ],
            'trend' => $trend->all(),
            'projects' => $this->projectPerformance(
                month: $focusMonth,
                personIds: $activePersonIds,
                projectIds: $projectIds,
                actualEnd: $reporting['end'],
            ),
            'attention' => $this->attention($focusRowValues),
            'alerts' => $this->alerts($focusRowValues),
            'dataQuality' => $scope['mode'] === 'empty'
                ? null
                : $this->dataQuality->build(
                    personIds: $personIds,
                    projectIds: $projectIds,
                    scopeMode: $scope['mode'],
                    start: $reporting['start'],
                    end: $reporting['end'],
                ),
            'sync' => $scope['mode'] === 'empty' ? null : $this->syncStatus(),
        ];
    }

    /** @return array{0: list<int>|null, 1: list<int>|null, 2: array{label: string, mode: string}} */
    private function scope(User $user): array
    {
        if ($user->can(PermissionName::ViewManagement->value)) {
            return [null, null, ['label' => __('messages.dashboard.company_scope'), 'mode' => 'company']];
        }

        if ($user->can(PermissionName::ViewTeamLead->value)) {
            return [$this->teamLeadScope->personIds($user), null, ['label' => __('messages.dashboard.team_scope'), 'mode' => 'team']];
        }

        if ($user->can(PermissionName::ViewPmBoards->value)) {
            $projectIds = $this->pmBoardScope->projectIds($user);

            return [
                $this->projectPeople($projectIds),
                $projectIds,
                ['label' => __('messages.dashboard.projects_scope'), 'mode' => 'projects'],
            ];
        }

        return [[], [], ['label' => __('messages.dashboard.empty_scope'), 'mode' => 'empty']];
    }

    /**
     * @param  list<CarbonImmutable>  $months
     */
    private function focusMonth(array $months, ?string $requestedMonth, string $defaultMonth): CarbonImmutable
    {
        if ($requestedMonth !== null) {
            foreach ($months as $month) {
                if ($month->format('Y-m') === $requestedMonth) {
                    return $month;
                }
            }
        }

        foreach ($months as $month) {
            if ($month->format('Y-m') === now()->format('Y-m')) {
                return $month;
            }
        }

        foreach ($months as $month) {
            if ($month->format('Y-m') === $defaultMonth) {
                return $month;
            }
        }

        return $months[0];
    }

    /**
     * @param  list<CarbonImmutable>  $months
     * @param  array{start: CarbonImmutable, end: CarbonImmutable, asOf: string|null, progress: float, elapsedWorkdays: int, totalWorkdays: int, state: string}  $reporting
     * @return array<string, mixed>
     */
    private function periodData(array $months, CarbonImmutable $selectedMonth, array $reporting): array
    {
        $selectedKey = $selectedMonth->format('Y-m');
        $selectedIndex = array_search($selectedKey, array_map(
            fn (CarbonImmutable $month): string => $month->format('Y-m'),
            $months,
        ), true);
        $selectedIndex = is_int($selectedIndex) ? $selectedIndex : 0;

        return [
            'selected' => $selectedKey,
            'label' => $this->period->label($selectedMonth),
            'options' => array_map(fn (CarbonImmutable $month): array => [
                'key' => $month->format('Y-m'),
                'label' => $this->period->label($month),
            ], $months),
            'previous' => $selectedIndex > 0 ? $months[$selectedIndex - 1]->format('Y-m') : null,
            'next' => $selectedIndex < count($months) - 1 ? $months[$selectedIndex + 1]->format('Y-m') : null,
            'asOf' => $reporting['asOf'],
            'state' => $reporting['state'],
            'progressPercent' => round($reporting['progress'] * 100, 1),
            'elapsedWorkdays' => $reporting['elapsedWorkdays'],
            'totalWorkdays' => $reporting['totalWorkdays'],
        ];
    }

    /**
     * @return array{start: CarbonImmutable, end: CarbonImmutable, asOf: string|null, progress: float, elapsedWorkdays: int, totalWorkdays: int, state: string}
     */
    private function reportingPeriod(CarbonImmutable $month): array
    {
        $start = $month->startOfMonth();
        $monthEnd = $month->endOfMonth();
        $today = now()->toImmutable();
        $totalWorkdays = $this->weekdays($start, $monthEnd);

        if ($today->isBefore($start)) {
            return [
                'start' => $start,
                'end' => $start->subSecond(),
                'asOf' => null,
                'progress' => 0.0,
                'elapsedWorkdays' => 0,
                'totalWorkdays' => $totalWorkdays,
                'state' => 'future',
            ];
        }

        $end = $today->isAfter($monthEnd) ? $monthEnd : $today->endOfDay();
        $elapsedWorkdays = $this->weekdays($start, $end);

        return [
            'start' => $start,
            'end' => $end,
            'asOf' => $end->toDateString(),
            'progress' => $totalWorkdays === 0 ? 0.0 : $elapsedWorkdays / $totalWorkdays,
            'elapsedWorkdays' => $elapsedWorkdays,
            'totalWorkdays' => $totalWorkdays,
            'state' => $today->isAfter($monthEnd) ? 'past' : 'current',
        ];
    }

    private function weekdays(CarbonImmutable $start, CarbonImmutable $end): int
    {
        if ($end->isBefore($start)) {
            return 0;
        }

        $days = 0;

        for ($date = $start->startOfDay(); $date->lessThanOrEqualTo($end); $date = $date->addDay()) {
            if ($date->isWeekday()) {
                $days++;
            }
        }

        return $days;
    }

    /** @param list<int> $projectIds
     * @return list<int>
     */
    private function projectPeople(array $projectIds): array
    {
        if ($projectIds === []) {
            return [];
        }

        $months = $this->period->months();
        $start = $months[0];
        $end = $months[count($months) - 1]->endOfMonth();

        return array_values(Allocation::query()
            ->whereIn('project_id', $projectIds)
            ->whereBetween('month', [$start, $end])
            ->pluck('person_id')
            ->merge(TimeEntry::query()
                ->whereIn('project_id', $projectIds)
                ->whereBetween('started_at', [$start, $end])
                ->whereNotNull('person_id')
                ->pluck('person_id'))
            ->merge(ActualAdjustment::query()
                ->whereIn('project_id', $projectIds)
                ->whereBetween('month', [$start, $end])
                ->pluck('person_id'))
            ->unique()
            ->sort()
            ->map(fn (mixed $id): int => (int) $id)
            ->values()
            ->all());
    }

    /**
     * @param  list<int>  $personIds
     * @param  list<int>|null  $projectIds
     * @return array<int, float>
     */
    private function actualHoursByPerson(
        array $personIds,
        ?array $projectIds,
        CarbonImmutable $start,
        CarbonImmutable $end,
    ): array {
        if ($personIds === [] || $end->isBefore($start)) {
            return [];
        }

        $actual = [];
        $entries = TimeEntry::query()
            ->select('person_id')
            ->selectRaw('SUM(duration_seconds) as aggregate_seconds')
            ->whereIn('person_id', $personIds)
            ->when($projectIds !== null, fn ($query) => $query->whereIn('project_id', $projectIds))
            ->whereBetween('started_at', [$start, $end])
            ->groupBy('person_id')
            ->get();

        foreach ($entries as $entry) {
            $actual[(int) $entry->person_id] = round(((int) $entry->getAttribute('aggregate_seconds')) / 3600, 2);
        }

        $adjustments = ActualAdjustment::query()
            ->select('person_id')
            ->selectRaw('SUM(hours_delta) as aggregate_hours')
            ->whereIn('person_id', $personIds)
            ->when($projectIds !== null, fn ($query) => $query->whereIn('project_id', $projectIds))
            ->whereBetween('effective_date', [$start->toDateString(), $end->toDateString()])
            ->groupBy('person_id')
            ->get();

        foreach ($adjustments as $adjustment) {
            $personId = (int) $adjustment->person_id;
            $actual[$personId] = round(
                ($actual[$personId] ?? 0.0) + (float) $adjustment->getAttribute('aggregate_hours'),
                2,
            );
        }

        return $actual;
    }

    /**
     * @param  list<UtilizationRow>  $rows
     * @param  array{key: string, label: string}  $month
     * @return array<string, float|string|int|null>
     */
    private function trendMonth(array $rows, array $month): array
    {
        $values = collect($rows)->map(fn (array $row): array => $row['months'][$month['key']] ?? $this->emptyMonth());
        $hasActual = $values->contains(fn (array $value): bool => $value['actualHours'] !== null);

        return [
            'key' => $month['key'],
            'label' => $month['label'],
            'capacityHours' => round((float) $values->sum('availableCapacityHours'), 2),
            'plannedHours' => round((float) $values->sum('plannedHours'), 2),
            'actualHours' => $hasActual
                ? round((float) $values->sum(fn (array $value): float => (float) ($value['actualHours'] ?? 0)), 2)
                : null,
            'activePeople' => $values->filter(fn (array $value): bool => (float) ($value['actualHours'] ?? 0) > 0)->count(),
        ];
    }

    /**
     * @param  list<array{person: array{id: int, name: string, jobRole: string|null, isExternal: bool}, availableCapacityHours: float, plannedHours: float, actualHours: float|null}>  $rows
     * @return list<array<string, mixed>>
     */
    private function attention(array $rows): array
    {
        $people = collect($rows)
            ->filter(fn (array $row): bool => ! $row['person']['isExternal'] && $row['availableCapacityHours'] > 0)
            ->map(function (array $row): array {
                $percent = $this->percent($row['plannedHours'], $row['availableCapacityHours']);

                return [
                    'id' => $row['person']['id'],
                    'name' => $row['person']['name'],
                    'role' => $row['person']['jobRole'],
                    'capacityHours' => $row['availableCapacityHours'],
                    'plannedHours' => $row['plannedHours'],
                    'actualHours' => $row['actualHours'],
                    'percent' => $percent,
                    'status' => $percent > 105 ? 'over' : ($percent >= 90 ? 'balanced' : 'under'),
                ];
            })
            ->values();
        $over = $people->where('status', 'over')->sortByDesc('percent')->take(3);

        return array_values($over
            ->concat($people->where('status', 'under')->sortBy('percent')->take(6 - $over->count()))
            ->concat($people->where('status', 'balanced')->sortByDesc('percent')->take(6 - $over->count()))
            ->unique('id')
            ->take(6)
            ->values()
            ->all());
    }

    /**
     * @param  list<int>  $personIds
     * @param  list<int>|null  $projectIds
     * @return list<array<string, mixed>>
     */
    private function projectPerformance(
        string $month,
        array $personIds,
        ?array $projectIds,
        CarbonImmutable $actualEnd,
    ): array {
        $start = CarbonImmutable::createFromFormat('!Y-m', $month);
        $monthEnd = $start->endOfMonth();
        $totals = [];

        $allocations = Allocation::query()
            ->select('project_id')
            ->selectRaw('SUM(planned_hours) as aggregate_hours')
            ->whereBetween('month', [$start, $monthEnd])
            ->whereIn('person_id', $personIds)
            ->when($projectIds !== null, fn ($query) => $query->whereIn('project_id', $projectIds))
            ->groupBy('project_id')
            ->get();

        foreach ($allocations as $allocation) {
            $totals[(int) $allocation->project_id]['planned'] = (float) $allocation->getAttribute('aggregate_hours');
        }

        if ($actualEnd->greaterThanOrEqualTo($start)) {
            $entries = TimeEntry::query()
                ->select('project_id')
                ->selectRaw('SUM(duration_seconds) as aggregate_seconds')
                ->whereBetween('started_at', [$start, $actualEnd])
                ->whereIn('person_id', $personIds)
                ->when($projectIds !== null, fn ($query) => $query->whereIn('project_id', $projectIds))
                ->groupBy('project_id')
                ->get();

            foreach ($entries as $entry) {
                $projectId = $entry->project_id === null ? 0 : (int) $entry->project_id;
                $totals[$projectId]['actual'] = ((int) $entry->getAttribute('aggregate_seconds')) / 3600;
            }

            $adjustments = ActualAdjustment::query()
                ->select('project_id')
                ->selectRaw('SUM(hours_delta) as aggregate_hours')
                ->whereBetween('effective_date', [$start->toDateString(), $actualEnd->toDateString()])
                ->whereIn('person_id', $personIds)
                ->when($projectIds !== null, fn ($query) => $query->whereIn('project_id', $projectIds))
                ->groupBy('project_id')
                ->get();

            foreach ($adjustments as $adjustment) {
                $projectId = $adjustment->project_id === null ? 0 : (int) $adjustment->project_id;
                $totals[$projectId]['actual'] = ($totals[$projectId]['actual'] ?? 0.0)
                    + (float) $adjustment->getAttribute('aggregate_hours');
            }
        }

        $projects = Project::query()
            ->select(['id', 'client', 'name'])
            ->whereIn('id', array_filter(array_keys($totals)))
            ->get()
            ->keyBy('id');

        return array_values(collect($totals)
            ->map(function (array $values, int|string $id) use ($projects): array {
                $project = (int) $id === 0 ? null : $projects->get((int) $id);
                $planned = round((float) ($values['planned'] ?? 0), 2);
                $actual = round((float) ($values['actual'] ?? 0), 2);

                return [
                    'id' => (int) $id,
                    'label' => $project === null
                        ? __('messages.common.internal_activities')
                        : trim($project->client.' — '.$project->name, ' —'),
                    'plannedHours' => $planned,
                    'actualHours' => $actual,
                    'varianceHours' => round($actual - $planned, 2),
                ];
            })
            ->sort(function (array $left, array $right): int {
                return ($right['actualHours'] <=> $left['actualHours'])
                    ?: ($right['plannedHours'] <=> $left['plannedHours']);
            })
            ->take(6)
            ->values()
            ->all());
    }

    /**
     * @param  list<array{person: array{id: int, name: string, jobRole: string|null, isExternal: bool}, availableCapacityHours: float, plannedHours: float, actualHours: float|null}>  $rows
     * @return list<array{tone: string, title: string, detail: string}>
     */
    private function alerts(array $rows): array
    {
        $alerts = [];
        $planning = collect($rows)
            ->filter(fn (array $row): bool => ! $row['person']['isExternal'] && $row['availableCapacityHours'] > 0)
            ->map(fn (array $row): float => $this->percent(
                $row['plannedHours'],
                $row['availableCapacityHours'],
            ));
        $over = $planning->filter(fn (float $value): bool => $value > 105)->count();
        $under = $planning->filter(fn (float $value): bool => $value < 70)->count();

        if ($over > 0) {
            $alerts[] = [
                'tone' => 'danger',
                'title' => trans_choice('messages.dashboard.overallocated', $over, ['count' => $over]),
                'detail' => __('messages.dashboard.overallocated_detail'),
            ];
        }

        if ($under > 0) {
            $alerts[] = [
                'tone' => 'warning',
                'title' => trans_choice('messages.dashboard.underallocated', $under, ['count' => $under]),
                'detail' => __('messages.dashboard.underallocated_detail'),
            ];
        }

        return $alerts;
    }

    /** @return array<string, mixed>|null */
    private function syncStatus(): ?array
    {
        $sync = SyncRun::query()->where('source', 'clickup')->latest('started_at')->first();

        if ($sync === null) {
            return null;
        }

        return [
            'status' => $sync->status->value,
            'startedAt' => $sync->started_at?->toIso8601String(),
            'finishedAt' => $sync->finished_at?->toIso8601String(),
            'error' => $sync->status === SyncRunStatus::Failed ? $sync->error_message : null,
            'counters' => $sync->counters,
        ];
    }

    /** @return array<string, float|null> */
    private function emptyMonth(): array
    {
        return [
            'availableCapacityHours' => 0.0,
            'plannedHours' => 0.0,
            'actualHours' => null,
        ];
    }

    private function nullablePercent(float $hours, float $capacity): ?float
    {
        return $capacity <= 0 ? null : round(($hours / $capacity) * 100, 1);
    }

    private function percent(float $hours, float $capacity): float
    {
        return $capacity <= 0 ? 0.0 : round(($hours / $capacity) * 100, 1);
    }

    private function paceStatus(?float $forecast, float $planned): string
    {
        if ($forecast === null) {
            return 'future';
        }

        if ($planned <= 0) {
            return $forecast > 0 ? 'over' : 'empty';
        }

        $percent = ($forecast / $planned) * 100;

        return $percent > 105 ? 'over' : ($percent >= 90 ? 'balanced' : 'under');
    }
}
