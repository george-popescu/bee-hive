<?php

namespace App\Http\Controllers;

use App\Http\Requests\DeleteAllocationRequest;
use App\Http\Requests\UpdateAllocationRequest;
use App\Http\Requests\UpsertAllocationRequest;
use App\Models\Allocation;
use App\Models\Person;
use App\Models\Project;
use App\Services\Capacity\AllocationPlanService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

class AllocationController extends Controller
{
    public function __construct(private readonly AllocationPlanService $allocations) {}

    public function upsert(UpsertAllocationRequest $request): JsonResponse
    {
        $data = $request->validated();
        $allocation = $this->allocations->upsert(
            user: $request->user(),
            person: Person::query()->whereKey((int) $data['person_id'])->firstOrFail(),
            project: Project::query()->whereKey((int) $data['project_id'])->firstOrFail(),
            role: $data['role'] ?? '',
            month: $data['month'],
            plannedHours: (float) $data['planned_hours'],
            weeklyHours: $data['weekly_hours'] ?? null,
            planningComment: $data['planning_comment'] ?? null,
            replacePlanningDetails: array_key_exists('weekly_hours', $data)
                || array_key_exists('planning_comment', $data),
        );

        return response()->json([
            'allocation' => $this->allocationData($allocation),
        ]);
    }

    public function update(UpdateAllocationRequest $request, Allocation $allocation): JsonResponse
    {
        $data = $request->validated();
        $allocation = $this->allocations->update(
            user: $request->user(),
            allocation: $allocation,
            person: Person::query()->whereKey((int) $data['person_id'])->firstOrFail(),
            project: Project::query()->whereKey((int) $data['project_id'])->firstOrFail(),
            role: $data['role'] ?? '',
            month: $data['month'],
            plannedHours: (float) $data['planned_hours'],
            weeklyHours: $data['weekly_hours'] ?? null,
            planningComment: $data['planning_comment'] ?? null,
            replacePlanningDetails: array_key_exists('weekly_hours', $data)
                || array_key_exists('planning_comment', $data),
        );

        return response()->json([
            'allocation' => $this->allocationData($allocation),
        ]);
    }

    public function destroy(DeleteAllocationRequest $request, Allocation $allocation): JsonResponse
    {
        $this->allocations->destroy($request->user(), $allocation);

        return response()->json(['deleted' => true]);
    }

    /** @return array{id: int, person_id: int, project_id: int, role: string, month: string, planned_hours: float, weekly_hours: list<array{week_start: string, hours: float}>, planning_comment: string|null, updated_at: string|null} */
    private function allocationData(Allocation $allocation): array
    {
        return [
            'id' => $allocation->getKey(),
            'person_id' => $allocation->person_id,
            'project_id' => $allocation->project_id,
            'role' => $allocation->role,
            'month' => CarbonImmutable::parse($allocation->month)->format('Y-m'),
            'planned_hours' => (float) $allocation->planned_hours,
            'weekly_hours' => array_map(fn (array $week): array => [
                'week_start' => $week['week_start'],
                'hours' => (float) $week['hours'],
            ], $allocation->weekly_hours ?? []),
            'planning_comment' => $allocation->planning_comment,
            'updated_at' => $allocation->updated_at?->toIso8601String(),
        ];
    }
}
