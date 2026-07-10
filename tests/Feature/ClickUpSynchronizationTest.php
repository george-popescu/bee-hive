<?php

use App\Contracts\ClickUpClient;
use App\Data\ClickUpSyncOptions;
use App\Enums\ClickUpLocationKind;
use App\Enums\SyncRunStatus;
use App\Models\Allocation;
use App\Models\ClickUpFolder;
use App\Models\ClickUpList;
use App\Models\ClickUpTask;
use App\Models\Person;
use App\Models\Project;
use App\Models\SyncRun;
use App\Models\TimeEntry;
use App\Models\TimeOff;
use App\Services\ClickUp\ClickUpSyncService;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

function clickUpClientFake(
    bool $failOnTimeEntries = false,
    bool $includeRecords = true,
    string $projectFolderName = '[Acme][Portal]',
    bool $validFolderLists = true,
    bool $externalTimeEntry = false,
): ClickUpClient {
    return new class($failOnTimeEntries, $includeRecords, $projectFolderName, $validFolderLists, $externalTimeEntry) implements ClickUpClient
    {
        public function __construct(
            private readonly bool $failOnTimeEntries,
            private readonly bool $includeRecords,
            private readonly string $projectFolderName,
            private readonly bool $validFolderLists,
            private readonly bool $externalTimeEntry,
        ) {}

        public function members(): array
        {
            return [[
                'id' => 101,
                'username' => 'Stefan Ionescu',
                'email' => 'stefan@example.test',
            ]];
        }

        public function folders(): array
        {
            $folders = [
                [
                    'id' => 'folder-project',
                    'name' => $this->projectFolderName,
                    'lists' => [['id' => 'list-project', 'name' => 'Delivery']],
                ],
                [
                    'id' => 'folder-internal',
                    'name' => '[BEE CODED][Non-Project Tasks]',
                    'lists' => [['id' => 'list-internal', 'name' => 'Internal']],
                ],
            ];

            if (! $this->validFolderLists) {
                unset($folders[0]['lists']);
            }

            return $folders;
        }

        public function folderlessLists(): array
        {
            return [];
        }

        public function tasks(?CarbonInterface $updatedAfter = null): array
        {
            return [[
                'id' => 'task-1',
                'name' => 'Build dashboard',
                'list' => ['id' => 'list-project'],
                'status' => ['status' => 'in progress'],
                'time_estimate' => 7_200_000,
                'start_date' => '1784073600000',
                'due_date' => '1784160000000',
                'assignees' => [['id' => 101]],
            ]];
        }

        public function timeEntries(CarbonInterface $from, CarbonInterface $to, array $assigneeIds): array
        {
            if ($this->failOnTimeEntries) {
                throw new RuntimeException('The ClickUp token cannot read team time entries.');
            }

            if (! $this->includeRecords) {
                return [];
            }

            if ($this->externalTimeEntry && $assigneeIds !== []) {
                return [];
            }

            return [[
                'id' => 'entry-1',
                'task' => ['id' => 'task-1', 'name' => 'Build dashboard'],
                'user' => $this->externalTimeEntry
                    ? ['id' => 999, 'username' => 'Contractor Extern']
                    : ['id' => 101, 'username' => 'Stefan Ionescu'],
                'task_location' => [
                    'list_id' => 'list-project',
                    'folder_name' => '[Acme][Portal]',
                    'list_name' => 'Delivery',
                ],
                'start' => '1784073600000',
                'duration' => '3600000',
                'billable' => true,
            ]];
        }

        public function timeOffTasks(): array
        {
            if (! $this->includeRecords) {
                return [];
            }

            return [[
                'id' => 'time-off-1',
                'status' => ['status' => 'approved'],
                'start_date' => '1784073600000',
                'due_date' => '1784160000000',
                'assignees' => [['id' => 101]],
                'custom_fields' => [
                    ['name' => 'Vacation period', 'value' => 2],
                    ['name' => 'Time Off Type', 'value' => 'Vacation'],
                ],
            ]];
        }
    };
}

beforeEach(function () {
    config()->set('services.clickup.projects_space_id', 'space-projects');
    config()->set('services.clickup.internal_folder_ids', ['folder-internal']);
});

it('rejects synchronization intervals too large for a single protected run', function () {
    expect(fn () => new ClickUpSyncOptions(
        from: CarbonImmutable::parse('2025-01-01'),
        to: CarbonImmutable::parse('2026-07-01'),
    ))->toThrow(InvalidArgumentException::class, 'cannot exceed 366 days');
});

it('fails an incomplete folder snapshot before deactivating existing lists', function () {
    $existingList = ClickUpList::factory()->create([
        'clickup_space_id' => 'space-projects',
        'active' => true,
    ]);
    app()->instance(ClickUpClient::class, clickUpClientFake(validFolderLists: false));
    $defaults = ClickUpSyncOptions::defaults();
    $options = new ClickUpSyncOptions(
        from: $defaults->from,
        to: $defaults->to,
        members: false,
        tasks: false,
        timeEntries: false,
        timeOff: false,
    );

    expect(fn () => app(ClickUpSyncService::class)->sync($options))
        ->toThrow(RuntimeException::class, 'invalid list snapshot');

    expect($existingList->refresh()->active)->toBeTrue();
});

