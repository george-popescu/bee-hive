<?php

namespace App\Services\ClickUp;

use App\Contracts\ClickUpClient;
use App\Models\ClickUpList;
use App\Models\ClickUpTask;
use App\Models\Person;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

final class TaskSynchronizer
{
    public function __construct(private readonly ClickUpClient $client) {}

    public function sync(?CarbonInterface $updatedAfter = null): int
    {
        $lists = ClickUpList::query()->with('folder')->get()->keyBy('clickup_list_id');
        $people = Person::query()->whereNotNull('clickup_user_id')->get()->keyBy('clickup_user_id');
        $seenIds = [];
        $rows = [];
        $assigneesByTask = [];
        $synchronizedAt = now();

        foreach ($this->client->tasks($updatedAfter) as $payload) {
            $id = ClickUpValue::stringId($payload['id'] ?? null);
            $listId = ClickUpValue::stringId(data_get($payload, 'list.id'));
            $name = is_string($payload['name'] ?? null) ? trim($payload['name']) : '';

            if ($id === null || $listId === null || $name === '') {
                continue;
            }

            $list = $lists->get($listId);
            $estimateMilliseconds = is_numeric($payload['time_estimate'] ?? null)
                ? max(0, (int) $payload['time_estimate'])
                : null;
            $projectId = $list === null
                ? null
                : ($list->project_id ?? $list->folder?->project_id);
            $rows[] = [
                'clickup_task_id' => $id,
                'project_id' => $projectId,
                'clickup_list_id' => $listId,
                'name' => $name,
                'status' => ClickUpValue::status($payload['status'] ?? null),
                'estimate_seconds' => $estimateMilliseconds === null ? null : intdiv($estimateMilliseconds, 1_000),
                'start_at' => ClickUpValue::dateTime($payload['start_date'] ?? null),
                'due_at' => ClickUpValue::dateTime($payload['due_date'] ?? null),
                'active' => true,
                'last_synced_at' => $synchronizedAt,
                'created_at' => $synchronizedAt,
                'updated_at' => $synchronizedAt,
            ];
            $assigneesByTask[$id] = collect(is_array($payload['assignees'] ?? null) ? $payload['assignees'] : [])
                ->map(fn (mixed $assignee): ?string => is_array($assignee)
                    ? ClickUpValue::stringId($assignee['id'] ?? null)
                    : null)
                ->filter()
                ->map(fn (string $clickUpUserId): ?int => $people->get($clickUpUserId)?->getKey())
                ->filter()
                ->values()
                ->all();
            $seenIds[] = $id;
        }

        DB::transaction(function () use ($rows, $seenIds, $assigneesByTask, $synchronizedAt): void {
            foreach (array_chunk($rows, 500) as $chunk) {
                ClickUpTask::query()->upsert(
                    $chunk,
                    ['clickup_task_id'],
                    [
                        'project_id',
                        'clickup_list_id',
                        'name',
                        'status',
                        'estimate_seconds',
                        'start_at',
                        'due_at',
                        'active',
                        'last_synced_at',
                        'updated_at',
                    ],
                );
            }

            $tasks = ClickUpTask::query()->whereIn('clickup_task_id', $seenIds)->get()->keyBy('clickup_task_id');
            $localTaskIds = $tasks->modelKeys();

            if ($localTaskIds === []) {
                return;
            }

            DB::table('click_up_task_person')->whereIn('click_up_task_id', $localTaskIds)->delete();
            $pivotRows = [];

            foreach ($assigneesByTask as $clickUpTaskId => $personIds) {
                $task = $tasks->get($clickUpTaskId);

                if ($task === null) {
                    continue;
                }

                foreach ($personIds as $personId) {
                    $pivotRows[] = [
                        'click_up_task_id' => $task->getKey(),
                        'person_id' => $personId,
                        'created_at' => $synchronizedAt,
                        'updated_at' => $synchronizedAt,
                    ];
                }
            }

            foreach (array_chunk($pivotRows, 1_000) as $chunk) {
                DB::table('click_up_task_person')->insertOrIgnore($chunk);
            }
        });

        if ($updatedAfter !== null) {
            return count($seenIds);
        }

        $listIds = $lists->keys()->all();
        $missing = ClickUpTask::query()->whereIn('clickup_list_id', $listIds);

        if ($seenIds !== []) {
            $missing->whereNotIn('clickup_task_id', $seenIds);
        }

        $missing->update(['active' => false]);

        return count($seenIds);
    }
}
