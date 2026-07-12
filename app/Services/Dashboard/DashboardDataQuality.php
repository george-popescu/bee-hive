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
            title: 'Pontaje fără persoană mapată',
            detail: 'Utilizatorul ClickUp nu este asociat unei persoane locale.',
            stats: $unmappedPeople,
        );
        $this->appendIssue(
            issues: $issues,
            key: 'projects',
            tone: 'danger',
            title: 'Pontaje fără proiect mapat',
            detail: 'Locația ClickUp nu este asociată unui proiect sau activităților interne.',
            stats: $unmappedProjects,
        );
        $this->appendIssue(
            issues: $issues,
            key: 'tasks',
            tone: 'warning',
            title: 'Pontaje fără task local',
            detail: 'Taskul ClickUp nu a fost găsit în snapshotul local.',
            stats: $missingTasks,
        );
        $this->appendIssue(
            issues: $issues,
            key: 'inactive_people',
            tone: 'warning',
            title: 'Pontaje pe persoane inactive',
            detail: 'Există activitate în perioadă pentru persoane marcate inactive.',
            stats: $inactivePeople,
        );

        if ($unmappedLocations > 0) {
            $issues[] = [
                'key' => 'locations',
                'tone' => 'danger',
                'title' => $unmappedLocations === 1
                    ? '1 folder ClickUp nemapat'
                    : "$unmappedLocations foldere ClickUp nemapate",
                'detail' => 'Folderul trebuie asociat unui proiect sau marcat drept intern.',
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
