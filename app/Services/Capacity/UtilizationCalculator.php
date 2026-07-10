<?php

namespace App\Services\Capacity;

use App\Data\MonthlyUtilization;
use App\Models\Person;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

class UtilizationCalculator
{
    public function __construct(
        private readonly AvailableCapacityCalculator $capacity,
        private readonly HoursAggregator $hours,
    ) {}

    public function forMonth(Person $person, CarbonInterface $month): MonthlyUtilization
    {
        $month = CarbonImmutable::instance($month)->startOfMonth();
        $grossHours = $this->capacity->grossHours($person, $month);
        $leaveHours = $this->capacity->leaveHours($person, $month);
        $availableHours = max(0, round($grossHours - $leaveHours, 2));
        $plannedHours = $this->hours->plannedForPerson($person, $month);
        $actualHours = $this->hours->actualForPerson($person, $month);

        return new MonthlyUtilization(
            month: $month,
            grossCapacityHours: $grossHours,
            leaveHours: $leaveHours,
            availableCapacityHours: $availableHours,
            plannedHours: $plannedHours,
            actualHours: $actualHours,
            estimatedPercent: $this->percent($plannedHours, $availableHours),
            actualPercent: $actualHours === null
                ? null
                : $this->percent($actualHours, $availableHours),
            isFullyOnLeave: $availableHours <= 0.0,
        );
    }

    /** @param iterable<MonthlyUtilization> $months */
    public function estimatedAverage(iterable $months): ?float
    {
        return $this->average($months, 'estimatedPercent');
    }

    /** @param iterable<MonthlyUtilization> $months */
    public function actualAverage(iterable $months): ?float
    {
        return $this->average($months, 'actualPercent');
    }

    private function percent(float $hours, float $availableHours): ?float
    {
        if ($availableHours === 0.0) {
            return null;
        }

        return round(($hours / $availableHours) * 100, 2);
    }

    /** @param iterable<MonthlyUtilization> $months */
    private function average(iterable $months, string $property): ?float
    {
        $values = [];

        foreach ($months as $month) {
            if ($month->{$property} !== null) {
                $values[] = $month->{$property};
            }
        }

        if ($values === []) {
            return null;
        }

        return round(array_sum($values) / count($values), 2);
    }
}