it('rejects ambiguous person email matches', function () {
    Person::factory()->create([
        'clickup_user_id' => null,
        'name' => 'First Person',
        'email' => 'stefan@example.test',
    ]);
    Person::factory()->create([
        'clickup_user_id' => null,
        'name' => 'Second Person',
        'email' => 'stefan@example.test',
    ]);
    app()->instance(ClickUpClient::class, clickUpClientFake());
    $defaults = ClickUpSyncOptions::defaults();
    $options = new ClickUpSyncOptions(
        from: $defaults->from,
        to: $defaults->to,
        hierarchy: false,
        tasks: false,
        timeEntries: false,
        timeOff: false,
    );

    expect(fn () => app(ClickUpSyncService::class)->sync($options))
        ->toThrow(RuntimeException::class, 'Ambiguous ClickUp email mapping');
});

it('reconciles removed ClickUp actuals while preserving manual time off', function () {
    $person = Person::factory()->create([
        'clickup_user_id' => '101',
        'name' => 'Ștefan Ionescu',
        'email' => 'stefan@example.test',
    ]);
    $manualTimeOff = TimeOff::factory()->create([
        'person_id' => $person,
        'source' => 'manual',
        'active' => true,
        'start_date' => '2026-07-20',
        'end_date' => '2026-07-20',
    ]);
    $options = new ClickUpSyncOptions(
        from: CarbonImmutable::parse('2026-07-01')->startOfDay(),
        to: CarbonImmutable::parse('2026-07-31')->endOfDay(),
    );
    app()->instance(ClickUpClient::class, clickUpClientFake());
    app(ClickUpSyncService::class)->sync($options);

    app()->instance(ClickUpClient::class, clickUpClientFake(includeRecords: false));
    app(ClickUpSyncService::class)->sync($options);

    expect(TimeEntry::query()->count())->toBe(0)
        ->and(TimeOff::query()->where('source', 'clickup')->sole()->active)->toBeFalse()
        ->and($manualTimeOff->refresh()->active)->toBeTrue();
});

it('does not map a structured ClickUp folder when its client conflicts with the project', function () {
    Project::factory()->create([
        'clickup_space_id' => null,
        'clickup_folder_id' => null,
        'client' => 'Acme',
        'name' => 'Portal',
    ]);
    app()->instance(ClickUpClient::class, clickUpClientFake(projectFolderName: '[Wrong Client][Portal]'));
    $defaults = ClickUpSyncOptions::defaults();
    $options = new ClickUpSyncOptions(
        from: $defaults->from,
        to: $defaults->to,
        members: false,
        tasks: false,
        timeEntries: false,
        timeOff: false,
    );

    app(ClickUpSyncService::class)->sync($options);

    expect(ClickUpFolder::query()->where('clickup_folder_id', 'folder-project')->sole()->project_id)->toBeNull()
        ->and(ClickUpList::query()->where('clickup_list_id', 'list-project')->sole()->project_id)->toBeNull();
});

it('closes stale running sync history before starting another run', function () {
    $staleRun = SyncRun::factory()->create([
        'status' => SyncRunStatus::Running,
        'started_at' => now()->subMinutes(31),
    ]);
    app()->instance(ClickUpClient::class, clickUpClientFake());
    $defaults = ClickUpSyncOptions::defaults();
    $options = new ClickUpSyncOptions(
        from: $defaults->from,
        to: $defaults->to,
        members: false,
        hierarchy: false,
        tasks: false,
        timeEntries: false,
        timeOff: false,
    );

    $newRun = app(ClickUpSyncService::class)->sync($options);

    expect($staleRun->refresh()->status)->toBe(SyncRunStatus::Failed)
        ->and($staleRun->finished_at)->not->toBeNull()
        ->and($newRun->status)->toBe(SyncRunStatus::Succeeded);
});

