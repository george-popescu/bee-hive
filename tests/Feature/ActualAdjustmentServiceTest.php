<?php

use App\Models\ActualAdjustment;
use App\Models\Person;
use App\Models\Project;
use App\Models\User;
use App\Services\Capacity\ActualAdjustmentService;
use Carbon\CarbonImmutable;

it('creates an audited adjustment for an exact date and normalizes its aggregate month', function () {
    $person = Person::factory()->create();
    $project = Project::factory()->create();
    $author = User::factory()->create(['name' => 'Manager Test']);

    $adjustment = app(ActualAdjustmentService::class)->create(
        person: $person,
        project: $project,
        effectiveDate: CarbonImmutable::parse('2026-07-18'),
        hoursDelta: 2.5,
        reason: 'Corecție verificată',
        author: $author,
    );

    expect($adjustment->effective_date->toDateString())->toBe('2026-07-18')
        ->and($adjustment->month->toDateString())->toBe('2026-07-01')
        ->and($adjustment->hours_delta)->toBe('2.50')
        ->and($adjustment->created_by)->toBe($author->id)
        ->and($adjustment->created_by_name)->toBe('Manager Test')
        ->and($adjustment->internal_label)->toBeNull();
});

it('requires a label for internal adjustments', function () {
    $service = app(ActualAdjustmentService::class);

    expect(fn () => $service->create(
        person: Person::factory()->create(),
        project: null,
        effectiveDate: CarbonImmutable::parse('2026-07-18'),
        hoursDelta: 2,
        reason: 'Activitate internă',
        author: User::factory()->create(),
    ))->toThrow(InvalidArgumentException::class, 'internal label');
});

it('reverses an adjustment with a linked inverse entry only once', function () {
    $person = Person::factory()->create();
    $project = Project::factory()->create();
    $author = User::factory()->create();
    $service = app(ActualAdjustmentService::class);

    $original = $service->create(
        person: $person,
        project: $project,
        effectiveDate: CarbonImmutable::parse('2026-07-18'),
        hoursDelta: 4,
        reason: 'Corecție inițială',
        author: $author,
    );

    $reversal = $service->reverse($original, $author, 'Anulare corecție');

    expect($reversal->hours_delta)->toBe('-4.00')
        ->and($reversal->effective_date->toDateString())->toBe('2026-07-18')
        ->and($reversal->month->toDateString())->toBe('2026-07-01')
        ->and($reversal->reverses_adjustment_id)->toBe($original->id)
        ->and((float) ActualAdjustment::query()->sum('hours_delta'))->toBe(0.0)
        ->and(fn () => $service->reverse($original, $author, 'Încă o anulare'))
        ->toThrow(LogicException::class, 'already been reversed');
});
