<?php

namespace App\Services\ClickUp;

use App\Contracts\ClickUpClient;
use Carbon\CarbonInterface;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

final class HttpClickUpClient implements ClickUpClient
{
    public function __construct(
        private readonly string $token,
        private readonly string $workspaceId,
        private readonly string $projectsSpaceId,
        private readonly string $holidaysListId,
        private readonly string $baseUrl = 'https://api.clickup.com/api/v2',
    ) {
        foreach ([$this->token, $this->workspaceId, $this->projectsSpaceId, $this->holidaysListId] as $value) {
            if (trim($value) === '') {
                throw new RuntimeException('ClickUp integration configuration is incomplete.');
            }
        }
    }

    public function members(): array
    {
        $teams = $this->records($this->get('/team'), 'teams', 'workspace list');

        foreach ($teams as $team) {
            if (ClickUpValue::stringId($team['id'] ?? null) !== $this->workspaceId) {
                continue;
            }

            return array_map(function (array $member): array {
                $user = $member['user'] ?? null;

                if (! is_array($user)) {
                    throw new RuntimeException('ClickUp returned an invalid workspace member.');
                }

                return $user;
            }, $this->records($team, 'members', 'workspace member snapshot'));
        }

        throw new RuntimeException("Configured ClickUp workspace {$this->workspaceId} is not accessible.");
    }

    public function folders(): array
    {
        return $this->records(
            $this->get("/space/{$this->projectsSpaceId}/folder"),
            'folders',
            'folder snapshot',
        );
    }

    public function folderlessLists(): array
    {
        return $this->records(
            $this->get("/space/{$this->projectsSpaceId}/list"),
            'lists',
            'folderless list snapshot',
        );
    }

    /** @return iterable<array<string, mixed>> */
    public function tasks(?CarbonInterface $updatedAfter = null): iterable
    {
        $query = [
            'space_ids[]' => $this->projectsSpaceId,
            'include_closed' => 'true',
            'subtasks' => 'true',
        ];

        if ($updatedAfter !== null) {
            $query['date_updated_gt'] = (string) $updatedAfter->getTimestampMs();
        }

        return $this->paginatedTasks("/team/{$this->workspaceId}/task", $query);
    }

    public function timeEntries(CarbonInterface $from, CarbonInterface $to, array $assigneeIds): array
    {
        $query = [
            'start_date' => (string) $from->getTimestampMs(),
            'end_date' => (string) $to->getTimestampMs(),
        ];

        if ($assigneeIds !== []) {
            $query['assignee'] = implode(',', $assigneeIds);
        }

        $query['include_location_names'] = 'true';

        $response = $this->get("/team/{$this->workspaceId}/time_entries", $query);

        return $this->records($response, 'data', 'time-entry snapshot');
    }

    /** @return iterable<array<string, mixed>> */
    public function timeOffTasks(): iterable
    {
        return $this->paginatedTasks("/list/{$this->holidaysListId}/task", [
            'include_closed' => 'true',
            'subtasks' => 'true',
        ]);
    }

    /**
     * @param  array<string, string|int>  $query
     * @return iterable<array<string, mixed>>
     */
    private function paginatedTasks(string $path, array $query): iterable
    {
        for ($page = 0; $page < 100; $page++) {
            $response = $this->get($path, [...$query, 'page' => $page]);
            $pageTasks = $this->records($response, 'tasks', "task page {$page}");

            foreach ($pageTasks as $task) {
                yield $task;
            }

            if (($response['last_page'] ?? false) === true || count($pageTasks) < 100) {
                return;
            }
        }

        throw new RuntimeException('ClickUp task pagination exceeded the safe limit of 100 pages.');
    }

    /**
     * @param  array<string, string|int>  $query
     * @return array<string, mixed>
     */
    private function get(string $path, array $query = []): array
    {
        $response = null;

        for ($attempt = 1; $attempt <= 3; $attempt++) {
            $response = $this->request()->get($path, $query);

            if ($response->successful()) {
                $json = $response->json();

                if (! is_array($json)) {
                    throw new RuntimeException('ClickUp returned a non-object JSON response.');
                }

                return $json;
            }

            if ($attempt === 3 || ($response->status() !== 429 && $response->status() < 500)) {
                $response->throw();
            }

            usleep($this->retryDelayMicroseconds($response, $attempt));
        }

        $response->throw();

        throw new RuntimeException('ClickUp request failed without a response.');
    }

    private function request(): PendingRequest
    {
        return Http::baseUrl(rtrim($this->baseUrl, '/'))
            ->withHeaders(['Authorization' => $this->token])
            ->acceptJson()
            ->timeout(30);
    }

    private function retryDelayMicroseconds(Response $response, int $attempt): int
    {
        $resetAt = $response->header('X-RateLimit-Reset');

        if ($response->status() === 429 && is_numeric($resetAt)) {
            $seconds = max(1, (int) $resetAt - time());

            return min($seconds, 5) * 1_000_000;
        }

        return min($attempt, 5) * 250_000;
    }

    /**
     * @param  array<string, mixed>  $response
     * @return list<array<string, mixed>>
     */
    private function records(array $response, string $key, string $context): array
    {
        $records = $response[$key] ?? null;

        if (! is_array($records)) {
            throw new RuntimeException("ClickUp returned an invalid {$context}.");
        }

        foreach ($records as $record) {
            if (! is_array($record)) {
                throw new RuntimeException("ClickUp returned an invalid record in the {$context}.");
            }
        }

        return array_values($records);
    }
}