it('synchronizes ClickUp data idempotently without changing the M1 allocation plan', function () {
    $person = Person::factory()->create([
        'clickup_user_id' => null,
        'name' => 'Ștefan Ionescu',
        'email' => null,
    ]);
    $project = Project::factory()->create([
        'clickup_space_id' => null,
        'clickup_folder_id' => null,
        'client' => 'Acme',
        'name' => 'Portal',
    ]);
    $allocation = Allocation::factory()->create([
        'person_id' => $person,
        'project_id' => $project,
        'month' => '2026-07-01',
        'planned_hours' => 80,
    ]);
    app()->instance(ClickUpClient::class, clickUpClientFake());
    $options = new ClickUpSyncOptions(
        from: CarbonImmutable::parse('2026-07-01')->startOfDay(),
        to: CarbonImmutable::parse('2026-07-31')->endOfDay(),
    );
    $service = app(ClickUpSyncService::class);

    $firstRun = $service->sync($options);
    $secondRun = $service->sync($options);

    expect($firstRun->status)->toBe(SyncRunStatus::Succeeded)
        ->and($secondRun->status)->toBe(SyncRunStatus::Succeeded)
        ->and(SyncRun::query()->count())->toBe(2)
        ->and(Person::query()->count())->toBe(1)
        ->and($person->refresh()->name)->toBe('Ștefan Ionescu')
        ->and($person->clickup_user_id)->toBe('101')
        ->and(ClickUpFolder::query()->count())->toBe(2)
        ->and(ClickUpList::query()->count())->toBe(2)
        ->and(ClickUpTask::query()->count())->toBe(1)
        ->and(TimeEntry::query()->count())->toBe(1)
        ->and(TimeOff::query()->count())->toBe(1)
        ->and(Allocation::query()->count())->toBe(1)
        ->and($allocation->refresh()->planned_hours)->toBe('80.00');

    $projectFolder = ClickUpFolder::query()->where('clickup_folder_id', 'folder-project')->firstOrFail();
    $internalFolder = ClickUpFolder::query()->where('clickup_folder_id', 'folder-internal')->firstOrFail();
    $task = ClickUpTask::query()->firstOrFail();
    $entry = TimeEntry::query()->firstOrFail();

    expect($projectFolder->project_id)->toBe($project->getKey())
        ->and($projectFolder->kind)->toBe(ClickUpLocationKind::Project)
        ->and($internalFolder->project_id)->toBeNull()
        ->and($internalFolder->kind)->toBe(ClickUpLocationKind::Internal)
        ->and($task->project_id)->toBe($project->getKey())
        ->and($task->estimate_seconds)->toBe(7_200)
        ->and($task->assignees)->toHaveCount(1)
        ->and($entry->project_id)->toBe($project->getKey())
        ->and($entry->duration_seconds)->toBe(3_600)
        ->and($entry->is_billable)->toBeTrue();
});

it('records a failed run after preserving stages completed before the failure', function () {
    app()->instance(ClickUpClient::class, clickUpClientFake(failOnTimeEntries: true));
    $service = app(ClickUpSyncService::class);
    $options = new ClickUpSyncOptions(
        from: CarbonImmutable::parse('2026-07-01')->startOfDay(),
        to: CarbonImmutable::parse('2026-07-31')->endOfDay(),
    );

    expect(fn () => $service->sync($options))->toThrow(
        RuntimeException::class,
        'The ClickUp token cannot read team time entries.',
    );

    $run = SyncRun::query()->firstOrFail();

    expect($run->status)->toBe(SyncRunStatus::Failed)
        ->and($run->counters)->toMatchArray([
            'people' => 1,
            'folders' => 2,
            'lists' => 2,
            'tasks' => 1,
            'time_off' => 1,
        ])
        ->and($run->error_message)->toContain('cannot read team time entries')
        ->and(Person::query()->count())->toBe(1)
        ->and(ClickUpTask::query()->count())->toBe(1)
        ->and(TimeEntry::query()->count())->toBe(0)
        ->and(TimeOff::query()->count())->toBe(1);
});

it('imports time entries for unknown ClickUp users as active external people', function () {
    Project::factory()->create([
        'clickup_folder_id' => null,
        'client' => 'Acme',
        'name' => 'Portal',
    ]);
    app()->instance(ClickUpClient::class, clickUpClientFake(externalTimeEntry: true));

    $options = new ClickUpSyncOptions(
        from: CarbonImmutable::parse('2026-07-01')->startOfDay(),
        to: CarbonImmutable::parse('2026-07-31')->endOfDay(),
    );
    app(ClickUpSyncService::class)->sync($options);
    app(ClickUpSyncService::class)->sync($options);

    $external = Person::query()->where('clickup_user_id', '999')->sole();
    $entry = TimeEntry::query()->sole();

    expect($external->name)->toBe('Contractor Extern')
        ->and($external->is_external)->toBeTrue()
        ->and($external->active)->toBeTrue()
        ->and($external->default_monthly_capacity_hours)->toBe('0.00')
        ->and($entry->person_id)->toBe($external->id)
        ->and(Person::query()->where('clickup_user_id', '999')->count())->toBe(1);
});

it('reclassifies former workspace members with current time entries as active externals', function () {
    $formerMember = Person::factory()->create([
        'clickup_user_id' => '999',
        'name' => 'Contractor Extern',
        'is_external' => false,
        'active' => true,
    ]);
    Project::factory()->create([
        'clickup_folder_id' => null,
        'client' => 'Acme',
        'name' => 'Portal',
    ]);
    app()->instance(ClickUpClient::class, clickUpClientFake(externalTimeEntry: true));

    app(ClickUpSyncService::class)->sync(new ClickUpSyncOptions(
        from: CarbonImmutable::parse('2026-07-01')->startOfDay(),
        to: CarbonImmutable::parse('2026-07-31')->endOfDay(),
    ));

    expect($formerMember->refresh()->is_external)->toBeTrue()
        ->and($formerMember->active)->toBeTrue()
        ->and(TimeEntry::query()->sole()->person_id)->toBe($formerMember->id);
});
