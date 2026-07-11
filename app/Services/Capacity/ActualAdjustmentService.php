<?php

namespace App\Services\Capacity;

use App\Models\ActualAdjustment;
use App\Models\Person;
use App\Models\Project;
use App\Models\User;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use LogicException;

class ActualAdjustmentService
{
    public function create(
        Person $person,
        ?Project $project,
        CarbonInterface $effectiveDate,
        float $hoursDelta,
        string $reason,
        User $author,
        ?string $internalLabel = null,
    ): ActualAdjustment {
        return $this->persist(
            person: $person,
            project: $project,
            effectiveDate: $effectiveDate,
            hoursDelta: $hoursDelta,
            reason: $reason,
            author: $author,
            internalLabel: $internalLabel,
        );
    }

    public function reverse(
        ActualAdjustment $adjustment,
        User $author,
        string $reason,
    ): ActualAdjustment {
        return DB::transaction(function () use ($adjustment, $author, $reason): ActualAdjustment {
            $original = ActualAdjustment::query()
                ->lockForUpdate()
                ->whereKey($adjustment->getKey())
                ->firstOrFail();

            if ($original->reversedBy()->exists()) {
                throw new LogicException('This actual adjustment has already been reversed.');
            }

            return $this->persist(
                person: $original->person,
                project: $original->project,
                effectiveDate: CarbonImmutable::parse($original->effective_date),
                hoursDelta: -((float) $original->hours_delta),
                reason: $reason,
                author: $author,
                internalLabel: $original->internal_label,
                reverses: $original,
            );
        });
    }

    private function persist(
        Person $person,
        ?Project $project,
        CarbonInterface $effectiveDate,
        float $hoursDelta,
        string $reason,
        User $author,
        ?string $internalLabel = null,
        ?ActualAdjustment $reverses = null,
    ): ActualAdjustment {
        $reason = trim($reason);
        $internalLabel = $internalLabel === null ? null : trim($internalLabel);

        if ($hoursDelta === 0.0) {
            throw new InvalidArgumentException('The adjustment must change the actual hours.');
        }

        if ($reason === '') {
            throw new InvalidArgumentException('The adjustment reason is required.');
        }

        if ($project === null && ($internalLabel === null || $internalLabel === '')) {
            throw new InvalidArgumentException('An internal label is required without a project.');
        }

        $effectiveDate = CarbonImmutable::instance($effectiveDate)->startOfDay();

        return ActualAdjustment::query()->create([
            'person_id' => $person->getKey(),
            'project_id' => $project?->getKey(),
            'internal_label' => $project === null ? $internalLabel : null,
            'month' => $effectiveDate->startOfMonth()->toDateString(),
            'effective_date' => $effectiveDate->toDateString(),
            'hours_delta' => $hoursDelta,
            'reason' => $reason,
            'created_by' => $author->getKey(),
            'created_by_name' => $author->name,
            'reverses_adjustment_id' => $reverses?->getKey(),
        ]);
    }
}
