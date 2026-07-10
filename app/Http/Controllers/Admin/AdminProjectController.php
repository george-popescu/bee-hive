<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateProjectRequest;
use App\Models\Project;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;

class AdminProjectController extends Controller
{
    public function update(UpdateProjectRequest $request, Project $project, AuditLogger $audit): JsonResponse|RedirectResponse
    {
        $data = $request->validated();

        DB::transaction(function () use ($request, $project, $audit, $data): void {
            $before = $this->snapshot($project);
            $existingConfig = $project->board_config ?? [];
            $project->update([
                'contract_type' => $data['contract_type'],
                'board_visible' => $data['board_visible'],
                'active' => $data['active'],
                'board_config' => [
                    ...$existingConfig,
                    'excluded_task_ids' => array_values($data['excluded_task_ids']),
                    'allowed_resource_names' => array_values($data['allowed_resource_names']),
                ],
            ]);
            $project->managers()->sync($data['manager_ids']);
            $after = $this->snapshot($project->fresh());
            $audit->log($request->user(), $project, 'project.updated', $before, $after);
        });

        if ($request->expectsJson()) {
            return response()->json(['updated' => true]);
        }

        return back(status: 303)->with('success', 'Configurația proiectului a fost actualizată.');
    }

    /** @return array<string, mixed> */
    private function snapshot(Project $project): array
    {
        return [
            'contract_type' => $project->contract_type?->value,
            'board_visible' => $project->board_visible,
            'active' => $project->active,
            'board_config' => $project->board_config,
            'manager_ids' => $project->managers()->orderBy('people.id')->pluck('people.id')->all(),
        ];
    }
}
