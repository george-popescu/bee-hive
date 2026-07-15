<?php

namespace App\Services\TeamLead;

use App\Enums\PermissionName;
use App\Enums\TimeOffStatus;
use App\Models\ActualAdjustment;
use App\Models\Allocation;
use App\Models\AuditLog;
use App\Models\Person;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
use App\Services\Capacity\PlanVarianceCalculator;
use App\Services\Capacity\SettingsService;
use App\Services\Planning\PlanningPeriod;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use LogicException;

final class TeamLeadPlanData
{
    public function __construct(
        private readonly TeamLeadScope $scope,
        private readonly PlanningPeriod $period,
        private readonly PlanVarianceCalculator $variance,
        private readonly SettingsService $settings,
    ) {}

    /** @return array<string, mixed> */
    public function for(User $user, CarbonImmutable $week): array
    {
        $months = $this->period->months();
        $firstMonth = $months[0] ?? throw new LogicException('The planning period has no months.');
        $lastMonth = $months[count($months) - 1] ?? throw new LogicException('The planning period has no months.');
        $monthKeys = array_map(fn (CarbonImmutable $month): string => $month->format('Y-m'), $months);
        $personIds = $this->scope->personIds($user);
        $timeOffRangeStart = $firstMonth->startOfMonth()->min($week->startOfWeek());
        $timeOffRangeEnd = $lastMonth->endOfMonth()->max($week->endOfWeek());
        $people = Person::query()
            ->select(['id', 'name', 'job_role', 'default_monthly_capacity_hours', 'weekly_capacity_hours', 'is_external'])
            ->whereIn('id', $personIds)
            ->where('active', true)
            ->with([
                'capacities' => fn ($query) => $query
                    ->select(['id', 'person_id', 'month', 'capacity_hours'])
                    ->whereBetween('month', [$firstMonth, $lastMonth]),
                'teams' => fn ($query) => $query
                    ->select(['teams.id', 'teams.name'])
                    ->where('teams.active', true)
                    ->orderBy('teams.name'),
                'timeOffs' => fn ($query) => $query
                    ->select(['id', 'person_id', 'status', 'start_date', 'end_date', 'active'])
                    ->where('active', true)
                    ->whereDate('start_date', '<=', $timeOffRangeEnd->toDateString())
                    ->whereDate('end_date', '>=', $timeOffRangeStart->toDateString()),
            ])
            ->orderBy('name')
            ->get()
            ->keyBy('id');
        $allProjects = Project::query()
            ->select(['id', 'client', 'name', 'active'])
            ->orderBy('client')
            ->orderBy('name')
            ->get()
            ->keyBy('id');
        $allocations = Allocation::query()
            ->select(['id', 'person_id', 'project_id', 'role', 'month', 'planned_hours', 'weekly_hours', 'planning_comment', 'updated_by', 'updated_at'])
            ->whereIn('person_id', $people->keys())
            ->whereBetween('month', [$firstMonth, $lastMonth])
            ->with(['updater:id,name'])
            ->orderBy('person_id')
            ->orderBy('project_id')
            ->orderBy('role')
            ->get();
        $rows = [];

        foreach ($allocations as $allocation) {
            $person = $people->get($allocation->person_id);
            $project = $allProjects->get($allocation->project_id);

            if ($person === null || $project === null) {
                continue;
            }

            $key = implode('|', [$allocation->person_id, $allocation->project_id, $allocation->role]);
            $rows[$key] ??= [
                'key' => sha1($key),
                'person' => $this->personData($person, $monthKeys),
                'project' => $this->projectData($project),
                'role' => $allocation->role,
                'hours' => array_fill_keys($monthKeys, 0.0),
            ];
            $rows[$key]['hours'][CarbonImmutable::parse($allocation->month)->format('Y-m')] = (float) $allocation->planned_hours;
        }

        $comparisonRows = $this->comparisonRows(
            people: $people,
            projects: $allProjects,
            allocations: $allocations,
            monthKeys: $monthKeys,
            firstMonth: $firstMonth,
            lastMonth: $lastMonth,
        );
        $adjustmentRows = $this->adjustmentRows($people, $allProjects, $firstMonth, $lastMonth);
        $capacityRows = $this->capacityRows($people, $allocations, $comparisonRows, $monthKeys);

        return [
            'months' => array_map(fn (CarbonImmutable $month): array => [
                'key' => $month->format('Y-m'),
                'label' => $this->period->label($month),
            ], $months),
            'people' => $people->map(fn (Person $person): array => [
                'id' => $person->getKey(),
                'name' => $person->name,
                'jobRole' => $person->job_role,
                'isExternal' => $person->is_external,
                'teamIds' => $person->teams->pluck('id')->map(fn (mixed $id): int => (int) $id)->values()->all(),
            ])->values()->all(),
            'teams' => $people
                ->flatMap->teams
                ->unique('id')
                ->sortBy('name')
                ->map(fn ($team): array => ['id' => (int) $team->getKey(), 'name' => $team->name])
                ->values()
                ->all(),
            'projects' => $allProjects->map(fn (Project $project): array => $this->projectData($project))->values()->all(),
            'roles' => $allocations->pluck('role')
                ->merge($people->pluck('job_role'))
                ->filter()
                ->unique()
                ->sort()
                ->values()
                ->all(),
            'planRows' => array_values($rows),
            'comparisonRows' => $comparisonRows,
            'capacityRows' => $capacityRows,
            'weekly' => $this->weeklyData($people, $allProjects, $week),
            'allocationEntries' => $allocations->map(fn (Allocation $allocation): array => [
                'id' => $allocation->getKey(),
                'personId' => $allocation->person_id,
                'projectId' => $allocation->project_id,
                'role' => $allocation->role,
                'month' => CarbonImmutable::parse($allocation->month)->format('Y-m'),
                'hours' => (float) $allocation->planned_hours,
                'weeklyHours' => collect($allocation->weekly_hours ?? [])->map(fn (array $week): array => [
                    'weekStart' => $week['week_start'],
                    'hours' => (float) $week['hours'],
                ])->values()->all(),
                'planningComment' => $allocation->planning_comment,
                'updatedBy' => $allocation->updater?->name,
                'updatedAt' => $allocation->updated_at?->toIso8601String(),
            ])->values()->all(),
            'allocationHistory' => $this->allocationHistory($allocations),
            'adjustments' => $adjustmentRows,
            'permissions' => [
                'manageAllocations' => $user->can(PermissionName::ManageAllocations->value),
                'adjustActualHours' => $user->can(PermissionName::AdjustActualHours->value),
            ],
        ];
    }

