<?php

namespace App\Http\Controllers;

use App\Data\ClickUpSyncOptions;
use App\Enums\PermissionName;
use App\Jobs\SyncClickUpWorkspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ClickUpSyncController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        Gate::authorize(PermissionName::SyncClickUp->value);
        $defaults = ClickUpSyncOptions::defaults();
        SyncClickUpWorkspace::dispatch(new ClickUpSyncOptions(
            from: $defaults->from,
            to: $defaults->to,
            triggeredBy: $request->user()->getKey(),
        ));

        return back(status: 303)->with('success', 'Sincronizarea ClickUp a fost pusă în coadă.');
    }
}
