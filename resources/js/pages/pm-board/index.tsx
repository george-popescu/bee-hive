import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    ExternalLink,
    LayoutDashboard,
    RefreshCw,
} from 'lucide-react';
import { useState } from 'react';
import { store as syncClickUp } from '@/actions/App/Http/Controllers/ClickUpSyncController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { index as pmBoardIndex } from '@/routes/pm_board';

type Project = {
    id: number;
    label: string;
    template: 'tm' | 'deliverables';
    templateLabel: string;
    managerIds: number[];
};
type Period = {
    type: 'week' | 'month';
    anchor: string;
    start: string;
    end: string;
    label: string;
    previousAnchor: string;
    nextAnchor: string;
};
type TaskPerson = { name: string; hours: number };
type BoardTask = {
    id: number;
    clickupId: string;
    name: string;
    url: string;
    status: string;
    isDone: boolean;
    active: boolean;
    owners: string[];
    people: TaskPerson[];
    estimateHours: number | null;
    periodHours: number;
    totalLoggedHours: number;
    remainingHours: number | null;
    progress: number | null;
    isOverrun: boolean;
    startDate: string | null;
    dueDate: string | null;
};
type Props = {
    projects: Project[];
    managers: Array<{ id: number; name: string }>;
    selectedPmId: number | null;
    selectedProject: Project | null;
    period: Period;
    workedTasks: BoardTask[];
    upcomingTasks: BoardTask[];
    peopleWorked: Array<{ name: string; hours: number; tasks: number }>;
    kpis: {
        plannedHours: number;
        actualHours: number;
        workedTasks: number;
        plannedTasks: number;
        activePeople: number;
        projects: number;
    };
    sync: {
        status: string;
        startedAt: string | null;
        finishedAt: string | null;
        error: string | null;
    } | null;
    permissions: { managePlanning: boolean; syncClickUp: boolean };
};
type Section = 'summary' | 'worked' | 'upcoming' | 'people';

function hours(value: number | null): string {
    return value === null
        ? '—'
        : `${value.toLocaleString('ro-RO', { maximumFractionDigits: 2 })}h`;
}

function boardHref(
    project: number | null,
    period: Period,
    anchor: string,
    pm: number | null,
) {
    return pmBoardIndex({
        query: {
            ...(project === null ? {} : { project }),
            period: period.type,
            anchor,
            ...(pm === null ? {} : { pm }),
        },
    });
}

function TaskStatus({ task }: { task: BoardTask }) {
    if (task.isDone) {
        return <Badge variant="success">{task.status}</Badge>;
    }

    return (
        <Badge variant={task.isOverrun ? 'destructive' : 'secondary'}>
            {task.status}
        </Badge>
    );
}

function Progress({ task }: { task: BoardTask }) {
    if (task.progress === null) {
        return <span className="text-muted-foreground">Fără estimare</span>;
    }

    return (
        <div className="min-w-28 space-y-1">
            <div className="flex justify-between text-xs tabular-nums">
                <span>{task.progress.toLocaleString('ro-RO')}%</span>
                {task.isOverrun && (
                    <span className="text-destructive">depășire</span>
                )}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                    className={
                        task.isOverrun
                            ? 'h-full bg-destructive'
                            : 'h-full bg-primary'
                    }
                    style={{ width: `${Math.min(task.progress, 100)}%` }}
                />
            </div>
        </div>
    );
}

function EmptyRow({ columns, label }: { columns: number; label: string }) {
    return (
        <TableRow>
            <TableCell
                colSpan={columns}
                className="h-24 text-center text-muted-foreground"
            >
                {label}
            </TableCell>
        </TableRow>
    );
}

