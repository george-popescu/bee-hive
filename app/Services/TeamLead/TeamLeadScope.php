<?php

namespace App\Services\TeamLead;

use App\Enums\PermissionName;
use App\Models\Person;
use App\Models\User;

final class TeamLeadScope
{
    /** @return list<int> */
    public function personIds(User $user): array
    {
        if ($user->can(PermissionName::ViewManagement->value)) {
            return array_values(Person::query()
                ->where('active', true)
                ->orderBy('id')
                ->pluck('id')
                ->map(fn (mixed $id): int => (int) $id)
                ->values()
                ->all());
        }

        $person = $user->person()->first();

        if ($person === null) {
            return [];
        }

        return array_values($person->teams()
            ->wherePivot('is_lead', true)
            ->where('active', true)
            ->with('people:id')
            ->get()
            ->flatMap->people
            ->pluck('id')
            ->unique()
            ->sort()
            ->map(fn (mixed $id): int => (int) $id)
            ->values()
            ->all());
    }
}
