<?php

namespace App\Services\Capacity;

use App\Models\Allocation;
use App\Models\Person;
use App\Models\Project;
use App\Models\User;
use App\Services\TeamLead\TeamLeadPlanData;
use App\Services\TeamLead\TeamLeadScope;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Validation\ValidationException;

final class AllocationPlanService
{
    public function __construct(
        private readonly TeamLeadScope $scope,
        private readonly TeamLeadPlanData $planData,
    ) {}

    public function upsert(
        User $user,
        Person $person,
        Project $project,
        string $role,
        string $month,
        float $plannedHours,
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

        if (! $allocation->exists) {
            $allocation->created_by = $user->getKey();
        }

        $allocation->fill([
            'planned_hours' => $plannedHours,
            'updated_by' => $user->getKey(),
        ])->save();

        return $allocation->refresh();
    }
}
