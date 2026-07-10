<?php

namespace App\Services\ClickUp;

use App\Contracts\ClickUpClient;
use App\Enums\ClickUpLocationKind;
use App\Models\ClickUpFolder;
use App\Models\ClickUpList;
use App\Models\Project;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

final class HierarchySynchronizer
{
    /** @param list<string> $internalFolderIds */
    public function __construct(
        private readonly ClickUpClient $client,
        private readonly string $projectsSpaceId,
        private readonly array $internalFolderIds,
    ) {}

    /** @return array{folders: int, lists: int} */
    public function sync(): array
    {
        $projects = Project::query()->get();
        $seenFolderIds = [];
        $seenListIds = [];

        foreach ($this->client->folders() as $payload) {
            $folder = $this->syncFolder($payload, $projects);

            if ($folder === null) {
                continue;
            }

            $seenFolderIds[] = $folder->clickup_folder_id;
            $lists = $payload['lists'] ?? null;

            if (! is_array($lists)) {
                throw new \RuntimeException("ClickUp folder {$folder->clickup_folder_id} has an invalid list snapshot.");
            }

            foreach ($lists as $listPayload) {
                if (! is_array($listPayload)) {
                    throw new \RuntimeException("ClickUp folder {$folder->clickup_folder_id} contains an invalid list.");
                }

                $list = $this->syncList($listPayload, $folder);

                if ($list !== null) {
                    $seenListIds[] = $list->clickup_list_id;
                }
            }
        }

        foreach ($this->client->folderlessLists() as $payload) {
            $list = $this->syncList($payload);

            if ($list !== null) {
                $seenListIds[] = $list->clickup_list_id;
            }
        }

        $this->markMissingInactive(ClickUpFolder::query(), 'clickup_folder_id', $seenFolderIds);
        $this->markMissingInactive(ClickUpList::query(), 'clickup_list_id', $seenListIds);

        return [
            'folders' => count($seenFolderIds),
            'lists' => count($seenListIds),
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  Collection<int, Project>  $projects
     */
    private function syncFolder(array $payload, Collection $projects): ?ClickUpFolder
    {
        $id = ClickUpValue::stringId($payload['id'] ?? null);
        $name = is_string($payload['name'] ?? null) ? trim($payload['name']) : '';

        if ($id === null || $name === '') {
            return null;
        }

        $folder = ClickUpFolder::query()->firstOrNew(['clickup_folder_id' => $id]);
        $isInternal = in_array($id, $this->internalFolderIds, true);
        $projectId = $isInternal
            ? null
            : ($folder->project_id ?? $this->matchingProject($name, $projects)?->getKey());

        $folder->fill([
            'clickup_space_id' => $this->projectsSpaceId,
            'project_id' => $projectId,
            'name' => $name,
            'kind' => $isInternal
                ? ClickUpLocationKind::Internal
                : ($projectId === null ? ClickUpLocationKind::Unmapped : ClickUpLocationKind::Project),
            'active' => true,
            'last_synced_at' => now(),
        ])->save();

        return $folder;
    }

    /** @param array<string, mixed> $payload */
    private function syncList(array $payload, ?ClickUpFolder $folder = null): ?ClickUpList
    {
        $id = ClickUpValue::stringId($payload['id'] ?? null);
        $name = is_string($payload['name'] ?? null) ? trim($payload['name']) : '';

        if ($id === null || $name === '') {
            return null;
        }

        $list = ClickUpList::query()->firstOrNew(['clickup_list_id' => $id]);
        $projectId = $folder?->kind === ClickUpLocationKind::Internal ? null : $list->project_id;
        $list->fill([
            'click_up_folder_id' => $folder?->getKey(),
            'project_id' => $projectId,
            'clickup_space_id' => $this->projectsSpaceId,
            'name' => $name,
            'active' => true,
            'last_synced_at' => now(),
        ])->save();

        return $list;
    }

    /** @param Collection<int, Project> $projects */
    private function matchingProject(string $folderName, Collection $projects): ?Project
    {
        preg_match_all('/\[([^]]+)]/', $folderName, $matches);
        $labels = $matches[1];

        if (count($labels) >= 2) {
            $client = ClickUpValue::normalizedName($labels[0]);
            $project = ClickUpValue::normalizedName($labels[1]);
            $exact = $projects->filter(fn (Project $candidate): bool => ClickUpValue::normalizedName($candidate->client) === $client
                && ClickUpValue::normalizedName($candidate->name) === $project
            );

            if ($exact->count() === 1) {
                return $exact->first();
            }

            return null;
        }

        $projectName = ClickUpValue::normalizedName($labels[0] ?? $folderName);
        $byUniqueName = $projects->filter(
            fn (Project $candidate): bool => ClickUpValue::normalizedName($candidate->name) === $projectName,
        );

        return $byUniqueName->count() === 1 ? $byUniqueName->first() : null;
    }

    /**
     * @param  Builder<ClickUpFolder>|Builder<ClickUpList>  $query
     * @param  list<string>  $seenIds
     */
    private function markMissingInactive($query, string $column, array $seenIds): void
    {
        $query->where('clickup_space_id', $this->projectsSpaceId);

        if ($seenIds !== []) {
            $query->whereNotIn($column, $seenIds);
        }

        $query->update(['active' => false]);
    }
}
