<?php

namespace App\Data;

use Carbon\CarbonImmutable;

readonly class MonthlyUtilization
{
    public function __construct(
        public CarbonImmutable $month,
        public float $grossCapacityHours,
        public float $leaveHours,
        public float $availableCapacityHours,
        public float $plannedHours,
        public ?float $actualHours,
        public ?float $estimatedPercent,
        public ?float $actualPercent,
        public bool $isFullyOnLeave,
    ) {}
}
