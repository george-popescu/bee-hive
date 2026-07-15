<?php

use App\Contracts\ClickUpClient;
use App\Jobs\SyncClickUpWorkspace;
use App\Models\SyncRun;
use Carbon\CarbonImmutable;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\Queue;

use function Pest\Laravel\mock;

it('queues synchronization with the selected date range and skip options', function () {
    Queue::fake();
    mock(ClickUpClient::class);

    $this->artisan('clickup:sync', [
        '--queue' => true,
        '--from' => '2026-07-01',
        '--to' => '2026-07-15',
        '--skip-members' => true,
        '--skip-hierarchy' => true,
        '--skip-tasks' => true,
        '--skip-time-entries' => true,
        '--skip-time-off' => true,
    ])
        ->expectsOutputToContain('ClickUp synchronization queued.')
        ->assertSuccessful();

    Queue::assertPushed(SyncClickUpWorkspace::class, function (SyncClickUpWorkspace $job): bool {
        $options = $job->options;

        return $options !== null
            && $options->from->equalTo(CarbonImmutable::parse('2026-07-01')->startOfDay())
            && $options->to->equalTo(CarbonImmutable::parse('2026-07-15')->endOfDay())
            && ! $options->members
            && ! $options->hierarchy
            && ! $options->tasks
            && ! $options->timeEntries
            && ! $options->timeOff;
    });
});

it('honors skip options without calling the clickup client', function () {
    mock(ClickUpClient::class);

    $this->artisan('clickup:sync', [
        '--from' => '2026-07-01',
        '--to' => '2026-07-15',
        '--skip-members' => true,
        '--skip-hierarchy' => true,
        '--skip-tasks' => true,
        '--skip-time-entries' => true,
        '--skip-time-off' => true,
    ])
        ->expectsOutputToContain('completed.')
        ->assertSuccessful();

    $run = SyncRun::query()->sole();

    expect($run->scope)->toBe('')
        ->and($run->counters)->toBe([])
        ->and($run->options)->toMatchArray([
            'members' => false,
            'hierarchy' => false,
            'tasks' => false,
            'time_entries' => false,
            'time_off' => false,
        ]);
});

it('defines unique queue behavior and overlap protection', function () {
    $job = new SyncClickUpWorkspace;
    $middleware = $job->middleware();

    expect($job)->toBeInstanceOf(ShouldQueue::class)
        ->toBeInstanceOf(ShouldBeUnique::class)
        ->and($job->uniqueId())->toBe('clickup-workspace-sync')
        ->and($job->uniqueFor)->toBe(1_800)
        ->and($job->tries)->toBe(3)
        ->and($job->timeout)->toBe(300)
        ->and($job->backoff)->toBe([60, 300])
        ->and(config('queue.connections.database.retry_after'))->toBe(360)
        ->and($middleware)->toHaveCount(1)
        ->and($middleware[0])->toBeInstanceOf(WithoutOverlapping::class)
        ->and($middleware[0]->key)->toBe('clickup-workspace-sync-job')
        ->and($middleware[0]->releaseAfter)->toBe(60)
        ->and($middleware[0]->expiresAfter)->toBe(1_800);
});

it('schedules the automatic ClickUp synchronization every day at 10:25 Bucharest time', function () {
    $event = collect(app(Schedule::class)->events())
        ->first(fn ($event): bool => $event->description === SyncClickUpWorkspace::class);

    expect($event)->not->toBeNull()
        ->and($event->expression)->toBe('25 10 * * *')
        ->and($event->timezone)->toBe('Europe/Bucharest');
});
