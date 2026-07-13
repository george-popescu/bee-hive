<?php

namespace App\Services\PmBoard;

use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PmBoardCsvExporter
{
    /** @param array<string, mixed> $board */
    public function response(array $board): StreamedResponse
    {
        $projectLabel = data_get($board, 'selectedProject.label', 'all-projects');
        $start = (string) data_get($board, 'period.start', now()->toDateString());
        $filename = 'pm-board-'.Str::slug(is_string($projectLabel) ? $projectLabel : 'all-projects').'-'.$start.'.csv';

        return response()->streamDownload(function () use ($board): void {
            $stream = fopen('php://output', 'w');

            if ($stream === false) {
                return;
            }

            fwrite($stream, "\xEF\xBB\xBF");
            $this->writeBoard($stream, $board);
            fclose($stream);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Cache-Control' => 'private, no-store, max-age=0',
        ]);
    }

    /**
     * @param  resource  $stream
     * @param  array<string, mixed>  $board
     */
    private function writeBoard($stream, array $board): void
    {
        $scopeLabel = data_get($board, 'selectedProject.label');

        $this->rows($stream, [
            ['PM Board Export'],
            ['Project scope', is_string($scopeLabel) ? $scopeLabel : 'All projects'],
            ['Period', data_get($board, 'period.label')],
            ['Generated at', now()->toIso8601String()],
            [],
            ['Key metrics'],
            ['Worked hours', 'Estimated hours', 'Worked tasks', 'Active tasks', 'To do', 'Selected next week', 'Planned next week', 'Active people'],
            [
                data_get($board, 'kpis.actualHours'),
                data_get($board, 'kpis.plannedHours'),
                data_get($board, 'kpis.workedTasks'),
                data_get($board, 'kpis.activeTasks'),
                data_get($board, 'kpis.todoTasks'),
                data_get($board, 'kpis.selectedTasks'),
                data_get($board, 'kpis.plannedNextWeekHours'),
                data_get($board, 'kpis.activePeople'),
            ],
            [],
            ['Hours over time'],
            ['Period bucket', 'Hours', 'Project breakdown'],
        ]);

        foreach ($this->values(data_get($board, 'summaryCharts.timeline', [])) as $bucket) {
            if (! is_array($bucket)) {
                continue;
            }

            $this->row($stream, [
                $bucket['label'] ?? null,
                $bucket['hours'] ?? null,
                collect($this->values($bucket['projects'] ?? []))->map(fn (mixed $project): string => is_array($project)
                    ? ($project['label'] ?? '').' '.($project['hours'] ?? 0).'h'
                    : '')->filter()->implode(', '),
            ]);
        }

        $this->rows($stream, [
            [],
            ['Hours by project'],
            ['Project', 'Hours'],
        ]);

        foreach ($this->values(data_get($board, 'summaryCharts.projects', [])) as $project) {
            if (is_array($project)) {
                $this->row($stream, [$project['label'] ?? null, $project['hours'] ?? null]);
            }
        }

        $this->rows($stream, [
            [],
            ['Project mix by person'],
            ['Person', 'Hours', 'Tasks', 'Project breakdown'],
        ]);

        foreach ($this->values(data_get($board, 'summaryCharts.people', [])) as $person) {
            if (! is_array($person)) {
                continue;
            }

            $this->row($stream, [
                $person['name'] ?? null,
                $person['hours'] ?? null,
                $person['tasks'] ?? null,
                collect($this->values($person['projects'] ?? []))->map(fn (mixed $project): string => is_array($project)
                    ? ($project['label'] ?? '').' '.($project['hours'] ?? 0).'h'
                    : '')->filter()->implode(', '),
            ]);
        }

        $this->rows($stream, [
            [],
            ['Previous week / worked tasks'],
            ['Project', 'Task', 'Status', 'Owners', 'People and hours', 'Period hours', 'Estimate', 'All-time logged', 'Progress %', 'Start', 'Deadline', 'ClickUp URL'],
        ]);

        foreach ((array) ($board['workedTasks'] ?? []) as $task) {
            if (! is_array($task)) {
                continue;
            }

            $this->row($stream, [
                $task['projectLabel'] ?? null,
                $task['name'] ?? null,
                $task['status'] ?? null,
                implode(', ', (array) ($task['owners'] ?? [])),
                collect($this->values($task['people'] ?? []))->map(fn (mixed $person): string => is_array($person)
                    ? ($person['name'] ?? '').' '.($person['hours'] ?? 0).'h'
                    : '')->filter()->implode(', '),
                $task['periodHours'] ?? null,
                $task['estimateHours'] ?? null,
                $task['totalLoggedHours'] ?? null,
                $task['progress'] ?? null,
                $task['startDate'] ?? null,
                $task['dueDate'] ?? null,
                $task['url'] ?? null,
            ]);
        }

        $this->rows($stream, [
            [],
            ['Work in progress and to do'],
            ['Group', 'Selected', 'Task', 'Status', 'Owners', 'All-time logged', 'Remaining', 'Deadline', 'Progress %', 'Planned hours', 'Allocations', 'ClickUp URL'],
        ]);
        $plans = collect($this->values(data_get($board, 'planning.plans', [])))->keyBy('taskId');

        foreach ((array) ($board['upcomingTasks'] ?? []) as $task) {
            if (! is_array($task)) {
                continue;
            }

            $plan = $plans->get($task['id'] ?? null, []);
            $this->row($stream, [
                ($task['statusGroup'] ?? '') === '0-active' ? 'Active' : 'To do',
                (bool) data_get($plan, 'selected') ? 'Yes' : 'No',
                $task['name'] ?? null,
                $task['status'] ?? null,
                implode(', ', (array) ($task['owners'] ?? [])),
                $task['totalLoggedHours'] ?? null,
                $task['remainingHours'] ?? null,
                $task['dueDate'] ?? null,
                $task['progress'] ?? null,
                data_get($plan, 'totalHours'),
                collect($this->values(data_get($plan, 'allocations', [])))->map(fn (mixed $allocation): string => is_array($allocation)
                    ? ($allocation['name'] ?? '').' '.($allocation['hours'] ?? 0).'h'
                    : '')->filter()->implode(', '),
                $task['url'] ?? null,
            ]);
        }

        $this->rows($stream, [
            [],
            ['People who worked'],
            ['Person', 'Hours', 'Tasks'],
        ]);

        foreach ((array) ($board['peopleWorked'] ?? []) as $person) {
            if (is_array($person)) {
                $this->row($stream, [$person['name'] ?? null, $person['hours'] ?? null, $person['tasks'] ?? null]);
            }
        }

        $this->rows($stream, [
            [],
            ['Resource planning'],
            ['Person', 'Role', 'Planned hours', 'Capacity', 'Remaining', 'Utilization %'],
        ]);
        $resources = collect($this->values(data_get($board, 'planning.resources', [])))->keyBy('id');

        foreach ((array) data_get($board, 'planning.resourceTotals', []) as $total) {
            if (! is_array($total)) {
                continue;
            }

            $resource = $resources->get($total['personId'] ?? null, []);
            $this->row($stream, [
                data_get($resource, 'name'),
                data_get($resource, 'jobRole'),
                $total['plannedHours'] ?? null,
                $total['weeklyCapacityHours'] ?? null,
                $total['remainingHours'] ?? null,
                $total['utilizationPercent'] ?? null,
            ]);
        }

        $this->rows($stream, [
            [],
            ['Gantt'],
            ['Module', 'Task / deliverable', 'Estimate', 'Start', 'End', 'Status', 'Progress %', 'Owners', 'Selected next week', 'ClickUp URL'],
        ]);

        foreach ((array) data_get($board, 'gantt.rows', []) as $task) {
            if (is_array($task)) {
                $this->row($stream, [
                    $task['module'] ?? null,
                    $task['name'] ?? null,
                    $task['estimateHours'] ?? null,
                    $task['startDate'] ?? null,
                    $task['dueDate'] ?? null,
                    $task['status'] ?? null,
                    $task['progress'] ?? null,
                    implode(', ', (array) ($task['owners'] ?? [])),
                    ($task['selected'] ?? false) ? 'Yes' : 'No',
                    $task['url'] ?? null,
                ]);
            }
        }
    }

    /**
     * @param  resource  $stream
     * @param  list<list<mixed>>  $rows
     */
    private function rows($stream, array $rows): void
    {
        foreach ($rows as $row) {
            $this->row($stream, $row);
        }
    }

    /**
     * @param  resource  $stream
     * @param  list<mixed>  $values
     */
    private function row($stream, array $values): void
    {
        $safeValues = array_map(function (mixed $value): string {
            if ($value === null) {
                return '';
            }

            if (is_bool($value)) {
                return $value ? 'Yes' : 'No';
            }

            $string = (string) $value;

            return preg_match('/^[=+\-@]/', $string) === 1 ? "'".$string : $string;
        }, $values);

        fputcsv($stream, $safeValues, ',', '"', '', "\r\n");
    }

    /** @return list<mixed> */
    private function values(mixed $value): array
    {
        return is_array($value) ? array_values($value) : [];
    }
}
