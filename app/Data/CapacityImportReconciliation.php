<?php

namespace App\Data;

use Carbon\CarbonImmutable;

readonly class CapacityImportReconciliation
{
    public function __construct(
        public string $person,
        public CarbonImmutable $month,
        public float $expectedHours,
        public float $importedHours,
    ) {}

    public function difference(): float
    {
        return round($this->importedHours - $this->expectedHours, 2);
    }

    public function matches(): bool
    {
        return abs($this->difference()) <= 0.01;
    }
}
