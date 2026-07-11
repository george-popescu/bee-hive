<?php

use App\Services\ClickUp\HttpClickUpClient;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

function makeHttpClickUpClient(): HttpClickUpClient
{
    return new HttpClickUpClient(
        token: 'raw-clickup-token',
        workspaceId: 'workspace-123',
        projectsSpaceId: 'space-456',
        holidaysListId: 'list-789',
        baseUrl: 'https://clickup.test/api/v2',
    );
}

beforeEach(function () {
    Http::preventStrayRequests();
});

it('sends only get requests with the raw authorization token', function () {
    Http::fake(function (Request $request) {
        if ($request->url() === 'https://clickup.test/api/v2/team') {
            return Http::response([
                'teams' => [[
                    'id' => 'workspace-123',
                    'members' => [],
                ]],
            ]);
        }

        if (str_contains($request->url(), '/time_entries')) {
            return Http::response(['data' => []]);
        }

        return Http::response([
            'folders' => [],
            'lists' => [],
            'tasks' => [],
        ]);
    });

    $client = makeHttpClickUpClient();
    $from = CarbonImmutable::parse('2026-07-01T00:00:00Z');
    $to = CarbonImmutable::parse('2026-07-02T00:00:00Z');

    $client->members();
    $client->folders();
    $client->folderlessLists();
    iterator_to_array($client->tasks());
    $client->timeEntries($from, $to, ['user-1']);
    iterator_to_array($client->timeOffTasks());

    $requests = Http::recorded()->map(fn (array $recorded) => $recorded[0]);

    expect($requests)->toHaveCount(6)
        ->and($requests->every(fn (Request $request) => $request->method() === 'GET'))->toBeTrue()
        ->and($requests->every(
            fn (Request $request) => $request->hasHeader('Authorization', 'raw-clickup-token')
        ))->toBeTrue();
});

it('requests another task page when the current page contains 100 results', function () {
    $firstPage = array_map(
        fn (int $number) => ['id' => "task-{$number}"],
        range(1, 100),
    );

    Http::fakeSequence()
        ->push(['tasks' => $firstPage])
        ->push(['tasks' => [['id' => 'task-101']]]);

    $updatedAfter = CarbonImmutable::parse('2026-07-01T12:30:00Z');
    $taskStream = makeHttpClickUpClient()->tasks($updatedAfter);

    expect(Http::recorded())->toHaveCount(0);

    $tasks = iterator_to_array($taskStream);
    $requests = Http::recorded()->map(fn (array $recorded) => $recorded[0])->values();

    expect($tasks)->toHaveCount(101)
        ->and($tasks[0]['id'])->toBe('task-1')
        ->and($tasks[100]['id'])->toBe('task-101')
        ->and($requests)->toHaveCount(2)
        ->and(parse_url($requests[0]->url(), PHP_URL_PATH))->toBe('/api/v2/team/workspace-123/task')
        ->and($requests[0]->data())->toMatchArray([
            'space_ids[]' => 'space-456',
            'include_closed' => 'true',
            'subtasks' => 'true',
            'date_updated_gt' => (string) $updatedAfter->getTimestampMs(),
            'page' => 0,
        ])
        ->and($requests[1]->data()['page'])->toBe(1);
});

it('sends the expected query when requesting time entries', function () {
    Http::fake([
        'clickup.test/*' => Http::response([
            'data' => [
                ['id' => 'entry-1'],
                ['id' => 'entry-2'],
            ],
        ]),
    ]);

    $from = CarbonImmutable::parse('2026-06-01T00:00:00Z');
    $to = CarbonImmutable::parse('2026-06-30T23:59:59Z');
    $entries = makeHttpClickUpClient()->timeEntries($from, $to, ['user-10', 'user-20']);

    expect($entries)->toBe([
        ['id' => 'entry-1'],
        ['id' => 'entry-2'],
    ]);

    Http::assertSent(fn (Request $request) => $request->method() === 'GET'
        && parse_url($request->url(), PHP_URL_PATH) === '/api/v2/team/workspace-123/time_entries'
        && $request->data() === [
            'start_date' => (string) $from->getTimestampMs(),
            'end_date' => (string) $to->getTimestampMs(),
            'assignee' => 'user-10,user-20',
            'include_location_names' => 'true',
        ]);
});

it('requests all workspace time entries when no assignee filter is supplied', function () {
    Http::fake([
        'clickup.test/*' => Http::response(['data' => []]),
    ]);
    $from = CarbonImmutable::parse('2026-06-01T00:00:00Z');
    $to = CarbonImmutable::parse('2026-06-30T23:59:59Z');

    makeHttpClickUpClient()->timeEntries($from, $to, []);

    Http::assertSent(fn (Request $request) => $request->method() === 'GET'
        && ! array_key_exists('assignee', $request->data())
        && $request->data() === [
            'start_date' => (string) $from->getTimestampMs(),
            'end_date' => (string) $to->getTimestampMs(),
            'include_location_names' => 'true',
        ]);
});

it('rejects malformed successful snapshots instead of treating them as empty', function () {
    Http::fake([
        'clickup.test/*' => Http::response([]),
    ]);

    expect(fn () => makeHttpClickUpClient()->folders())
        ->toThrow(RuntimeException::class, 'ClickUp returned an invalid folder snapshot.');
});

it('rejects a workspace snapshot without its members collection', function () {
    Http::fake([
        'clickup.test/*' => Http::response([
            'teams' => [['id' => 'workspace-123']],
        ]),
    ]);

    expect(fn () => makeHttpClickUpClient()->members())
        ->toThrow(RuntimeException::class, 'ClickUp returned an invalid workspace member snapshot.');
});
