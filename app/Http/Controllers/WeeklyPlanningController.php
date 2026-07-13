<?php

namespace App\Http\Controllers;

use App\Http\Requests\ClearWeeklyPlanningRequest;
use App\Http\Requests\UpsertWeeklyPlanningRequest;
use App\Services\PmBoard\WeeklyPlanningService;
use Illuminate\Http\JsonResponse;

class WeeklyPlanningController extends Controller
{
    public function __construct(private readonly WeeklyPlanningService $planning) {}

    public function upsert(UpsertWeeklyPlanningRequest $request): JsonResponse
    {
        $plan = $this->planning->upsert($request->payload(), $request->user());

        return response()->json([
            'plan' => [
                'id' => $plan->getKey(),
                'selected' => $plan->selected,
                'version' => $plan->version,
                'updatedAt' => $plan->updated_at?->toIso8601String(),
            ],
        ]);
    }

    public function clear(ClearWeeklyPlanningRequest $request): JsonResponse
    {
        return response()->json([
            'cleared' => $this->planning->clear($request->payload(), $request->user()),
        ]);
    }
}
