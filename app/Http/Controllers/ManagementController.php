<?php

namespace App\Http\Controllers;

use App\Services\Management\ManagementUtilizationData;
use Inertia\Inertia;
use Inertia\Response;

class ManagementController extends Controller
{
    public function __construct(private readonly ManagementUtilizationData $utilization) {}

    public function index(): Response
    {
        return Inertia::render('management/index', $this->utilization->build());
    }
}
