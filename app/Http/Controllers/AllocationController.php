<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpsertAllocationRequest;
use App\Models\Person;
use App\Models\Project;
use App\Services\Capacity\AllocationPlanService;
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
        );

        return response()->json([
            'allocation' => [
                'id' => $allocation->getKey(),
                'planned_hours' => (float) $allocation->planned_hours,
                'updated_at' => $allocation->updated_at?->toIso8601String(),
            ],
        ]);
    }
}
