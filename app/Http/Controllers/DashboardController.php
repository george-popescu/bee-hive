<?php

namespace App\Http\Controllers;

use App\Http\Requests\ViewDashboardRequest;
use App\Services\Dashboard\DashboardData;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(ViewDashboardRequest $request, DashboardData $dashboardData): Response
    {
        return Inertia::render('dashboard', [
            'dashboard' => $dashboardData->for(
                user: $request->user(),
                requestedMonth: $request->validated('month'),
            ),
        ]);
    }
}
