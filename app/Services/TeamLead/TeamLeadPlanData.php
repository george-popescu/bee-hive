<?php

namespace App\Services\TeamLead;

use App\Enums\PermissionName;
use App\Models\ActualAdjustment;
use App\Models\Allocation;
use App\Models\Person;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
use App\Services\Capacity\PlanVarianceCalculator;
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
    ) {}

    /** @return array<string, mixed> */
    public function for(User $user): array
    {
        $months = $this->period->months();
        $firstMonth = $months[0] ?? throw new LogicException('The planning period has no months.');
        $lastMonth = $months[count($months) - 1] ?? throw new LogicException('The planning period has no months.');
        $monthKeys = array_map(fn (CarbonImmutable $month): string => $month->format('Y-m'), $months);
        $personIds = $this->scope->personIds($user);
        $people = Person::query()
            ->select(['id', 'name', 'job_role', 'default_monthly_capacity_hours', 'is_external'])
            ->whereIn('id', $personIds)
            ->where('active', true)
            ->with(['capacities' => fn ($query) => $query
                ->select(['id', 'person_id', 'month', 'capacity_hours'])
                ->whereBetween('month', [$firstMonth, $lastMonth])])
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
            ->select(['id', 'person_id', 'project_id', 'role', 'month', 'planned_hours'])
            ->whereIn('person_id', $people->keys())
            ->whereBetween('month', [$firstMonth, $lastMonth])
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

        return [
            'months' => array_map(fn (CarbonImmutable $month): array => [
                'key' => $month->format('Y-m'),
                'label' => $this->period->label($month),
            ], $months),
            'people' => $people->map(fn (Person $person): array => [
                'id' => $person->getKey(),
                'name' => $person->name,
            ])->values()->all(),
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

        return $label === '' ? 'Activitate internă' : $label;
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
