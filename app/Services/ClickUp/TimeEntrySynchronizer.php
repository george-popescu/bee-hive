<?php

namespace App\Services\ClickUp;

use App\Contracts\ClickUpClient;
use App\Models\ClickUpList;
use App\Models\ClickUpTask;
use App\Models\Person;
use App\Models\TimeEntry;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Str;

final class TimeEntrySynchronizer
{
    public function __construct(private readonly ClickUpClient $client) {}

    public function sync(CarbonInterface $from, CarbonInterface $to): int
    {
        $people = Person::query()->whereNotNull('clickup_user_id')->get()->keyBy('clickup_user_id');
        $tasks = ClickUpTask::query()->with('clickUpList.folder')->get()->keyBy('clickup_task_id');
        $lists = ClickUpList::query()->with('folder')->get()->keyBy('clickup_list_id');
        $entries = [];
        $cursor = CarbonImmutable::instance($from)->utc();
        $rangeEnd = CarbonImmutable::instance($to)->utc();

        while ($cursor->lessThanOrEqualTo($rangeEnd)) {
            $windowEnd = $cursor->endOfMonth()->min($rangeEnd);
            $entries = [
                ...$entries,
                ...$this->client->timeEntries($cursor, $windowEnd, []),
            ];
            $cursor = $windowEnd->addMillisecond();
        }

        $synchronized = 0;
        $rows = [];
        $synchronizedAt = now();

        foreach ($entries as $payload) {
            $id = ClickUpValue::stringId($payload['id'] ?? null);
            $durationMilliseconds = is_numeric($payload['duration'] ?? null) ? (int) $payload['duration'] : 0;
            $startedAt = ClickUpValue::dateTime($payload['start'] ?? null);

            if ($id === null || $durationMilliseconds <= 0 || $startedAt === null) {
                continue;
            }

            $taskId = ClickUpValue::stringId(is_array($payload['task'] ?? null)
                ? ($payload['task']['id'] ?? null)
                : ($payload['task'] ?? null));
            $clickUpUserId = ClickUpValue::stringId(data_get($payload, 'user.id'));
            $task = $taskId === null ? null : $tasks->get($taskId);
            $listId = ClickUpValue::stringId(data_get($payload, 'task_location.list_id'))
                ?? $task?->clickup_list_id;
            $list = $listId === null ? null : $lists->get($listId);
            $person = $clickUpUserId === null ? null : $people->get($clickUpUserId);

            if ($person === null && $clickUpUserId !== null) {
                $personName = is_string(data_get($payload, 'user.username'))
                    ? trim(data_get($payload, 'user.username'))
                    : '';
                $person = Person::query()->firstOrCreate(
                    ['clickup_user_id' => $clickUpUserId],
                    [
                        'name' => $personName === '' ? "Extern ClickUp {$clickUpUserId}" : $personName,
                        'default_monthly_capacity_hours' => 0,
                        'is_external' => true,
                        'active' => true,
                    ],
                );
                $people->put($clickUpUserId, $person);
            }

            if ($person?->is_external && ! $person->active) {
                $person->update(['active' => true]);
            }
            $projectId = $task === null
                ? ($list === null ? null : ($list->project_id ?? $list->folder?->project_id))
                : ($task->project_id ?? ($list === null ? null : ($list->project_id ?? $list->folder?->project_id)));

            $rows[] = [
                'clickup_time_entry_id' => $id,
                'click_up_task_id' => $task?->getKey(),
                'person_id' => $person?->getKey(),
                'project_id' => $projectId,
                'clickup_user_id' => $clickUpUserId,
                'person_name' => is_string(data_get($payload, 'user.username'))
                    ? data_get($payload, 'user.username')
                    : $person?->name,
                'source_label' => $this->sourceLabel($payload, $task, $list),
                'started_at' => $startedAt,
                'duration_seconds' => intdiv($durationMilliseconds, 1_000),
                'is_billable' => (bool) ($payload['billable'] ?? false),
                'last_synced_at' => $synchronizedAt,
                'created_at' => $synchronizedAt,
                'updated_at' => $synchronizedAt,
            ];
            $synchronized++;
        }

        foreach (array_chunk($rows, 500) as $chunk) {
            TimeEntry::query()->upsert(
                $chunk,
                ['clickup_time_entry_id'],
                [
                    'click_up_task_id',
                    'person_id',
                    'project_id',
                    'clickup_user_id',
                    'person_name',
                    'source_label',
                    'started_at',
                    'duration_seconds',
                    'is_billable',
                    'last_synced_at',
                    'updated_at',
                ],
            );
        }

        $seenIds = array_column($rows, 'clickup_time_entry_id');
        $missingEntries = TimeEntry::query()->whereBetween('started_at', [$from, $to]);

        if ($seenIds !== []) {
            $missingEntries->whereNotIn('clickup_time_entry_id', $seenIds);
        }

        $missingEntries->delete();

        return $synchronized;
    }

    /** @param array<string, mixed> $payload */
    private function sourceLabel(array $payload, ?ClickUpTask $task, ?ClickUpList $list): ?string
    {
        $parts = array_filter([
            data_get($payload, 'task_location.folder_name') ?? $list?->folder?->name,
            data_get($payload, 'task_location.list_name') ?? $list?->name,
            is_string(data_get($payload, 'task.name')) ? data_get($payload, 'task.name') : $task?->name,
        ], fn (mixed $value): bool => is_string($value) && trim($value) !== '');

        return $parts === [] ? null : Str::limit(implode(' / ', $parts), 255, '');
    }
}
