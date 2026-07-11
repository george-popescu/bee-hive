<?php

namespace App\Providers;

use App\Contracts\ClickUpClient;
use App\Enums\RoleName;
use App\Models\User;
use App\Services\ClickUp\HierarchySynchronizer;
use App\Services\ClickUp\HttpClickUpClient;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(ClickUpClient::class, fn (): ClickUpClient => new HttpClickUpClient(
            token: (string) config('services.clickup.token'),
            workspaceId: (string) config('services.clickup.workspace_id'),
            projectsSpaceId: (string) config('services.clickup.projects_space_id'),
            holidaysListId: (string) config('services.clickup.holidays_list_id'),
            baseUrl: (string) config('services.clickup.base_url'),
            requestTimeoutSeconds: (int) config('services.clickup.request_timeout_seconds'),
            connectTimeoutSeconds: (int) config('services.clickup.connect_timeout_seconds'),
        ));

        $this->app->bind(HierarchySynchronizer::class, fn (): HierarchySynchronizer => new HierarchySynchronizer(
            client: $this->app->make(ClickUpClient::class),
            projectsSpaceId: (string) config('services.clickup.projects_space_id'),
            internalFolderIds: config('services.clickup.internal_folder_ids', []),
        ));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        $this->configureAuthorization();
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }

    /**
     * Configure application-wide authorization behavior.
     */
    protected function configureAuthorization(): void
    {
        Gate::before(
            fn (User $user, string $ability): ?bool => $user->hasRole(RoleName::Admin->value) ? true : null,
        );
    }
}
