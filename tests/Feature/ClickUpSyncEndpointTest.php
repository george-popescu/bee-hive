<?php

use App\Enums\PermissionName;
use App\Jobs\SyncClickUpWorkspace;
use App\Models\User;
use Illuminate\Support\Facades\Bus;
use Spatie\Permission\Models\Permission;

beforeEach(function () {
    Permission::findOrCreate(PermissionName::SyncClickUp->value);
});

it('redirects guests and forbids users without sync permission', function () {
    $this->post(route('clickup_sync.store'))->assertRedirect(route('login'));

    $this->actingAs(User::factory()->create())
        ->post(route('clickup_sync.store'))
        ->assertForbidden();
});

it('queues a workspace sync attributed to the authenticated user', function () {
    Bus::fake();
    $user = User::factory()->create();
    $user->givePermissionTo(PermissionName::SyncClickUp->value);

    $this->actingAs($user)
        ->from(route('pm_board.index'))
        ->post(route('clickup_sync.store'))
        ->assertStatus(303)
        ->assertRedirect(route('pm_board.index'));

    Bus::assertDispatched(
        SyncClickUpWorkspace::class,
        fn (SyncClickUpWorkspace $job): bool => $job->options?->triggeredBy === $user->id,
    );
});
