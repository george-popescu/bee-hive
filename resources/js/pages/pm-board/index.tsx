import { Head, Link, router, setLayoutProps, useHttp } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    ChevronDown,
    Download,
    ExternalLink,
    LayoutDashboard,
    Printer,
    RefreshCw,
    Save,
    Star,
    Trash2,
} from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { store as syncClickUp } from '@/actions/App/Http/Controllers/ClickUpSyncController';
import {
    clear as clearWeeklyPlanning,
    upsert as upsertWeeklyPlanning,
} from '@/actions/App/Http/Controllers/WeeklyPlanningController';
import { SummaryCharts } from '@/components/pm-board/summary-charts';
import type { SummaryChartData } from '@/components/pm-board/summary-charts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { useTranslations } from '@/hooks/use-translations';
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
    statusGroup: '0-active' | '1-todo';
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
        utilizationPercent: number | null;
    }>;
};
type Gantt = {
    weeks: Array<{
        key: string;
        label: string;
        start: string;
        end: string;
        isCurrent: boolean;
        isoWeek: number;
        monthKey: string;
        monthLabel: string;
    }>;
    rows: Array<{
        id: number;
        module: string;
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
        activeTasks: number;
        todoTasks: number;
        selectedTasks: number;
        plannedNextWeekHours: number;
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
type ClearWeeklyPlanningPayload = { project_id: number; week_start: string };
type ClearWeeklyPlanningResponse = { cleared: number };
type ProjectSelection = {
    all: boolean;
    projectIds: number[];
    includeInternal: boolean;
};

function hours(value: number | null, locale: string): string {
    return value === null
        ? '—'
        : `${value.toLocaleString(locale, { maximumFractionDigits: 2 })}h`;
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

function exportHref(
    selection: ProjectSelection,
    period: Period,
    pm: number | null,
): string {
    const params = new URLSearchParams();

    if (!selection.all) {
        if (selection.projectIds.length === 1 && !selection.includeInternal) {
            params.set('project', String(selection.projectIds[0]));
        } else {
            params.set('selection', 'custom');
            selection.projectIds.forEach((id) =>
                params.append('projects[]', String(id)),
            );

            if (selection.includeInternal) {
                params.set('include_internal', '1');
            }
        }
    }

    params.set('period', period.type);
    params.set('anchor', period.anchor);

    if (pm !== null) {
        params.set('pm', String(pm));
    }

    return `/pm-board/export.csv?${params.toString()}`;
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

function StatusDot({ status }: { status: string }) {
    return (
        <span
            className={`inline-block size-2.5 shrink-0 rounded-full ${ganttCellClass(status)}`}
            title={status}
            role="img"
            aria-label={status}
        />
    );
}

function Progress({ task }: { task: BoardTask }) {
    const { languageTag, t } = useTranslations();

    if (task.progress === null) {
        return (
            <span className="text-muted-foreground">{t('No estimate')}</span>
        );
    }

    return (
        <div className="min-w-28 space-y-1">
            <div className="flex justify-between text-xs tabular-nums">
                <span>{task.progress.toLocaleString(languageTag)}%</span>
                {task.isOverrun && (
                    <span className="text-destructive">{t('Overrun')}</span>
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
    presentation,
    showTodoDivider,
}: {
    task: BoardTask;
    projectId: number;
    planning: Planning;
    editable: boolean;
    presentation: boolean;
    showTodoDivider: boolean;
}) {
    const { languageTag, t } = useTranslations();
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
            router.reload({ only: ['planning', 'gantt', 'kpis'] });
        };
        void form
            .put(upsertWeeklyPlanning.url(), {
                onSuccess: (response) => {
                    setSelected(response.plan.selected);
                    setConfirmedSelected(response.plan.selected);
                    setVersion(response.plan.version);
                    toast.success(t('The weekly planning was saved.'));
                    router.reload({ only: ['planning', 'gantt', 'kpis'] });
                },
                onHttpException: () => {
                    rollback();
                    toast.error(
                        t(
                            'Planning changed in the meantime. Reload and try again.',
                        ),
                    );
                },
                onError: () => {
                    rollback();
                    toast.error(t('The weekly planning could not be saved.'));
                },
                onNetworkError: () => {
                    rollback();
                    toast.error(
                        t('Connection failed. The changes were not saved.'),
                    );
                },
            })
            .catch(() => undefined);
    };

    return (
        <Fragment>
            <TableRow
                className={`${selected ? 'bg-primary/5' : ''} ${showTodoDivider ? 'border-t-4 border-t-border' : ''}`}
            >
                <TableCell>
                    {editable ? (
                        <Checkbox
                            aria-label={t('Plan :task', { task: task.name })}
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
                <TableCell>
                    {task.owners.join(', ') || t('Unassigned')}
                </TableCell>
                <TableCell>
                    {presentation ? (
                        <StatusDot status={task.status} />
                    ) : (
                        <TaskStatus task={task} />
                    )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                    {hours(task.totalLoggedHours, languageTag)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                    {hours(task.estimateHours, languageTag)}
                </TableCell>
                <TableCell
                    className={
                        task.isOverrun
                            ? 'text-right text-destructive tabular-nums'
                            : 'text-right tabular-nums'
                    }
                >
                    {hours(task.remainingHours, languageTag)}
                </TableCell>
                <TableCell>{task.dueDate ?? '—'}</TableCell>
                <TableCell>
                    <Progress task={task} />
                </TableCell>
            </TableRow>
            {editable && selected && (
                <TableRow className="bg-muted/30">
                    <TableCell colSpan={9}>
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
                                <Save /> {t('Save hours')}
                            </Button>
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </Fragment>
    );
}

function ganttCellClass(status: string): string {
    const normalized = status.toLowerCase();

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
    const { languageTag, t } = useTranslations();
    const [section, setSection] = useState<Section>('summary');
    const [displayMode, setDisplayMode] = useState<'presentation' | 'edit'>(
        'presentation',
    );
    const [printAll, setPrintAll] = useState(false);
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
    const clearForm = useHttp<
        ClearWeeklyPlanningPayload,
        ClearWeeklyPlanningResponse
    >(clearWeeklyPlanning(), {
        project_id: selectedProject?.id ?? 0,
        week_start: planning?.weekStart ?? '',
    });
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
            ? t('1 selection')
            : t(':count selections', { count: selectedItemsCount });
    const selectionHeading = allProjectsSelected
        ? t('All projects')
        : selectedProject
          ? selectedProject.label
          : selectedProjectIds.length === 0 && includeInternal
            ? internalOption.label
            : t('Custom selection');
    const selectionBadge = allProjectsSelected
        ? t(
              internalOption.available
                  ? ':count projects + internal'
                  : ':count projects',
              { count: projects.length },
          )
        : selectedProject
          ? selectedProject.templateLabel
          : selectedItemsLabel;
    const selectorLabel = allProjectsSelected
        ? t('All projects · :hours', {
              hours: hours(allPeriodHours, languageTag),
          })
        : selectedProject
          ? `${selectedProject.label} · ${hours(selectedPeriodHours, languageTag)}`
          : selectedProjectIds.length === 0 && includeInternal
            ? `${internalOption.label} · ${hours(selectedPeriodHours, languageTag)}`
            : `${selectedItemsLabel} · ${hours(selectedPeriodHours, languageTag)}`;
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
    const selectedPlans = planning?.plans.filter((plan) => plan.selected) ?? [];
    const selectedPlannedHours = selectedPlans.reduce(
        (total, plan) => total + plan.totalHours,
        0,
    );
    const resourceScaleMax = Math.max(
        1,
        ...(planning?.resourceTotals.flatMap((total) => [
            total.weeklyCapacityHours,
            total.plannedHours,
        ]) ?? []),
    );
    const taskLookup = new Map(upcomingTasks.map((task) => [task.id, task]));
    const ganttMonthGroups =
        gantt?.weeks.reduce<
            Array<{ key: string; label: string; weeks: number }>
        >((groups, week) => {
            const latest = groups.at(-1);

            if (latest?.key === week.monthKey) {
                latest.weeks += 1;
            } else {
                groups.push({
                    key: week.monthKey,
                    label: week.monthLabel,
                    weeks: 1,
                });
            }

            return groups;
        }, []) ?? [];
    const sectionClass = (name: Section): string =>
        `pm-board-print-section ${printAll && activeSection !== name ? 'pm-board-print-pending' : ''}`;
    const clearPlanning = () => {
        if (
            !selectedProject ||
            !planning ||
            !window.confirm(
                t(
                    'Clear every selected task for this planning week? Allocated hours will be kept for later reuse.',
                ),
            )
        ) {
            return;
        }

        clearForm.setData({
            project_id: selectedProject.id,
            week_start: planning.weekStart,
        });
        void clearForm
            .delete(clearWeeklyPlanning.url(), {
                onSuccess: (response) => {
                    toast.success(
                        t(':count planned tasks were cleared.', {
                            count: response.cleared,
                        }),
                    );
                    router.reload({ only: ['planning', 'gantt', 'kpis'] });
                },
                onError: () => {
                    toast.error(t('The weekly planning could not be cleared.'));
                },
                onNetworkError: () => {
                    toast.error(t('Connection failed. Please try again.'));
                },
            })
            .catch(() => undefined);
    };

    useEffect(() => {
        if (!printAll) {
            return;
        }

        const reset = () => setPrintAll(false);
        const timeout = window.setTimeout(() => window.print(), 150);
        window.addEventListener('afterprint', reset, { once: true });

        return () => {
            window.clearTimeout(timeout);
            window.removeEventListener('afterprint', reset);
        };
    }, [printAll]);

    setLayoutProps({
        breadcrumbs: [{ title: t('PM boards'), href: pmBoardIndex() }],
    });

    return (
        <>
            <Head title={t('PM boards')} />
            <div className="pm-board-print-root flex h-full flex-1 flex-col gap-4 overflow-x-hidden p-4">
                <div className="pm-board-no-print flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <LayoutDashboard className="size-6" />
                            <h1 className="text-2xl font-semibold tracking-tight">
                                {t('PM boards')}
                            </h1>
                        </div>
                        <p className="max-w-3xl text-sm text-muted-foreground">
                            {t(
                                'Project delivery status from ClickUp: consumed effort, estimates, progress, and the active team for the selected period.',
                            )}
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
                                    <SelectValue placeholder={t('All PMs')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectItem value="all">
                                            {t('All PMs')}
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
                                {t('Presentation')}
                            </ToggleGroupItem>
                            {permissions.managePlanning && isDeliverables && (
                                <ToggleGroupItem value="edit">
                                    {t('Edit')}
                                </ToggleGroupItem>
                            )}
                        </ToggleGroup>
                        <Button variant="outline" asChild>
                            <a
                                href={exportHref(
                                    currentSelection,
                                    period,
                                    selectedPmId,
                                )}
                            >
                                <Download /> {t('Export CSV')}
                            </a>
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setPrintAll(true)}
                        >
                            <Printer /> {t('Export PDF')}
                        </Button>
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
                                <RefreshCw /> {t('Refresh ClickUp')}
                            </Button>
                        )}
                    </div>
                </div>

                <div className="pm-board-print-title hidden">
                    <h1 className="text-2xl font-semibold">{t('PM boards')}</h1>
                    <p className="text-sm text-muted-foreground">
                        {selectionHeading} · {period.label}
                    </p>
                </div>

                {(projects.length > 0 || internalOption.available) && (
                    <div className="pm-board-no-print grid w-full gap-2 sm:max-w-md">
                        <Label htmlFor="project-selector">
                            {t('Projects')}
                        </Label>
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
                                        {t('View')}
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
                                            {t('All projects')}
                                        </span>
                                        <span className="text-muted-foreground tabular-nums">
                                            {hours(allPeriodHours, languageTag)}
                                        </span>
                                    </DropdownMenuCheckboxItem>
                                </DropdownMenuGroup>
                                <DropdownMenuSeparator />
                                <DropdownMenuGroup>
                                    <DropdownMenuLabel>
                                        {t('Available projects')}
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
                                                {hours(
                                                    project.periodHours,
                                                    languageTag,
                                                )}
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
                                                    languageTag,
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
                                        {t('Apply selection')}
                                    </DropdownMenuItem>
                                </DropdownMenuGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}

                {projects.length === 0 && !internalOption.available ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('No projects available')}</CardTitle>
                            <CardDescription>
                                {t(
                                    'The current filter or your permissions do not include any projects visible on the board.',
                                )}
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
                                                <Badge
                                                    className="pm-board-no-print"
                                                    variant="warning"
                                                >
                                                    {t('Edit mode')}
                                                </Badge>
                                            )}
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {sync?.status === 'failed'
                                            ? t(
                                                  'Last synchronization failed:error',
                                                  {
                                                      error: sync.error
                                                          ? `: ${sync.error}`
                                                          : '.',
                                                  },
                                              )
                                            : `${t('Last synchronization:')} `}
                                        {sync?.status !== 'failed' &&
                                        sync?.finishedAt
                                            ? new Date(
                                                  sync.finishedAt,
                                              ).toLocaleString(languageTag)
                                            : sync?.status !== 'failed' &&
                                                sync?.startedAt
                                              ? t(
                                                    'In progress',
                                                ).toLocaleLowerCase(languageTag)
                                              : sync?.status !== 'failed'
                                                ? t('Not yet')
                                                : ''}
                                    </p>
                                </div>
                                <div className="pm-board-no-print flex flex-wrap items-center gap-2">
                                    {isDeliverables ? (
                                        <Badge variant="secondary">
                                            {t('Weekly board')}
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
                                                {t('Week')}
                                            </ToggleGroupItem>
                                            <ToggleGroupItem value="month">
                                                {t('Month')}
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
                                            aria-label={t('Previous period')}
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
                                            aria-label={t('Next period')}
                                        >
                                            <ArrowRight />
                                        </Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {isDeliverables && (
                            <Alert className="border-warning/50 bg-warning/10">
                                <AlertTriangle className="text-warning-foreground" />
                                <AlertTitle>
                                    {t('Contract data missing')}
                                </AlertTitle>
                                <AlertDescription>
                                    {t(
                                        'Sales OS annex ID, contractual budget, start date, and deadline are not available yet. The metrics below use ClickUp execution only; no contractual budget or forecast is inferred.',
                                    )}
                                </AlertDescription>
                            </Alert>
                        )}

                        <div
                            className={`grid gap-3 sm:grid-cols-2 ${isDeliverables ? 'xl:grid-cols-7' : 'xl:grid-cols-5'}`}
                        >
                            {(isDeliverables
                                ? [
                                      [
                                          t('Worked hours'),
                                          hours(kpis.actualHours, languageTag),
                                      ],
                                      [
                                          t('Estimate for worked tasks'),
                                          hours(kpis.plannedHours, languageTag),
                                      ],
                                      [
                                          t('Active tasks'),
                                          String(kpis.activeTasks),
                                      ],
                                      [t('To do'), String(kpis.todoTasks)],
                                      [
                                          t('Selected next week'),
                                          String(kpis.selectedTasks),
                                      ],
                                      [
                                          t('Planned next week'),
                                          hours(
                                              kpis.plannedNextWeekHours,
                                              languageTag,
                                          ),
                                      ],
                                      [
                                          t('Active people'),
                                          String(kpis.activePeople),
                                      ],
                                  ]
                                : [
                                      [
                                          t('Worked hours'),
                                          hours(kpis.actualHours, languageTag),
                                      ],
                                      [
                                          t('Estimate for worked tasks'),
                                          hours(kpis.plannedHours, languageTag),
                                      ],
                                      [
                                          t('Worked tasks'),
                                          String(kpis.workedTasks),
                                      ],
                                      [
                                          t('Estimated active tasks'),
                                          String(kpis.plannedTasks),
                                      ],
                                      [
                                          t('Active people'),
                                          String(kpis.activePeople),
                                      ],
                                  ]
                            ).map(([label, value]) => (
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
                            className="pm-board-no-print flex-wrap justify-start"
                        >
                            <ToggleGroupItem value="summary">
                                {t('Summary')}
                            </ToggleGroupItem>
                            <ToggleGroupItem value="worked">
                                {isDeliverables
                                    ? `① ${t('Previous week')}`
                                    : t('Worked in period')}
                            </ToggleGroupItem>
                            <ToggleGroupItem value="upcoming">
                                {isDeliverables
                                    ? `② ${t('In progress')}`
                                    : t('Upcoming')}
                            </ToggleGroupItem>
                            {isDeliverables ? (
                                <>
                                    <ToggleGroupItem value="planning">
                                        ③ {t('Resource planning')}
                                    </ToggleGroupItem>
                                    <ToggleGroupItem value="gantt">
                                        Gantt
                                    </ToggleGroupItem>
                                </>
                            ) : (
                                <ToggleGroupItem value="people">
                                    {t('Active team')}
                                </ToggleGroupItem>
                            )}
                        </ToggleGroup>

                        {(activeSection === 'summary' || printAll) && (
                            <div
                                className={`${sectionClass('summary')} flex flex-col gap-4`}
                            >
                                <SummaryCharts
                                    data={summaryCharts}
                                    periodLabel={period.label}
                                    periodType={period.type}
                                />
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>
                                                {t('Period consumption')}
                                            </CardTitle>
                                            <CardDescription>
                                                {t(
                                                    'Top tasks by logged hours.',
                                                )}
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
                                                                languageTag,
                                                            )}
                                                        </span>
                                                    </div>
                                                ))}
                                            {workedTasks.length === 0 && (
                                                <p className="text-sm text-muted-foreground">
                                                    {t(
                                                        'No time entries in the selected period.',
                                                    )}
                                                </p>
                                            )}
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>
                                                {t('To watch')}
                                            </CardTitle>
                                            <CardDescription>
                                                {t(
                                                    'Active tasks are ordered by status and due date.',
                                                )}
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
                                                                    ? `${task.projectLabel} · ${task.dueDate ?? t('No due date')}`
                                                                    : (task.dueDate ??
                                                                      t(
                                                                          'No due date',
                                                                      ))}
                                                            </span>
                                                        </div>
                                                        <TaskStatus
                                                            task={task}
                                                        />
                                                    </div>
                                                ))}
                                            {upcomingTasks.length === 0 && (
                                                <p className="text-sm text-muted-foreground">
                                                    {t('No active tasks.')}
                                                </p>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        )}

                        {(activeSection === 'worked' || printAll) && (
                            <Card className={sectionClass('worked')}>
                                <CardHeader>
                                    <CardTitle>{t('Worked tasks')}</CardTitle>
                                    <CardDescription>
                                        {t(
                                            'The hours in :period; progress uses all historical time entries for the task.',
                                            {
                                                period: period.label,
                                            },
                                        )}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>
                                                    {t('Task')}
                                                </TableHead>
                                                <TableHead>
                                                    {t('Status')}
                                                </TableHead>
                                                <TableHead>
                                                    {t('Contributors')}
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    {t('Period')}
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    {t('Estimate')}
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    {t('Total')}
                                                </TableHead>
                                                <TableHead>
                                                    {t('Progress')}
                                                </TableHead>
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
                                                        {displayMode ===
                                                            'presentation' ||
                                                        printAll ? (
                                                            <StatusDot
                                                                status={
                                                                    task.status
                                                                }
                                                            />
                                                        ) : (
                                                            <TaskStatus
                                                                task={task}
                                                            />
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {task.people
                                                            .map(
                                                                (person) =>
                                                                    `${person.name} · ${hours(person.hours, languageTag)}`,
                                                            )
                                                            .join(', ') || '—'}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        {hours(
                                                            task.periodHours,
                                                            languageTag,
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        {hours(
                                                            task.estimateHours,
                                                            languageTag,
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        {hours(
                                                            task.totalLoggedHours,
                                                            languageTag,
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Progress task={task} />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {workedTasks.length > 0 && (
                                                <TableRow className="border-t-2 font-semibold">
                                                    <TableCell colSpan={3}>
                                                        {t('Total')}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        {hours(
                                                            workedTasks.reduce(
                                                                (total, task) =>
                                                                    total +
                                                                    task.periodHours,
                                                                0,
                                                            ),
                                                            languageTag,
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        {hours(
                                                            workedTasks.reduce(
                                                                (total, task) =>
                                                                    total +
                                                                    (task.estimateHours ??
                                                                        0),
                                                                0,
                                                            ),
                                                            languageTag,
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        {hours(
                                                            workedTasks.reduce(
                                                                (total, task) =>
                                                                    total +
                                                                    task.totalLoggedHours,
                                                                0,
                                                            ),
                                                            languageTag,
                                                        )}
                                                    </TableCell>
                                                    <TableCell />
                                                </TableRow>
                                            )}
                                            {workedTasks.length === 0 && (
                                                <EmptyRow
                                                    columns={7}
                                                    label={t(
                                                        'No time entries in the selected period.',
                                                    )}
                                                />
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        )}

                        {(activeSection === 'upcoming' || printAll) && (
                            <Card className={sectionClass('upcoming')}>
                                <CardHeader>
                                    <CardTitle>
                                        {isDeliverables
                                            ? t('In progress and to do')
                                            : t('Active tasks')}
                                    </CardTitle>
                                    <CardDescription>
                                        {isDeliverables
                                            ? t(
                                                  'Planning targets the week starting :date. Configured recurring tasks are hidden here.',
                                                  {
                                                      date:
                                                          planning?.weekStart ??
                                                          '—',
                                                  },
                                              )
                                            : t(
                                                  'Ownership, due date and remaining effort compared with the ClickUp estimate.',
                                              )}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="overflow-x-auto">
                                    {isDeliverables && planning && (
                                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
                                            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                                                <span>
                                                    <strong>
                                                        {kpis.selectedTasks}
                                                    </strong>{' '}
                                                    {t('selected tasks')}
                                                </span>
                                                <span>
                                                    <strong>
                                                        {hours(
                                                            kpis.plannedNextWeekHours,
                                                            languageTag,
                                                        )}
                                                    </strong>{' '}
                                                    {t('planned next week')}
                                                </span>
                                            </div>
                                            {displayMode === 'edit' &&
                                                permissions.managePlanning &&
                                                kpis.selectedTasks > 0 && (
                                                    <Button
                                                        className="pm-board-no-print"
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={
                                                            clearForm.processing
                                                        }
                                                        onClick={clearPlanning}
                                                    >
                                                        <Trash2 />{' '}
                                                        {t('Clear selection')}
                                                    </Button>
                                                )}
                                        </div>
                                    )}
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                {isDeliverables && (
                                                    <TableHead>
                                                        {t('Plan')}
                                                    </TableHead>
                                                )}
                                                <TableHead>
                                                    {t('Task')}
                                                </TableHead>
                                                <TableHead>
                                                    {t('Owner')}
                                                </TableHead>
                                                <TableHead>
                                                    {t('Status')}
                                                </TableHead>
                                                {isDeliverables && (
                                                    <TableHead className="text-right">
                                                        {t('Logged')}
                                                    </TableHead>
                                                )}
                                                <TableHead className="text-right">
                                                    {t('Estimated')}
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    {t('Remaining')}
                                                </TableHead>
                                                <TableHead>
                                                    {t('Due date')}
                                                </TableHead>
                                                <TableHead>
                                                    {t('Progress')}
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {isDeliverables &&
                                            planning &&
                                            selectedProject
                                                ? upcomingTasks.map(
                                                      (task, index) => (
                                                          <DeliverableTaskRows
                                                              key={`${task.id}-${planning.plans.find((plan) => plan.taskId === task.id)?.updatedAt ?? 'new'}`}
                                                              task={task}
                                                              projectId={
                                                                  selectedProject.id
                                                              }
                                                              planning={
                                                                  planning
                                                              }
                                                              editable={
                                                                  displayMode ===
                                                                      'edit' &&
                                                                  permissions.managePlanning &&
                                                                  !printAll
                                                              }
                                                              presentation={
                                                                  displayMode ===
                                                                      'presentation' ||
                                                                  printAll
                                                              }
                                                              showTodoDivider={
                                                                  task.statusGroup ===
                                                                      '1-todo' &&
                                                                  (index ===
                                                                      0 ||
                                                                      upcomingTasks[
                                                                          index -
                                                                              1
                                                                      ]
                                                                          ?.statusGroup !==
                                                                          '1-todo')
                                                              }
                                                          />
                                                      ),
                                                  )
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
                                                              ) ||
                                                                  t(
                                                                      'Unassigned',
                                                                  )}
                                                          </TableCell>
                                                          <TableCell>
                                                              {displayMode ===
                                                                  'presentation' ||
                                                              printAll ? (
                                                                  <StatusDot
                                                                      status={
                                                                          task.status
                                                                      }
                                                                  />
                                                              ) : (
                                                                  <TaskStatus
                                                                      task={
                                                                          task
                                                                      }
                                                                  />
                                                              )}
                                                          </TableCell>
                                                          <TableCell className="text-right tabular-nums">
                                                              {hours(
                                                                  task.estimateHours,
                                                                  languageTag,
                                                              )}
                                                          </TableCell>
                                                          <TableCell>
                                                              {task.dueDate ??
                                                                  '—'}
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
                                                                  languageTag,
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
                                                        isDeliverables ? 9 : 7
                                                    }
                                                    label={t(
                                                        'No active tasks.',
                                                    )}
                                                />
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        )}

                        {(activeSection === 'people' ||
                            (printAll && !isDeliverables)) && (
                            <Card className={sectionClass('people')}>
                                <CardHeader>
                                    <CardTitle>{t('Active team')}</CardTitle>
                                    <CardDescription>
                                        {t(
                                            'People with time entries in the selected period.',
                                        )}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>
                                                    {t('Person')}
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    {t('Tasks')}
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    {t('Hours')}
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
                                                        {hours(
                                                            person.hours,
                                                            languageTag,
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {peopleWorked.length === 0 && (
                                                <EmptyRow
                                                    columns={3}
                                                    label={t(
                                                        'No people with time entries in the selected period.',
                                                    )}
                                                />
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        )}

                        {(activeSection === 'planning' || printAll) &&
                            planning && (
                                <Card className={sectionClass('planning')}>
                                    <CardHeader>
                                        <CardTitle>
                                            {t('Resource planning — :date', {
                                                date: planning.weekStart,
                                            })}
                                        </CardTitle>
                                        <CardDescription>
                                            {t(
                                                'Capacity is configured per person. Totals come from hours assigned to selected in-progress tasks.',
                                            )}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border bg-muted/30 p-3">
                                            <span className="text-sm text-muted-foreground">
                                                {t('Total planned')}
                                            </span>
                                            <strong className="text-2xl tabular-nums">
                                                {hours(
                                                    selectedPlannedHours,
                                                    languageTag,
                                                )}
                                            </strong>
                                        </div>
                                        <div className="space-y-5">
                                            {planning.resources.map(
                                                (resource) => {
                                                    const total =
                                                        planning.resourceTotals.find(
                                                            (item) =>
                                                                item.personId ===
                                                                resource.id,
                                                        );
                                                    const planned =
                                                        total?.plannedHours ??
                                                        0;
                                                    const capacity =
                                                        total?.weeklyCapacityHours ??
                                                        resource.weeklyCapacityHours;
                                                    const remaining =
                                                        total?.remainingHours ??
                                                        capacity;
                                                    const overloaded =
                                                        remaining < 0;
                                                    const plannedWidth =
                                                        Math.min(
                                                            100,
                                                            (planned /
                                                                resourceScaleMax) *
                                                                100,
                                                        );
                                                    const capacityPosition =
                                                        Math.min(
                                                            100,
                                                            (capacity /
                                                                resourceScaleMax) *
                                                                100,
                                                        );

                                                    return (
                                                        <div
                                                            key={resource.id}
                                                            className="grid gap-2 lg:grid-cols-[14rem_1fr_15rem] lg:items-center"
                                                        >
                                                            <div>
                                                                <div className="font-medium">
                                                                    {
                                                                        resource.name
                                                                    }
                                                                </div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    {resource.jobRole ??
                                                                        '—'}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="relative h-5 overflow-visible rounded bg-muted">
                                                                    <div
                                                                        className={`h-full rounded ${overloaded ? 'bg-destructive' : 'bg-primary'}`}
                                                                        style={{
                                                                            width: `${plannedWidth}%`,
                                                                        }}
                                                                    />
                                                                    <div
                                                                        className="absolute top-[-3px] h-7 w-0.5 bg-foreground"
                                                                        style={{
                                                                            left: `${capacityPosition}%`,
                                                                        }}
                                                                        title={t(
                                                                            'Capacity: :hours',
                                                                            {
                                                                                hours: hours(
                                                                                    capacity,
                                                                                    languageTag,
                                                                                ),
                                                                            },
                                                                        )}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div
                                                                className={`text-sm tabular-nums ${overloaded ? 'text-destructive' : ''}`}
                                                            >
                                                                <strong>
                                                                    {hours(
                                                                        planned,
                                                                        languageTag,
                                                                    )}
                                                                </strong>{' '}
                                                                /{' '}
                                                                {hours(
                                                                    capacity,
                                                                    languageTag,
                                                                )}{' '}
                                                                ·{' '}
                                                                {(
                                                                    total?.utilizationPercent ??
                                                                    0
                                                                ).toLocaleString(
                                                                    languageTag,
                                                                )}
                                                                % ·{' '}
                                                                {t('available')}
                                                                :{' '}
                                                                {hours(
                                                                    remaining,
                                                                    languageTag,
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                },
                                            )}
                                            {planning.resources.length ===
                                                0 && (
                                                <p className="py-8 text-center text-sm text-muted-foreground">
                                                    {t(
                                                        'No active internal resources.',
                                                    )}
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-3">
                                            <h3 className="font-semibold">
                                                {t('Selected task allocations')}
                                            </h3>
                                            <div className="overflow-x-auto">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>
                                                                {t('Task')}
                                                            </TableHead>
                                                            <TableHead>
                                                                {t(
                                                                    'Allocations',
                                                                )}
                                                            </TableHead>
                                                            <TableHead className="text-right">
                                                                {t('Planned')}
                                                            </TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {selectedPlans.map(
                                                            (plan) => {
                                                                const task =
                                                                    taskLookup.get(
                                                                        plan.taskId,
                                                                    );

                                                                return (
                                                                    <TableRow
                                                                        key={
                                                                            plan.taskId
                                                                        }
                                                                    >
                                                                        <TableCell className="font-medium">
                                                                            {task ? (
                                                                                <a
                                                                                    href={
                                                                                        task.url
                                                                                    }
                                                                                    target="_blank"
                                                                                    rel="noreferrer"
                                                                                    className="hover:underline"
                                                                                >
                                                                                    {
                                                                                        task.name
                                                                                    }
                                                                                </a>
                                                                            ) : (
                                                                                `#${plan.taskId}`
                                                                            )}
                                                                        </TableCell>
                                                                        <TableCell className="text-muted-foreground">
                                                                            {plan.allocations
                                                                                .map(
                                                                                    (
                                                                                        allocation,
                                                                                    ) =>
                                                                                        `${allocation.name} · ${hours(allocation.hours, languageTag)}`,
                                                                                )
                                                                                .join(
                                                                                    ', ',
                                                                                ) ||
                                                                                '—'}
                                                                        </TableCell>
                                                                        <TableCell className="text-right tabular-nums">
                                                                            {hours(
                                                                                plan.totalHours,
                                                                                languageTag,
                                                                            )}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                );
                                                            },
                                                        )}
                                                        {selectedPlans.length ===
                                                            0 && (
                                                            <EmptyRow
                                                                columns={3}
                                                                label={t(
                                                                    'No tasks selected for next week.',
                                                                )}
                                                            />
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                        {(activeSection === 'gantt' || printAll) && gantt && (
                            <Card className={sectionClass('gantt')}>
                                <CardHeader>
                                    <CardTitle>
                                        {t('Deliverables Gantt')}
                                    </CardTitle>
                                    <CardDescription>
                                        {t(
                                            'Intervals come from ClickUp start/deadline dates; the current week is highlighted.',
                                        )}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="overflow-x-auto">
                                    <Table className="pm-board-gantt-table min-w-max">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead
                                                    rowSpan={2}
                                                    className="min-w-32"
                                                >
                                                    {t('Module')}
                                                </TableHead>
                                                <TableHead
                                                    rowSpan={2}
                                                    className="min-w-72"
                                                >
                                                    {t('Task')}
                                                </TableHead>
                                                <TableHead
                                                    rowSpan={2}
                                                    className="min-w-24 text-right"
                                                >
                                                    {t('Estimate')}
                                                </TableHead>
                                                <TableHead
                                                    rowSpan={2}
                                                    className="min-w-28"
                                                >
                                                    {t('Start')}
                                                </TableHead>
                                                <TableHead
                                                    rowSpan={2}
                                                    className="min-w-28"
                                                >
                                                    {t('End')}
                                                </TableHead>
                                                <TableHead
                                                    rowSpan={2}
                                                    className="min-w-28"
                                                >
                                                    {t('Status')}
                                                </TableHead>
                                                <TableHead
                                                    rowSpan={2}
                                                    className="min-w-24 text-right"
                                                >
                                                    {t('Progress')}
                                                </TableHead>
                                                {ganttMonthGroups.map(
                                                    (group) => (
                                                        <TableHead
                                                            key={group.key}
                                                            colSpan={
                                                                group.weeks
                                                            }
                                                            className="border-l text-center font-semibold"
                                                        >
                                                            {group.label}
                                                        </TableHead>
                                                    ),
                                                )}
                                            </TableRow>
                                            <TableRow>
                                                {gantt.weeks.map((week) => (
                                                    <TableHead
                                                        key={week.key}
                                                        className={
                                                            week.isCurrent
                                                                ? 'min-w-20 border-x-2 border-destructive px-2 text-center'
                                                                : 'min-w-20 px-2 text-center'
                                                        }
                                                        title={week.label}
                                                    >
                                                        <div>
                                                            {new Date(
                                                                `${week.start}T00:00:00`,
                                                            ).toLocaleDateString(
                                                                languageTag,
                                                                {
                                                                    day: '2-digit',
                                                                    month: 'short',
                                                                },
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground">
                                                            CW {week.isoWeek}
                                                        </div>
                                                    </TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {gantt.rows.map((row) => (
                                                <TableRow key={row.id}>
                                                    <TableCell className="font-medium">
                                                        {row.module}
                                                    </TableCell>
                                                    <TableCell>
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
                                                                t('Unassigned')}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        {hours(
                                                            row.estimateHours,
                                                            languageTag,
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="tabular-nums">
                                                        {row.startDate ?? '—'}
                                                    </TableCell>
                                                    <TableCell className="tabular-nums">
                                                        {row.dueDate ?? '—'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <StatusDot
                                                                status={
                                                                    row.status
                                                                }
                                                            />
                                                            <span className="text-xs">
                                                                {row.status}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        {row.progress === null
                                                            ? '—'
                                                            : `${row.progress}%`}
                                                    </TableCell>
                                                    {gantt.weeks.map((week) => {
                                                        const active =
                                                            row.startDate !==
                                                                null &&
                                                            row.dueDate !==
                                                                null &&
                                                            row.startDate <=
                                                                week.end &&
                                                            row.dueDate >=
                                                                week.start;

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
                                                                        className={`h-5 rounded ${ganttCellClass(row.status)}`}
                                                                        title={`${row.status}: ${row.startDate} – ${row.dueDate}`}
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
                                                        gantt.weeks.length + 7
                                                    }
                                                    label={t(
                                                        'Tasks do not have start/deadline dates yet.',
                                                    )}
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
