<?php

namespace App\Services\ClickUp;

use App\Contracts\ClickUpClient;
use App\Models\Person;
use App\Models\TimeOff;

final class TimeOffSynchronizer
{
    public function __construct(private readonly ClickUpClient $client) {}

    public function sync(): int
    {
        $people = Person::query()->whereNotNull('clickup_user_id')->get()->keyBy('clickup_user_id');
        $synchronized = 0;
        $rows = [];
        $seenPairs = [];
        $synchronizedAt = now();

        foreach ($this->client->timeOffTasks() as $payload) {
            $taskId = ClickUpValue::stringId($payload['id'] ?? null);
            $startDate = ClickUpValue::date($payload['start_date'] ?? $payload['due_date'] ?? null);
            $endDate = ClickUpValue::date($payload['due_date'] ?? $payload['start_date'] ?? null);

            if ($taskId === null || $startDate === null || $endDate === null) {
                continue;
            }

            $status = mb_strtolower(ClickUpValue::status($payload['status'] ?? null) ?? 'unknown');
            $daysReported = $this->customFieldValue($payload, 'vacation period');
            $type = $this->customFieldValue($payload, 'time off type');

            foreach (is_array($payload['assignees'] ?? null) ? $payload['assignees'] : [] as $assignee) {
                $clickUpUserId = is_array($assignee)
                    ? ClickUpValue::stringId($assignee['id'] ?? null)
                    : null;
                $person = $clickUpUserId === null ? null : $people->get($clickUpUserId);

                if ($person === null) {
                    continue;
                }

                $rows[] = [
                    'clickup_task_id' => $taskId,
                    'person_id' => $person->getKey(),
                    'status' => $status,
                    'type' => is_string($type) && trim($type) !== '' ? $type : 'PTO',
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'days_reported' => is_numeric($daysReported) ? (float) $daysReported : null,
                    'source' => 'clickup',
                    'active' => true,
                    'last_synced_at' => $synchronizedAt,
                    'created_at' => $synchronizedAt,
                    'updated_at' => $synchronizedAt,
                ];
                $seenPairs[$taskId.'|'.$person->getKey()] = true;
                $synchronized++;
            }
        }

        foreach (array_chunk($rows, 500) as $chunk) {
            TimeOff::query()->upsert(
                $chunk,
                ['clickup_task_id', 'person_id'],
                [
                    'status',
                    'type',
                    'start_date',
                    'end_date',
                    'days_reported',
                    'source',
                    'active',
                    'last_synced_at',
                    'updated_at',
                ],
            );
        }

        $missingIds = TimeOff::query()
            ->where('source', 'clickup')
            ->get(['id', 'clickup_task_id', 'person_id'])
            ->reject(fn (TimeOff $timeOff): bool => isset($seenPairs[$timeOff->clickup_task_id.'|'.$timeOff->person_id]))
            ->modelKeys();

        if ($missingIds !== []) {
            TimeOff::query()->whereKey($missingIds)->update(['active' => false]);
        }

        return $synchronized;
    }

    /** @param array<string, mixed> $task */
    private function customFieldValue(array $task, string $fieldName): mixed
    {
        foreach (is_array($task['custom_fields'] ?? null) ? $task['custom_fields'] : [] as $field) {
            if (! is_array($field) || ClickUpValue::normalizedName($field['name'] ?? null) !== $fieldName) {
                continue;
            }

            return $field['value'] ?? null;
        }

        return null;
    }
}
