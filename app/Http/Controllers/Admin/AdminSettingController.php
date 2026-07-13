<?php

namespace App\Http\Controllers\Admin;

use App\Enums\SettingKey;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateSettingsRequest;
use App\Models\Setting;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;

class AdminSettingController extends Controller
{
    public function update(UpdateSettingsRequest $request, AuditLogger $audit): JsonResponse|RedirectResponse
    {
        $data = $request->validated();
        $values = [
            SettingKey::DefaultMonthlyCapacityHours->value => [$data['default_monthly_capacity_hours'], 'capacity'],
            SettingKey::HoursPerLeaveDay->value => [$data['hours_per_leave_day'], 'capacity'],
            SettingKey::ActivePeriodStart->value => [$data['active_period_start'] ?? null, 'planning'],
            SettingKey::ActivePeriodEnd->value => [$data['active_period_end'] ?? null, 'planning'],
        ];

        DB::transaction(function () use ($request, $audit, $values): void {
            $before = [];
            $subject = null;

            foreach ($values as $key => [$value, $group]) {
                $setting = Setting::query()->firstOrNew(['key' => $key]);
                $before[$this->payloadKey($key)] = $setting->exists ? data_get($setting->value, 'value') : null;
                $setting->fill(['group' => $group, 'value' => ['value' => $value]])->save();
                $subject ??= $setting;
            }

            $audit->log($request->user(), $subject, 'settings.updated', $before, [
                'active_period_start' => $values[SettingKey::ActivePeriodStart->value][0],
                'active_period_end' => $values[SettingKey::ActivePeriodEnd->value][0],
                'default_monthly_capacity_hours' => $values[SettingKey::DefaultMonthlyCapacityHours->value][0],
                'hours_per_leave_day' => $values[SettingKey::HoursPerLeaveDay->value][0],
            ]);
        });

        if ($request->expectsJson()) {
            return response()->json(['updated' => true]);
        }

        return back(status: 303)->with('success', __('messages.admin.settings_updated'));
    }

    private function payloadKey(string $settingKey): string
    {
        return match ($settingKey) {
            SettingKey::ActivePeriodStart->value => 'active_period_start',
            SettingKey::ActivePeriodEnd->value => 'active_period_end',
            SettingKey::DefaultMonthlyCapacityHours->value => 'default_monthly_capacity_hours',
            SettingKey::HoursPerLeaveDay->value => 'hours_per_leave_day',
            default => $settingKey,
        };
    }
}