    /**
     * @param  Collection<int, Person>  $people
     * @param  Collection<int, Project>  $projects
     * @return array<string, mixed>
     */
    private function weeklyData(Collection $people, Collection $projects, CarbonImmutable $week): array
    {
        $weekStart = $week->startOfWeek();
        $weekEnd = $weekStart->endOfWeek();
        $allocations = Allocation::query()
            ->select(['person_id', 'project_id', 'role', 'month', 'planned_hours', 'weekly_hours'])
            ->whereIn('person_id', $people->keys())
            ->whereBetween('month', [$weekStart->startOfMonth(), $weekEnd->startOfMonth()])
            ->get();
        $partsByPerson = [];
        $rolesByPerson = [];

        foreach ($allocations as $allocation) {
            $project = $projects->get($allocation->project_id);

            if ($project === null) {
                continue;
            }

            $personId = (int) $allocation->person_id;
            $projectId = (int) $allocation->project_id;

            if ($allocation->role !== '') {
                $rolesByPerson[$personId][$allocation->role] = true;
            }

            $nativeWeek = collect($allocation->weekly_hours ?? [])->first(
                fn (array $candidate): bool => $candidate['week_start'] === $weekStart->toDateString(),
            );
            $source = $nativeWeek === null ? 'prorated' : 'weekly';

            if ($nativeWeek !== null) {
                $hours = (float) $nativeWeek['hours'];
            } else {
                $month = CarbonImmutable::parse($allocation->month)->startOfMonth();
                $monthWorkingDays = $this->workingDays($month, $month->endOfMonth());
                $weekWorkingDays = $this->workingDays($month->max($weekStart), $month->endOfMonth()->min($weekEnd));

                if ($monthWorkingDays === 0 || $weekWorkingDays === 0) {
                    continue;
                }

                $hours = (float) $allocation->planned_hours * $weekWorkingDays / $monthWorkingDays;
            }

            if ($hours <= 0) {
                continue;
            }

            $partsByPerson[$personId][$projectId] ??= [
                'projectId' => $projectId,
                'label' => $this->projectData($project)['label'],
                'hours' => 0.0,
                'sources' => [],
            ];
            $partsByPerson[$personId][$projectId]['hours'] += $hours;
            $partsByPerson[$personId][$projectId]['sources'][$source] = true;
        }

        $rows = $people->map(function (Person $person) use ($partsByPerson, $rolesByPerson, $weekStart, $weekEnd): array {
            $contractHours = $person->weekly_capacity_hours === null
                ? (float) $person->default_monthly_capacity_hours * 12 / 52
                : (float) $person->weekly_capacity_hours;
            $leaveDays = $person->is_external ? 0 : $this->leaveWorkingDays($person, $weekStart, $weekEnd);
            $leaveHours = round($leaveDays * $this->settings->hoursPerLeaveDay(), 2);
            $availableHours = max(0, round($contractHours - $leaveHours, 2));
            $parts = collect($partsByPerson[$person->getKey()] ?? [])
                ->map(fn (array $part): array => [
                    'projectId' => $part['projectId'],
                    'label' => $part['label'],
                    'hours' => round((float) $part['hours'], 2),
                    'source' => $this->allocationSource($part['sources']),
                ])
                ->sortByDesc('hours')
                ->values();
            $allocatedHours = round((float) $parts->sum('hours'), 2);
            $freeHours = round($availableHours - $allocatedHours, 2);
            $status = $freeHours < 0
                ? 'over'
                : ($allocatedHours <= 0 && $availableHours > 0
                    ? 'unallocated'
                    : ($freeHours > 0 ? 'available' : 'balanced'));

            return [
                'person' => [
                    'id' => $person->getKey(),
                    'name' => $person->name,
                    'jobRole' => $person->job_role,
                    'isExternal' => $person->is_external,
                ],
                'roles' => array_values(array_unique(array_filter([
                    $person->job_role,
                    ...array_keys($rolesByPerson[$person->getKey()] ?? []),
                ]))),
                'teamIds' => $person->teams->pluck('id')->map(fn (mixed $id): int => (int) $id)->values()->all(),
                'contractHours' => round($contractHours, 2),
                'leaveHours' => $leaveHours,
                'availableHours' => $availableHours,
                'allocatedHours' => $allocatedHours,
                'freeHours' => $freeHours,
                'status' => $status,
                'allocations' => $parts->all(),
            ];
        })->values();

        return [
            'period' => [
                'start' => $weekStart->toDateString(),
                'end' => $weekEnd->toDateString(),
                'previous' => $weekStart->subWeek()->toDateString(),
                'next' => $weekStart->addWeek()->toDateString(),
            ],
            'allocationMethod' => 'weekly_with_monthly_fallback',
            'rows' => $rows->all(),
            'totals' => [
                'contractHours' => round((float) $rows->sum('contractHours'), 2),
                'leaveHours' => round((float) $rows->sum('leaveHours'), 2),
                'availableHours' => round((float) $rows->sum('availableHours'), 2),
                'allocatedHours' => round((float) $rows->sum('allocatedHours'), 2),
                'freeHours' => round((float) $rows->sum(fn (array $row): float => max(0, $row['freeHours'])), 2),
                'overallocatedPeople' => $rows->where('status', 'over')->count(),
                'unallocatedPeople' => $rows->where('status', 'unallocated')->count(),
            ],
        ];
    }

