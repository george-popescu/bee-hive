<?php

namespace App\Http\Controllers\Settings;

use App\Enums\RoleName;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileDeleteRequest;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use App\Models\User;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;

class ProfileController extends Controller
{
    /**
     * Show the user's profile settings page.
     */
    public function edit(Request $request): Response
    {
        return Inertia::render('settings/profile', [
            'mustVerifyEmail' => $request->user() instanceof MustVerifyEmail,
            'status' => $request->session()->get('status'),
        ]);
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $request->user()->fill($request->validated());

        if ($request->user()->isDirty('email')) {
            $request->user()->email_verified_at = null;
        }

        $request->user()->save();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Profile updated.')]);

        return to_route('profile.edit');
    }

    /**
     * Delete the user's profile.
     */
    public function destroy(ProfileDeleteRequest $request): RedirectResponse
    {
        $user = $request->user();

        DB::transaction(function () use ($user): void {
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

            if ($adminIds->contains($user->getKey()) && $adminIds->count() <= 1) {
                throw ValidationException::withMessages([
                    'password' => __('messages.admin.last_admin_cannot_delete_account'),
                ]);
            }

            User::query()->whereKey($user->getKey())->lockForUpdate()->firstOrFail()->delete();
        });

        Auth::logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
