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