    /**
     * @param  Collection<int, Person>  $people
     * @param  Collection<int, Allocation>  $allocations
     * @param  list<array<string, mixed>>  $comparisonRows
     * @param  list<string>  $monthKeys
     * @return list<array<string, mixed>>
     */
    private function capacityRows(Collection $people, Collection $allocations, array $comparisonRows, array $monthKeys): array
    {
        $allocated = [];
        $actual = [];
        $roles = [];

        foreach ($allocations as $allocation) {
            $month = CarbonImmutable::parse($allocation->month)->format('Y-m');
            $allocated[$allocation->person_id][$month] ??= 0.0;
            $allocated[$allocation->person_id][$month] += (float) $allocation->planned_hours;

            if ($allocation->role !== '') {
                $roles[$allocation->person_id][$allocation->role] = true;
            }
        }

        foreach ($comparisonRows as $row) {
            $personId = (int) $row['person']['id'];

            foreach ($row['months'] as $month => $values) {
                if ($values['actual'] === null) {
                    continue;
                }

                $actual[$personId][$month] ??= 0.0;
                $actual[$personId][$month] += (float) $values['actual'];
            }
        }

        return array_values($people->map(function (Person $person) use ($actual, $allocated, $monthKeys, $roles): array {
            $months = [];

            foreach ($monthKeys as $monthKey) {
                $month = CarbonImmutable::parse($monthKey.'-01');
                $grossHours = $this->monthlyGrossHours($person, $monthKey);
                $leaveDays = $person->is_external ? 0 : $this->leaveWorkingDays($person, $month, $month->endOfMonth());
                $leaveHours = round($leaveDays * $this->settings->hoursPerLeaveDay(), 2);
                $availableHours = max(0, round($grossHours - $leaveHours, 2));
                $allocatedHours = round((float) ($allocated[$person->getKey()][$monthKey] ?? 0), 2);
                $actualHours = array_key_exists($monthKey, $actual[$person->getKey()] ?? [])
                    ? round((float) $actual[$person->getKey()][$monthKey], 2)
                    : null;

                $months[$monthKey] = [
                    'grossHours' => round($grossHours, 2),
                    'leaveHours' => $leaveHours,
                    'availableHours' => $availableHours,
                    'allocatedHours' => $allocatedHours,
                    'actualHours' => $actualHours,
                    'allocationPercent' => $availableHours > 0
                        ? round($allocatedHours / $availableHours * 100, 1)
                        : null,
                    'freeHours' => round($availableHours - $allocatedHours, 2),
                ];
            }

            return [
                'person' => [
                    'id' => $person->getKey(),
                    'name' => $person->name,
                    'jobRole' => $person->job_role,
                    'isExternal' => $person->is_external,
                ],
                'roles' => array_values(array_unique(array_filter([
                    $person->job_role,
                    ...array_keys($roles[$person->getKey()] ?? []),
                ]))),
                'months' => $months,
            ];
        })->values()->all());
    }

