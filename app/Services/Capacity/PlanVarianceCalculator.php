<?php

namespace App\Services\Capacity;

use App\Enums\PlanVarianceStatus;

class PlanVarianceCalculator
{
    public function classify(float $plannedHours, float $actualHours): PlanVarianceStatus
    {
        if ($plannedHours === 0.0) {
            if ($actualHours > 0.0) {
                return PlanVarianceStatus::Unplanned;
            }

            return $actualHours === 0.0
                ? PlanVarianceStatus::Empty
                : PlanVarianceStatus::Neutral;
        }

        $relativeVariance = abs($actualHours - $plannedHours) / $plannedHours;

        if ($relativeVariance <= 0.10) {
            return PlanVarianceStatus::OnPlan;
        }

        if ($actualHours > $plannedHours * 1.25 || $actualHours < $plannedHours * 0.75) {
            return PlanVarianceStatus::SignificantVariance;
        }

        return PlanVarianceStatus::Neutral;
    }
}
