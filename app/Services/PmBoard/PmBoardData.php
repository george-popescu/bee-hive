<?php

namespace App\Services\PmBoard;

use App\Enums\PermissionName;
use App\Enums\ProjectBoardTemplate;
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

class PmBoardData
{
    public function __construct(private readonly PmBoardScope $scope) {}

    /** @return array<string, mixed> */
    public function for(
        User $user,
        ?int $selectedProjectId,
        string $period,
        CarbonImmutable $anchor,
        ?int $pmId,
    ): array {
        $projectIds = $this->scope->projectIds($user);
        $period = $period === 'month' ? 'month' : 'week';

        if ($selectedProjectId !== null && ! in_array($selectedProjectId, $projectIds, true)) {
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
        $allProjectsSelected = $selectedProjectId === null;
        $selectedProject = $allProjectsSelected ? null : $projects->firstWhere('id', $selectedProjectId);

        if ($selectedProject instanceof Project && $selectedProject->contract_type === ProjectBoardTemplate::Deliverables) {
            $period = 'week';
            [$rangeStart, $rangeEnd] = $this->range($anchor, $period);
            $periodSecondsByProject = $this->periodSecondsByProject($projects, $rangeStart, $rangeEnd);
            $projects = $this->orderProjectsByPeriodHours($projects, $periodSecondsByProject);
        }
        $selectedProjects = $allProjectsSelected
            ? $projects
            : $projects->filter(fn (Project $project): bool => $project->is($selectedProject))->values();
        $sync = $this->syncStatus();

        if ($selectedProjects->isEmpty()) {
            return [
                'projects' => $projects->map(fn (Project $project): array => $this->projectData($project, $periodSecondsByProject))->all(),
                'managers' => $managers->map(fn (Person $person): array => [
                    'id' => $person->getKey(),
                    'name' => $person->name,
                ])->all(),
                'selectedPmId' => $pmId,
                'allProjectsSelected' => $allProjectsSelected,
                'selectedProject' => null,
                'period' => $this->periodData($period, $anchor, $rangeStart, $rangeEnd),
                'workedTasks' => [],
                'upcomingTasks' => [],
                'peopleWorked' => [],
                'planning' => null,
                'gantt' => null,
                'kpis' => [
                    'plannedHours' => 0.0,
                    'actualHours' => 0.0,
                    'workedTasks' => 0,
                    'plannedTasks' => 0,
                    'activePeople' => 0,
                    'projects' => $projects->count(),
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
            ->whereIn('project_id', $selectedProjects->modelKeys())
            ->whereNotNull('click_up_task_id')
            ->whereBetween('started_at', [$rangeStart, $rangeEnd]);
        $tasks = ClickUpTask::query()
            ->select([
                'id',
                'project_id',
                'clickup_task_id',
                'name',
                'status',
                'estimate_seconds',
                'tracked_seconds',
                'start_at',
                'due_at',
                'active',
            ])
            ->whereIn('project_id', $selectedProjects->modelKeys())
            ->where(fn ($query) => $query
                ->where('active', true)
                ->orWhereIn('id', $taskIdsWithEntries))
            ->with(['assignees:id,name', 'project:id,client,name'])
            ->orderBy('name')
            ->get();
        $taskIds = $tasks->modelKeys();
        $periodEntryRows = TimeEntry::query()
            ->select(['id', 'click_up_task_id', 'person_id', 'clickup_user_id', 'person_name', 'duration_seconds', 'started_at'])
            ->whereIn('click_up_task_id', $taskIds)
            ->whereBetween('started_at', [$rangeStart, $rangeEnd])
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
        $isDeliverables = $selectedProject instanceof Project
            && $selectedProject->contract_type === ProjectBoardTemplate::Deliverables;
        $planning = $isDeliverables
            ? $this->planningData($selectedProject, $upcomingTasks, $rangeEnd->addDay()->startOfDay())
            : null;
        $gantt = $isDeliverables
            ? $this->ganttData($tasks, $taskRows, $planning, $rangeStart)
            : null;

        return [
            'projects' => $projects->map(fn (Project $project): array => $this->projectData($project, $periodSecondsByProject))->all(),
            'managers' => $managers->map(fn (Person $person): array => [
                'id' => $person->getKey(),
                'name' => $person->name,
            ])->all(),
            'selectedPmId' => $pmId,
            'allProjectsSelected' => $allProjectsSelected,
            'selectedProject' => $selectedProject instanceof Project
                ? $this->projectData($selectedProject, $periodSecondsByProject)
                : null,
            'period' => $this->periodData($period, $anchor, $rangeStart, $rangeEnd),
            'workedTasks' => $workedTasks->all(),
            'upcomingTasks' => $upcomingTasks->all(),
            'peopleWorked' => $peopleWorked,
            'planning' => $planning,
            'gantt' => $gantt,
            'kpis' => [
                'plannedHours' => round($workedTasks->sum('estimateHours'), 2),
                'actualHours' => round($workedTasks->sum('periodHours'), 2),
                'workedTasks' => $workedTasks->count(),
                'plannedTasks' => $upcomingTasks->whereNotNull('estimateHours')->count(),
                'activePeople' => count($peopleWorked),
                'projects' => $projects->count(),
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
                    'name' => $entry instanceof TimeEntry ? $this->entryPersonName($entry) : 'Necunoscut',
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
        $statusGroup = str_contains($normalizedStatus, 'progress')
            || str_contains($normalizedStatus, 'qa')
            || str_contains($normalizedStatus, 'review')
            ? '0-active'
            : '1-todo';

        return [
            'id' => $task->getKey(),
            'clickupId' => $task->clickup_task_id,
            'name' => $task->name,
            'projectLabel' => $task->project instanceof Project ? $this->projectLabel($task->project) : 'Fără proiect',
            'url' => "https://app.clickup.com/t/{$task->clickup_task_id}",
            'status' => $status === '' ? 'fără status' : $status,
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
                    'name' => $entry instanceof TimeEntry ? $this->entryPersonName($entry) : 'Necunoscut',
                    'hours' => round(((int) $entries->sum('duration_seconds')) / 3600, 2),
                    'tasks' => $entries->pluck('click_up_task_id')->filter()->unique()->count(),
                ];
            })
            ->sortByDesc('hours')
            ->values()
            ->all());
    }

    private function entryPersonName(TimeEntry $entry): string
    {
        if ($entry->person_id === null) {
            return $entry->person_name ?? 'Necunoscut';
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
    private function ganttData(EloquentCollection $tasks, Collection $taskRows, array $planning, CarbonImmutable $rangeStart): array
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
        $firstWeek = $rangeStart->subWeek()->startOfWeek();
        $weeks = collect(range(0, 7))->map(function (int $offset) use ($firstWeek): array {
            $start = $firstWeek->addWeeks($offset);
            $end = $start->endOfWeek();

            return [
                'key' => $start->toDateString(),
                'label' => $this->shortDate($start).'–'.$this->shortDate($end),
                'start' => $start->toDateString(),
                'end' => $end->toDateString(),
                'isCurrent' => $start->isSameDay(CarbonImmutable::now()->startOfWeek()),
            ];
        });
        $rows = $tasks
            ->filter(fn (ClickUpTask $task): bool => $task->start_at !== null || $task->due_at !== null)
            ->sortBy(fn (ClickUpTask $task): string => ($task->start_at?->toDateString() ?? '9999-12-31').'|'.($task->due_at?->toDateString() ?? '9999-12-31'))
            ->map(function (ClickUpTask $task) use ($taskData, $selectedTaskIds): array {
                $row = $taskData->get($task->getKey(), []);

                return [
                    'id' => $task->getKey(),
                    'name' => $task->name,
                    'url' => "https://app.clickup.com/t/{$task->clickup_task_id}",
                    'status' => trim((string) $task->status) ?: 'fără status',
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
            ->whereBetween('started_at', [$rangeStart, $rangeEnd])
            ->selectRaw('project_id, SUM(duration_seconds) as aggregate_seconds')
            ->groupBy('project_id')
            ->pluck('aggregate_seconds', 'project_id')
            ->map(fn (mixed $seconds): int => (int) $seconds);
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
     * @return array{id: int, label: string, template: string, templateLabel: string, managerIds: list<int>, periodHours: float}
     */
    private function projectData(Project $project, Collection $periodSecondsByProject): array
    {
        $template = $project->contract_type instanceof ProjectBoardTemplate
            ? $project->contract_type
            : ProjectBoardTemplate::TimeAndMaterials;

        return [
            'id' => $project->getKey(),
            'label' => $this->projectLabel($project),
            'template' => $template->value,
            'templateLabel' => $template->label(),
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
        return $date->day.' '.mb_strtolower(mb_substr($this->monthName($date), 0, 3));
    }

    private function monthName(CarbonImmutable $date): string
    {
        return [
            1 => 'Ianuarie',
            2 => 'Februarie',
            3 => 'Martie',
            4 => 'Aprilie',
            5 => 'Mai',
            6 => 'Iunie',
            7 => 'Iulie',
            8 => 'August',
            9 => 'Septembrie',
            10 => 'Octombrie',
            11 => 'Noiembrie',
            12 => 'Decembrie',
        ][$date->month];
    }
}
