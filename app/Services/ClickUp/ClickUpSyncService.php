<?php

namespace App\Services\ClickUp;

use App\Data\ClickUpSyncOptions;
use App\Enums\SyncRunStatus;
use App\Models\SyncRun;
use Illuminate\Contracts\Cache\Lock;
use Illuminate\Support\Facades\Cache;
use RuntimeException;
use Throwable;

final class ClickUpSyncService
{
    public function __construct(
        private readonly PeopleSynchronizer $people,
        private readonly HierarchySynchronizer $hierarchy,
        private readonly TaskSynchronizer $tasks,
        private readonly TimeEntrySynchronizer $timeEntries,
        private readonly TimeOffSynchronizer $timeOff,
    ) {}

    public function sync(ClickUpSyncOptions $options): SyncRun
    {
        $lock = Cache::lock('clickup-workspace-sync', 1_800);

        if (! $lock->get()) {
            throw new RuntimeException('A ClickUp synchronization is already running.');
        }

        try {
            $this->failStaleRuns();

            return $this->run($options);
        } finally {
            $this->release($lock);
        }
    }

    private function run(ClickUpSyncOptions $options): SyncRun
    {
        $run = SyncRun::query()->create([
            'source' => 'clickup',
            'scope' => $options->scope(),
            'status' => SyncRunStatus::Running,
            'range_start' => $options->from,
            'range_end' => $options->to,
            'counters' => [],
            'options' => $options->toArray(),
            'triggered_by' => $options->triggeredBy,
            'started_at' => now(),
        ]);
        $counters = [];

        try {
            if ($options->members) {
                $counters['people'] = $this->people->sync();
                $this->saveCounters($run, $counters);
            }

            if ($options->hierarchy) {
                $counters = [...$counters, ...$this->hierarchy->sync()];
                $this->saveCounters($run, $counters);
            }

            if ($options->tasks) {
                $counters['tasks'] = $this->tasks->sync();
                $this->saveCounters($run, $counters);
            }

            if ($options->timeOff) {
                $counters['time_off'] = $this->timeOff->sync();
                $this->saveCounters($run, $counters);
            }

            if ($options->timeEntries) {
                $counters['time_entries'] = $this->timeEntries->sync($options->from, $options->to);
                $this->saveCounters($run, $counters);
            }

            $run->update([
                'status' => SyncRunStatus::Succeeded,
                'counters' => $counters,
                'finished_at' => now(),
            ]);
        } catch (Throwable $exception) {
            $run->update([
                'status' => SyncRunStatus::Failed,
                'counters' => $counters,
                'error_message' => $exception->getMessage(),
                'finished_at' => now(),
            ]);

            throw $exception;
        }

        return $run->refresh();
    }

    /** @param array<string, int> $counters */
    private function saveCounters(SyncRun $run, array $counters): void
    {
        $run->update(['counters' => $counters]);
    }

    private function release(Lock $lock): void
    {
        $lock->release();
    }

    private function failStaleRuns(): void
    {
        SyncRun::query()
            ->where('source', 'clickup')
            ->where('status', SyncRunStatus::Running)
            ->where('started_at', '<', now()->subMinutes(30))
            ->update([
                'status' => SyncRunStatus::Failed,
                'error_message' => 'Synchronization process ended without reporting a final status.',
                'finished_at' => now(),
            ]);
    }
}
