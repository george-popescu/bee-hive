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
    ) {}

    /** @return array<string, mixed> */
    public function for(User $user): array
    {
        [$personIds, $projectIds, $scope] = $this->scope($user);
        $utilization = $this->utilizationData->build($personIds, $projectIds);
        $focusMonth = $this->focusMonth($utilization['months'], $utilization['defaultStartMonth']);
        $rows = collect($utilization['rows']);
        $activePersonIds = array_values($rows
            ->pluck('person.id')
            ->map(fn (mixed $id): int => (int) $id)
            ->values()
            ->all());
        $focusRows = $rows->map(function (array $row) use ($focusMonth): array {
            $month = $row['months'][$focusMonth] ?? $this->emptyMonth();

            return [
                'person' => $row['person'],
                'availableCapacityHours' => (float) $month['availableCapacityHours'],
                'plannedHours' => (float) $month['plannedHours'],
                'actualHours' => $month['actualHours'] === null ? null : (float) $month['actualHours'],
            ];
        });
        $trend = collect($utilization['months'])
            ->map(fn (array $month): array => $this->trendMonth(array_values($rows->all()), $month))
            ->values();
        $capacity = round((float) $focusRows->sum('availableCapacityHours'), 2);
        $planned = round((float) $focusRows->sum('plannedHours'), 2);
        $actual = round((float) $focusRows->sum(fn (array $row): float => (float) ($row['actualHours'] ?? 0)), 2);
        $focusRowValues = array_values($focusRows->all());
        $attention = $this->attention($focusRowValues);

        return [
            'scope' => $scope,
            'focusMonth' => [
                'key' => $focusMonth,
                'label' => collect($utilization['months'])->firstWhere('key', $focusMonth)['label'] ?? $focusMonth,
            ],
            'kpis' => [
                'capacityHours' => $capacity,
                'plannedHours' => $planned,
                'actualHours' => $actual,
                'utilizationPercent' => $this->percent($actual, $capacity),
                'planningPercent' => $this->percent($planned, $capacity),
                'activePeople' => $focusRows->filter(fn (array $row): bool => (float) ($row['actualHours'] ?? 0) > 0)->count(),
                'people' => $focusRows->count(),
            ],
            'trend' => $trend->all(),
            'projects' => $this->projectPerformance(
                month: $focusMonth,
                personIds: $activePersonIds,
                projectIds: $projectIds,
            ),
            'attention' => $attention,
            'alerts' => $this->alerts($focusRowValues),
            'sync' => $scope['mode'] === 'empty' ? null : $this->syncStatus(),
        ];
    }

    /** @return array{0: list<int>|null, 1: list<int>|null, 2: array{label: string, mode: string}} */
    private function scope(User $user): array
    {
        if ($user->can(PermissionName::ViewManagement->value)) {
            return [null, null, ['label' => 'Toată compania', 'mode' => 'company']];
        }

        if ($user->can(PermissionName::ViewTeamLead->value)) {
            return [$this->teamLeadScope->personIds($user), null, ['label' => 'Echipa mea', 'mode' => 'team']];
        }

        if ($user->can(PermissionName::ViewPmBoards->value)) {
            $projectIds = $this->pmBoardScope->projectIds($user);

            return [
                $this->projectPeople($projectIds),
                $projectIds,
                ['label' => 'Proiectele mele', 'mode' => 'projects'],
            ];
        }

        return [[], [], ['label' => 'Fără scope operațional', 'mode' => 'empty']];
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

    /** @param list<array{key: string, label: string}> $months */
    private function focusMonth(array $months, string $default): string
    {
        $current = now()->format('Y-m');

        return collect($months)->contains('key', $current) ? $current : $default;
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
            ->filter(fn (array $row): bool => ! $row['person']['isExternal'] && (float) $row['availableCapacityHours'] > 0)
            ->map(function (array $row): array {
                $percent = $this->percent((float) $row['plannedHours'], (float) $row['availableCapacityHours']);

                return [
                    'id' => $row['person']['id'],
                    'name' => $row['person']['name'],
                    'role' => $row['person']['jobRole'],
                    'capacityHours' => (float) $row['availableCapacityHours'],
                    'plannedHours' => (float) $row['plannedHours'],
                    'actualHours' => $row['actualHours'] === null ? null : (float) $row['actualHours'],
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
    private function projectPerformance(string $month, array $personIds, ?array $projectIds): array
    {
        $start = CarbonImmutable::createFromFormat('!Y-m', $month);
        $end = $start->endOfMonth();
        $totals = [];

        $allocations = Allocation::query()
            ->select('project_id')
            ->selectRaw('SUM(planned_hours) as aggregate_hours')
            ->whereBetween('month', [$start, $end])
            ->whereIn('person_id', $personIds)
            ->when($projectIds !== null, fn ($query) => $query->whereIn('project_id', $projectIds))
            ->groupBy('project_id')
            ->get();

        foreach ($allocations as $allocation) {
            $id = (int) $allocation->project_id;
            $totals[$id]['planned'] = (float) $allocation->getAttribute('aggregate_hours');
        }

        $entries = TimeEntry::query()
            ->select('project_id')
            ->selectRaw('SUM(duration_seconds) as aggregate_seconds')
            ->whereBetween('started_at', [$start, $end])
            ->whereIn('person_id', $personIds)
            ->when($projectIds !== null, fn ($query) => $query->whereIn('project_id', $projectIds))
            ->groupBy('project_id')
            ->get();

        foreach ($entries as $entry) {
            $id = $entry->project_id === null ? 0 : (int) $entry->project_id;
            $totals[$id]['actual'] = ((int) $entry->getAttribute('aggregate_seconds')) / 3600;
        }

        $adjustments = ActualAdjustment::query()
            ->select('project_id')
            ->selectRaw('SUM(hours_delta) as aggregate_hours')
            ->whereBetween('month', [$start, $end])
            ->whereIn('person_id', $personIds)
            ->when($projectIds !== null, fn ($query) => $query->whereIn('project_id', $projectIds))
            ->groupBy('project_id')
            ->get();

        foreach ($adjustments as $adjustment) {
            $id = $adjustment->project_id === null ? 0 : (int) $adjustment->project_id;
            $totals[$id]['actual'] = ($totals[$id]['actual'] ?? 0.0) + (float) $adjustment->getAttribute('aggregate_hours');
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
                        ? 'Activități interne'
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
            ->filter(fn (array $row): bool => ! $row['person']['isExternal'] && (float) $row['availableCapacityHours'] > 0)
            ->map(fn (array $row): float => $this->percent(
                (float) $row['plannedHours'],
                (float) $row['availableCapacityHours'],
            ));
        $over = $planning->filter(fn (float $value): bool => $value > 105)->count();
        $under = $planning->filter(fn (float $value): bool => $value < 70)->count();

        if ($over > 0) {
            $alerts[] = [
                'tone' => 'danger',
                'title' => $over === 1 ? '1 persoană este supra-alocată' : "$over persoane sunt supra-alocate",
                'detail' => 'Planificarea depășește 105% din capacitatea disponibilă.',
            ];
        }

        if ($under > 0) {
            $alerts[] = [
                'tone' => 'warning',
                'title' => $under === 1 ? '1 persoană are disponibilitate mare' : "$under persoane au disponibilitate mare",
                'detail' => 'Planificarea este sub 70% din capacitatea disponibilă.',
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

    private function percent(float $hours, float $capacity): float
    {
        return $capacity <= 0 ? 0.0 : round(($hours / $capacity) * 100, 1);
    }
}
