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
        $labels = [
            1 => 'Ian',
            2 => 'Feb',
            3 => 'Mar',
            4 => 'Apr',
            5 => 'Mai',
            6 => 'Iun',
            7 => 'Iul',
            8 => 'Aug',
            9 => 'Sep',
            10 => 'Oct',
            11 => 'Nov',
            12 => 'Dec',
        ];

        return $labels[$month->month]." '".$month->format('y');
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
