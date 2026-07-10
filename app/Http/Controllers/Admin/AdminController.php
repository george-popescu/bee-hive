<?php

namespace App\Http\Controllers\Admin;

use App\Enums\PermissionName;
use App\Http\Controllers\Controller;
use App\Services\Admin\AdminData;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class AdminController extends Controller
{
    public function __invoke(Request $request, AdminData $data): Response
    {
        $permissions = [
            PermissionName::ManageSettings->value,
            PermissionName::ManageUsers->value,
            PermissionName::ManageRolesAndPermissions->value,
        ];

        abort_unless(Gate::any($permissions), 403);

        return Inertia::render('admin/index', $data->get($request->user()));
    }
}
