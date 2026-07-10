<?php

namespace App\Enums;

enum TimeOffStatus: string
{
    case RequiresApproval = 'requires approval';
    case OnLeave = 'on leave';
    case Approved = 'approved';
    case Complete = 'complete';

    public function reducesCapacity(): bool
    {
        return match ($this) {
            self::OnLeave, self::Approved, self::Complete => true,
            self::RequiresApproval => false,
        };
    }

    public static function reducesCapacityFor(string $status): bool
    {
        return self::tryFrom(strtolower(trim($status)))?->reducesCapacity() ?? false;
    }
}
