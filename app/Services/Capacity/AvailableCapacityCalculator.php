<?php

namespace App\Services\Capacity;

use App\Enums\TimeOffStatus;
use App\Models\Person;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

class AvailableCapacityCalculator
{
    public function __construct(private readonly SettingsService $settings) {}

    public function grossHours(Person $person, CarbonInterface $month): float
    {
        $month = $this->month($month);
        $override = $person->capacities()
            ->whereDate('month', $month->toDateString())
            ->value('capacity_hours');

        return (float) ($override ?? $person->default_monthly_capacity_hours);
    }

    public function leaveWorkingDays(Person $person, CarbonInterface $month): int
    {
        $month = $this->month($month);
        $monthStart = $month->startOfMonth();
        $monthEnd = $month->endOfMonth();
        $leaveDates = [];

        $timeOffs = $person->timeOffs()
            ->where('active', true)
            ->whereDate('start_date', '<=', $monthEnd->toDateString())
            ->whereDate('end_date', '>=', $monthStart->toDateString())
            ->get();

        foreach ($timeOffs as $timeOff) {
            if (! TimeOffStatus::reducesCapacityFor($timeOff->status)) {
                continue;
            }

            $start = CarbonImmutable::parse($timeOff->start_date)->max($monthStart);
            $end = CarbonImmutable::parse($timeOff->end_date)->min($monthEnd);

            for ($date = $start; $date->lte($end); $date = $date->addDay()) {
                if ($date->isWeekday()) {
                    $leaveDates[$date->toDateString()] = true;
                }
            }
        }

        return count($leaveDates);
    }

    public function leaveHours(Person $person, CarbonInterface $month): float
    {
        return round(
            $this->leaveWorkingDays($person, $month) * $this->settings->hoursPerLeaveDay(),
            2,
        );
    }

    public function availableHours(Person $person, CarbonInterface $month): float
    {
        return max(0, round(
            $this->grossHours($person, $month) - $this->leaveHours($person, $month),
            2,
        ));
    }

    private function month(CarbonInterface $month): CarbonImmutable
    {
        return CarbonImmutable::instance($month)->startOfMonth();
    }
}
