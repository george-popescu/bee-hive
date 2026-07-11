<?php

namespace App\Http\Controllers;

use App\Services\Dashboard\DashboardData;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request, DashboardData $dashboardData): Response
    {
        return Inertia::render('dashboard', [
            'dashboard' => $dashboardData->for($request->user()),
        ]);
    }
}
