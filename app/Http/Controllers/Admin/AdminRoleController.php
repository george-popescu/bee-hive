<?php

namespace App\Http\Controllers\Admin;

use App\Enums\PermissionName;
use App\Enums\RoleName;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateRoleRequest;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;

class AdminRoleController extends Controller
{
    public function update(UpdateRoleRequest $request, Role $role, AuditLogger $audit): JsonResponse|RedirectResponse
    {
        $permissions = array_values($request->validated('permission_names'));

        DB::transaction(function () use ($request, $role, $audit, $permissions): void {
            $lockedRole = Role::query()->whereKey($role->getKey())->lockForUpdate()->firstOrFail();

            if ($lockedRole->name === RoleName::Admin->value) {
                $required = [
                    PermissionName::ManageUsers->value,
                    PermissionName::ManageRolesAndPermissions->value,
                    PermissionName::ManageSettings->value,
                ];
                $missing = array_diff($required, $permissions);

                if ($missing !== []) {
                    throw ValidationException::withMessages([
                        'permission_names' => __('messages.admin.admin_role_must_keep_critical_permissions'),
                    ]);
                }
            }

            $before = ['permission_names' => $lockedRole->permissions()->pluck('name')->all()];
            $lockedRole->syncPermissions($permissions);
            $audit->log($request->user(), $lockedRole, 'role.permissions_updated', $before, [
                'permission_names' => $lockedRole->permissions()->pluck('name')->all(),
            ]);
        });

        if ($request->expectsJson()) {
            return response()->json(['updated' => true]);
        }

        return back(status: 303)->with('success', __('messages.admin.role_permissions_updated'));
    }
}
