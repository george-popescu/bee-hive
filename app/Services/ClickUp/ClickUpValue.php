<?php

namespace App\Services\ClickUp;

use Carbon\CarbonImmutable;
use DateTimeInterface;
use Illuminate\Support\Str;

final class ClickUpValue
{
    public static function stringId(mixed $value): ?string
    {
        if (! is_int($value) && ! is_string($value)) {
            return null;
        }

        $id = trim((string) $value);

        return $id === '' ? null : $id;
    }

    public static function dateTime(mixed $value): ?CarbonImmutable
    {
        if ($value instanceof DateTimeInterface) {
            return CarbonImmutable::instance($value)->utc();
        }

        if (! is_numeric($value)) {
            return null;
        }

        return CarbonImmutable::createFromTimestampMsUTC((int) $value);
    }

    public static function date(mixed $value): ?CarbonImmutable
    {
        return self::dateTime($value)?->setTimezone(config('app.timezone'))->startOfDay();
    }

    public static function status(mixed $value): ?string
    {
        if (is_array($value)) {
            $value = $value['status'] ?? null;
        }

        if (! is_string($value)) {
            return null;
        }

        $status = trim($value);

        return $status === '' ? null : $status;
    }

    public static function normalizedName(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $name = Str::of($value)->ascii()->lower()->squish()->toString();

        return $name === '' ? null : $name;
    }
}
