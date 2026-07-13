<?php

namespace App\Services\Dashboard;

use App\Enums\ClickUpLocationKind;
use App\Models\ClickUpFolder;
use App\Models\ClickUpList;
use App\Models\ClickUpTask;
use App\Models\Person;
use App\Models\TimeEntry;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

class DashboardDataQuality
{
    /**
     * @param  list<int>|null  $personIds
     * @param  list<int>|null  $projectIds
     * @return array<string, mixed>
     */
    public function build(
        ?array $personIds,
        ?array $projectIds,
        string $scopeMode,
        CarbonImmutable $start,
        CarbonImmutable $end,
    ): array {
        if ($end->isBefore($start)) {
            return [
                'status' => 'healthy',
                'entryCount' => 0,
                'totalHours' => 0.0,
                'mappedPeoplePercent' => 100.0,
                'mappedProjectsPercent' => 100.0,
                'issues' => [],
            ];
        }

        $entries = TimeEntry::query()->whereBetween('started_at', [$start, $end]);

        if ($projectIds !== null) {
            $entries->whereIn('project_id', $projectIds);
        } elseif ($personIds !== null) {
            $entries->whereIn('person_id', $personIds);
        }

        $total = $this->entryStats(clone $entries);
        $unmappedPeople = $this->entryStats((clone $entries)->whereNull('person_id'));
        $internalListIds = ClickUpList::query()
            ->select('clickup_list_id')
            ->whereIn('click_up_folder_id', ClickUpFolder::query()
                ->select('id')
                ->where('kind', ClickUpLocationKind::Internal));
        $internalTaskIds = ClickUpTask::query()
            ->select('id')
            ->whereIn('clickup_list_id', $internalListIds);
        $unmappedProjects = $this->entryStats((clone $entries)
            ->whereNull('project_id')
            ->where(fn (Builder $query) => $query
                ->whereNull('click_up_task_id')
                ->orWhereNotIn('click_up_task_id', $internalTaskIds)));
        $missingTasks = $this->entryStats((clone $entries)->whereNull('click_up_task_id'));
        $inactivePeople = $this->entryStats((clone $entries)
            ->whereIn('person_id', Person::query()->select('id')->where('active', false)));
        $unmappedLocations = $scopeMode === 'company'
            ? ClickUpFolder::query()
                ->where('active', true)
                ->where('kind', ClickUpLocationKind::Unmapped)
                ->count()
            : 0;
        $issues = [];

        $this->appendIssue(
            issues: $issues,
            key: 'people',
            tone: 'danger',
            title: __('messages.data_quality.unmapped_people_title'),
            detail: __('messages.data_quality.unmapped_people_detail'),
            stats: $unmappedPeople,
        );
        $this->appendIssue(
            issues: $issues,
            key: 'projects',
            tone: 'danger',
            title: __('messages.data_quality.unmapped_projects_title'),
            detail: __('messages.data_quality.unmapped_projects_detail'),
            stats: $unmappedProjects,
        );
        $this->appendIssue(
            issues: $issues,
            key: 'tasks',
            tone: 'warning',
            title: __('messages.data_quality.missing_tasks_title'),
            detail: __('messages.data_quality.missing_tasks_detail'),
            stats: $missingTasks,
        );
        $this->appendIssue(
            issues: $issues,
            key: 'inactive_people',
            tone: 'warning',
            title: __('messages.data_quality.inactive_people_title'),
            detail: __('messages.data_quality.inactive_people_detail'),
            stats: $inactivePeople,
        );

        if ($unmappedLocations > 0) {
            $issues[] = [
                'key' => 'locations',
                'tone' => 'danger',
                'title' => trans_choice('messages.data_quality.unmapped_locations_title', $unmappedLocations, [
                    'count' => $unmappedLocations,
                ]),
                'detail' => __('messages.data_quality.unmapped_locations_detail'),
                'count' => $unmappedLocations,
                'hours' => 0.0,
            ];
        }

        return [
            'status' => collect($issues)->contains('tone', 'danger')
                ? 'critical'
                : ($issues === [] ? 'healthy' : 'warning'),
            'entryCount' => $total['count'],
            'totalHours' => $total['hours'],
            'mappedPeoplePercent' => $this->mappingPercent($total['count'], $unmappedPeople['count']),
            'mappedProjectsPercent' => $this->mappingPercent($total['count'], $unmappedProjects['count']),
            'issues' => $issues,
        ];
    }

    /**
     * @param  Builder<TimeEntry>  $query
     * @return array{count: int, hours: float}
     */
    private function entryStats(Builder $query): array
    {
        $stats = $query
            ->selectRaw('COUNT(*) as entry_count')
            ->selectRaw('COALESCE(SUM(duration_seconds), 0) as aggregate_seconds')
            ->first();

        return [
            'count' => (int) ($stats?->getAttribute('entry_count') ?? 0),
            'hours' => round(((int) ($stats?->getAttribute('aggregate_seconds') ?? 0)) / 3600, 2),
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $issues
     * @param  array{count: int, hours: float}  $stats
     */
    private function appendIssue(
        array &$issues,
        string $key,
        string $tone,
        string $title,
        string $detail,
        array $stats,
    ): void {
        if ($stats['count'] === 0) {
            return;
        }

        $issues[] = [
            'key' => $key,
            'tone' => $tone,
            'title' => $title,
            'detail' => $detail,
            'count' => $stats['count'],
            'hours' => $stats['hours'],
        ];
    }

    private function mappingPercent(int $total, int $unmapped): float
    {
        return $total === 0 ? 100.0 : round((($total - $unmapped) / $total) * 100, 1);
    }
}
