import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

type HoursRow = {
    label: string;
    hours: number;
};

export type SummaryChartData = {
    timeline: Array<{
        key: string;
        label: string;
        hours: number;
        projects: HoursRow[];
    }>;
    projects: HoursRow[];
    people: Array<{
        key: string;
        name: string;
        hours: number;
        tasks: number;
        projects: HoursRow[];
    }>;
};

const chartColors = [
    'bg-chart-1',
    'bg-chart-2',
    'bg-chart-3',
    'bg-chart-4',
    'bg-chart-5',
];

function hours(value: number): string {
    return `${value.toLocaleString('ro-RO', { maximumFractionDigits: 2 })}h`;
}

function projectColor(label: string, projectLabels: string[]): string {
    const index = Math.max(projectLabels.indexOf(label), 0);

    return chartColors[index % chartColors.length];
}

function HorizontalHoursChart({
    rows,
    projectLabels,
    colorByProject = false,
}: {
    rows: HoursRow[];
    projectLabels: string[];
    colorByProject?: boolean;
}) {
    const maximumHours = Math.max(...rows.map((row) => row.hours), 1);

    return (
        <div className="flex flex-col gap-4" role="img">
            {rows.map((row, index) => (
                <div key={row.label} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate font-medium">
                            {row.label}
                        </span>
                        <span className="shrink-0 text-muted-foreground tabular-nums">
                            {hours(row.hours)}
                        </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                            className={cn(
                                'h-full rounded-full',
                                colorByProject
                                    ? projectColor(row.label, projectLabels)
                                    : chartColors[index % chartColors.length],
                            )}
                            style={{
                                width: `${Math.max((row.hours / maximumHours) * 100, 1.5)}%`,
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}

function ProjectLegend({ projectLabels }: { projectLabels: string[] }) {
    return (
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            {projectLabels.map((label) => (
                <span key={label} className="inline-flex items-center gap-1.5">
                    <span
                        className={cn(
                            'size-2.5 rounded-sm',
                            projectColor(label, projectLabels),
                        )}
                    />
                    {label}
                </span>
            ))}
        </div>
    );
}

export function SummaryCharts({
    data,
    periodLabel,
    periodType,
}: {
    data: SummaryChartData;
    periodLabel: string;
    periodType: 'week' | 'month';
}) {
    if (data.projects.length === 0) {
        return null;
    }

    const projectLabels = data.projects.map((project) => project.label);
    const maximumTimelineHours = Math.max(
        ...data.timeline.map((bucket) => bucket.hours),
        1,
    );
    const peopleRows = data.people.map((person) => ({
        label: person.name,
        hours: person.hours,
    }));

    return (
        <div className="grid gap-4 lg:grid-cols-2">
            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle>Evoluția orelor</CardTitle>
                    <CardDescription>
                        {periodType === 'month'
                            ? `Ore grupate pe săptămâni în ${periodLabel}.`
                            : `Ore grupate pe zile în ${periodLabel}.`}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                    <div
                        className="grid h-48 items-end gap-2 sm:gap-3"
                        style={{
                            gridTemplateColumns: `repeat(${data.timeline.length}, minmax(0, 1fr))`,
                        }}
                        role="img"
                        aria-label="Evoluția orelor în perioada selectată"
                    >
                        {data.timeline.map((bucket) => (
                            <div
                                key={bucket.key}
                                className="flex h-full min-w-0 flex-col justify-end gap-2"
                            >
                                <span className="text-center text-xs text-muted-foreground tabular-nums">
                                    {bucket.hours > 0
                                        ? hours(bucket.hours)
                                        : '—'}
                                </span>
                                <div className="flex h-32 flex-col-reverse overflow-hidden rounded-md bg-muted">
                                    {bucket.projects.map((project) => (
                                        <div
                                            key={project.label}
                                            className={projectColor(
                                                project.label,
                                                projectLabels,
                                            )}
                                            style={{
                                                height: `${(project.hours / maximumTimelineHours) * 100}%`,
                                            }}
                                            title={`${bucket.label} · ${project.label}: ${hours(project.hours)}`}
                                        />
                                    ))}
                                </div>
                                <span className="truncate text-center text-xs font-medium">
                                    {bucket.label}
                                </span>
                            </div>
                        ))}
                    </div>
                    <ProjectLegend projectLabels={projectLabels} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Ore pe proiect</CardTitle>
                    <CardDescription>
                        Proiectele și activitățile interne ordonate după consum.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <HorizontalHoursChart
                        rows={data.projects}
                        projectLabels={projectLabels}
                        colorByProject
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Cine a lucrat</CardTitle>
                    <CardDescription>
                        Contribuția totală a fiecărei persoane în perioadă.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <HorizontalHoursChart
                        rows={peopleRows}
                        projectLabels={projectLabels}
                    />
                </CardContent>
            </Card>

            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle>Mixul de proiecte per persoană</CardTitle>
                    <CardDescription>
                        Cum se împart orele fiecărui om între proiectele
                        selectate.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                    <div className="flex flex-col gap-4" role="img">
                        {data.people.map((person) => (
                            <div
                                key={person.key}
                                className="grid gap-2 md:grid-cols-[minmax(10rem,15rem)_1fr_auto] md:items-center"
                            >
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">
                                        {person.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {person.tasks}{' '}
                                        {person.tasks === 1
                                            ? 'task'
                                            : 'taskuri'}
                                    </p>
                                </div>
                                <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                                    {person.projects.map((project) => (
                                        <div
                                            key={project.label}
                                            className={projectColor(
                                                project.label,
                                                projectLabels,
                                            )}
                                            style={{
                                                width: `${(project.hours / Math.max(person.hours, 1)) * 100}%`,
                                            }}
                                            title={`${project.label}: ${hours(project.hours)}`}
                                        />
                                    ))}
                                </div>
                                <span className="text-right text-sm font-medium tabular-nums">
                                    {hours(person.hours)}
                                </span>
                            </div>
                        ))}
                    </div>
                    <ProjectLegend projectLabels={projectLabels} />
                </CardContent>
            </Card>
        </div>
    );
}
