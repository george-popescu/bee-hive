<?php

namespace App\Services\PmBoard;

use App\Enums\PermissionName;
use App\Models\Project;
use App\Models\User;

class PmBoardScope
{
    /** @return list<int> */
    public function projectIds(User $user): array
    {
        if ($user->can(PermissionName::ViewManagement->value)) {
            return array_values(Project::query()
                ->where('active', true)
                ->where('board_visible', true)
                ->orderBy('id')
                ->pluck('id')
                ->map(fn (mixed $id): int => (int) $id)
                ->all());
        }

        $person = $user->person()->first();

        if ($person === null) {
            return [];
        }

        return array_values($person->managedProjects()
            ->where('projects.active', true)
            ->where('projects.board_visible', true)
            ->orderBy('projects.id')
            ->pluck('projects.id')
            ->map(fn (mixed $id): int => (int) $id)
            ->all());
    }
}