    /**
     * @param  Collection<int, Allocation>  $allocations
     * @return list<array<string, mixed>>
     */
    private function allocationHistory(Collection $allocations): array
    {
        if ($allocations->isEmpty()) {
            return [];
        }

        return array_values(AuditLog::query()
            ->where('auditable_type', Allocation::class)
            ->whereIn('auditable_id', $allocations->pluck('id')->all())
            ->whereIn('action', ['allocation.upserted', 'allocation.updated'])
            ->latest('id')
            ->limit(30)
            ->get()
            ->map(fn (AuditLog $log): array => [
                'id' => (int) $log->getKey(),
                'allocationId' => (int) $log->auditable_id,
                'action' => $log->action,
                'author' => is_string($log->actor_name) && $log->actor_name !== ''
                    ? $log->actor_name
                    : 'Unknown',
                'before' => is_array($log->before) ? $log->before : null,
                'after' => is_array($log->after) ? $log->after : null,
                'createdAt' => $log->created_at?->toIso8601String(),
            ])
            ->all());
    }

    private function monthlyGrossHours(Person $person, string $month): float
    {
        foreach ($person->capacities as $capacity) {
            if (CarbonImmutable::parse($capacity->month)->format('Y-m') === $month) {
                return (float) $capacity->capacity_hours;
            }
        }

        return (float) $person->default_monthly_capacity_hours;
    }

    private function leaveWorkingDays(Person $person, CarbonImmutable $start, CarbonImmutable $end): int
    {
        $dates = [];

        foreach ($person->timeOffs as $timeOff) {
            if (! TimeOffStatus::reducesCapacityFor($timeOff->status)) {
                continue;
            }

            $rangeStart = CarbonImmutable::parse($timeOff->start_date)->max($start);
            $rangeEnd = CarbonImmutable::parse($timeOff->end_date)->min($end);

            for ($date = $rangeStart; $date->lte($rangeEnd); $date = $date->addDay()) {
                if ($date->isWeekday()) {
                    $dates[$date->toDateString()] = true;
                }
            }
        }

        return count($dates);
    }

    private function workingDays(CarbonImmutable $start, CarbonImmutable $end): int
    {
        if ($start->gt($end)) {
            return 0;
        }

        $days = 0;

        for ($date = $start; $date->lte($end); $date = $date->addDay()) {
            if ($date->isWeekday()) {
                $days++;
            }
        }

        return $days;
    }

    /** @param array<string, bool> $sources */
    private function allocationSource(array $sources): string
    {
        if (count($sources) > 1) {
            return 'mixed';
        }

        return array_key_first($sources) ?? 'prorated';
    }

