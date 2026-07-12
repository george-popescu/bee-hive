<?php

namespace App\Services\Capacity;

use App\Enums\SettingKey;
use App\Models\Setting;

class SettingsService
{
    /** @var array<string, mixed> */
    private array $resolvedValues = [];

    public function hoursPerLeaveDay(): float
    {
        return (float) $this->value(SettingKey::HoursPerLeaveDay, 8);
    }

    public function defaultMonthlyCapacityHours(): float
    {
        return (float) $this->value(SettingKey::DefaultMonthlyCapacityHours, 138);
    }

    public function value(SettingKey $key, mixed $default = null): mixed
    {
        if (array_key_exists($key->value, $this->resolvedValues)) {
            return $this->resolvedValues[$key->value];
        }

        $setting = Setting::query()->where('key', $key->value)->first();

        if ($setting === null) {
            return $this->resolvedValues[$key->value] = $default;
        }

        return $this->resolvedValues[$key->value] = $setting->value['value'] ?? $default;
    }
}
