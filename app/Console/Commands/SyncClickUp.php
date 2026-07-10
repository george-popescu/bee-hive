<?php

namespace App\Console\Commands;

use App\Data\ClickUpSyncOptions;
use App\Jobs\SyncClickUpWorkspace;
use App\Services\ClickUp\ClickUpSyncService;
use Carbon\CarbonImmutable;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Throwable;

#[Signature('clickup:sync
    {--from= : Start of the time-entry interval (date or timestamp)}
    {--to= : End of the time-entry interval (date or timestamp)}
    {--queue : Dispatch the synchronization to the queue}
    {--skip-members : Do not synchronize workspace members}
    {--skip-hierarchy : Do not synchronize folders and lists}
    {--skip-tasks : Do not synchronize tasks}
    {--skip-time-entries : Do not synchronize time entries}
    {--skip-time-off : Do not synchronize time-off tasks}')]
#[Description('Synchronize the configured ClickUp workspace into the local read model')]
class SyncClickUp extends Command
{
    public function handle(ClickUpSyncService $service): int
    {
        try {
            $options = $this->syncOptions();

            if ((bool) $this->option('queue')) {
                SyncClickUpWorkspace::dispatch($options);
                $this->components->info('ClickUp synchronization queued.');

                return self::SUCCESS;
            }

            $run = $service->sync($options);
            $this->components->info("ClickUp synchronization #{$run->getKey()} completed.");

            $counters = $run->counters;

            if (is_array($counters)) {
                $rows = [];

                foreach ($counters as $resource => $count) {
                    $rows[] = [(string) $resource, (int) $count];
                }

                $this->table(
                    ['Resource', 'Synchronized'],
                    $rows,
                );
            }

            return self::SUCCESS;
        } catch (Throwable $exception) {
            $this->components->error($exception->getMessage());

            return self::FAILURE;
        }
    }

    private function syncOptions(): ClickUpSyncOptions
    {
        $defaults = ClickUpSyncOptions::defaults();
        $fromOption = $this->option('from');
        $toOption = $this->option('to');
        $from = is_string($fromOption) && $fromOption !== ''
            ? CarbonImmutable::parse($fromOption)->startOfDay()
            : $defaults->from;
        $to = is_string($toOption) && $toOption !== ''
            ? CarbonImmutable::parse($toOption)->endOfDay()
            : $defaults->to;

        return new ClickUpSyncOptions(
            from: $from,
            to: $to,
            members: ! (bool) $this->option('skip-members'),
            hierarchy: ! (bool) $this->option('skip-hierarchy'),
            tasks: ! (bool) $this->option('skip-tasks'),
            timeEntries: ! (bool) $this->option('skip-time-entries'),
            timeOff: ! (bool) $this->option('skip-time-off'),
        );
    }
}
