<?php

namespace App\Http\Controllers;

use App\Http\Requests\ViewPmBoardRequest;
use App\Services\PmBoard\PmBoardCsvExporter;
use App\Services\PmBoard\PmBoardData;
use Carbon\CarbonImmutable;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PmBoardController extends Controller
{
    public function __construct(
        private readonly PmBoardData $board,
        private readonly PmBoardCsvExporter $csv,
    ) {}

    public function index(ViewPmBoardRequest $request): Response
    {
        return Inertia::render('pm-board/index', $this->data($request));
    }

    public function export(ViewPmBoardRequest $request): StreamedResponse
    {
        return $this->csv->response($this->data($request));
    }

    /** @return array<string, mixed> */
    private function data(ViewPmBoardRequest $request): array
    {
        $data = $request->validated();
        $isCustomSelection = isset($data['project']) || ($data['selection'] ?? null) === 'custom';
        $selectedProjectIds = [];

        if (is_array($data['projects'] ?? null)) {
            foreach ($data['projects'] as $projectId) {
                $selectedProjectIds[] = (int) $projectId;
            }
        } elseif (isset($data['project'])) {
            $selectedProjectIds[] = (int) $data['project'];
        }

        $selectedProjectIds = array_values(array_unique($selectedProjectIds));

        return $this->board->for(
            user: $request->user(),
            selectedProjectIds: $selectedProjectIds,
            includeInternal: $isCustomSelection && (bool) ($data['include_internal'] ?? false),
            allProjectsSelected: ! $isCustomSelection,
            period: $data['period'] ?? 'week',
            anchor: isset($data['anchor']) ? CarbonImmutable::parse($data['anchor']) : now()->toImmutable(),
            pmId: isset($data['pm']) ? (int) $data['pm'] : null,
        );
    }
}