    /**
     * @param  Collection<int, Person>  $people
     * @param  Collection<int, Project>  $projects
     * @return list<array<string, mixed>>
     */
    private function adjustmentRows(
        Collection $people,
        Collection $projects,
        CarbonImmutable $firstMonth,
        CarbonImmutable $lastMonth,
    ): array {
        $adjustments = ActualAdjustment::query()
            ->select([
                'id',
                'person_id',
                'project_id',
                'internal_label',
                'month',
                'effective_date',
                'hours_delta',
                'reason',
                'created_by_name',
                'reverses_adjustment_id',
                'created_at',
            ])
            ->whereIn('person_id', $people->keys())
            ->whereBetween('month', [$firstMonth->toDateString(), $lastMonth->toDateString()])
            ->latest('created_at')
            ->get();
        $reversedIds = $adjustments->pluck('reverses_adjustment_id')->filter()->all();

        return array_values($adjustments->map(function (ActualAdjustment $adjustment) use ($people, $projects, $reversedIds): array {
            $person = $people->get($adjustment->person_id);
            $project = $adjustment->project_id === null ? null : $projects->get($adjustment->project_id);

            return [
                'id' => $adjustment->getKey(),
                'person' => $person->name,
                'project' => $project === null
                    ? $this->internalLabel($adjustment->internal_label)
                    : $this->projectData($project)['label'],
                'month' => CarbonImmutable::parse($adjustment->month)->format('Y-m'),
                'effectiveDate' => CarbonImmutable::parse($adjustment->effective_date)->toDateString(),
                'hoursDelta' => (float) $adjustment->hours_delta,
                'reason' => $adjustment->reason,
                'author' => $adjustment->created_by_name,
                'createdAt' => CarbonImmutable::parse($adjustment->created_at)->toIso8601String(),
                'isReversal' => $adjustment->reverses_adjustment_id !== null,
                'isReversed' => in_array($adjustment->getKey(), $reversedIds, true),
            ];
        })->all());
    }

    /**
     * @param  Collection<int, Person>  $people
     * @param  Collection<int, Project>  $projects
     * @param  Collection<int, Allocation>  $allocations
     * @param  list<string>  $monthKeys
     * @return list<array<string, mixed>>
     */
    private function comparisonRows(
        $people,
        $projects,
        $allocations,
        array $monthKeys,
        CarbonImmutable $firstMonth,
        CarbonImmutable $lastMonth,
    ): array {
        $rows = [];

        foreach ($allocations as $allocation) {
            $person = $people->get($allocation->person_id);
            $project = $projects->get($allocation->project_id);

            if ($person === null || $project === null) {
                continue;
            }

            $key = $this->comparisonKey((int) $person->getKey(), (int) $project->getKey(), null);
            $rows[$key] ??= $this->comparisonRow($key, $person, $this->projectData($project), $monthKeys);
            $month = CarbonImmutable::parse($allocation->month)->format('Y-m');
            $rows[$key]['months'][$month]['planned'] += (float) $allocation->planned_hours;

            if ($allocation->role !== '' && ! in_array($allocation->role, $rows[$key]['roles'], true)) {
                $rows[$key]['roles'][] = $allocation->role;
            }
        }

        $timeEntries = TimeEntry::query()
            ->select(['person_id', 'project_id', 'source_label', 'started_at', 'duration_seconds'])
            ->whereIn('person_id', $people->keys())
            ->whereBetween('started_at', [$firstMonth->startOfMonth(), $lastMonth->endOfMonth()])
            ->get();

        foreach ($timeEntries as $entry) {
            $person = $people->get($entry->person_id);
            $project = $entry->project_id === null ? null : $projects->get($entry->project_id);

            if ($person === null || ($entry->project_id !== null && $project === null)) {
                continue;
            }

            $internalLabel = $project === null ? $this->internalLabel($entry->source_label) : null;
            $key = $this->comparisonKey((int) $person->getKey(), $project?->getKey(), $internalLabel);
            $rows[$key] ??= $this->comparisonRow(
                $key,
                $person,
                $project === null ? $this->internalProjectData($internalLabel) : $this->projectData($project),
                $monthKeys,
            );
            $month = CarbonImmutable::parse($entry->started_at)->format('Y-m');
            $rows[$key]['months'][$month]['actual'] ??= 0.0;
            $rows[$key]['months'][$month]['actual'] += ((int) $entry->duration_seconds) / 3600;
        }

        $adjustments = ActualAdjustment::query()
            ->select(['person_id', 'project_id', 'internal_label', 'month', 'hours_delta'])
            ->whereIn('person_id', $people->keys())
            ->whereBetween('month', [$firstMonth->toDateString(), $lastMonth->toDateString()])
            ->get();

        foreach ($adjustments as $adjustment) {
            $person = $people->get($adjustment->person_id);
            $project = $adjustment->project_id === null ? null : $projects->get($adjustment->project_id);

            if ($person === null || ($adjustment->project_id !== null && $project === null)) {
                continue;
            }

            $internalLabel = $project === null ? $this->internalLabel($adjustment->internal_label) : null;
            $key = $this->comparisonKey((int) $person->getKey(), $project?->getKey(), $internalLabel);
            $rows[$key] ??= $this->comparisonRow(
                $key,
                $person,
                $project === null ? $this->internalProjectData($internalLabel) : $this->projectData($project),
                $monthKeys,
            );
            $month = CarbonImmutable::parse($adjustment->month)->format('Y-m');
            $rows[$key]['months'][$month]['actual'] ??= 0.0;
            $rows[$key]['months'][$month]['actual'] += (float) $adjustment->hours_delta;
        }

        foreach ($rows as &$row) {
            foreach ($row['months'] as &$values) {
                $values['planned'] = round((float) $values['planned'], 2);
                $values['actual'] = $values['actual'] === null ? null : round((float) $values['actual'], 2);
                $values['status'] = $values['actual'] === null
                    ? 'empty'
                    : $this->variance->classify($values['planned'], $values['actual'])->value;
            }
            unset($values);
        }
        unset($row);

        usort($rows, fn (array $left, array $right): int => strcasecmp($left['person']['name'], $right['person']['name'])
            ?: strcasecmp($left['project']['label'], $right['project']['label']));

        return $rows;
    }

