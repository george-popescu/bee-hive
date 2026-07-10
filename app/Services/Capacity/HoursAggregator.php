<?php

namespace App\Services\Capacity;

use App\Models\ActualAdjustment;
use App\Models\Allocation;
use App\Models\Person;
use App\Models\Project;
use App\Models\TimeEntry;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;

class HoursAggregator
{
    public function plannedForPerson(Person $person, CarbonInterface $month): float
    {
        return (float) $this->plannedQuery($person, $month)->sum('planned_hours');
    }

    public function plannedForProject(Person $person, Project $project, CarbonInterface $month): float
    {
        return (float) $this->plannedQuery($person, $month)
            ->whereBelongsTo($project)
            ->sum('planned_hours');
    }

    public function actualForPerson(Person $person, CarbonInterface $month): ?float
    {
        return $this->actualHours(
            $this->timeEntriesQuery($person, $month),
            $this->adjustmentsQuery($person, $month),
        );
    }

    public function actualForProject(
        Person $person,
        ?Project $project,
        CarbonInterface $month,
    ): ?float {
        $timeEntries = $this->timeEntriesQuery($person, $month);
        $adjustments = $this->adjustmentsQuery($person, $month);

        if ($project === null) {
            $timeEntries->whereNull('project_id');
            $adjustments->whereNull('project_id');
        } else {
            $timeEntries->whereBelongsTo($project);
            $adjustments->whereBelongsTo($project);
        }

        return $this->actualHours($timeEntries, $adjustments);
    }

    /** @return Builder<Allocation> */
    private function plannedQuery(Person $person, CarbonInterface $month): Builder
    {
        return Allocation::query()
            ->whereBelongsTo($person)
            ->whereDate('month', $this->month($month)->toDateString());
    }

    /** @return Builder<TimeEntry> */
    private function timeEntriesQuery(Person $person, CarbonInterface $month): Builder
    {
        $month = $this->month($month);

        return TimeEntry::query()
            ->whereBelongsTo($person)
            ->whereBetween('started_at', [$month->startOfMonth(), $month->endOfMonth()]);
    }

    /** @return Builder<ActualAdjustment> */
    private function adjustmentsQuery(Person $person, CarbonInterface $month): Builder
    {
        return ActualAdjustment::query()
            ->whereBelongsTo($person)
            ->whereDate('month', $this->month($month)->toDateString());
    }

    /**
     * @param  Builder<TimeEntry>  $timeEntries
     * @param  Builder<ActualAdjustment>  $adjustments
     */
    private function actualHours(Builder $timeEntries, Builder $adjustments): ?float
    {
        $hasTimeEntries = (clone $timeEntries)->exists();
        $hasAdjustments = (clone $adjustments)->exists();

        if (! $hasTimeEntries && ! $hasAdjustments) {
            return null;
        }

        $clickUpHours = ((float) $timeEntries->sum('duration_seconds')) / 3600;
        $adjustmentHours = (float) $adjustments->sum('hours_delta');

        return round($clickUpHours + $adjustmentHours, 2);
    }

    private function month(CarbonInterface $month): CarbonImmutable
    {
        return CarbonImmutable::instance($month)->startOfMonth();
    }
}
