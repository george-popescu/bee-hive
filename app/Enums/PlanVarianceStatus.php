<?php

namespace App\Enums;

enum PlanVarianceStatus: string
{
    case Empty = 'empty';
    case OnPlan = 'on-plan';
    case SignificantVariance = 'significant-variance';
    case Neutral = 'neutral';
    case Unplanned = 'unplanned';
}
