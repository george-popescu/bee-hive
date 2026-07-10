<?php

namespace App\Http\Controllers;

use App\Services\TeamLead\TeamLeadPlanData;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TeamLeadController extends Controller
{
    public function __construct(private readonly TeamLeadPlanData $planData) {}

    public function index(Request $request): Response
    {
        return Inertia::render('team-lead/index', $this->planData->for($request->user()));
    }
}
