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
            : $this->resolveProject($id, $name, $folder, $projects)?->getKey();

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
        $projectId = $folder === null
            ? $list->project_id
            : ($folder->kind === ClickUpLocationKind::Internal ? null : $folder->project_id);
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
    private function resolveProject(
        string $folderId,
        string $folderName,
        ClickUpFolder $folder,
        Collection $projects,
    ): ?Project {
        $explicitProject = $projects->first(
            fn (Project $project): bool => ClickUpValue::stringId($project->clickup_folder_id) === $folderId,
        );

        if ($explicitProject instanceof Project) {
            return $explicitProject;
        }

        $existingProject = $folder->project_id === null
            ? null
            : $projects->firstWhere('id', $folder->project_id);

        if ($existingProject instanceof Project) {
            return $existingProject;
        }

        $folderAlias = ClickUpValue::normalizedName($folderName);
        $aliasMatches = $projects->filter(
            fn (Project $project): bool => $this->mayClaimFolder($project, $folderId)
                && ClickUpValue::normalizedName($project->folder_name) === $folderAlias,
        );

        if ($aliasMatches->count() === 1) {
            return $this->claimFolder($aliasMatches->first(), $folderId, $folderName);
        }

        $labels = $this->structuredLabels($folderName);

        if ($labels === null) {
            return null;
        }

        [$client, $name] = $labels;
        $clientName = ClickUpValue::normalizedName($client);
        $projectName = ClickUpValue::normalizedName($name);
        $exactMatches = $projects->filter(
            fn (Project $project): bool => $this->mayClaimFolder($project, $folderId)
                && ClickUpValue::normalizedName($project->client) === $clientName
                && ClickUpValue::normalizedName($project->name) === $projectName,
        );

        if ($exactMatches->count() === 1) {
            return $this->claimFolder($exactMatches->first(), $folderId, $folderName);
        }

        if ($exactMatches->isNotEmpty()) {
            return null;
        }

        $project = Project::query()->create([
            'clickup_space_id' => $this->projectsSpaceId,
            'clickup_folder_id' => $folderId,
            'client' => $client,
            'name' => $name,
            'folder_name' => $folderName,
            'board_visible' => true,
            'active' => true,
        ]);
        $projects->push($project);

        return $project;
    }

    private function mayClaimFolder(Project $project, string $folderId): bool
    {
        $claimedFolderId = ClickUpValue::stringId($project->clickup_folder_id);

        return $claimedFolderId === null || $claimedFolderId === $folderId;
    }

    private function claimFolder(Project $project, string $folderId, string $folderName): Project
    {
        $project->update([
            'clickup_space_id' => $this->projectsSpaceId,
            'clickup_folder_id' => $folderId,
            'folder_name' => $folderName,
        ]);

        return $project;
    }

    /** @return array{0: string, 1: string}|null */
    private function structuredLabels(string $folderName): ?array
    {
        preg_match_all('/\[([^]]+)]/', $folderName, $matches);
        $client = is_string($matches[1][0] ?? null) ? trim($matches[1][0]) : '';
        $project = is_string($matches[1][1] ?? null) ? trim($matches[1][1]) : '';

        return $client === '' || $project === '' ? null : [$client, $project];
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