    /**
     * @param  array{id: int|null, label: string, internal: bool}  $project
     * @param  list<string>  $monthKeys
     * @return array<string, mixed>
     */
    private function comparisonRow(string $key, Person $person, array $project, array $monthKeys): array
    {
        return [
            'key' => sha1($key),
            'person' => $this->personData($person, $monthKeys),
            'project' => $project,
            'roles' => array_filter([$person->job_role]),
            'months' => collect($monthKeys)->mapWithKeys(fn (string $month): array => [
                $month => ['planned' => 0.0, 'actual' => null, 'status' => 'empty'],
            ])->all(),
        ];
    }

    private function comparisonKey(int $personId, ?int $projectId, ?string $internalLabel): string
    {
        return $personId.'|'.($projectId === null
            ? 'internal:'.mb_strtolower($internalLabel ?? 'Activitate internă')
            : 'project:'.$projectId);
    }

    private function internalLabel(?string $label): string
    {
        $label = trim((string) $label);

        return $label === '' ? __('messages.common.internal_activity') : $label;
    }

    /** @return array{id: null, label: string, internal: true} */
    private function internalProjectData(string $label): array
    {
        return ['id' => null, 'label' => $label, 'internal' => true];
    }

    /** @return list<string> */
    public function monthKeys(): array
    {
        return $this->period->monthKeys();
    }

    /**
     * @param  list<string>  $monthKeys
     * @return array<string, mixed>
     */
    private function personData(Person $person, array $monthKeys): array
    {
        $overrides = $person->capacities->keyBy(
            fn ($capacity): string => CarbonImmutable::parse($capacity->month)->format('Y-m'),
        );

        return [
            'id' => $person->getKey(),
            'name' => $person->name,
            'jobRole' => $person->job_role,
            'isExternal' => $person->is_external,
            'capacity' => collect($monthKeys)->mapWithKeys(fn (string $month): array => [
                $month => (float) ($overrides->has($month)
                    ? $overrides->get($month)->capacity_hours
                    : $person->default_monthly_capacity_hours),
            ])->all(),
        ];
    }

    /** @return array{id: int, label: string, internal: false, active: bool} */
    private function projectData(Project $project): array
    {
        return [
            'id' => $project->getKey(),
            'label' => trim($project->client.' — '.$project->name, ' —'),
            'internal' => false,
            'active' => $project->active,
        ];
    }
}
