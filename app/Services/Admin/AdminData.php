<?php

namespace App\Services\Admin;

use App\Enums\PermissionName;
use App\Enums\SettingKey;
use App\Models\AuditLog;
use App\Models\Person;
use App\Models\Project;
use App\Models\Setting;
use App\Models\User;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class AdminData
{
    /** @return array<string, mixed> */
    public function get(User $user): array
    {
        $canManageSettings = $user->can(PermissionName::ManageSettings->value);
        $canManageUsers = $user->can(PermissionName::ManageUsers->value);
        $canManageRoles = $user->can(PermissionName::ManageRolesAndPermissions->value);

        $people = $canManageSettings ? Person::query()->orderBy('name')->get()->map(fn (Person $person): array => [
            'id' => $person->getKey(),
            'name' => $person->name,
            'email' => $person->email,
            'jobRole' => $person->job_role,
            'monthlyCapacityHours' => (float) $person->default_monthly_capacity_hours,
            'weeklyCapacityHours' => $person->weekly_capacity_hours === null ? null : (float) $person->weekly_capacity_hours,
            'hourlyRate' => $person->hourly_rate === null ? null : (float) $person->hourly_rate,
            'external' => $person->is_external,
            'active' => $person->active,
        ])->all() : [];
        $managers = $canManageSettings ? collect($people)->where('active', true)->where('external', false)->values()->map(
            fn (array $person): array => ['id' => $person['id'], 'name' => $person['name']],
        )->all() : [];
        $projects = $canManageSettings ? Project::query()->with('managers:id,name')->orderBy('client')->orderBy('name')->get()->map(
            fn (Project $project): array => [
                'id' => $project->getKey(),
                'label' => trim($project->client.' — '.$project->name, ' —'),
                'contractType' => $project->contract_type?->value,
                'boardVisible' => $project->board_visible,
                'active' => $project->active,
                'managerIds' => $project->managers->modelKeys(),
                'boardConfig' => $project->board_config ?? [],
            ],
        )->all() : [];
        $users = $canManageUsers ? User::query()->with('roles:id,name')->orderBy('name')->get()->map(fn (User $listedUser): array => [
            'id' => $listedUser->getKey(),
            'name' => $listedUser->name,
            'email' => $listedUser->email,
            'roles' => $listedUser->roles->pluck('name')->values()->all(),
        ])->all() : [];
        $roles = ($canManageUsers || $canManageRoles) ? Role::query()->with('permissions:id,name')->orderBy('name')->get()->map(fn (Role $role): array => [
            'id' => $role->getKey(),
            'name' => $role->name,
            'permissions' => $canManageRoles ? $role->permissions->pluck('name')->values()->all() : [],
        ])->all() : [];
        $permissions = $canManageRoles ? Permission::query()->orderBy('name')->pluck('name')->all() : [];
        $storedSettings = $canManageSettings
            ? Setting::query()->whereIn('key', array_map(fn (SettingKey $key): string => $key->value, SettingKey::cases()))
                ->get()->keyBy('key')
            : collect();
        $settings = $canManageSettings ? collect(SettingKey::cases())->mapWithKeys(fn (SettingKey $key): array => [
            $key->value => data_get($storedSettings->get($key->value)?->value, 'value'),
        ])->all() : [];
        $auditLogs = $canManageRoles ? AuditLog::query()->with('actor:id,name')->latest('id')->limit(100)->get()->map(fn (AuditLog $log): array => [
            'id' => $log->getKey(),
            'action' => $log->action,
            'actor' => $log->actor_name ?? ($log->user_id === null ? 'Sistem' : $log->actor->name),
            'subject' => class_basename((string) $log->auditable_type).' #'.$log->auditable_id,
            'before' => $log->before,
            'after' => $log->after,
            'createdAt' => $log->created_at?->toIso8601String(),
        ])->all() : [];
        $capabilities = [
            'manageSettings' => $canManageSettings,
            'manageUsers' => $canManageUsers,
            'manageRoles' => $canManageRoles,
            'viewAudit' => $canManageRoles,
        ];

        return [
            'capabilities' => $capabilities,
            ...($canManageSettings ? compact('people', 'managers', 'projects', 'settings') : []),
            ...($canManageUsers ? compact('users') : []),
            ...(($canManageUsers || $canManageRoles) ? compact('roles') : []),
            ...($canManageRoles ? compact('permissions', 'auditLogs') : []),
        ];
    }
}
