<?php

namespace App\Services\PmBoard;

use App\Enums\ClickUpLocationKind;
use App\Enums\PermissionName;
use App\Enums\ProjectBoardTemplate;
use App\Models\ClickUpFolder;
use App\Models\ClickUpList;
use App\Models\ClickUpTask;
use App\Models\Person;
use App\Models\Project;
use App\Models\SyncRun;
use App\Models\TimeEntry;
use App\Models\User;
use App\Models\WeeklyPlan;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class PmBoardData
{
    public function __construct(private readonly PmBoardScope $scope) {}

    /**
     * @param  list<int>  $selectedProjectIds
     * @return array<string, mixed>
     */
    public function for(
        User $user,
        array $selectedProjectIds,
        bool $includeInternal,
        bool $allProjectsSelected,
        string $period,
        CarbonImmutable $anchor,
        ?int $pmId,
    ): array {
        $projectIds = $this->scope->projectIds($user);
        $period = $period === 'month' ? 'month' : 'week';

        if (array_diff($selectedProjectIds, $projectIds) !== []) {
            throw new AuthorizationException;
        }

        $allProjects = Project::query()
            ->select(['id', 'client', 'name', 'contract_type', 'board_config'])
            ->whereIn('id', $projectIds)
            ->with(['managers:id,name'])
            ->orderBy('client')
            ->orderBy('name')
            ->get();
        $managers = $allProjects
            ->flatMap->managers
            ->unique('id')
            ->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();
        $projects = $pmId === null
            ? $allProjects
            : $allProjects->filter(fn (Project $project): bool => $project->managers->contains('id', $pmId))->values();
        [$rangeStart, $rangeEnd] = $this->range($anchor, $period);
        $periodSecondsByProject = $this->periodSecondsByProject($projects, $rangeStart, $rangeEnd);
        $projects = $this->orderProjectsByPeriodHours($projects, $periodSecondsByProject);
        if ($allProjectsSelected) {
            $selectedProjects = $projects->take(1)->values();
            $allProjectsSelected = false;
        } else {
            $selectedProjects = $projects->whereIn('id', $selectedProjectIds)->values();
        }
        $selectedProject = $selectedProjects->count() === 1 && ! $includeInternal
            ? $selectedProjects->first()
            : null;

        $internalListIds = $this->internalListIds();
        $internalPeriodSeconds = $this->internalPeriodSeconds($internalListIds, $rangeStart, $rangeEnd);
        $internalOption = [
            'label' => __('messages.common.internal_activities'),
            'periodHours' => round($internalPeriodSeconds / 3600, 2),
            'available' => $internalListIds->isNotEmpty(),
        ];
        $sync = $this->syncStatus();

        if ($selectedProjects->isEmpty() && (! $includeInternal || $internalListIds->isEmpty())) {
            return [
                'projects' => $projects->map(fn (Project $project): array => $this->projectData($project, $periodSecondsByProject))->all(),
                'managers' => $managers->map(fn (Person $person): array => [
                    'id' => $person->getKey(),
                    'name' => $person->name,
                ])->all(),
                'selectedPmId' => $pmId,
                'allProjectsSelected' => $allProjectsSelected,
                'selectedProjectIds' => [],
                'includeInternal' => false,
                'internalOption' => $internalOption,
                'selectedProject' => null,
                'today' => now()->toDateString(),
                'period' => $this->periodData($period, $anchor, $rangeStart, $rangeEnd),
                'workedTasks' => [],
                'upcomingTasks' => [],
                'peopleWorked' => [],
                'summaryCharts' => [
                    'timeline' => [],
                    'projects' => [],
                    'people' => [],
                ],
                'planning' => null,
                'gantt' => null,
                'annexBoard' => null,
                'kpis' => [
                    'plannedHours' => 0.0,
                    'actualHours' => 0.0,
                    'workedTasks' => 0,
                    'plannedTasks' => 0,
                    'activeTasks' => 0,
                    'todoTasks' => 0,
                    'selectedTasks' => 0,
                    'plannedNextWeekHours' => 0.0,
                    'activePeople' => 0,
                    'projects' => $selectedProjects->count(),
                ],
                'sync' => $sync,
                'permissions' => [
                    'managePlanning' => $user->can(PermissionName::ManagePmPlanning->value),
                    'syncClickUp' => $user->can(PermissionName::SyncClickUp->value),
                ],
            ];
        }

        $taskIdsWithEntries = TimeEntry::query()
            ->select('click_up_task_id')
            ->whereNotNull('click_up_task_id')
            ->whereBetween('started_at', [$rangeStart->utc(), $rangeEnd->utc()]);
        $selectedProjectKeys = $selectedProjects->modelKeys();
        $tasks = ClickUpTask::query()
            ->select([
                'id',
                'project_id',
                'clickup_task_id',
                'clickup_list_id',
                'name',
                'status',
                'estimate_seconds',
                'tracked_seconds',
                'start_at',
                'due_at',
                'active',
            ])
            ->where(function ($query) use ($includeInternal, $internalListIds, $selectedProjectKeys): void {
                if ($selectedProjectKeys === []) {
                    $query->whereIn('clickup_list_id', $internalListIds);

                    return;
                }

                $query->whereIn('project_id', $selectedProjectKeys);

                if ($includeInternal && $internalListIds->isNotEmpty()) {
                    $query->orWhereIn('clickup_list_id', $internalListIds);
                }
            })
            ->where(fn ($query) => $query
                ->where('active', true)
                ->orWhereIn('id', $taskIdsWithEntries))
            ->with([
                'assignees:id,name',
                'clickUpList:id,clickup_list_id,name',
                'project:id,client,name',
            ])
            ->orderBy('name')
            ->get();
        $taskIds = $tasks->modelKeys();
        $periodEntryRows = TimeEntry::query()
            ->select(['id', 'click_up_task_id', 'person_id', 'clickup_user_id', 'person_name', 'duration_seconds', 'started_at'])
            ->whereIn('click_up_task_id', $taskIds)
            ->whereBetween('started_at', [$rangeStart->utc(), $rangeEnd->utc()])
            ->with(['person:id,name'])
            ->get();
        $periodEntries = $periodEntryRows->groupBy('click_up_task_id');
        $totalSeconds = TimeEntry::query()
            ->whereIn('click_up_task_id', $taskIds)
            ->selectRaw('click_up_task_id, SUM(duration_seconds) as aggregate_seconds')
            ->groupBy('click_up_task_id')
            ->pluck('aggregate_seconds', 'click_up_task_id');
        $taskRows = $tasks->map(fn (ClickUpTask $task): array => $this->taskData(
            task: $task,
            periodEntries: $periodEntries->get($task->getKey()) ?? new EloquentCollection,
            totalSeconds: $task->tracked_seconds ?? (int) ($totalSeconds->get($task->getKey()) ?? 0),
        ));
        $workedTasks = $taskRows
            ->filter(fn (array $task): bool => $task['periodHours'] > 0)
            ->sortByDesc('periodHours')
            ->values();
        $excludedTaskIds = $selectedProjects
            ->filter(fn (Project $project): bool => $project->contract_type === ProjectBoardTemplate::Deliverables)
            ->flatMap(fn (Project $project): array => $this->excludedTaskIds($project))
            ->all();
        $upcomingTasks = $taskRows
            ->filter(fn (array $task): bool => $task['active'] && ! $task['isDone'])
            ->sortBy(fn (array $task): string => $task['statusGroup'].'|'.($task['dueDate'] ?? '9999-12-31').'|'.$task['name'])
            ->values();

        if ($excludedTaskIds !== []) {
            $upcomingTasks = $upcomingTasks
                ->reject(fn (array $task): bool => in_array($task['clickupId'], $excludedTaskIds, true))
                ->values();
        }
        $peopleWorked = $this->peopleWorked($periodEntryRows);
        $summaryCharts = $this->summaryCharts(
            periodEntries: $periodEntryRows,
            tasks: $tasks,
            period: $period,
            rangeStart: $rangeStart,
            rangeEnd: $rangeEnd,
        );
        $isDeliverables = $selectedProject instanceof Project
            && $selectedProject->contract_type === ProjectBoardTemplate::Deliverables;
        $planning = $isDeliverables
            ? $this->planningData($selectedProject, $upcomingTasks, $rangeEnd->addDay()->startOfDay())
            : null;
        $gantt = $isDeliverables
            ? $this->ganttData($selectedProject, $tasks, $taskRows, $planning)
            : null;
        $annexBoard = $isDeliverables
            ? $this->annexBoardData(
                project: $selectedProject,
                tasks: $tasks,
                taskRows: $taskRows,
                upcomingTasks: $upcomingTasks,
                period: $period,
                rangeStart: $rangeStart,
                rangeEnd: $rangeEnd,
                planning: $planning,
            )
            : null;
        $selectedPlans = collect(is_array($planning['plans'] ?? null) ? $planning['plans'] : [])
            ->where('selected', true);

        return [
            'projects' => $projects->map(fn (Project $project): array => $this->projectData($project, $periodSecondsByProject))->all(),
            'managers' => $managers->map(fn (Person $person): array => [
                'id' => $person->getKey(),
                'name' => $person->name,
            ])->all(),
            'selectedPmId' => $pmId,
            'allProjectsSelected' => $allProjectsSelected,
            'selectedProjectIds' => array_values($selectedProjects->modelKeys()),
            'includeInternal' => $includeInternal,
            'internalOption' => $internalOption,
            'selectedProject' => $selectedProject instanceof Project
                ? $this->projectData($selectedProject, $periodSecondsByProject)
                : null,
            'today' => now()->toDateString(),
            'period' => $this->periodData($period, $anchor, $rangeStart, $rangeEnd),
            'workedTasks' => $workedTasks->all(),
            'upcomingTasks' => $upcomingTasks->all(),
            'peopleWorked' => $peopleWorked,
            'summaryCharts' => $summaryCharts,
            'planning' => $planning,
            'gantt' => $gantt,
            'annexBoard' => $annexBoard,
            'kpis' => [
                'plannedHours' => round($workedTasks->sum('estimateHours'), 2),
                'actualHours' => round($workedTasks->sum('periodHours'), 2),
                'workedTasks' => $workedTasks->count(),
                'plannedTasks' => $upcomingTasks->whereNotNull('estimateHours')->count(),
                'activeTasks' => $upcomingTasks->where('statusGroup', '0-active')->count(),
                'todoTasks' => $upcomingTasks->where('statusGroup', '1-todo')->count(),
                'selectedTasks' => $selectedPlans->count(),
                'plannedNextWeekHours' => round((float) $selectedPlans->sum('totalHours'), 2),
                'activePeople' => count($peopleWorked),
                'projects' => $selectedProjects->count(),
            ],
            'sync' => $sync,
            'permissions' => [
                'managePlanning' => $user->can(PermissionName::ManagePmPlanning->value),
                'syncClickUp' => $user->can(PermissionName::SyncClickUp->value),
            ],
        ];
    }

    /**
     * @param  EloquentCollection<int, TimeEntry>  $periodEntries
     * @return array<string, mixed>
     */
    private function taskData(ClickUpTask $task, EloquentCollection $periodEntries, int $totalSeconds): array
    {
        $periodSeconds = (int) $periodEntries->sum('duration_seconds');
        $estimateHours = $task->estimate_seconds === null ? null : round($task->estimate_seconds / 3600, 2);
        $periodHours = round($periodSeconds / 3600, 2);
        $totalHours = round($totalSeconds / 3600, 2);
        $progress = $task->estimate_seconds === null || $task->estimate_seconds === 0
            ? null
            : round(($totalSeconds / $task->estimate_seconds) * 100, 1);
        $people = $periodEntries
            ->groupBy(fn (TimeEntry $entry): string => $this->entryPersonKey($entry))
            ->map(function (Collection $entries): array {
                $entry = $entries->first();

                return [
                    'name' => $entry instanceof TimeEntry ? $this->entryPersonName($entry) : __('messages.common.unknown'),
                    'hours' => round(((int) $entries->sum('duration_seconds')) / 3600, 2),
                ];
            })
            ->values()
            ->all();
        $status = trim((string) $task->status);
        $normalizedStatus = mb_strtolower($status);
        $isDone = str_contains($normalizedStatus, 'done')
            || str_contains($normalizedStatus, 'complete')
            || str_contains($normalizedStatus, 'closed');
        $statusGroup = str_contains($normalizedStatus, 'to do')
            || $normalizedStatus === 'open'
            || $normalizedStatus === 'backlog'
            ? '1-todo'
            : '0-active';

        return [
            'id' => $task->getKey(),
            'clickupId' => $task->clickup_task_id,
            'name' => $task->name,
            'projectLabel' => $task->project instanceof Project ? $this->projectLabel($task->project) : __('messages.common.internal_activities'),
            'url' => "https://app.clickup.com/t/{$task->clickup_task_id}",
            'status' => $status === '' ? __('messages.common.no_status') : $status,
            'statusGroup' => $statusGroup,
            'isDone' => $isDone,
            'active' => $task->active,
            'owners' => $task->assignees->pluck('name')->values()->all(),
            'people' => $people,
            'estimateHours' => $estimateHours,
            'periodHours' => $periodHours,
            'totalLoggedHours' => $totalHours,
            'remainingHours' => $estimateHours === null ? null : round($estimateHours - $totalHours, 2),
            'progress' => $progress,
            'isOverrun' => $estimateHours !== null && $totalHours > $estimateHours * 1.10,
            'startDate' => $task->start_at?->toDateString(),
            'dueDate' => $task->due_at?->toDateString(),
        ];
    }

    /**
     * @param  EloquentCollection<int, TimeEntry>  $periodEntries
     * @return list<array{name: string, hours: float, tasks: int}>
     */
    private function peopleWorked(EloquentCollection $periodEntries): array
    {
        return array_values($periodEntries
            ->groupBy(fn (TimeEntry $entry): string => $this->entryPersonKey($entry))
            ->map(function (Collection $entries): array {
                $entry = $entries->first();

                return [
                    'name' => $entry instanceof TimeEntry ? $this->entryPersonName($entry) : __('messages.common.unknown'),
                    'hours' => round(((int) $entries->sum('duration_seconds')) / 3600, 2),
                    'tasks' => $entries->pluck('click_up_task_id')->filter()->unique()->count(),
                ];
            })
            ->sortByDesc('hours')
            ->values()
            ->all());
    }

    /**
     * @param  EloquentCollection<int, TimeEntry>  $periodEntries
     * @param  EloquentCollection<int, ClickUpTask>  $tasks
     * @return array{
     *     timeline: list<array{key: string, label: string, hours: float, projects: list<array{label: string, hours: float}>}>,
     *     projects: list<array{label: string, hours: float}>,
     *     people: list<array{key: string, name: string, hours: float, tasks: int, projects: list<array{label: string, hours: float}>}>
     * }
     */
    private function summaryCharts(
        EloquentCollection $periodEntries,
        EloquentCollection $tasks,
        string $period,
        CarbonImmutable $rangeStart,
        CarbonImmutable $rangeEnd,
    ): array {
        $projectLabelsByTask = $tasks->mapWithKeys(fn (ClickUpTask $task): array => [
            $task->getKey() => $task->project instanceof Project
                ? $this->projectLabel($task->project)
                : __('messages.common.internal_activities'),
        ]);
        $projectRows = $this->chartHoursRows($periodEntries, $projectLabelsByTask);
        $people = array_values($periodEntries
            ->groupBy(fn (TimeEntry $entry): string => $this->entryPersonKey($entry))
            ->map(function (Collection $entries, string $key) use ($projectLabelsByTask): array {
                $entry = $entries->first();

                return [
                    'key' => $key,
                    'name' => $entry instanceof TimeEntry ? $this->entryPersonName($entry) : __('messages.common.unknown'),
                    'hours' => round(((int) $entries->sum('duration_seconds')) / 3600, 2),
                    'tasks' => $entries->pluck('click_up_task_id')->filter()->unique()->count(),
                    'projects' => $this->chartHoursRows($entries, $projectLabelsByTask),
                ];
            })
            ->sort(fn (array $first, array $second): int => $second['hours'] <=> $first['hours'])
            ->values()
            ->all());
        $timeline = array_values($this->chartBuckets($period, $rangeStart, $rangeEnd)
            ->map(function (array $bucket) use ($periodEntries, $projectLabelsByTask): array {
                $entries = $periodEntries->filter(function (TimeEntry $entry) use ($bucket): bool {
                    $startedAt = CarbonImmutable::parse($entry->started_at)
                        ->setTimezone(config('app.timezone'));

                    return $startedAt->betweenIncluded($bucket['start'], $bucket['end']);
                });

                return [
                    'key' => $bucket['key'],
                    'label' => $bucket['label'],
                    'hours' => round(((int) $entries->sum('duration_seconds')) / 3600, 2),
                    'projects' => $this->chartHoursRows($entries, $projectLabelsByTask),
                ];
            })
            ->all());

        return [
            'timeline' => $timeline,
            'projects' => $projectRows,
            'people' => $people,
        ];
    }

    /**
     * @param  Collection<int, TimeEntry>  $entries
     * @param  Collection<int, string>  $projectLabelsByTask
     * @return list<array{label: string, hours: float}>
     */
    private function chartHoursRows(Collection $entries, Collection $projectLabelsByTask): array
    {
        $internalActivities = __('messages.common.internal_activities');
        $internalActivities = is_string($internalActivities)
            ? $internalActivities
            : 'Internal activities';

        return array_values($entries
            ->groupBy(fn (TimeEntry $entry): string => $projectLabelsByTask->get(
                $entry->click_up_task_id,
                $internalActivities,
            ))
            ->map(fn (Collection $projectEntries, string $label): array => [
                'label' => $label,
                'hours' => round(((int) $projectEntries->sum('duration_seconds')) / 3600, 2),
            ])
            ->sort(function (array $first, array $second): int {
                $hoursComparison = $second['hours'] <=> $first['hours'];

                return $hoursComparison !== 0
                    ? $hoursComparison
                    : strnatcasecmp($first['label'], $second['label']);
            })
            ->values()
            ->all());
    }

    /**
     * @return Collection<int, array{key: string, label: string, start: CarbonImmutable, end: CarbonImmutable}>
     */
    private function chartBuckets(
        string $period,
        CarbonImmutable $rangeStart,
        CarbonImmutable $rangeEnd,
    ): Collection {
        $buckets = collect();
        $cursor = $rangeStart->startOfDay();

        while ($cursor->lessThanOrEqualTo($rangeEnd)) {
            $bucketEnd = $period === 'month'
                ? $cursor->endOfWeek()->min($rangeEnd)
                : $cursor->endOfDay();
            $buckets->push([
                'key' => $cursor->toDateString(),
                'label' => $period === 'month'
                    ? $this->shortDate($cursor).'–'.$this->shortDate($bucketEnd)
                    : $this->shortWeekday($cursor).' '.$cursor->day,
                'start' => $cursor,
                'end' => $bucketEnd,
            ]);
            $cursor = $bucketEnd->addDay()->startOfDay();
        }

        return $buckets;
    }

    private function entryPersonName(TimeEntry $entry): string
    {
        if ($entry->person_id === null) {
            return $entry->person_name ?? __('messages.common.unknown');
        }

        return $entry->person->name;
    }

    private function entryPersonKey(TimeEntry $entry): string
    {
        if ($entry->person_id !== null) {
            return 'person:'.$entry->person_id;
        }

        if ($entry->clickup_user_id !== null) {
            return 'clickup:'.$entry->clickup_user_id;
        }

        return 'entry:'.$entry->getKey();
    }

    /** @return list<string> */
    private function excludedTaskIds(Project $project): array
    {
        $ids = data_get($project->board_config, 'excluded_task_ids', []);

        if (! is_array($ids)) {
            return [];
        }

        return array_values(array_filter($ids, fn (mixed $id): bool => is_string($id) && $id !== ''));
    }

    /**
     * @param  Collection<int, covariant array<string, mixed>>  $upcomingTasks
     * @return array<string, mixed>
     */
    private function planningData(Project $project, Collection $upcomingTasks, CarbonImmutable $weekStart): array
    {
        $taskIds = $upcomingTasks->pluck('id')->map(fn (mixed $id): int => (int) $id)->all();
        $persistedPlans = WeeklyPlan::query()
            ->whereBelongsTo($project)
            ->whereDate('week_start', $weekStart)
            ->whereIn('click_up_task_id', $taskIds)
            ->with(['allocations.person:id,name'])
            ->get()
            ->keyBy('click_up_task_id');
        $plans = $upcomingTasks->map(function (array $task) use ($persistedPlans): array {
            $plan = $persistedPlans->get($task['id']);
            $allocations = [];

            if ($plan instanceof WeeklyPlan) {
                foreach ($plan->allocations as $allocation) {
                    $allocations[] = [
                        'personId' => $allocation->person_id,
                        'name' => $allocation->person->name,
                        'hours' => round((float) $allocation->hours, 2),
                    ];
                }
            }

            return [
                'taskId' => $task['id'],
                'selected' => $plan->selected ?? false,
                'version' => $plan?->version,
                'updatedAt' => $plan?->updated_at?->toIso8601String(),
                'totalHours' => round((float) array_sum(array_column($allocations, 'hours')), 2),
                'allocations' => $allocations,
            ];
        })->values();
        $excludedResourceIds = data_get($project->board_config, 'excluded_resource_ids', []);
        $allowedResourceNames = data_get($project->board_config, 'allowed_resource_names', []);
        $resourceRoles = data_get($project->board_config, 'resource_roles', []);
        $resources = Person::query()
            ->select(['id', 'name', 'job_role', 'default_monthly_capacity_hours', 'weekly_capacity_hours'])
            ->where('active', true)
            ->where('is_external', false)
            ->when(is_array($excludedResourceIds) && $excludedResourceIds !== [], fn ($query) => $query->whereNotIn('id', $excludedResourceIds))
            ->when(is_array($allowedResourceNames) && $allowedResourceNames !== [], fn ($query) => $query->whereIn('name', $allowedResourceNames))
            ->orderBy('name')
            ->get()
            ->map(function (Person $person) use ($resourceRoles): array {
                $weeklyCapacity = $person->weekly_capacity_hours === null
                    ? (float) $person->default_monthly_capacity_hours * 12 / 52
                    : (float) $person->weekly_capacity_hours;
                $configuredRole = is_array($resourceRoles) ? ($resourceRoles[$person->name] ?? null) : null;

                return [
                    'id' => $person->getKey(),
                    'name' => $person->name,
                    'jobRole' => is_string($configuredRole) ? $configuredRole : $person->job_role,
                    'weeklyCapacityHours' => round($weeklyCapacity, 2),
                ];
            })
            ->values();
        $selectedPlans = $plans->where('selected', true);
        $resourceTotals = $resources->map(function (array $resource) use ($selectedPlans): array {
            $planned = $selectedPlans->sum(fn (array $plan): float => (float) collect($plan['allocations'])
                ->where('personId', $resource['id'])
                ->sum('hours'));

            return [
                'personId' => $resource['id'],
                'plannedHours' => round($planned, 2),
                'weeklyCapacityHours' => $resource['weeklyCapacityHours'],
                'remainingHours' => round($resource['weeklyCapacityHours'] - $planned, 2),
                'utilizationPercent' => $resource['weeklyCapacityHours'] > 0
                    ? round(($planned / $resource['weeklyCapacityHours']) * 100, 1)
                    : null,
            ];
        })->values();

        return [
            'weekStart' => $weekStart->toDateString(),
            'plans' => $plans->all(),
            'resources' => $resources->all(),
            'resourceTotals' => $resourceTotals->all(),
        ];
    }

    /**
     * @param  EloquentCollection<int, ClickUpTask>  $tasks
     * @param  Collection<int, array<string, mixed>>  $taskRows
     * @param  array<string, mixed>  $planning
     * @return array<string, mixed>
     */
    private function ganttData(Project $project, EloquentCollection $tasks, Collection $taskRows, array $planning): array
    {
        $taskData = $taskRows->keyBy('id');
        $selectedTaskIds = [];
        $planningRows = $planning['plans'] ?? [];

        if (is_array($planningRows)) {
            foreach ($planningRows as $plan) {
                if (is_array($plan) && ($plan['selected'] ?? false) === true && is_int($plan['taskId'] ?? null)) {
                    $selectedTaskIds[] = $plan['taskId'];
                }
            }
        }
        $ganttTasks = $tasks
            ->filter(fn (ClickUpTask $task): bool => $task->start_at !== null && $task->due_at !== null)
            ->sortBy(fn (ClickUpTask $task): string => $task->start_at?->toDateString().'|'.$task->due_at?->toDateString())
            ->values();

        if ($ganttTasks->isEmpty()) {
            return ['weeks' => [], 'rows' => []];
        }

        $firstWeek = CarbonImmutable::parse($ganttTasks->min('start_at'))->startOfWeek();
        $lastWeek = CarbonImmutable::parse($ganttTasks->max('due_at'))->startOfWeek();
        $weeks = collect();
        $start = $firstWeek;

        while ($start->lessThanOrEqualTo($lastWeek)) {
            $end = $start->endOfWeek();

            $weeks->push([
                'key' => $start->toDateString(),
                'label' => $this->shortDate($start).'–'.$this->shortDate($end),
                'start' => $start->toDateString(),
                'end' => $end->toDateString(),
                'isCurrent' => $start->isSameDay(CarbonImmutable::now()->startOfWeek()),
                'isoWeek' => (int) $start->format('W'),
                'monthKey' => $start->format('Y-m'),
                'monthLabel' => $start->translatedFormat('M Y'),
            ]);
            $start = $start->addWeek();
        }
        $rows = $ganttTasks
            ->map(function (ClickUpTask $task) use ($project, $taskData, $selectedTaskIds): array {
                $row = $taskData->get($task->getKey(), []);

                return [
                    'id' => $task->getKey(),
                    'module' => $this->ganttModule($project, $task),
                    'name' => $task->name,
                    'url' => "https://app.clickup.com/t/{$task->clickup_task_id}",
                    'status' => trim((string) $task->status) ?: __('messages.common.no_status'),
                    'owners' => $task->assignees->pluck('name')->values()->all(),
                    'estimateHours' => $row['estimateHours'] ?? null,
                    'progress' => $row['progress'] ?? null,
                    'startDate' => $task->start_at?->toDateString(),
                    'dueDate' => $task->due_at?->toDateString(),
                    'selected' => in_array($task->getKey(), $selectedTaskIds, true),
                ];
            })
            ->values();

        return ['weeks' => $weeks->all(), 'rows' => $rows->all()];
    }

    private function ganttModule(Project $project, ClickUpTask $task): string
    {
        $configuredModules = data_get($project->board_config, 'gantt_modules', []);
        $configured = is_array($configuredModules)
            ? ($configuredModules[$task->clickup_task_id] ?? null)
            : null;

        if (is_string($configured) && trim($configured) !== '') {
            return trim($configured);
        }

        preg_match_all('/\[([^\]]+)\]/u', $task->name, $matches);
        $genericLabels = ['projects', 'project', 'new platform', 'la depozit', 'osiris'];
        $labels = collect($matches[1])
            ->map(fn (mixed $label): string => trim((string) $label))
            ->reject(fn (string $label): bool => $label === '' || in_array(mb_strtolower($label), $genericLabels, true));

        if ($labels->isNotEmpty()) {
            return (string) $labels->last();
        }

        $listName = trim((string) $task->clickUpList?->name);

        return $listName !== '' && mb_strtolower($listName) !== 'backlog'
            ? $listName
            : __('messages.pm_board.general_module');
    }

    /**
     * @param  EloquentCollection<int, ClickUpTask>  $tasks
     * @param  Collection<int, array<string, mixed>>  $taskRows
     * @param  Collection<int, covariant array<string, mixed>>  $upcomingTasks
     * @param  array<string, mixed>  $planning
     * @return array<string, mixed>
     */
    private function annexBoardData(
        Project $project,
        EloquentCollection $tasks,
        Collection $taskRows,
        Collection $upcomingTasks,
        string $period,
        CarbonImmutable $rangeStart,
        CarbonImmutable $rangeEnd,
        array $planning,
    ): array {
        $taskData = $taskRows->keyBy('id');
        $budgetListNames = $this->configuredBoardListNames($project, 'annex_budget_list_names');
        $operationalListNames = $this->configuredBoardListNames($project, 'annex_operational_list_names');
        $validationEnabled = $budgetListNames !== [] && $operationalListNames !== [];
        $scopedTasks = $tasks->map(function (ClickUpTask $task) use (
            $budgetListNames,
            $operationalListNames,
            $project,
            $taskData,
            $validationEnabled,
        ): array {
            $scope = $this->annexScope($project, $task);
            $listName = trim((string) $task->clickUpList?->name);

            return [
                'annexKey' => $scope['key'],
                'annexLabel' => $scope['label'],
                'scopeSource' => $scope['source'],
                'listName' => $listName === '' ? null : $listName,
                'isBudgetTask' => ! $validationEnabled || $this->listNameMatches($listName, $budgetListNames),
                'isOperationalTask' => ! $validationEnabled || $this->listNameMatches($listName, $operationalListNames),
                'task' => $task,
                'row' => $taskData->get($task->getKey(), []),
            ];
        });
        $currentPlans = $period === 'week'
            ? $this->selectedPlanHours($project, $upcomingTasks, $rangeStart->startOfWeek())
            : collect();
        $nextPlans = collect(is_array($planning['plans'] ?? null) ? $planning['plans'] : [])
            ->filter(fn (mixed $plan): bool => is_array($plan) && ($plan['selected'] ?? false) === true)
            ->keyBy('taskId');
        $plannedTaskIds = $period === 'week'
            ? $currentPlans->keys()->merge($nextPlans->keys())
            : collect();
        $activeAnnexKeys = $scopedTasks
            ->groupBy('annexKey')
            ->filter(function (Collection $annexTasks) use ($plannedTaskIds): bool {
                if ($annexTasks->contains(fn (array $scopedTask): bool => $scopedTask['scopeSource'] === 'missing')) {
                    return true;
                }

                return $annexTasks->contains(function (array $scopedTask) use ($plannedTaskIds): bool {
                    $row = $scopedTask['row'];

                    if (($row['active'] ?? false) !== true || ($row['isDone'] ?? false) === true) {
                        return false;
                    }

                    return $plannedTaskIds->contains($scopedTask['task']->getKey())
                        || ($row['estimateHours'] ?? null) !== null
                        || (float) ($row['totalLoggedHours'] ?? 0) > 0
                        || (float) ($row['periodHours'] ?? 0) > 0
                        || ($row['startDate'] ?? null) !== null
                        || ($row['dueDate'] ?? null) !== null;
                });
            })
            ->keys();
        $scopedTasks = $scopedTasks
            ->whereIn('annexKey', $activeAnnexKeys)
            ->values();
        $annexes = $scopedTasks
            ->groupBy('annexKey')
            ->map(fn (Collection $annexTasks): array => $this->annexData($annexTasks))
            ->sortBy(fn (array $annex): string => ($annex['scopeSource'] === 'missing' ? '1|' : '0|').$annex['label'])
            ->values();
        $weeklyRows = $period === 'week'
            ? $scopedTasks
                ->filter(function (array $scopedTask) use ($currentPlans): bool {
                    $taskId = $scopedTask['task']->getKey();

                    return $currentPlans->has($taskId)
                        || (float) ($scopedTask['row']['periodHours'] ?? 0) > 0;
                })
                ->map(fn (array $scopedTask): array => $this->annexTaskRow(
                    scopedTask: $scopedTask,
                    plannedHours: $currentPlans->get($scopedTask['task']->getKey(), 0.0),
                ))
                ->sortBy(fn (array $row): string => $row['annexLabel'].'|'.$row['name'])
                ->values()
            : collect();
        $agreedRows = $scopedTasks
            ->filter(function (array $scopedTask) use ($period, $nextPlans): bool {
                if ($period === 'week') {
                    return $nextPlans->has($scopedTask['task']->getKey());
                }

                $row = $scopedTask['row'];

                return ($row['active'] ?? false) === true
                    && ($row['isDone'] ?? false) === false
                    && (($row['estimateHours'] ?? null) !== null
                        || (float) ($row['totalLoggedHours'] ?? 0) > 0
                        || (float) ($row['periodHours'] ?? 0) > 0
                        || ($row['startDate'] ?? null) !== null
                        || ($row['dueDate'] ?? null) !== null);
            })
            ->map(function (array $scopedTask) use ($nextPlans): array {
                $plan = $nextPlans->get($scopedTask['task']->getKey());

                return $this->annexTaskRow(
                    scopedTask: $scopedTask,
                    plannedHours: is_array($plan) ? (float) ($plan['totalHours'] ?? 0) : null,
                );
            })
            ->sortBy(fn (array $row): string => ($row['dueDate'] ?? '9999-12-31').'|'.$row['annexLabel'].'|'.$row['name'])
            ->values();
        $timelineRows = $annexes->map(fn (array $annex): array => [
            'annexKey' => $annex['key'],
            'label' => $annex['label'],
            'type' => $annex['type'],
            'status' => $annex['status'],
            'startDate' => $annex['startDate'],
            'dueDate' => $annex['dueDate'],
            'missingFields' => array_values(array_intersect($annex['missingFields'], ['startDate', 'dueDate'])),
        ]);
        $knownStartDates = $timelineRows->pluck('startDate')->filter();
        $knownDueDates = $timelineRows->pluck('dueDate')->filter();
        $allEstimatesKnown = $annexes->every(fn (array $annex): bool => $annex['estimatedBudgetHours'] !== null);
        $consumedHours = round((float) $annexes->sum('consumedHours'), 2);
        $completedTasks = (int) $annexes->sum('completedTasks');
        $taskCount = (int) $annexes->sum('totalTasks');
        $validation = $this->annexValidationData(
            scopedTasks: $scopedTasks,
            enabled: $validationEnabled,
            budgetListNames: $budgetListNames,
            operationalListNames: $operationalListNames,
        );

        return [
            'annexes' => $annexes->all(),
            'weeklyRows' => $weeklyRows->all(),
            'agreedRows' => $agreedRows->all(),
            'timeline' => [
                'start' => $knownStartDates->isEmpty() ? null : $knownStartDates->min(),
                'end' => $knownDueDates->isEmpty() ? null : $knownDueDates->max(),
                'rows' => $timelineRows->all(),
            ],
            'totals' => [
                'contractBudgetHours' => null,
                'contractDeadline' => null,
                'estimatedBudgetHours' => $allEstimatesKnown
                    ? round((float) $annexes->sum('estimatedBudgetHours'), 2)
                    : null,
                'consumedHours' => $consumedHours,
                'remainingEstimateHours' => $allEstimatesKnown
                    ? round((float) $annexes->sum('remainingEstimateHours'), 2)
                    : null,
                'closestDueDate' => $annexes->pluck('closestDueDate')->filter()->min(),
                'completedTasks' => $completedTasks,
                'taskCount' => $taskCount,
                'deliveryProgress' => $taskCount > 0
                    ? round(($completedTasks / $taskCount) * 100, 1)
                    : null,
                'periodStart' => $rangeStart->toDateString(),
                'periodEnd' => $rangeEnd->toDateString(),
            ],
            'validation' => $validation,
        ];
    }

    /**
     * @param  Collection<int, covariant array{annexKey: string, annexLabel: string, scopeSource: string, listName: string|null, isBudgetTask: bool, isOperationalTask: bool, task: ClickUpTask, row: array<string, mixed>}>  $annexTasks
     * @return array<string, mixed>
     */
    private function annexData(Collection $annexTasks): array
    {
        $first = $annexTasks->first();
        $deliveryRows = $annexTasks->where('isBudgetTask', true)->pluck('row');
        $operationalRows = $annexTasks->where('isOperationalTask', true)->pluck('row');
        $estimatedHours = $deliveryRows->pluck('estimateHours');
        $allEstimatesKnown = $estimatedHours->every(fn (mixed $hours): bool => $hours !== null);
        $estimatedBudgetHours = $deliveryRows->isNotEmpty() && $allEstimatesKnown
            ? round((float) $estimatedHours->sum(), 2)
            : null;
        $consumedHours = round((float) $operationalRows->sum('totalLoggedHours'), 2);
        $remainingEstimateHours = $estimatedBudgetHours === null
            ? null
            : round($estimatedBudgetHours - $consumedHours, 2);
        $completedTasks = $deliveryRows->where('isDone', true)->count();
        $totalTasks = $deliveryRows->count();
        $activeRows = $deliveryRows->where('active', true)->where('isDone', false);
        $knownStartDates = $deliveryRows->pluck('startDate')->filter();
        $knownDueDates = $deliveryRows->pluck('dueDate')->filter();
        $closestDueDate = $activeRows->pluck('dueDate')->filter()->min();
        $missingFields = ['contractIdentifier', 'contractBudgetHours', 'contractDeadline'];

        if (($first['scopeSource'] ?? null) === 'missing') {
            $missingFields[] = 'annexScope';
        }

        if (! $allEstimatesKnown) {
            $missingFields[] = 'estimateHours';
        }

        if ($knownStartDates->isEmpty()) {
            $missingFields[] = 'startDate';
        }

        if ($knownDueDates->isEmpty()) {
            $missingFields[] = 'dueDate';
        }

        if ($deliveryRows->contains(fn (array $row): bool => ($row['owners'] ?? []) === [])) {
            $missingFields[] = 'owners';
        }

        $today = now()->toDateString();
        $isAtRisk = ($closestDueDate !== null && $closestDueDate < $today)
            || ($estimatedBudgetHours !== null && $consumedHours > $estimatedBudgetHours);
        $hasExecutionDataMissing = array_intersect($missingFields, ['annexScope', 'estimateHours', 'startDate', 'dueDate']) !== [];
        $label = (string) ($first['annexLabel'] ?? __('messages.pm_board.annex_data_missing'));

        return [
            'key' => (string) ($first['annexKey'] ?? 'annex-data-missing'),
            'label' => $label,
            'type' => $this->annexType($label, (string) ($first['scopeSource'] ?? 'missing')),
            'scopeSource' => (string) ($first['scopeSource'] ?? 'missing'),
            'contractIdentifier' => null,
            'contractBudgetHours' => null,
            'contractDeadline' => null,
            'estimatedBudgetHours' => $estimatedBudgetHours,
            'consumedHours' => $consumedHours,
            'remainingEstimateHours' => $remainingEstimateHours,
            'completedTasks' => $completedTasks,
            'totalTasks' => $totalTasks,
            'deliveryProgress' => $totalTasks > 0 ? round(($completedTasks / $totalTasks) * 100, 1) : null,
            'closestDueDate' => $closestDueDate,
            'startDate' => $knownStartDates->isEmpty() ? null : $knownStartDates->min(),
            'dueDate' => $knownDueDates->isEmpty() ? null : $knownDueDates->max(),
            'status' => $isAtRisk ? 'at_risk' : ($hasExecutionDataMissing ? 'data_missing' : 'on_track'),
            'missingFields' => array_values(array_unique($missingFields)),
        ];
    }

    /**
     * @param  Collection<int, covariant array{annexKey: string, annexLabel: string, scopeSource: string, listName: string|null, isBudgetTask: bool, isOperationalTask: bool, task: ClickUpTask, row: array<string, mixed>}>  $scopedTasks
     * @param  list<string>  $budgetListNames
     * @param  list<string>  $operationalListNames
     * @return array<string, mixed>
     */
    private function annexValidationData(
        Collection $scopedTasks,
        bool $enabled,
        array $budgetListNames,
        array $operationalListNames,
    ): array {
        if (! $enabled) {
            return [
                'enabled' => false,
                'budgetSourceLabels' => [],
                'operationalSourceLabels' => [],
                'deliverables' => [],
                'issues' => [],
                'people' => [],
            ];
        }

        $deliverables = $scopedTasks
            ->where('isBudgetTask', true)
            ->map(function (array $scopedTask): array {
                $task = $scopedTask['task'];
                $row = $scopedTask['row'];

                return [
                    'annexKey' => $scopedTask['annexKey'],
                    'annexLabel' => $scopedTask['annexLabel'],
                    'taskId' => $task->getKey(),
                    'name' => (string) ($row['name'] ?? $task->name),
                    'url' => (string) ($row['url'] ?? "https://app.clickup.com/t/{$task->clickup_task_id}"),
                    'estimateHours' => $row['estimateHours'] ?? null,
                    'owners' => array_values(is_array($row['owners'] ?? null) ? $row['owners'] : []),
                    'startDate' => $row['startDate'] ?? null,
                    'dueDate' => $row['dueDate'] ?? null,
                    'status' => (string) ($row['status'] ?? __('messages.common.no_status')),
                    'isDone' => (bool) ($row['isDone'] ?? false),
                    'missingFields' => array_values(array_filter([
                        ($row['estimateHours'] ?? null) === null ? 'estimateHours' : null,
                        ($row['owners'] ?? []) === [] ? 'owners' : null,
                        ($row['startDate'] ?? null) === null ? 'startDate' : null,
                        ($row['dueDate'] ?? null) === null ? 'dueDate' : null,
                    ])),
                ];
            })
            ->sortBy(fn (array $deliverable): string => $deliverable['name'])
            ->values();
        $people = $scopedTasks
            ->filter(fn (array $scopedTask): bool => $scopedTask['isBudgetTask'] || $scopedTask['isOperationalTask'])
            ->flatMap(function (array $scopedTask): array {
                $row = $scopedTask['row'];
                $owners = is_array($row['owners'] ?? null) ? $row['owners'] : [];
                $contributors = collect(is_array($row['people'] ?? null) ? $row['people'] : [])
                    ->pluck('name')
                    ->filter(fn (mixed $name): bool => is_string($name) && trim($name) !== '')
                    ->all();

                return [...$owners, ...$contributors];
            })
            ->filter(fn (mixed $name): bool => is_string($name) && trim($name) !== '')
            ->map(fn (string $name): string => trim($name))
            ->unique(fn (string $name): string => mb_strtolower($name))
            ->sort(SORT_NATURAL | SORT_FLAG_CASE)
            ->values();
        $issues = collect([
            ['field' => 'contractIdentifier', 'count' => 1, 'reason' => 'contract_identifier_missing'],
            ['field' => 'contractBudgetHours', 'count' => 1, 'reason' => 'contract_budget_missing'],
            ['field' => 'contractDeadline', 'count' => 1, 'reason' => 'contract_deadline_missing'],
            [
                'field' => 'estimateHours',
                'count' => $deliverables->whereNull('estimateHours')->count(),
                'reason' => 'deliverable_estimate_missing',
            ],
            [
                'field' => 'owners',
                'count' => $deliverables->filter(fn (array $deliverable): bool => $deliverable['owners'] === [])->count(),
                'reason' => 'deliverable_owner_missing',
            ],
            [
                'field' => 'startDate',
                'count' => $deliverables->whereNull('startDate')->count(),
                'reason' => 'deliverable_start_missing',
            ],
            [
                'field' => 'dueDate',
                'count' => $deliverables->whereNull('dueDate')->count(),
                'reason' => 'deliverable_due_missing',
            ],
        ])->filter(fn (array $issue): bool => $issue['count'] > 0)->values();

        return [
            'enabled' => true,
            'budgetSourceLabels' => $budgetListNames,
            'operationalSourceLabels' => $operationalListNames,
            'deliverables' => $deliverables->all(),
            'issues' => $issues->all(),
            'people' => $people->all(),
        ];
    }

    /**
     * @param  array{annexKey: string, annexLabel: string, scopeSource: string, task: ClickUpTask, row: array<string, mixed>}  $scopedTask
     * @return array<string, mixed>
     */
    private function annexTaskRow(array $scopedTask, ?float $plannedHours): array
    {
        $task = $scopedTask['task'];
        $row = $scopedTask['row'];
        $workedHours = (float) ($row['periodHours'] ?? 0);

        return [
            'annexKey' => $scopedTask['annexKey'],
            'annexLabel' => $scopedTask['annexLabel'],
            'scopeSource' => $scopedTask['scopeSource'],
            'taskId' => $task->getKey(),
            'name' => (string) ($row['name'] ?? $task->name),
            'url' => (string) ($row['url'] ?? "https://app.clickup.com/t/{$task->clickup_task_id}"),
            'owners' => array_values(is_array($row['owners'] ?? null) ? $row['owners'] : []),
            'plannedHours' => $plannedHours === null ? null : round($plannedHours, 2),
            'workedHours' => round($workedHours, 2),
            'estimateHours' => $row['estimateHours'] ?? null,
            'remainingEstimateHours' => $row['remainingHours'] ?? null,
            'startDate' => $row['startDate'] ?? null,
            'dueDate' => $row['dueDate'] ?? null,
            'status' => (string) ($row['status'] ?? __('messages.common.no_status')),
            'isDone' => (bool) ($row['isDone'] ?? false),
            'isUnplanned' => $plannedHours === 0.0 && $workedHours > 0,
            'missingFields' => array_values(array_filter([
                ($row['owners'] ?? []) === [] ? 'owners' : null,
                ($row['estimateHours'] ?? null) === null ? 'estimateHours' : null,
                ($row['startDate'] ?? null) === null ? 'startDate' : null,
                ($row['dueDate'] ?? null) === null ? 'dueDate' : null,
            ])),
        ];
    }

    /**
     * @param  Collection<int, covariant array<string, mixed>>  $upcomingTasks
     * @return Collection<int<0, max>, float>
     */
    private function selectedPlanHours(Project $project, Collection $upcomingTasks, CarbonImmutable $weekStart): Collection
    {
        return WeeklyPlan::query()
            ->whereBelongsTo($project)
            ->whereDate('week_start', $weekStart)
            ->where('selected', true)
            ->whereIn('click_up_task_id', $upcomingTasks->pluck('id')->all())
            ->with(['allocations:id,weekly_plan_id,hours'])
            ->get()
            ->mapWithKeys(fn (WeeklyPlan $plan): array => [
                $plan->click_up_task_id => round((float) $plan->allocations->sum('hours'), 2),
            ]);
    }

    /** @return array{key: string, label: string, source: string} */
    private function annexScope(Project $project, ClickUpTask $task): array
    {
        $configuredScopes = data_get($project->board_config, 'annex_modules', []);
        $configured = is_array($configuredScopes)
            ? ($configuredScopes[$task->clickup_task_id] ?? null)
            : null;

        if (is_string($configured) && trim($configured) !== '') {
            $label = $this->normalizeAnnexLabel($configured);

            return ['key' => $this->annexKey($label), 'label' => $label, 'source' => 'configured'];
        }

        preg_match_all('/\[([^\]]+)\]/u', $task->name, $matches);
        $genericLabels = ['projects', 'project', 'new platform', 'la depozit', 'osiris'];
        $labels = collect($matches[1])
            ->map(fn (mixed $label): string => $this->normalizeAnnexLabel((string) $label))
            ->reject(fn (string $label): bool => $label === '' || in_array(mb_strtolower($label), $genericLabels, true));

        if ($labels->isNotEmpty()) {
            $label = (string) $labels->last();

            return ['key' => $this->annexKey($label), 'label' => $label, 'source' => 'task_name'];
        }

        return [
            'key' => 'annex-data-missing',
            'label' => __('messages.pm_board.annex_data_missing'),
            'source' => 'missing',
        ];
    }

    private function normalizeAnnexLabel(string $label): string
    {
        return trim((string) preg_replace('/\s+/u', ' ', $label));
    }

    private function annexKey(string $label): string
    {
        $slug = Str::slug($label);

        return $slug !== '' ? $slug : 'annex-'.substr(sha1($label), 0, 10);
    }

    private function annexType(string $label, string $scopeSource): string
    {
        if ($scopeSource === 'missing') {
            return 'unresolved';
        }

        $normalizedLabel = Str::lower(Str::ascii($label));

        return str_contains($normalizedLabel, 'maintenance') || str_contains($normalizedLabel, 'mentenanta')
            ? 'maintenance'
            : 'fixed';
    }

    /** @return list<string> */
    private function configuredBoardListNames(Project $project, string $key): array
    {
        $names = data_get($project->board_config, $key, []);

        if (! is_array($names)) {
            return [];
        }

        return array_values(collect($names)
            ->filter(fn (mixed $name): bool => is_string($name) && trim($name) !== '')
            ->map(fn (string $name): string => trim($name))
            ->unique(fn (string $name): string => mb_strtolower($name))
            ->values()
            ->all());
    }

    /** @param list<string> $configuredNames */
    private function listNameMatches(string $listName, array $configuredNames): bool
    {
        $normalized = mb_strtolower(trim($listName));

        return $normalized !== '' && collect($configuredNames)
            ->contains(fn (string $name): bool => mb_strtolower($name) === $normalized);
    }

    /**
     * @param  EloquentCollection<int, Project>  $projects
     * @return Collection<int, int>
     */
    private function periodSecondsByProject(
        EloquentCollection $projects,
        CarbonImmutable $rangeStart,
        CarbonImmutable $rangeEnd,
    ): Collection {
        return TimeEntry::query()
            ->whereIn('project_id', $projects->modelKeys())
            ->whereBetween('started_at', [$rangeStart->utc(), $rangeEnd->utc()])
            ->selectRaw('project_id, SUM(duration_seconds) as aggregate_seconds')
            ->groupBy('project_id')
            ->pluck('aggregate_seconds', 'project_id')
            ->map(fn (mixed $seconds): int => (int) $seconds);
    }

    /** @return Collection<int, string> */
    private function internalListIds(): Collection
    {
        return ClickUpList::query()
            ->whereIn('click_up_folder_id', ClickUpFolder::query()
                ->select('id')
                ->where('kind', ClickUpLocationKind::Internal))
            ->pluck('clickup_list_id')
            ->values();
    }

    /** @param Collection<int, string> $internalListIds */
    private function internalPeriodSeconds(
        Collection $internalListIds,
        CarbonImmutable $rangeStart,
        CarbonImmutable $rangeEnd,
    ): int {
        if ($internalListIds->isEmpty()) {
            return 0;
        }

        return (int) TimeEntry::query()
            ->whereIn('click_up_task_id', ClickUpTask::query()
                ->select('id')
                ->whereIn('clickup_list_id', $internalListIds))
            ->whereBetween('started_at', [$rangeStart->utc(), $rangeEnd->utc()])
            ->sum('duration_seconds');
    }

    /**
     * @param  EloquentCollection<int, Project>  $projects
     * @param  Collection<int, int>  $periodSecondsByProject
     * @return EloquentCollection<int, Project>
     */
    private function orderProjectsByPeriodHours(
        EloquentCollection $projects,
        Collection $periodSecondsByProject,
    ): EloquentCollection {
        return $projects
            ->sort(function (Project $first, Project $second) use ($periodSecondsByProject): int {
                $hoursComparison = ((int) $periodSecondsByProject->get($second->getKey(), 0))
                    <=> ((int) $periodSecondsByProject->get($first->getKey(), 0));

                return $hoursComparison !== 0
                    ? $hoursComparison
                    : strnatcasecmp($this->projectLabel($first), $this->projectLabel($second));
            })
            ->values();
    }

    /**
     * @param  Collection<int, int>  $periodSecondsByProject
     * @return array{id: int, label: string, template: string|null, templateLabel: string, managerIds: list<int>, periodHours: float}
     */
    private function projectData(Project $project, Collection $periodSecondsByProject): array
    {
        $template = $project->contract_type instanceof ProjectBoardTemplate
            ? $project->contract_type
            : null;

        return [
            'id' => $project->getKey(),
            'label' => $this->projectLabel($project),
            'template' => $template?->value,
            'templateLabel' => $template?->label() ?? __('messages.pm_board.not_configured'),
            'managerIds' => array_values($project->managers->pluck('id')->map(fn (mixed $id): int => (int) $id)->all()),
            'periodHours' => round(((int) $periodSecondsByProject->get($project->getKey(), 0)) / 3600, 2),
        ];
    }

    private function projectLabel(Project $project): string
    {
        return trim($project->client.' — '.$project->name, ' —');
    }

    /** @return array<string, mixed>|null */
    private function syncStatus(): ?array
    {
        $sync = SyncRun::query()
            ->where('source', 'clickup')
            ->latest('started_at')
            ->first();

        if ($sync === null) {
            return null;
        }

        return [
            'status' => $sync->status->value,
            'startedAt' => $sync->started_at?->toIso8601String(),
            'finishedAt' => $sync->finished_at?->toIso8601String(),
            'error' => $sync->error_message,
        ];
    }

    /** @return array{0: CarbonImmutable, 1: CarbonImmutable} */
    private function range(CarbonImmutable $anchor, string $period): array
    {
        return $period === 'month'
            ? [$anchor->startOfMonth(), $anchor->endOfMonth()]
            : [$anchor->startOfWeek(), $anchor->endOfWeek()];
    }

    /** @return array<string, string> */
    private function periodData(
        string $period,
        CarbonImmutable $anchor,
        CarbonImmutable $start,
        CarbonImmutable $end,
    ): array {
        $previous = $period === 'month' ? $anchor->subMonthNoOverflow() : $anchor->subWeek();
        $next = $period === 'month' ? $anchor->addMonthNoOverflow() : $anchor->addWeek();

        return [
            'type' => $period,
            'anchor' => $anchor->toDateString(),
            'start' => $start->toDateString(),
            'end' => $end->toDateString(),
            'label' => $period === 'month'
                ? $this->monthName($start).' '.$start->year
                : $this->shortDate($start).' – '.$this->shortDate($end).' '.$end->year,
            'previousAnchor' => $previous->toDateString(),
            'nextAnchor' => $next->toDateString(),
        ];
    }

    private function shortDate(CarbonImmutable $date): string
    {
        return $date->day.' '.__('dates.months_short_lower.'.$date->month);
    }

    private function shortWeekday(CarbonImmutable $date): string
    {
        return __('dates.weekdays_short.'.$date->dayOfWeekIso);
    }

    private function monthName(CarbonImmutable $date): string
    {
        return __('dates.months.'.$date->month);
    }
}
