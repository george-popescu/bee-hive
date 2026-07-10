<?php

namespace App\Services\ClickUp;

use App\Contracts\ClickUpClient;
use App\Models\Person;
use RuntimeException;

final class PeopleSynchronizer
{
    public function __construct(private readonly ClickUpClient $client) {}

    public function sync(): int
    {
        $members = $this->client->members();
        $people = Person::query()->get();
        $seenIds = [];

        foreach ($members as $member) {
            $clickUpUserId = ClickUpValue::stringId($member['id'] ?? null);
            $name = is_string($member['username'] ?? null) ? trim($member['username']) : '';

            if ($clickUpUserId === null || $name === '') {
                continue;
            }

            $email = is_string($member['email'] ?? null) && trim($member['email']) !== ''
                ? mb_strtolower(trim($member['email']))
                : null;
            $person = Person::query()->where('clickup_user_id', $clickUpUserId)->first();

            if ($person === null && $email !== null) {
                $emailMatches = Person::query()->whereRaw('LOWER(email) = ?', [$email])->get();

                if ($emailMatches->count() > 1) {
                    throw new RuntimeException("Ambiguous ClickUp email mapping for {$email}.");
                }

                $person = $emailMatches->first();
            }

            if ($person === null) {
                $normalizedName = ClickUpValue::normalizedName($name);
                $matches = $people->filter(
                    fn (Person $candidate): bool => ClickUpValue::normalizedName($candidate->name) === $normalizedName,
                );

                if ($matches->count() > 1) {
                    throw new RuntimeException("Ambiguous ClickUp person mapping for {$name}.");
                }

                $person = $matches->first();
            }

            $person ??= new Person(['name' => $name]);
            $person->fill([
                'clickup_user_id' => $clickUpUserId,
                'email' => $email ?? $person->email,
                'is_external' => false,
                'active' => ! $person->manually_inactive,
            ])->save();

            if (! $people->contains(fn (Person $candidate): bool => $candidate->is($person))) {
                $people->push($person);
            }

            $seenIds[] = $clickUpUserId;
        }

        Person::query()
            ->whereNotNull('clickup_user_id')
            ->where('is_external', false)
            ->when($seenIds !== [], fn ($query) => $query->whereNotIn('clickup_user_id', $seenIds))
            ->when($seenIds === [], fn ($query) => $query)
            ->update([
                'active' => false,
                'is_external' => true,
            ]);

        return count($seenIds);
    }
}
