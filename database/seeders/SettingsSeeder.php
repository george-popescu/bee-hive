<?php

namespace Database\Seeders;

use App\Enums\SettingKey;
use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $settings = [
            SettingKey::DefaultMonthlyCapacityHours->value => [
                'group' => 'capacity',
                'value' => ['value' => 138],
            ],
            SettingKey::HoursPerLeaveDay->value => [
                'group' => 'capacity',
                'value' => ['value' => 8],
            ],
            SettingKey::ActivePeriodStart->value => [
                'group' => 'planning',
                'value' => ['value' => null],
            ],
            SettingKey::ActivePeriodEnd->value => [
                'group' => 'planning',
                'value' => ['value' => null],
            ],
        ];

        foreach ($settings as $key => $attributes) {
            Setting::query()->firstOrCreate(['key' => $key], $attributes);
        }
    }
}