export default function PmBoard({
    projects,
    managers,
    selectedPmId,
    selectedProject,
    period,
    workedTasks,
    upcomingTasks,
    peopleWorked,
    kpis,
    sync,
    permissions,
}: Props) {
    const [section, setSection] = useState<Section>('summary');
    const [displayMode, setDisplayMode] = useState<'presentation' | 'edit'>(
        'presentation',
    );
    const currentProjectId = selectedProject?.id ?? null;
    const navigate = (
        project: number | null,
        periodType = period.type,
        anchor = period.anchor,
        pm = selectedPmId,
    ) => {
        router.visit(
            pmBoardIndex({
                query: {
                    ...(project === null ? {} : { project }),
                    period: periodType,
                    anchor,
                    ...(pm === null ? {} : { pm }),
                },
            }),
            { preserveScroll: true },
        );
    };

    return (
        <>
            <Head title="Board-uri PM" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-hidden p-4">
                <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <LayoutDashboard className="size-6" />
                            <h1 className="text-2xl font-semibold tracking-tight">
                                Board-uri PM
                            </h1>
                        </div>
                        <p className="max-w-3xl text-sm text-muted-foreground">
                            Situația proiectului din ClickUp: efort consumat,
                            estimări, progres și echipa activă în perioada
                            aleasă.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {managers.length > 0 && (
                            <Select
                                value={selectedPmId?.toString() ?? 'all'}
                                onValueChange={(value) =>
                                    navigate(
                                        null,
                                        period.type,
                                        period.anchor,
                                        value === 'all' ? null : Number(value),
                                    )
                                }
                            >
                                <SelectTrigger className="w-48">
                                    <SelectValue placeholder="Toți PM-ii" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        Toți PM-ii
                                    </SelectItem>
                                    {managers.map((manager) => (
                                        <SelectItem
                                            key={manager.id}
                                            value={manager.id.toString()}
                                        >
                                            {manager.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        <ToggleGroup
                            type="single"
                            variant="outline"
                            value={displayMode}
                            onValueChange={(value) => {
                                if (value) {
                                    setDisplayMode(value as typeof displayMode);
                                }
                            }}
                        >
                            <ToggleGroupItem value="presentation">
                                Prezentare
                            </ToggleGroupItem>
                            {permissions.managePlanning && (
                                <ToggleGroupItem value="edit">
                                    Editare
                                </ToggleGroupItem>
                            )}
                        </ToggleGroup>
                        {permissions.syncClickUp && (
                            <Button
                                variant="outline"
                                onClick={() =>
                                    router.post(
                                        syncClickUp().url,
                                        {},
                                        {
                                            preserveScroll: true,
                                        },
                                    )
                                }
                            >
                                <RefreshCw /> Actualizează ClickUp
                            </Button>
                        )}
                    </div>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                    {projects.map((project) => (
                        <Button
                            key={project.id}
                            asChild
                            variant={
                                project.id === currentProjectId
                                    ? 'default'
                                    : 'outline'
                            }
                            className="shrink-0"
                        >
                            <Link
                                href={boardHref(
                                    project.id,
                                    period,
                                    period.anchor,
                                    selectedPmId,
                                )}
                                preserveScroll
                            >
                                {project.label}
                                <Badge variant="secondary">
                                    {project.templateLabel}
                                </Badge>
                            </Link>
                        </Button>
                    ))}
                </div>

                {selectedProject === null ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>Niciun proiect disponibil</CardTitle>
                            <CardDescription>
                                Filtrul curent sau permisiunile tale nu includ
                                proiecte vizibile în board.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                ) : (
                    <>
                        <Card>
                            <CardContent className="flex flex-col justify-between gap-4 pt-6 lg:flex-row lg:items-center">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="text-xl font-semibold">
                                            {selectedProject.label}
                                        </h2>
                                        <Badge variant="outline">
                                            {selectedProject.templateLabel}
                                        </Badge>
                                        {displayMode === 'edit' && (
                                            <Badge variant="warning">
                                                Mod editare
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {sync?.status === 'failed'
                                            ? `Ultima sincronizare a eșuat${sync.error ? `: ${sync.error}` : '.'}`
                                            : 'Ultima sincronizare: '}
                                        {sync?.status !== 'failed' &&
                                        sync?.finishedAt
                                            ? new Date(
                                                  sync.finishedAt,
                                              ).toLocaleString('ro-RO')
                                            : sync?.status !== 'failed' &&
                                                sync?.startedAt
                                              ? 'în curs'
                                              : sync?.status !== 'failed'
                                                ? 'nu există încă'
                                                : ''}
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <ToggleGroup
                                        type="single"
                                        variant="outline"
                                        value={period.type}
                                        onValueChange={(value) => {
                                            if (value) {
                                                navigate(
                                                    currentProjectId,
                                                    value as Period['type'],
                                                );
                                            }
                                        }}
                                    >
                                        <ToggleGroupItem value="week">
                                            Săptămână
                                        </ToggleGroupItem>
                                        <ToggleGroupItem value="month">
                                            Lună
                                        </ToggleGroupItem>
                                    </ToggleGroup>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        asChild
                                    >
                                        <Link
                                            href={boardHref(
                                                currentProjectId,
                                                period,
                                                period.previousAnchor,
                                                selectedPmId,
                                            )}
                                            preserveScroll
                                            aria-label="Perioada anterioară"
                                        >
                                            <ArrowLeft />
                                        </Link>
                                    </Button>
                                    <span className="min-w-48 text-center text-sm font-medium">
                                        {period.label}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        asChild
                                    >
                                        <Link
                                            href={boardHref(
                                                currentProjectId,
                                                period,
                                                period.nextAnchor,
                                                selectedPmId,
                                            )}
                                            preserveScroll
                                            aria-label="Perioada următoare"
                                        >
                                            <ArrowRight />
                                        </Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                            {[
                                ['Ore lucrate', hours(kpis.actualHours)],
                                [
                                    'Estimare taskuri lucrate',
                                    hours(kpis.plannedHours),
                                ],
                                ['Taskuri lucrate', String(kpis.workedTasks)],
                                [
                                    'Taskuri active estimate',
                                    String(kpis.plannedTasks),
                                ],
                                ['Oameni activi', String(kpis.activePeople)],
                            ].map(([label, value]) => (
                                <Card key={label}>
                                    <CardHeader className="pb-2">
                                        <CardDescription>
                                            {label}
                                        </CardDescription>
                                        <CardTitle className="text-2xl tabular-nums">
                                            {value}
                                        </CardTitle>
                                    </CardHeader>
                                </Card>
                            ))}
                        </div>

                        <ToggleGroup
                            type="single"
                            variant="outline"
                            value={section}
                            onValueChange={(value) => {
                                if (value) {
                                    setSection(value as Section);
                                }
                            }}
                            className="flex-wrap justify-start"
                        >
                            <ToggleGroupItem value="summary">
                                Sumar
                            </ToggleGroupItem>
                            <ToggleGroupItem value="worked">
                                Lucrat în perioadă
                            </ToggleGroupItem>
                            <ToggleGroupItem value="upcoming">
                                Urmează
                            </ToggleGroupItem>
                            <ToggleGroupItem value="people">
                                Echipa activă
                            </ToggleGroupItem>
                        </ToggleGroup>

                        {section === 'summary' && (
                            <div className="grid gap-4 lg:grid-cols-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>
                                            Consum în perioadă
                                        </CardTitle>
                                        <CardDescription>
                                            Primele taskuri după orele pontate.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {workedTasks.slice(0, 5).map((task) => (
                                            <div
                                                key={task.id}
                                                className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                                            >
                                                <a
                                                    href={task.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="line-clamp-1 font-medium hover:underline"
                                                >
                                                    {task.name}
                                                </a>
                                                <span className="shrink-0 tabular-nums">
                                                    {hours(task.periodHours)}
                                                </span>
                                            </div>
                                        ))}
                                        {workedTasks.length === 0 && (
                                            <p className="text-sm text-muted-foreground">
                                                Nu există pontaje în perioada
                                                aleasă.
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>De urmărit</CardTitle>
                                        <CardDescription>
                                            Taskuri active ordonate după status
                                            și termen.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {upcomingTasks
                                            .slice(0, 5)
                                            .map((task) => (
                                                <div
                                                    key={task.id}
                                                    className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                                                >
                                                    <div className="min-w-0">
                                                        <a
                                                            href={task.url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="line-clamp-1 font-medium hover:underline"
                                                        >
                                                            {task.name}
                                                        </a>
                                                        <span className="text-xs text-muted-foreground">
                                                            {task.dueDate ??
                                                                'fără termen'}
                                                        </span>
                                                    </div>
                                                    <TaskStatus task={task} />
                                                </div>
                                            ))}
                                        {upcomingTasks.length === 0 && (
                                            <p className="text-sm text-muted-foreground">
                                                Nu există taskuri active.
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {section === 'worked' && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Taskuri lucrate</CardTitle>
                                    <CardDescription>
                                        Orele din {period.label}; progresul
                                        folosește toate pontajele istorice ale
                                        taskului.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Task</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>
                                                    Contribuitori
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    Perioadă
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    Total
                                                </TableHead>
                                                <TableHead>Progres</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {workedTasks.map((task) => (
                                                <TableRow key={task.id}>
                                                    <TableCell>
                                                        <a
                                                            href={task.url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex items-center gap-1 font-medium hover:underline"
                                                        >
                                                            {task.name}
                                                            <ExternalLink className="size-3" />
                                                        </a>
                                                    </TableCell>
                                                    <TableCell>
                                                        <TaskStatus
                                                            task={task}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {task.people
                                                            .map(
                                                                (person) =>
                                                                    `${person.name} · ${hours(person.hours)}`,
                                                            )
                                                            .join(', ') || '—'}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        {hours(
                                                            task.periodHours,
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        {hours(
                                                            task.totalLoggedHours,
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Progress task={task} />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {workedTasks.length === 0 && (
                                                <EmptyRow
                                                    columns={6}
                                                    label="Nu există pontaje în perioada aleasă."
                                                />
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        )}

                        {section === 'upcoming' && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Taskuri active</CardTitle>
                                    <CardDescription>
                                        Ownership, termen și efort rămas față de
                                        estimarea ClickUp.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Task</TableHead>
                                                <TableHead>Owner</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Termen</TableHead>
                                                <TableHead className="text-right">
                                                    Estimat
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    Rămas
                                                </TableHead>
                                                <TableHead>Progres</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {upcomingTasks.map((task) => (
                                                <TableRow key={task.id}>
                                                    <TableCell>
                                                        <a
                                                            href={task.url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="font-medium hover:underline"
                                                        >
                                                            {task.name}
                                                        </a>
                                                    </TableCell>
                                                    <TableCell>
                                                        {task.owners.join(
                                                            ', ',
                                                        ) || 'Nealocat'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <TaskStatus
                                                            task={task}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        {task.dueDate ?? '—'}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        {hours(
                                                            task.estimateHours,
                                                        )}
                                                    </TableCell>
                                                    <TableCell
                                                        className={
                                                            task.isOverrun
                                                                ? 'text-right text-destructive tabular-nums'
                                                                : 'text-right tabular-nums'
                                                        }
                                                    >
                                                        {hours(
                                                            task.remainingHours,
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Progress task={task} />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {upcomingTasks.length === 0 && (
                                                <EmptyRow
                                                    columns={7}
                                                    label="Nu există taskuri active."
                                                />
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        )}

                        {section === 'people' && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Echipa activă</CardTitle>
                                    <CardDescription>
                                        Persoanele cu pontaje în perioada
                                        selectată.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Persoană</TableHead>
                                                <TableHead className="text-right">
                                                    Taskuri
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    Ore
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {peopleWorked.map((person) => (
                                                <TableRow key={person.name}>
                                                    <TableCell className="font-medium">
                                                        {person.name}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        {person.tasks}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        {hours(person.hours)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {peopleWorked.length === 0 && (
                                                <EmptyRow
                                                    columns={3}
                                                    label="Nu există persoane cu pontaje în perioada aleasă."
                                                />
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        )}
                    </>
                )}
            </div>
        </>
    );
}
