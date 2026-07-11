<?php

namespace App\Http\Controllers;

use App\Http\Requests\ReverseActualAdjustmentRequest;
use App\Http\Requests\StoreActualAdjustmentRequest;
use App\Models\ActualAdjustment;
use App\Models\Person;
use App\Models\Project;
use App\Services\Capacity\ActualAdjustmentService;
use App\Services\TeamLead\TeamLeadScope;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;

class ActualAdjustmentController extends Controller
{
    public function __construct(
        private readonly ActualAdjustmentService $adjustments,
        private readonly TeamLeadScope $scope,
    ) {}

    public function store(StoreActualAdjustmentRequest $request): JsonResponse|RedirectResponse
    {
        $data = $request->validated();
        abort_unless(in_array((int) $data['person_id'], $this->scope->personIds($request->user()), true), 403);

        $adjustment = $this->adjustments->create(
            person: Person::query()->where('active', true)->findOrFail((int) $data['person_id']),
            project: isset($data['project_id'])
                ? Project::query()->where('active', true)->findOrFail((int) $data['project_id'])
                : null,
            effectiveDate: CarbonImmutable::createFromFormat('!Y-m-d', $data['effective_date']),
            hoursDelta: (float) $data['hours_delta'],
            reason: $data['reason'],
            author: $request->user(),
            internalLabel: $data['internal_label'] ?? null,
        );

        if ($request->expectsJson()) {
            return response()->json([
                'adjustment' => [
                    'id' => $adjustment->getKey(),
                    'hours_delta' => (float) $adjustment->hours_delta,
                    'month' => CarbonImmutable::parse($adjustment->month)->format('Y-m'),
                    'effective_date' => CarbonImmutable::parse($adjustment->effective_date)->toDateString(),
                ],
            ], 201);
        }

        return back(status: 303)->with('success', 'Ajustarea a fost înregistrată.');
    }

    public function reverse(
        ReverseActualAdjustmentRequest $request,
        ActualAdjustment $actualAdjustment,
    ): JsonResponse|RedirectResponse {
        abort_unless(in_array($actualAdjustment->person_id, $this->scope->personIds($request->user()), true), 403);
        abort_if($actualAdjustment->reverses_adjustment_id !== null, 409, 'O inversare nu poate fi inversată din nou.');
        abort_if($actualAdjustment->reversedBy()->exists(), 409, 'Ajustarea a fost deja inversată.');

        $reversal = $this->adjustments->reverse(
            adjustment: $actualAdjustment,
            author: $request->user(),
            reason: $request->validated('reason'),
        );

        if ($request->expectsJson()) {
            return response()->json([
                'adjustment' => [
                    'id' => $reversal->getKey(),
                    'reverses_adjustment_id' => $actualAdjustment->getKey(),
                    'hours_delta' => (float) $reversal->hours_delta,
                ],
            ], 201);
        }

        return back(status: 303)->with('success', 'Ajustarea a fost inversată.');
    }
}
