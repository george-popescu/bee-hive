<?php

namespace App\Services\Capacity;

use App\Models\Allocation;
use App\Models\Person;
use App\Models\Project;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Services\TeamLead\TeamLeadPlanData;
use App\Services\TeamLead\TeamLeadScope;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class AllocationPlanService
{
    public function __construct(
        private readonly TeamLeadScope $scope,
        private readonly TeamLeadPlanData $planData,
        private readonly AuditLogger $audit,
    ) {}

    /** @param list<array{week_start: string, hours: float|int|string}>|null $weeklyHours */
    public function upsert(
        User $user,
        Person $person,
        Project $project,
        string $role,
        string $month,
        float $plannedHours,
        ?array $weeklyHours = null,
        ?string $planningComment = null,
        bool $replacePlanningDetails = false,
    ): Allocation {
        return DB::transaction(fn (): Allocation => $this->performUpsert(
            $user,
            $person,
            $project,
            $role,
            $month,
            $plannedHours,
            $weeklyHours,
            $planningComment,
            $replacePlanningDetails,
        ));
    }

    /** @param list<array{week_start: string, hours: float|int|string}>|null $weeklyHours */
    public function update(
        User $user,
        Allocation $allocation,
        Person $person,
        Project $project,
        string $role,
        string $month,
        float $plannedHours,
        ?array $weeklyHours = null,
        ?string $planningComment = null,
        bool $replacePlanningDetails = false,
    ): Allocation {
        return DB::transaction(fn (): Allocation => $this->performUpdate(
            $user,
            $allocation,
            $person,
            $project,
            $role,
            $month,
            $plannedHours,
            $weeklyHours,
            $planningComment,
            $replacePlanningDetails,
        ));
    }

    public function destroy(User $user, Allocation $allocation): void
    {
        DB::transaction(function () use ($user, $allocation): void {
            if (! in_array($allocation->person_id, $this->scope->personIds($user), true)) {
                throw new AuthorizationException('You cannot manage allocations for this person.');
            }

            $before = $this->snapshot($allocation);
            $this->audit->log($user, $allocation, 'allocation.deleted', $before, []);
            $allocation->delete();
        });
    }

    /**
     * @param  list<array{id?: int|null, project_id: int, role?: string|null, planned_hours: float|int|string, weekly_hours: list<array{week_start: string, hours: float|int|string}>, planning_comment?: string|null}>  $rows
     * @return Collection<int, Allocation>
     */
    public function replacePersonMonth(User $user, Person $person, string $month, array $rows): Collection
    {
        if (! in_array($person->getKey(), $this->scope->personIds($user), true)) {
            throw new AuthorizationException('You cannot manage allocations for this person.');
        }

        if (! in_array($month, $this->planData->monthKeys(), true)) {
            throw ValidationException::withMessages(['month' => 'The selected month is outside the active planning period.']);
        }

        $normalizedMonth = CarbonImmutable::parse($month)->startOfMonth()->toDateString();

        return DB::transaction(function () use ($user, $person, $normalizedMonth, $rows): Collection {
            $existing = Allocation::query()
                ->whereBelongsTo($person)
                ->whereDate('month', $normalizedMonth)
                ->lockForUpdate()
                ->get()
                ->keyBy(fn (Allocation $allocation): int => (int) $allocation->getKey());
            $requestedIds = collect($rows)
                ->pluck('id')
                ->filter(fn (mixed $id): bool => $id !== null)
                ->map(fn (mixed $id): int => (int) $id);

            if ($requestedIds->diff($existing->keys())->isNotEmpty()) {
                throw ValidationException::withMessages([
                    'allocations' => 'Every allocation must belong to the selected person and month.',
                ]);
            }

            $beforeSnapshots = $existing->map(fn (Allocation $allocation): array => $this->snapshot($allocation));

            foreach ($existing->except($requestedIds->all()) as $allocation) {
                $before = $beforeSnapshots->get($allocation->getKey(), []);
                $this->audit->log($user, $allocation, 'allocation.deleted', $before, []);
                $allocation->delete();
            }

            foreach ($rows as $row) {
                if (! isset($row['id'])) {
                    continue;
                }

                $allocation = $existing->get((int) $row['id']);
                $targetRole = trim((string) ($row['role'] ?? ''));

                if ($allocation !== null
                    && ($allocation->project_id !== (int) $row['project_id'] || $allocation->role !== $targetRole)) {
                    $allocation->forceFill(['role' => '__hive_draft_'.$allocation->getKey()])->save();
                }
            }

            $saved = collect();

            foreach ($rows as $row) {
                $allocation = isset($row['id'])
                    ? $existing->get((int) $row['id'])
                    : null;
                $isNew = $allocation === null;
                $allocation ??= new Allocation([
                    'person_id' => $person->getKey(),
                    'month' => $normalizedMonth,
                    'created_by' => $user->getKey(),
                ]);
                $before = $isNew ? [] : $beforeSnapshots->get($allocation->getKey(), []);

                $allocation->fill([
                    'project_id' => (int) $row['project_id'],
                    'role' => trim((string) ($row['role'] ?? '')),
                    'planned_hours' => (float) $row['planned_hours'],
                    'weekly_hours' => $this->normalizeWeeklyHours($row['weekly_hours']),
                    'planning_comment' => $this->normalizeComment($row['planning_comment'] ?? null),
                    'updated_by' => $user->getKey(),
                ])->save();

                $after = $this->snapshot($allocation);

                if ($isNew) {
                    $this->audit->log($user, $allocation, 'allocation.upserted', [], $after);
                } elseif ($before !== $after) {
                    $this->audit->log($user, $allocation, 'allocation.updated', $before, $after);
                }

                $saved->push($allocation->refresh());
            }

            return $saved;
        });
    }

    /** @param list<array{week_start: string, hours: float|int|string}>|null $weeklyHours */
    private function performUpsert(
        User $user,
        Person $person,
        Project $project,
        string $role,
        string $month,
        float $plannedHours,
        ?array $weeklyHours,
        ?string $planningComment,
        bool $replacePlanningDetails,
    ): Allocation {
        if (! in_array($person->getKey(), $this->scope->personIds($user), true)) {
            throw new AuthorizationException('You cannot manage allocations for this person.');
        }

        if (! in_array($month, $this->planData->monthKeys(), true)) {
            throw ValidationException::withMessages(['month' => 'The selected month is outside the active planning period.']);
        }

        $normalizedMonth = CarbonImmutable::parse($month)->startOfMonth()->toDateString();
        $normalizedRole = trim($role);
        $allocation = Allocation::query()
            ->whereBelongsTo($person)
            ->whereBelongsTo($project)
            ->where('role', $normalizedRole)
            ->whereDate('month', $normalizedMonth)
            ->first();

        $allocation ??= new Allocation([
            'person_id' => $person->getKey(),
            'project_id' => $project->getKey(),
            'role' => $normalizedRole,
            'month' => $normalizedMonth,
        ]);
        $before = $allocation->exists ? $this->snapshot($allocation) : [];

        if (! $allocation->exists) {
            $allocation->created_by = $user->getKey();
        }

        $changes = [
            'planned_hours' => $plannedHours,
            'updated_by' => $user->getKey(),
        ];

        if ($replacePlanningDetails) {
            $changes['weekly_hours'] = $this->normalizeWeeklyHours($weeklyHours ?? []);
            $changes['planning_comment'] = $this->normalizeComment($planningComment);
        } elseif ($allocation->exists
            && $allocation->weekly_hours !== null
            && abs((float) $allocation->planned_hours - $plannedHours) > 0.001) {
            $changes['weekly_hours'] = null;
        }

        $allocation->fill($changes)->save();

        $this->audit->log($user, $allocation, 'allocation.upserted', $before, $this->snapshot($allocation));

        return $allocation->refresh();
    }

    /** @param list<array{week_start: string, hours: float|int|string}>|null $weeklyHours */
    private function performUpdate(
        User $user,
        Allocation $allocation,
        Person $person,
        Project $project,
        string $role,
        string $month,
        float $plannedHours,
        ?array $weeklyHours,
        ?string $planningComment,
        bool $replacePlanningDetails,
    ): Allocation {
        $manageablePersonIds = $this->scope->personIds($user);

        if (! in_array($allocation->person_id, $manageablePersonIds, true)
            || ! in_array($person->getKey(), $manageablePersonIds, true)) {
            throw new AuthorizationException('You cannot manage allocations for this person.');
        }

        if (! in_array($month, $this->planData->monthKeys(), true)) {
            throw ValidationException::withMessages(['month' => 'The selected month is outside the active planning period.']);
        }

        $normalizedMonth = CarbonImmutable::parse($month)->startOfMonth()->toDateString();
        $normalizedRole = trim($role);
        $duplicateExists = Allocation::query()
            ->whereKeyNot($allocation->getKey())
            ->whereBelongsTo($person)
            ->whereBelongsTo($project)
            ->where('role', $normalizedRole)
            ->whereDate('month', $normalizedMonth)
            ->exists();

        if ($duplicateExists) {
            throw ValidationException::withMessages([
                'project_id' => 'An allocation already exists for this person, project, role, and month.',
            ]);
        }

        $before = $this->snapshot($allocation);
        $monthChanged = CarbonImmutable::parse($allocation->month)->toDateString() !== $normalizedMonth;
        $hoursChanged = abs((float) $allocation->planned_hours - $plannedHours) > 0.001;

        $changes = [
            'person_id' => $person->getKey(),
            'project_id' => $project->getKey(),
            'role' => $normalizedRole,
            'month' => $normalizedMonth,
            'planned_hours' => $plannedHours,
            'updated_by' => $user->getKey(),
        ];

        if ($replacePlanningDetails) {
            $changes['weekly_hours'] = $this->normalizeWeeklyHours($weeklyHours ?? []);
            $changes['planning_comment'] = $this->normalizeComment($planningComment);
        } elseif ($monthChanged || $hoursChanged) {
            $changes['weekly_hours'] = null;
        }

        $allocation->fill($changes)->save();

        $this->audit->log($user, $allocation, 'allocation.updated', $before, $this->snapshot($allocation));

        return $allocation->refresh();
    }

    /**
     * @param  list<array{week_start: string, hours: float|int|string}>  $weeklyHours
     * @return list<array{week_start: string, hours: float}>
     */
    private function normalizeWeeklyHours(array $weeklyHours): array
    {
        $normalized = array_map(fn (array $week): array => [
            'week_start' => $week['week_start'],
            'hours' => round((float) $week['hours'], 2),
        ], $weeklyHours);
        usort(
            $normalized,
            fn (array $left, array $right): int => $left['week_start'] <=> $right['week_start'],
        );

        return $normalized;
    }

    private function normalizeComment(?string $planningComment): ?string
    {
        $comment = trim((string) $planningComment);

        return $comment === '' ? null : $comment;
    }

    /** @return array<string, mixed> */
    private function snapshot(Allocation $allocation): array
    {
        return [
            'person_id' => $allocation->person_id,
            'project_id' => $allocation->project_id,
            'planned_hours' => (float) $allocation->planned_hours,
            'weekly_hours' => $allocation->weekly_hours,
            'planning_comment' => $allocation->planning_comment,
            'role' => $allocation->role,
            'month' => CarbonImmutable::parse($allocation->month)->toDateString(),
        ];
    }
}
