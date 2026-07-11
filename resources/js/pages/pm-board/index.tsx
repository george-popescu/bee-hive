import { Head, Link, router, useHttp } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    ChevronDown,
    ExternalLink,
    LayoutDashboard,
    RefreshCw,
    Save,
    Star,
} from 'lucide-react';
import { Fragment, useState } from 'react';
import { toast } from 'sonner';
import { store as syncClickUp } from '@/actions/App/Http/Controllers/ClickUpSyncController';
import { upsert as upsertWeeklyPlanning } from '@/actions/App/Http/Controllers/WeeklyPlanningController';
import { SummaryCharts } from '@/components/pm-board/summary-charts';
import type { SummaryChartData } from '@/components/pm-board/summary-charts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectGroup,
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
    periodHours: number;
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
    projectLabel: string;
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
type PlanningAllocation = { personId: number; name: string; hours: number };
type PlanningRow = {
    taskId: number;
    selected: boolean;
    updatedAt: string | null;
    version: number | null;
    totalHours: number;
    allocations: PlanningAllocation[];
};
type PlanningResource = {
    id: number;
    name: string;
    jobRole: string | null;
    weeklyCapacityHours: number;
};
type Planning = {
    weekStart: string;
    plans: PlanningRow[];
    resources: PlanningResource[];
    resourceTotals: Array<{
        personId: number;
        plannedHours: number;
        weeklyCapacityHours: number;
        remainingHours: number;
    }>;
};
type Gantt = {
    weeks: Array<{
        key: string;
        label: string;
        start: string;
        end: string;
        isCurrent: boolean;
    }>;
    rows: Array<{
        id: number;
        name: string;
        url: string;
        status: string;
        owners: string[];
        estimateHours: number | null;
        progress: number | null;
        startDate: string | null;
        dueDate: string | null;
        selected: boolean;
    }>;
};
type Props = {
    projects: Project[];
    managers: Array<{ id: number; name: string }>;
    selectedPmId: number | null;
    allProjectsSelected: boolean;
    selectedProjectIds: number[];
    includeInternal: boolean;
    internalOption: {
        label: string;
        periodHours: number;
        available: boolean;
    };
    selectedProject: Project | null;
    period: Period;
    workedTasks: BoardTask[];
    upcomingTasks: BoardTask[];
    peopleWorked: Array<{ name: string; hours: number; tasks: number }>;
    summaryCharts: SummaryChartData;
    planning: Planning | null;
    gantt: Gantt | null;
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
type Section =
    'summary' | 'worked' | 'upcoming' | 'people' | 'planning' | 'gantt';
type WeeklyPlanningPayload = {
    project_id: number;
    click_up_task_id: number;
    week_start: string;
    selected: boolean;
    allocations: Array<{ person_id: number; hours: number }>;
    version: number | null;
};
type WeeklyPlanningResponse = {
    plan: { id: number; selected: boolean; version: number; updatedAt: string };
};
type ProjectSelection = {
    all: boolean;
    projectIds: number[];
    includeInternal: boolean;
};

function hours(value: number | null): string {
    return value === null
        ? '—'
        : `${value.toLocaleString('ro-RO', { maximumFractionDigits: 2 })}h`;
}

function boardHref(
    selection: ProjectSelection,
    period: Period,
    anchor: string,
    pm: number | null,
) {
    return pmBoardIndex({
        query: {
            ...selectionQuery(selection),
            period: period.type,
            anchor,
            ...(pm === null ? {} : { pm }),
        },
    });
}

function selectionQuery(selection: ProjectSelection) {
    if (selection.all) {
        return {};
    }

    if (selection.projectIds.length === 1 && !selection.includeInternal) {
        return { project: selection.projectIds[0] };
    }

    return {
        selection: 'custom',
        projects: selection.projectIds,
        ...(selection.includeInternal ? { include_internal: true } : {}),
    };
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

function DeliverableTaskRows({
    task,
    projectId,
    planning,
    editable,
}: {
    task: BoardTask;
    projectId: number;
    planning: Planning;
    editable: boolean;
}) {
    const plan = planning.plans.find((item) => item.taskId === task.id);
    const [selected, setSelected] = useState(plan?.selected ?? false);
    const [confirmedSelected, setConfirmedSelected] = useState(
        plan?.selected ?? false,
    );
    const [version, setVersion] = useState(plan?.version ?? null);
    const [drafts, setDrafts] = useState<Record<number, string>>(
        Object.fromEntries(
            (plan?.allocations ?? []).map((allocation) => [
                allocation.personId,
                String(allocation.hours),
            ]),
        ),
    );
    const form = useHttp<WeeklyPlanningPayload, WeeklyPlanningResponse>(
        upsertWeeklyPlanning(),
        {
            project_id: projectId,
            click_up_task_id: task.id,
            week_start: planning.weekStart,
            selected,
            allocations:
                plan?.allocations.map((allocation) => ({
                    person_id: allocation.personId,
                    hours: allocation.hours,
                })) ?? [],
            version,
        },
    );
    const save = (nextSelected = selected) => {
        const allocations = planning.resources.map((resource) => ({
            person_id: resource.id,
            hours: Number((drafts[resource.id] ?? '').replace(',', '.')) || 0,
        }));
        form.setData({
            project_id: projectId,
            click_up_task_id: task.id,
            week_start: planning.weekStart,
            selected: nextSelected,
            allocations,
            version,
        });
        const rollback = () => {
            setSelected(confirmedSelected);
            router.reload({ only: ['planning', 'gantt'] });
        };
        void form
            .put(upsertWeeklyPlanning.url(), {
                onSuccess: (response) => {
                    setSelected(response.plan.selected);
                    setConfirmedSelected(response.plan.selected);
                    setVersion(response.plan.version);
                    toast.success('Planificarea săptămânală a fost salvată.');
                    router.reload({ only: ['planning', 'gantt'] });
                },
                onHttpException: () => {
                    rollback();
                    toast.error(
                        'Planificarea s-a schimbat între timp. Reîncarcă și încearcă din nou.',
                    );
                },
                onError: () => {
                    rollback();
                    toast.error('Planificarea nu a putut fi salvată.');
                },
                onNetworkError: () => {
                    rollback();
                    toast.error(
                        'Conexiunea a eșuat. Modificările nu s-au salvat.',
                    );
                },
            })
            .catch(() => undefined);
    };

    return (
        <Fragment>
            <TableRow className={selected ? 'bg-primary/5' : undefined}>
                <TableCell>
                    {editable ? (
                        <Checkbox
                            aria-label={`Planifică ${task.name}`}
                            checked={selected}
                            disabled={form.processing}
                            onCheckedChange={(checked) => {
                                const nextSelected = checked === true;
                                setSelected(nextSelected);
                                save(nextSelected);
                            }}
                        />
                    ) : selected ? (
                        <Star className="size-4 fill-warning text-warning" />
                    ) : (
                        '—'
                    )}
                </TableCell>
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
                <TableCell>{task.owners.join(', ') || 'Nealocat'}</TableCell>
                <TableCell>
                    <TaskStatus task={task} />
                </TableCell>
                <TableCell>{task.dueDate ?? '—'}</TableCell>
                <TableCell className="text-right tabular-nums">
                    {hours(task.estimateHours)}
                </TableCell>
                <TableCell
                    className={
                        task.isOverrun
                            ? 'text-right text-destructive tabular-nums'
                            : 'text-right tabular-nums'
                    }
                >
                    {hours(task.remainingHours)}
                </TableCell>
                <TableCell>
                    <Progress task={task} />
                </TableCell>
            </TableRow>
            {editable && selected && (
                <TableRow className="bg-muted/30">
                    <TableCell colSpan={8}>
                        <div className="flex flex-wrap items-end gap-3 py-2">
                            {planning.resources.map((resource) => (
                                <label
                                    key={resource.id}
                                    className="grid gap-1 text-xs text-muted-foreground"
                                >
                                    {resource.name}
                                    <Input
                                        className="h-8 w-28"
                                        inputMode="decimal"
                                        min={0}
                                        max={168}
                                        step={0.25}
                                        type="number"
                                        value={drafts[resource.id] ?? ''}
                                        onChange={(event) =>
                                            setDrafts((current) => ({
                                                ...current,
                                                [resource.id]:
                                                    event.target.value,
                                            }))
                                        }
                                        placeholder="0h"
                                    />
                                </label>
                            ))}
                            <Button
                                size="sm"
                                disabled={form.processing}
                                onClick={() => save()}
                            >
                                <Save /> Salvează orele
                            </Button>
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </Fragment>
    );
}

function ganttCellClass(status: string): string {
    const normalized = status.toLocaleLowerCase('ro');

    if (
        normalized.includes('done') ||
        normalized.includes('complete') ||
        normalized.includes('closed')
    ) {
        return 'bg-success/70';
    }

    if (
        normalized.includes('progress') ||
        normalized.includes('review') ||
        normalized.includes('qa')
    ) {
        return 'bg-primary/70';
    }

    if (normalized.includes('pending') || normalized.includes('ready')) {
        return 'bg-warning/70';
    }

    return 'bg-muted-foreground/25';
}

export default function PmBoard({
    projects,
    managers,
    selectedPmId,
    allProjectsSelected,
    selectedProjectIds,
    includeInternal,
    internalOption,
    selectedProject,
    period,
    workedTasks,
    upcomingTasks,
    peopleWorked,
    summaryCharts,
    planning,
    gantt,
    kpis,
    sync,
    permissions,
}: Props) {
    const [section, setSection] = useState<Section>('summary');
    const [displayMode, setDisplayMode] = useState<'presentation' | 'edit'>(
        'presentation',
    );
    const [projectSelectorOpen, setProjectSelectorOpen] = useState(false);
    const [draftAllProjects, setDraftAllProjects] =
        useState(allProjectsSelected);
    const [draftProjectIds, setDraftProjectIds] =
        useState<number[]>(selectedProjectIds);
    const [draftIncludeInternal, setDraftIncludeInternal] =
        useState(includeInternal);
    const currentSelection: ProjectSelection = {
        all: allProjectsSelected,
        projectIds: selectedProjectIds,
        includeInternal,
    };
    const allPeriodHours =
        projects.reduce((total, project) => total + project.periodHours, 0) +
        internalOption.periodHours;
    const selectedPeriodHours =
        projects
            .filter((project) => selectedProjectIds.includes(project.id))
            .reduce((total, project) => total + project.periodHours, 0) +
        (includeInternal ? internalOption.periodHours : 0);
    const selectedItemsCount =
        selectedProjectIds.length + (includeInternal ? 1 : 0);
    const selectedItemsLabel =
        selectedItemsCount === 1
            ? '1 selecție'
            : `${selectedItemsCount} selecții`;
    const selectionHeading = allProjectsSelected
        ? 'Toate proiectele'
        : selectedProject
          ? selectedProject.label
          : selectedProjectIds.length === 0 && includeInternal
            ? internalOption.label
            : 'Selecție personalizată';
    const selectionBadge = allProjectsSelected
        ? `${projects.length} proiecte${internalOption.available ? ' + interne' : ''}`
        : selectedProject
          ? selectedProject.templateLabel
          : selectedItemsLabel;
    const selectorLabel = allProjectsSelected
        ? `Toate proiectele · ${hours(allPeriodHours)}`
        : selectedProject
          ? `${selectedProject.label} · ${hours(selectedPeriodHours)}`
          : selectedProjectIds.length === 0 && includeInternal
            ? `${internalOption.label} · ${hours(selectedPeriodHours)}`
            : `${selectedItemsLabel} · ${hours(selectedPeriodHours)}`;
    const isDeliverables = selectedProject?.template === 'deliverables';
    const showProjectLabels = selectedProject === null;
    const activeSection = isDeliverables
        ? section === 'people'
            ? 'summary'
            : section
        : section === 'planning' || section === 'gantt'
          ? 'summary'
          : section;
    const navigate = (
        selection: ProjectSelection = currentSelection,
        periodType = period.type,
        anchor = period.anchor,
        pm = selectedPmId,
    ) => {
        router.visit(
            pmBoardIndex({
                query: {
                    ...selectionQuery(selection),
                    period: periodType,
                    anchor,
                    ...(pm === null ? {} : { pm }),
                },
            }),
            { preserveScroll: true },
        );
    };
    const handleProjectSelectorOpen = (open: boolean) => {
        if (open) {
            setDraftAllProjects(allProjectsSelected);
            setDraftProjectIds(
                allProjectsSelected
                    ? projects.map((project) => project.id)
                    : selectedProjectIds,
            );
            setDraftIncludeInternal(
                allProjectsSelected
                    ? internalOption.available
                    : includeInternal,
            );
        }

        setProjectSelectorOpen(open);
    };
    const applyProjectSelection = () => {
        navigate({
            all: draftAllProjects,
            projectIds: draftProjectIds,
            includeInternal: draftIncludeInternal,
        });
        setProjectSelectorOpen(false);
    };
    const canApplyProjectSelection =
        draftAllProjects || draftProjectIds.length > 0 || draftIncludeInternal;

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
                                        {
                                            all: true,
                                            projectIds: [],
                                            includeInternal: true,
                                        },
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
                                    <SelectGroup>
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
                                    </SelectGroup>
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
                            {permissions.managePlanning && isDeliverables && (
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

                {(projects.length > 0 || internalOption.available) && (
                    <div className="grid w-full gap-2 sm:max-w-md">
                        <Label htmlFor="project-selector">Proiecte</Label>
                        <DropdownMenu
                            open={projectSelectorOpen}
                            onOpenChange={handleProjectSelectorOpen}
                        >
                            <DropdownMenuTrigger asChild>
                                <Button
                                    id="project-selector"
                                    variant="outline"
                                    className="w-full justify-between"
                                >
                                    <span className="truncate">
                                        {selectorLabel}
                                    </span>
                                    <ChevronDown data-icon="inline-end" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="start"
                                className="max-h-[var(--radix-dropdown-menu-content-available-height)] w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
                            >
                                <DropdownMenuGroup>
                                    <DropdownMenuLabel>
                                        Vedere
                                    </DropdownMenuLabel>
                                    <DropdownMenuCheckboxItem
                                        checked={draftAllProjects}
                                        onCheckedChange={(checked) => {
                                            setDraftAllProjects(
                                                checked === true,
                                            );

                                            if (checked === true) {
                                                setDraftProjectIds(
                                                    projects.map(
                                                        (project) => project.id,
                                                    ),
                                                );
                                                setDraftIncludeInternal(
                                                    internalOption.available,
                                                );
                                            } else {
                                                setDraftProjectIds([]);
                                                setDraftIncludeInternal(false);
                                            }
                                        }}
                                        onSelect={(event) =>
                                            event.preventDefault()
                                        }
                                    >
                                        <span className="flex-1 truncate">
                                            Toate proiectele
                                        </span>
                                        <span className="text-muted-foreground tabular-nums">
                                            {hours(allPeriodHours)}
                                        </span>
                                    </DropdownMenuCheckboxItem>
                                </DropdownMenuGroup>
                                <DropdownMenuSeparator />
                                <DropdownMenuGroup>
                                    <DropdownMenuLabel>
                                        Proiecte disponibile
                                    </DropdownMenuLabel>
                                    {projects.map((project) => (
                                        <DropdownMenuCheckboxItem
                                            key={project.id}
                                            checked={draftProjectIds.includes(
                                                project.id,
                                            )}
                                            onCheckedChange={(checked) => {
                                                setDraftAllProjects(false);
                                                setDraftProjectIds(
                                                    checked === true
                                                        ? Array.from(
                                                              new Set([
                                                                  ...draftProjectIds,
                                                                  project.id,
                                                              ]),
                                                          )
                                                        : draftProjectIds.filter(
                                                              (projectId) =>
                                                                  projectId !==
                                                                  project.id,
                                                          ),
                                                );
                                            }}
                                            onSelect={(event) =>
                                                event.preventDefault()
                                            }
                                        >
                                            <span className="flex-1 truncate">
                                                {project.label}
                                            </span>
                                            <span className="text-muted-foreground tabular-nums">
                                                {hours(project.periodHours)}
                                            </span>
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                    {internalOption.available && (
                                        <DropdownMenuCheckboxItem
                                            checked={draftIncludeInternal}
                                            onCheckedChange={(checked) => {
                                                setDraftAllProjects(false);
                                                setDraftIncludeInternal(
                                                    checked === true,
                                                );
                                            }}
                                            onSelect={(event) =>
                                                event.preventDefault()
                                            }
                                        >
                                            <span className="flex-1 truncate">
                                                {internalOption.label}
                                            </span>
                                            <span className="text-muted-foreground tabular-nums">
                                                {hours(
                                                    internalOption.periodHours,
                                                )}
                                            </span>
                                        </DropdownMenuCheckboxItem>
                                    )}
                                </DropdownMenuGroup>
                                <DropdownMenuSeparator />
                                <DropdownMenuGroup>
                                    <DropdownMenuItem
                                        disabled={!canApplyProjectSelection}
                                        onSelect={applyProjectSelection}
                                    >
                                        Aplică selecția
                                    </DropdownMenuItem>
                                </DropdownMenuGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}

                {projects.length === 0 && !internalOption.available ? (
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
                                            {selectionHeading}
                                        </h2>
                                        <Badge variant="outline">
                                            {selectionBadge}
                                        </Badge>
                                        {displayMode === 'edit' &&
                                            isDeliverables && (
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
                                    {isDeliverables ? (
                                        <Badge variant="secondary">
                                            Board săptămânal
                                        </Badge>
                                    ) : (
                                        <ToggleGroup
                                            type="single"
                                            variant="outline"
                                            value={period.type}
                                            onValueChange={(value) => {
                                                if (value) {
                                                    navigate(
                                                        currentSelection,
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
                                    )}
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        asChild
                                    >
                                        <Link
                                            href={boardHref(
                                                currentSelection,
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
                                                currentSelection,
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
                            value={activeSection}
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
                                {isDeliverables
                                    ? '① Săptămâna anterioară'
                                    : 'Lucrat în perioadă'}
                            </ToggleGroupItem>
                            <ToggleGroupItem value="upcoming">
                                {isDeliverables ? '② În progres' : 'Urmează'}
                            </ToggleGroupItem>
                            {isDeliverables ? (
                                <>
                                    <ToggleGroupItem value="planning">
                                        ③ Planificare resurse
                                    </ToggleGroupItem>
                                    <ToggleGroupItem value="gantt">
                                        Gantt
                                    </ToggleGroupItem>
                                </>
                            ) : (
                                <ToggleGroupItem value="people">
                                    Echipa activă
                                </ToggleGroupItem>
                            )}
                        </ToggleGroup>

                        {activeSection === 'summary' && (
                            <div className="flex flex-col gap-4">
                                <SummaryCharts
                                    data={summaryCharts}
                                    periodLabel={period.label}
                                    periodType={period.type}
                                />
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>
                                                Consum în perioadă
                                            </CardTitle>
                                            <CardDescription>
                                                Primele taskuri după orele
                                                pontate.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="flex flex-col gap-3">
                                            {workedTasks
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
                                                            {showProjectLabels && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    {
                                                                        task.projectLabel
                                                                    }
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="shrink-0 tabular-nums">
                                                            {hours(
                                                                task.periodHours,
                                                            )}
                                                        </span>
                                                    </div>
                                                ))}
                                            {workedTasks.length === 0 && (
                                                <p className="text-sm text-muted-foreground">
                                                    Nu există pontaje în
                                                    perioada aleasă.
                                                </p>
                                            )}
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>De urmărit</CardTitle>
                                            <CardDescription>
                                                Taskuri active ordonate după
                                                status și termen.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="flex flex-col gap-3">
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
                                                                {showProjectLabels
                                                                    ? `${task.projectLabel} · ${task.dueDate ?? 'fără termen'}`
                                                                    : (task.dueDate ??
                                                                      'fără termen')}
                                                            </span>
                                                        </div>
                                                        <TaskStatus
                                                            task={task}
                                                        />
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
                            </div>
                        )}

                        {activeSection === 'worked' && (
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
                                                        <div className="flex flex-col gap-1">
                                                            <a
                                                                href={task.url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-flex items-center gap-1 font-medium hover:underline"
                                                            >
                                                                {task.name}
                                                                <ExternalLink className="size-3" />
                                                            </a>
                                                            {showProjectLabels && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    {
                                                                        task.projectLabel
                                                                    }
                                                                </span>
                                                            )}
                                                        </div>
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

                        {activeSection === 'upcoming' && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>
                                        {isDeliverables
                                            ? 'În progres și de făcut'
                                            : 'Taskuri active'}
                                    </CardTitle>
                                    <CardDescription>
                                        {isDeliverables
                                            ? `Planificarea vizează săptămâna care începe la ${planning?.weekStart ?? '—'}. Taskurile recurente configurate sunt ascunse aici.`
                                            : 'Ownership, termen și efort rămas față de estimarea ClickUp.'}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                {isDeliverables && (
                                                    <TableHead>Plan</TableHead>
                                                )}
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
                                            {isDeliverables &&
                                            planning &&
                                            selectedProject
                                                ? upcomingTasks.map((task) => (
                                                      <DeliverableTaskRows
                                                          key={`${task.id}-${planning.plans.find((plan) => plan.taskId === task.id)?.updatedAt ?? 'new'}`}
                                                          task={task}
                                                          projectId={
                                                              selectedProject.id
                                                          }
                                                          planning={planning}
                                                          editable={
                                                              displayMode ===
                                                                  'edit' &&
                                                              permissions.managePlanning
                                                          }
                                                      />
                                                  ))
                                                : upcomingTasks.map((task) => (
                                                      <TableRow key={task.id}>
                                                          <TableCell>
                                                              <div className="flex flex-col gap-1">
                                                                  <a
                                                                      href={
                                                                          task.url
                                                                      }
                                                                      target="_blank"
                                                                      rel="noreferrer"
                                                                      className="font-medium hover:underline"
                                                                  >
                                                                      {
                                                                          task.name
                                                                      }
                                                                  </a>
                                                                  {showProjectLabels && (
                                                                      <span className="text-xs text-muted-foreground">
                                                                          {
                                                                              task.projectLabel
                                                                          }
                                                                      </span>
                                                                  )}
                                                              </div>
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
                                                              {task.dueDate ??
                                                                  '—'}
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
                                                              <Progress
                                                                  task={task}
                                                              />
                                                          </TableCell>
                                                      </TableRow>
                                                  ))}
                                            {upcomingTasks.length === 0 && (
                                                <EmptyRow
                                                    columns={
                                                        isDeliverables ? 8 : 7
                                                    }
                                                    label="Nu există taskuri active."
                                                />
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        )}

                        {activeSection === 'people' && (
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

                        {activeSection === 'planning' && planning && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>
                                        Planificare resurse —{' '}
                                        {planning.weekStart}
                                    </CardTitle>
                                    <CardDescription>
                                        Totalurile vin din orele alocate pe
                                        taskurile bifate în „În progres”.
                                        Capacitatea este configurabilă per
                                        persoană.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Resursă</TableHead>
                                                <TableHead>Rol</TableHead>
                                                <TableHead className="text-right">
                                                    Capacitate
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    Planificat
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    Disponibil
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {planning.resources.map(
                                                (resource) => {
                                                    const total =
                                                        planning.resourceTotals.find(
                                                            (item) =>
                                                                item.personId ===
                                                                resource.id,
                                                        );
                                                    const overloaded =
                                                        (total?.remainingHours ??
                                                            resource.weeklyCapacityHours) <
                                                        0;

                                                    return (
                                                        <TableRow
                                                            key={resource.id}
                                                        >
                                                            <TableCell className="font-medium">
                                                                {resource.name}
                                                            </TableCell>
                                                            <TableCell className="text-muted-foreground">
                                                                {resource.jobRole ??
                                                                    '—'}
                                                            </TableCell>
                                                            <TableCell className="text-right tabular-nums">
                                                                {hours(
                                                                    resource.weeklyCapacityHours,
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-right tabular-nums">
                                                                {hours(
                                                                    total?.plannedHours ??
                                                                        0,
                                                                )}
                                                            </TableCell>
                                                            <TableCell
                                                                className={
                                                                    overloaded
                                                                        ? 'text-right text-destructive tabular-nums'
                                                                        : 'text-right tabular-nums'
                                                                }
                                                            >
                                                                {hours(
                                                                    total?.remainingHours ??
                                                                        resource.weeklyCapacityHours,
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                },
                                            )}
                                            {planning.resources.length ===
                                                0 && (
                                                <EmptyRow
                                                    columns={5}
                                                    label="Nu există resurse interne active."
                                                />
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        )}

                        {activeSection === 'gantt' && gantt && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Gantt livrabile</CardTitle>
                                    <CardDescription>
                                        Intervalele provin din datele
                                        start/deadline ClickUp; săptămâna
                                        curentă este marcată distinct.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="sticky left-0 min-w-72 bg-card">
                                                    Task
                                                </TableHead>
                                                {gantt.weeks.map((week) => (
                                                    <TableHead
                                                        key={week.key}
                                                        className={
                                                            week.isCurrent
                                                                ? 'min-w-24 border-x-2 border-destructive text-center'
                                                                : 'min-w-24 text-center'
                                                        }
                                                    >
                                                        {week.label}
                                                    </TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {gantt.rows.map((row) => (
                                                <TableRow key={row.id}>
                                                    <TableCell className="sticky left-0 bg-card">
                                                        <div className="flex items-center gap-2">
                                                            {row.selected && (
                                                                <Star className="size-4 fill-warning text-warning" />
                                                            )}
                                                            <a
                                                                href={row.url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="line-clamp-1 font-medium hover:underline"
                                                            >
                                                                {row.name}
                                                            </a>
                                                        </div>
                                                        <div className="mt-1 text-xs text-muted-foreground">
                                                            {row.owners.join(
                                                                ', ',
                                                            ) ||
                                                                'Nealocat'}{' '}
                                                            ·{' '}
                                                            {hours(
                                                                row.estimateHours,
                                                            )}{' '}
                                                            ·{' '}
                                                            {row.progress ===
                                                            null
                                                                ? '—'
                                                                : `${row.progress}%`}
                                                        </div>
                                                    </TableCell>
                                                    {gantt.weeks.map((week) => {
                                                        const start =
                                                            row.startDate ??
                                                            row.dueDate;
                                                        const end =
                                                            row.dueDate ??
                                                            row.startDate;
                                                        const active =
                                                            start !== null &&
                                                            end !== null &&
                                                            start <= week.end &&
                                                            end >= week.start;

                                                        return (
                                                            <TableCell
                                                                key={week.key}
                                                                className={
                                                                    week.isCurrent
                                                                        ? 'border-x-2 border-destructive p-2'
                                                                        : 'p-2'
                                                                }
                                                            >
                                                                {active && (
                                                                    <div
                                                                        className={`h-6 rounded ${ganttCellClass(row.status)}`}
                                                                        title={`${row.status}: ${start} – ${end}`}
                                                                    />
                                                                )}
                                                            </TableCell>
                                                        );
                                                    })}
                                                </TableRow>
                                            ))}
                                            {gantt.rows.length === 0 && (
                                                <EmptyRow
                                                    columns={
                                                        gantt.weeks.length + 1
                                                    }
                                                    label="Taskurile nu au încă date start/deadline."
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
