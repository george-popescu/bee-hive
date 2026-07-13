<?php

namespace App\Services\Planning;

use App\Enums\SettingKey;
use App\Models\Allocation;
use App\Services\Capacity\SettingsService;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Throwable;

class PlanningPeriod
{
    public function __construct(private readonly SettingsService $settings) {}

    /** @return list<CarbonImmutable> */
    public function months(): array
    {
        $fallbackStart = Allocation::query()->min('month');
        $fallbackEnd = Allocation::query()->max('month');
        $start = $this->dateSetting(SettingKey::ActivePeriodStart)
            ?? ($fallbackStart === null ? now()->startOfMonth()->toImmutable() : CarbonImmutable::parse($fallbackStart));
        $end = $this->dateSetting(SettingKey::ActivePeriodEnd)
            ?? ($fallbackEnd === null ? $start->addMonths(5) : CarbonImmutable::parse($fallbackEnd));

        if ($start->isAfter($end)) {
            [$start, $end] = [$end, $start];
        }

        $months = [];

        for ($month = $start->startOfMonth(); $month->lessThanOrEqualTo($end) && count($months) < 36; $month = $month->addMonth()) {
            $months[] = $month;
        }

        return $months;
    }

    /** @return list<string> */
    public function monthKeys(): array
    {
        return array_map(fn (CarbonImmutable $month): string => $month->format('Y-m'), $this->months());
    }

    public function label(CarbonInterface $month): string
    {
        return __('dates.months_short.'.$month->month)." '".$month->format('y');
    }

    private function dateSetting(SettingKey $key): ?CarbonImmutable
    {
        $value = $this->settings->value($key);

        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        try {
            return CarbonImmutable::parse($value)->startOfMonth();
        } catch (Throwable) {
            return null;
        }
    }
}
