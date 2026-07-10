<?php

use App\Enums\SettingKey;
use App\Models\ActualAdjustment;
use App\Models\ClickUpTask;
use App\Models\Person;
use App\Models\Project;
use App\Models\Setting;
use App\Models\Team;
use App\Models\User;
use Database\Seeders\SettingsSeeder;

it('connects operational people to users teams projects and clickup tasks', function () {
    $user = User::factory()->create();
    $person = Person::factory()->create(['user_id' => $user]);
    $team = Team::factory()->create();
    $project = Project::factory()->create();
    $task = ClickUpTask::factory()->create(['project_id' => $project]);

    $team->people()->attach($person, ['is_lead' => true]);
    $project->managers()->attach($person);
    $task->assignees()->attach($person);

    expect($user->person->is($person))->toBeTrue()
        ->and($person->teams->first()->is($team))->toBeTrue()
        ->and((bool) $person->teams->first()->pivot->is_lead)->toBeTrue()
        ->and($person->managedProjects->first()->is($project))->toBeTrue()
        ->and($person->clickUpTasks->first()->is($task))->toBeTrue();
});

it('prevents eloquent updates and deletes of actual adjustments', function () {
    $adjustment = ActualAdjustment::factory()->create();

    expect(fn () => $adjustment->update(['reason' => 'Changed']))
        ->toThrow(LogicException::class, 'append-only')
        ->and(fn () => $adjustment->delete())
        ->toThrow(LogicException::class, 'append-only');
});

it('seeds capacity settings idempotently', function () {
    $this->seed(SettingsSeeder::class);
    $this->seed(SettingsSeeder::class);

    expect(Setting::query()->count())->toBe(count(SettingKey::cases()))
        ->and(Setting::query()->where('key', SettingKey::HoursPerLeaveDay->value)->first()->value)
        ->toBe(['value' => 8]);
});
