<?php

namespace Database\Seeders;

use App\Enums\PermissionName;
use App\Enums\RoleName;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (PermissionName::cases() as $permissionName) {
            Permission::findOrCreate($permissionName->value);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (RoleName::cases() as $roleName) {
            Role::findOrCreate($roleName->value)
                ->syncPermissions($this->permissionsFor($roleName));
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    /**
     * @return list<string>
     */
    private function permissionsFor(RoleName $roleName): array
    {
        $permissions = match ($roleName) {
            RoleName::Admin => PermissionName::cases(),
            RoleName::Management => [
                PermissionName::ViewManagement,
                PermissionName::ViewTeamLead,
                PermissionName::ViewPmBoards,
                PermissionName::AdjustActualHours,
            ],
            RoleName::TeamLead => [
                PermissionName::ViewTeamLead,
                PermissionName::ManageAllocations,
            ],
            RoleName::ProjectManager => [
                PermissionName::ViewPmBoards,
                PermissionName::ManagePmPlanning,
            ],
        };

        return array_map(
            fn (PermissionName $permissionName): string => $permissionName->value,
            $permissions,
        );
    }
}
