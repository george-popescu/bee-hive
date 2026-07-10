<?php

use App\Enums\PermissionName;
use App\Enums\SettingKey;
use App\Models\ActualAdjustment;
use App\Models\Person;
use App\Models\Project;
use App\Models\Setting;
use App\Models\Team;
use App\Models\User;
use Spatie\Permission\Models\Permission;

beforeEach(function () {
    Permission::findOrCreate(PermissionName::AdjustActualHours->value);
    Permission::findOrCreate(PermissionName::ViewManagement->value);

    Setting::query()->updateOrCreate(
        ['key' => SettingKey::ActivePeriodStart->value],
        ['group' => 'planning', 'value' => ['value' => '2026-05']],
    );
    Setting::query()->updateOrCreate(
        ['key' => SettingKey::ActivePeriodEnd->value],
        ['group' => 'planning', 'value' => ['value' => '2026-12']],
    );
});

function actualAdjustmentPayload(Person $person, ?Project $project): array
{
    return [
        'person_id' => $person->getKey(),
        'project_id' => $project?->getKey(),
        'internal_label' => $project === null ? 'Training' : null,
        'month' => '2026-07',
        'hours_delta' => 2.5,
        'reason' => 'Corecție verificată',
    ];
}

function actualAdjustmentManager(): User
{
    $user = User::factory()->create();
    $user->givePermissionTo(
        PermissionName::AdjustActualHours->value,
        PermissionName::ViewManagement->value,
    );

    return $user;
}

it('redirects guests to login', function () {
    $this->post(route('actual_adjustments.store'), actualAdjustmentPayload(
        Person::factory()->create(),
        Project::factory()->create(),
    ))->assertRedirect(route('login'));
});

it('forbids users without the adjustment permission', function () {
    $this->actingAs(User::factory()->create())
        ->postJson(route('actual_adjustments.store'), actualAdjustmentPayload(
            Person::factory()->create(),
            Project::factory()->create(),
        ))
        ->assertForbidden();
});

it('creates an audited project adjustment', function () {
    $user = actualAdjustmentManager();
    $person = Person::factory()->create();
    $project = Project::factory()->create();

    $this->actingAs($user)
        ->postJson(route('actual_adjustments.store'), actualAdjustmentPayload($person, $project))
        ->assertSuccessful();

    $adjustment = ActualAdjustment::query()->sole();

    expect($adjustment->person_id)->toBe($person->id)
        ->and($adjustment->project_id)->toBe($project->id)
        ->and($adjustment->internal_label)->toBeNull()
        ->and($adjustment->month->toDateString())->toBe('2026-07-01')
        ->and($adjustment->hours_delta)->toBe('2.50')
        ->and($adjustment->reason)->toBe('Corecție verificată')
        ->and($adjustment->created_by)->toBe($user->id)
        ->and($adjustment->created_by_name)->toBe($user->name);
});

it('creates an audited internal adjustment with a label', function () {
    $user = actualAdjustmentManager();
    $person = Person::factory()->create();

    $this->actingAs($user)
        ->postJson(route('actual_adjustments.store'), actualAdjustmentPayload($person, null))
        ->assertSuccessful();

    $adjustment = ActualAdjustment::query()->sole();

    expect($adjustment->person_id)->toBe($person->id)
        ->and($adjustment->project_id)->toBeNull()
        ->and($adjustment->internal_label)->toBe('Training')
        ->and($adjustment->created_by)->toBe($user->id)
        ->and($adjustment->created_by_name)->toBe($user->name);
});

it('validates the adjustment value reason period and active resources', function () {
    $user = actualAdjustmentManager();
    $person = Person::factory()->create();
    $project = Project::factory()->create();
    $payload = actualAdjustmentPayload($person, $project);

    $this->actingAs($user)
        ->postJson(route('actual_adjustments.store'), [...$payload, 'hours_delta' => 0])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['hours_delta']);

    $this->actingAs($user)
        ->postJson(route('actual_adjustments.store'), [...$payload, 'reason' => ''])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['reason']);

    $this->actingAs($user)
        ->postJson(route('actual_adjustments.store'), [...$payload, 'month' => '2027-01'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['month']);

    $this->actingAs($user)
        ->postJson(route('actual_adjustments.store'), [
            ...$payload,
            'person_id' => Person::factory()->create(['active' => false])->id,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['person_id']);

    $this->actingAs($user)
        ->postJson(route('actual_adjustments.store'), [
            ...$payload,
            'project_id' => Project::factory()->create(['active' => false])->id,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['project_id']);

    expect(ActualAdjustment::query()->count())->toBe(0);
});

it('limits users without management view to people in teams they lead', function () {
    $user = User::factory()->create();
    $user->givePermissionTo(PermissionName::AdjustActualHours->value);
    $lead = Person::factory()->create(['user_id' => $user]);
    $visiblePerson = Person::factory()->create();
    $hiddenPerson = Person::factory()->create();
    $team = Team::factory()->create();
    $project = Project::factory()->create();
    $team->people()->attach($lead, ['is_lead' => true]);
    $team->people()->attach($visiblePerson);

    $this->actingAs($user)
        ->postJson(
            route('actual_adjustments.store'),
            actualAdjustmentPayload($visiblePerson, $project),
        )
        ->assertSuccessful();

    $this->actingAs($user)
        ->postJson(
            route('actual_adjustments.store'),
            actualAdjustmentPayload($hiddenPerson, $project),
        )
        ->assertForbidden();

    expect(ActualAdjustment::query()->pluck('person_id')->all())->toBe([$visiblePerson->id]);
});

it('reverses an adjustment through a linked inverse entry only once', function () {
    $user = actualAdjustmentManager();
    $person = Person::factory()->create();
    $original = ActualAdjustment::factory()->create([
        'person_id' => $person,
        'hours_delta' => 3.5,
        'created_by' => $user,
        'created_by_name' => $user->name,
    ]);

    $this->actingAs($user)
        ->postJson(route('actual_adjustments.reverse', $original), [
            'reason' => 'Corecție anulată',
        ])
        ->assertCreated()
        ->assertJsonPath('adjustment.reverses_adjustment_id', $original->id)
        ->assertJsonPath('adjustment.hours_delta', -3.5);

    $this->actingAs($user)
        ->postJson(route('actual_adjustments.reverse', $original), [
            'reason' => 'A doua încercare',
        ])
        ->assertConflict();

    $reversal = ActualAdjustment::query()->where('reverses_adjustment_id', $original->id)->sole();
    $this->actingAs($user)
        ->postJson(route('actual_adjustments.reverse', $reversal), [
            'reason' => 'Reaplicare nepermisă',
        ])
        ->assertConflict();

    expect(ActualAdjustment::query()->count())->toBe(2)
        ->and((float) ActualAdjustment::query()->sum('hours_delta'))->toBe(0.0);
});
