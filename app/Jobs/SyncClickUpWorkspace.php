<?php

namespace App\Jobs;

use App\Data\ClickUpSyncOptions;
use App\Services\ClickUp\ClickUpSyncService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;

class SyncClickUpWorkspace implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $uniqueFor = 1_800;

    public int $tries = 3;

    public int $timeout = 300;

    /** @var list<int> */
    public array $backoff = [60, 300];

    public function __construct(public readonly ?ClickUpSyncOptions $options = null) {}

    /** @return list<WithoutOverlapping> */
    public function middleware(): array
    {
        return [(new WithoutOverlapping('clickup-workspace-sync-job'))->releaseAfter(60)->expireAfter(1_800)];
    }

    public function uniqueId(): string
    {
        return 'clickup-workspace-sync';
    }

    public function handle(ClickUpSyncService $service): void
    {
        $service->sync($this->options ?? ClickUpSyncOptions::defaults());
    }
}
