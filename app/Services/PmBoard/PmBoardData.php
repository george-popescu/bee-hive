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

        if ($selectedProjectId !== null && ! in_array($selectedProjectId, $projectIds, true)) {
            throw new AuthorizationException;
        }

        $allProjects = Project::query()
            ->select(['id', 'client', 'name', 'contract_type'])
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
        $selectedProject = $selectedProjectId === null
            ? $projects->first()
            : $projects->firstWhere('id', $selectedProjectId);
        $period = $period === 'month' ? 'month' : 'week';
        [$rangeStart, $rangeEnd] = $this->range($anchor, $period);
        $sync = $this->syncStatus();

        if (! $selectedProject instanceof Project) {
            return [
                'projects' => $projects->map(fn (Project $project): array => $this->projectData($project))->all(),
                'managers' => $managers->map(fn (Person $person): array => [
                    'id' => $person->getKey(),
                    'name' => $person->name,
                ])->all(),
                'selectedPmId' => $pmId,
                'selectedProject' => null,
                'period' => $this->periodData($period, $anchor, $rangeStart, $rangeEnd),
                'workedTasks' => [],
                'upcomingTasks' => [],
                'peopleWorked' => [],
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
            ->whereBelongsTo($selectedProject)
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
            ->whereBelongsTo($selectedProject)
            ->where(fn ($query) => $query
                ->where('active', true)
                ->orWhereIn('id', $taskIdsWithEntries))
            ->with(['assignees:id,name'])
            ->orderBy('name')
            ->get();
        $taskIds = $tasks->modelKeys();
        $periodEntryRows = TimeEntry::query()
            ->select(['id', 'click_up_task_id', 'person_id', 'person_name', 'duration_seconds', 'started_at'])
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
        $upcomingTasks = $taskRows
            ->filter(fn (array $task): bool => $task['active'] && ! $task['isDone'])
            ->sortBy(fn (array $task): string => $task['statusGroup'].'|'.($task['dueDate'] ?? '9999-12-31').'|'.$task['name'])
            ->values();
        $peopleWorked = $this->peopleWorked($periodEntryRows);

        return [
            'projects' => $projects->map(fn (Project $project): array => $this->projectData($project))->all(),
            'managers' => $managers->map(fn (Person $person): array => [
                'id' => $person->getKey(),
                'name' => $person->name,
            ])->all(),
            'selectedPmId' => $pmId,
            'selectedProject' => $this->projectData($selectedProject),
            'period' => $this->periodData($period, $anchor, $rangeStart, $rangeEnd),
            'workedTasks' => $workedTasks->all(),
            'upcomingTasks' => $upcomingTasks->all(),
            'peopleWorked' => $peopleWorked,
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

    /** @return array{id: int, label: string, template: string, templateLabel: string, managerIds: list<int>} */
    private function projectData(Project $project): array
    {
        $template = $project->contract_type instanceof ProjectBoardTemplate
            ? $project->contract_type
            : ProjectBoardTemplate::TimeAndMaterials;

        return [
            'id' => $project->getKey(),
            'label' => trim($project->client.' — '.$project->name, ' —'),
            'template' => $template->value,
            'templateLabel' => $template->label(),
            'managerIds' => array_values($project->managers->pluck('id')->map(fn (mixed $id): int => (int) $id)->all()),
        ];
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
