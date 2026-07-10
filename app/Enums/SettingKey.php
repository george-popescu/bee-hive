<?php

namespace App\Enums;

enum SettingKey: string
{
    case DefaultMonthlyCapacityHours = 'capacity.default_monthly_hours';
    case HoursPerLeaveDay = 'capacity.hours_per_leave_day';
    case ActivePeriodStart = 'planning.active_period_start';
    case ActivePeriodEnd = 'planning.active_period_end';
}
