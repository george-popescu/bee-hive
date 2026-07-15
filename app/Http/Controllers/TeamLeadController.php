<?php

namespace App\Http\Controllers;

use App\Http\Requests\ViewTeamLeadPlanRequest;
use App\Services\TeamLead\TeamLeadPlanData;
use Carbon\CarbonImmutable;
use Inertia\Inertia;
use Inertia\Response;

class TeamLeadController extends Controller
{
    public function __construct(private readonly TeamLeadPlanData $planData) {}

    public function index(ViewTeamLeadPlanRequest $request): Response
    {
        $data = $request->validated();
        $week = isset($data['week'])
            ? CarbonImmutable::parse($data['week'])->startOfWeek()
            : CarbonImmutable::now()->startOfWeek();

        return Inertia::render('team-lead/index', $this->planData->for($request->user(), $week));
    }
}
