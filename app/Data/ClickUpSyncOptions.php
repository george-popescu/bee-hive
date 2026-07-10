<?php

namespace App\Data;

use Carbon\CarbonImmutable;
use InvalidArgumentException;

final readonly class ClickUpSyncOptions
{
    public function __construct(
        public CarbonImmutable $from,
        public CarbonImmutable $to,
        public bool $members = true,
        public bool $hierarchy = true,
        public bool $tasks = true,
        public bool $timeEntries = true,
        public bool $timeOff = true,
        public ?int $triggeredBy = null,
    ) {
        if ($this->from->isAfter($this->to)) {
            throw new InvalidArgumentException('The ClickUp synchronization start date must be before its end date.');
        }

        if ($this->from->diffInDays($this->to) > 366) {
            throw new InvalidArgumentException('A ClickUp synchronization interval cannot exceed 366 days.');
        }
    }

    public static function defaults(): self
    {
        $now = CarbonImmutable::now();

        return new self(
            from: $now->subMonthNoOverflow()->startOfMonth(),
            to: $now,
        );
    }

    /** @return array<string, bool|int|string|null> */
    public function toArray(): array
    {
        return [
            'from' => $this->from->toIso8601String(),
            'to' => $this->to->toIso8601String(),
            'members' => $this->members,
            'hierarchy' => $this->hierarchy,
            'tasks' => $this->tasks,
            'time_entries' => $this->timeEntries,
            'time_off' => $this->timeOff,
            'triggered_by' => $this->triggeredBy,
        ];
    }

    public function scope(): string
    {
        $enabled = collect([
            'members' => $this->members,
            'hierarchy' => $this->hierarchy,
            'tasks' => $this->tasks,
            'time_entries' => $this->timeEntries,
            'time_off' => $this->timeOff,
        ])->filter()->keys();

        return $enabled->count() === 5 ? 'full' : $enabled->implode(',');
    }
}
