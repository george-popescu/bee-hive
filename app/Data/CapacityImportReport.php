<?php

namespace App\Data;

readonly class CapacityImportReport
{
    /**
     * @param  list<CapacityImportReconciliation>  $reconciliations
     */
    public function __construct(
        public int $peopleCount,
        public int $projectsCount,
        public int $allocationsCount,
        public array $reconciliations,
        public bool $persisted,
    ) {}

    /** @return list<CapacityImportReconciliation> */
    public function mismatches(): array
    {
        return array_values(array_filter(
            $this->reconciliations,
            fn (CapacityImportReconciliation $item): bool => ! $item->matches(),
        ));
    }

    public function isReconciled(): bool
    {
        return $this->mismatches() === [];
    }
}
