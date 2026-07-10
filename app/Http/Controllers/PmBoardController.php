<?php

namespace App\Http\Controllers;

use App\Http\Requests\ViewPmBoardRequest;
use App\Services\PmBoard\PmBoardData;
use Carbon\CarbonImmutable;
use Inertia\Inertia;
use Inertia\Response;

class PmBoardController extends Controller
{
    public function __construct(private readonly PmBoardData $board) {}

    public function index(ViewPmBoardRequest $request): Response
    {
        $data = $request->validated();

        return Inertia::render('pm-board/index', $this->board->for(
            user: $request->user(),
            selectedProjectId: isset($data['project']) ? (int) $data['project'] : null,
            period: $data['period'] ?? 'week',
            anchor: isset($data['anchor']) ? CarbonImmutable::parse($data['anchor']) : now()->toImmutable(),
            pmId: isset($data['pm']) ? (int) $data['pm'] : null,
        ));
    }
}
