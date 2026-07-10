<?php

namespace App\Services\Capacity;

use App\Enums\SettingKey;
use App\Models\Setting;

class SettingsService
{
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
        $setting = Setting::query()->where('key', $key->value)->first();

        if ($setting === null) {
            return $default;
        }

        return $setting->value['value'] ?? $default;
    }
}
