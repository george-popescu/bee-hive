<?php

namespace App\Services\TeamLead;

use App\Enums\PermissionName;
use App\Enums\SettingKey;
use App\Models\Allocation;
use App\Models\Person;
use App\Models\Project;
use App\Models\User;
use App\Services\Capacity\SettingsService;
use Carbon\CarbonImmutable;
use LogicException;
use Throwable;

final class TeamLeadPlanData
{
    public function __construct(
        private readonly TeamLeadScope $scope,
        private readonly SettingsService $settings,
    ) {}

    /** @return array<string, mixed> */
    public function for(User $user): array
    {
        $months = $this->months();
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
        $projects = Project::query()
            ->select(['id', 'client', 'name'])
            ->where('active', true)
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
            $project = $projects->get($allocation->project_id);

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

        return [
            'months' => array_map(fn (CarbonImmutable $month): array => [
                'key' => $month->format('Y-m'),
                'label' => $this->monthLabel($month),
            ], $months),
            'people' => $people->map(fn (Person $person): array => [
                'id' => $person->getKey(),
                'name' => $person->name,
            ])->values()->all(),
            'projects' => $projects->map(fn (Project $project): array => $this->projectData($project))->values()->all(),
            'roles' => $allocations->pluck('role')->filter()->unique()->sort()->values()->all(),
            'planRows' => array_values($rows),
            'permissions' => [
                'manageAllocations' => $user->can(PermissionName::ManageAllocations->value),
                'adjustActualHours' => $user->can(PermissionName::AdjustActualHours->value),
            ],
        ];
    }

    /** @return list<string> */
    public function monthKeys(): array
    {
        return array_map(fn (CarbonImmutable $month): string => $month->format('Y-m'), $this->months());
    }

    /** @return list<CarbonImmutable> */
    private function months(): array
    {
        $fallbackStart = Allocation::query()->min('month');
        $fallbackEnd = Allocation::query()->max('month');
        $start = $this->dateSetting(SettingKey::ActivePeriodStart)
            ?? ($fallbackStart === null ? now()->startOfMonth()->toImmutable() : CarbonImmutable::parse($fallbackStart));
        $end = $this->dateSetting(SettingKey::ActivePeriodEnd)
            ?? ($fallbackEnd === null ? $start->addMonths(5) : CarbonImmutable::parse($fallbackEnd));

        if ($start->isAfter($end)) {
            [$start, $end] = [$end, $start];
        }

        $months = [];

        for ($month = $start->startOfMonth(); $month->lessThanOrEqualTo($end) && count($months) < 36; $month = $month->addMonth()) {
            $months[] = $month;
        }

        return $months;
    }

    private function dateSetting(SettingKey $key): ?CarbonImmutable
    {
        $value = $this->settings->value($key);

        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        try {
            return CarbonImmutable::parse($value)->startOfMonth();
        } catch (Throwable) {
            return null;
        }
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

    /** @return array{id: int, label: string} */
    private function projectData(Project $project): array
    {
        return [
            'id' => $project->getKey(),
            'label' => trim($project->client.' — '.$project->name, ' —'),
        ];
    }

    private function monthLabel(CarbonImmutable $month): string
    {
        $labels = [
            1 => 'Ian',
            2 => 'Feb',
            3 => 'Mar',
            4 => 'Apr',
            5 => 'Mai',
            6 => 'Iun',
            7 => 'Iul',
            8 => 'Aug',
            9 => 'Sep',
            10 => 'Oct',
            11 => 'Nov',
            12 => 'Dec',
        ];

        return $labels[$month->month]." '".$month->format('y');
    }
}
