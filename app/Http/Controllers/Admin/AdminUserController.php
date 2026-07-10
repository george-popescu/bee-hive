<?php

namespace App\Http\Controllers\Admin;

use App\Enums\PermissionName;
use App\Enums\RoleName;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;

class AdminUserController extends Controller
{
    public function update(UpdateUserRequest $request, User $user, AuditLogger $audit): JsonResponse|RedirectResponse
    {
        $roles = array_values($request->validated('role_names'));
        $criticalPermissions = [
            PermissionName::ManageUsers->value,
            PermissionName::ManageRolesAndPermissions->value,
            PermissionName::ManageSettings->value,
        ];
        $assignsPrivilegedRole = in_array(RoleName::Admin->value, $roles, true)
            || Role::query()
                ->whereIn('name', $roles)
                ->whereHas('permissions', fn ($query) => $query->whereIn('name', $criticalPermissions))
                ->exists();

        if ($assignsPrivilegedRole && ! $request->user()->can(PermissionName::ManageRolesAndPermissions->value)) {
            throw ValidationException::withMessages([
                'role_names' => 'Doar utilizatorii care administrează rolurile și permisiunile pot atribui roluri administrative.',
            ]);
        }

        DB::transaction(function () use ($request, $user, $audit, $roles): void {
            $adminRole = Role::query()
                ->where('name', RoleName::Admin->value)
                ->where('guard_name', 'web')
                ->lockForUpdate()
                ->first();
            $adminRoleId = $adminRole?->getKey();
            $adminIds = $adminRoleId === null
                ? new Collection
                : User::query()
                    ->whereHas('roles', fn ($query) => $query->whereKey($adminRoleId))
                    ->select('users.id')
                    ->lockForUpdate()
                    ->pluck('users.id');
            $lockedUser = User::query()->whereKey($user->getKey())->lockForUpdate()->firstOrFail();

            $removesAdmin = $adminIds->contains($lockedUser->getKey())
                && ! in_array(RoleName::Admin->value, $roles, true);

            if ($removesAdmin && ! $request->user()->can(PermissionName::ManageRolesAndPermissions->value)) {
                throw ValidationException::withMessages([
                    'role_names' => 'Doar utilizatorii care administrează rolurile și permisiunile pot elimina rolul Admin.',
                ]);
            }

            if ($removesAdmin && $adminIds->count() <= 1) {
                throw ValidationException::withMessages(['role_names' => 'Ultimul administrator nu poate pierde rolul Admin.']);
            }

            $before = ['role_names' => $lockedUser->getRoleNames()->values()->all()];
            $lockedUser->syncRoles($roles);
            $audit->log($request->user(), $lockedUser, 'user.roles_updated', $before, [
                'role_names' => $lockedUser->getRoleNames()->values()->all(),
            ]);
        });

        if ($request->expectsJson()) {
            return response()->json(['updated' => true]);
        }

        return back(status: 303)->with('success', 'Rolurile utilizatorului au fost actualizate.');
    }
}
