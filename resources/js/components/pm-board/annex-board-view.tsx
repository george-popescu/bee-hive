import { router } from '@inertiajs/react';
import { Fragment, useState } from 'react';
import { AnnexValidationView } from '@/components/pm-board/annex-validation-view';
import type { AnnexValidationData } from '@/components/pm-board/annex-validation-view';
import type {
    Period,
    ProjectSelectorProject,
} from '@/components/pm-board/project-selector-view';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import { index as pmBoardIndex } from '@/routes/pm_board';

type AnnexStatus = 'at_risk' | 'data_missing' | 'on_track';
type AnnexType = 'fixed' | 'maintenance' | 'unresolved';

type Annex = {
    key: string;
    label: string;
    type: AnnexType;
    scopeSource: 'configured' | 'missing' | 'task_name';
    contractIdentifier: string | null;
    contractBudgetHours: number | null;
    contractDeadline: string | null;
    estimatedBudgetHours: number | null;
    consumedHours: number;
    remainingEstimateHours: number | null;
    completedTasks: number;
    totalTasks: number;
    deliveryProgress: number | null;
    closestDueDate: string | null;
    startDate: string | null;
    dueDate: string | null;
    status: AnnexStatus;
    missingFields: string[];
};

type AnnexTaskRow = {
    annexKey: string;
    annexLabel: string;
    scopeSource: 'configured' | 'missing' | 'task_name';
    taskId: number;
    name: string;
    url: string;
    owners: string[];
    plannedHours: number | null;
    workedHours: number;
    estimateHours: number | null;
    remainingEstimateHours: number | null;
    startDate: string | null;
    dueDate: string | null;
    status: string;
    isDone: boolean;
    isUnplanned: boolean;
    missingFields: string[];
};

type TimelineRow = {
    annexKey: string;
    label: string;
    type: AnnexType;
    status: AnnexStatus;
    startDate: string | null;
    dueDate: string | null;
    missingFields: string[];
};

export type AnnexBoardData = {
    annexes: Annex[];
    weeklyRows: AnnexTaskRow[];
    agreedRows: AnnexTaskRow[];
    timeline: {
        start: string | null;
        end: string | null;
        rows: TimelineRow[];
    };
    totals: {
        contractBudgetHours: number | null;
        contractDeadline: string | null;
        estimatedBudgetHours: number | null;
        consumedHours: number;
        remainingEstimateHours: number | null;
        closestDueDate: string | null;
        completedTasks: number;
        taskCount: number;
        deliveryProgress: number | null;
        periodStart: string;
        periodEnd: string;
    };
    validation: AnnexValidationData;
};

type AnnexBoardViewProps = {
    projects: ProjectSelectorProject[];
    selectedPmId: number | null;
    selectedProject: ProjectSelectorProject;
    today: string;
    period: Period;
    annexBoard: AnnexBoardData;
    sync: {
        startedAt: string | null;
        finishedAt: string | null;
    } | null;
};

type Timeline = {
    start: Date;
    end: Date;
    ticks: Date[];
};

function parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);

    return new Date(year, month - 1, day, 12);
}

function addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);

    return next;
}

function formatHours(value: number | null, languageTag: string): string {
    if (value === null) {
        return '—';
    }

    return `${value.toLocaleString(languageTag, { maximumFractionDigits: 2 })}h`;
}

function formatDate(value: string | Date, languageTag: string): string {
    const date = typeof value === 'string' ? parseDate(value) : value;

    return new Intl.DateTimeFormat(languageTag, {
        day: 'numeric',
        month: 'short',
    }).format(date);
}

function formatPeriod(period: Period, languageTag: string): string {
    const start = parseDate(period.start);
    const end = parseDate(period.end);

    if (period.type === 'month') {
        return new Intl.DateTimeFormat(languageTag, {
            month: 'long',
            year: 'numeric',
        }).format(start);
    }

    const startMonth = new Intl.DateTimeFormat(languageTag, {
        month: 'short',
    }).format(start);
    const endMonth = new Intl.DateTimeFormat(languageTag, {
        month: 'short',
    }).format(end);

    return startMonth === endMonth
        ? `${start.getDate()}–${end.getDate()} ${endMonth} ${end.getFullYear()}`
        : `${start.getDate()} ${startMonth}–${end.getDate()} ${endMonth} ${end.getFullYear()}`;
}

function buildTimeline(
    data: AnnexBoardData['timeline'],
    period: Period,
): Timeline {
    const start = parseDate(data.start ?? period.start);
    const candidateEnd = parseDate(data.end ?? period.end);
    const end =
        candidateEnd.getTime() <= start.getTime()
            ? addDays(start, period.type === 'month' ? 28 : 7)
            : candidateEnd;
    const span = end.getTime() - start.getTime();
    const ticks = Array.from(
        { length: 5 },
        (_, index) => new Date(start.getTime() + (span * index) / 4),
    );

    return { start, end, ticks };
}

function positionInTimeline(date: Date, timeline: Timeline): number {
    const span = timeline.end.getTime() - timeline.start.getTime();

    return Math.max(
        0,
        Math.min(
            100,
            ((date.getTime() - timeline.start.getTime()) / span) * 100,
        ),
    );
}

function healthBadgeClass(status: AnnexStatus): string {
    if (status === 'at_risk') {
        return 'bg-destructive/12 text-destructive dark:bg-destructive/20';
    }

    if (status === 'data_missing') {
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
    }

    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
}

function annexBarClass(annex: Annex | TimelineRow): string {
    if (annex.status === 'at_risk') {
        return 'bg-destructive';
    }

    if (annex.type === 'maintenance') {
        return 'bg-chart-2';
    }

    if (annex.type === 'unresolved') {
        return 'bg-muted-foreground';
    }

    return 'bg-chart-1';
}

export function AnnexBoardView({
    projects,
    selectedPmId,
    selectedProject,
    today,
    period,
    annexBoard,
    sync,
}: AnnexBoardViewProps) {
    const { languageTag, t } = useTranslations();
    const [annexFilter, setAnnexFilter] = useState('all');

    if (annexBoard.validation.enabled) {
        return (
            <AnnexValidationView
                projects={projects}
                selectedPmId={selectedPmId}
                selectedProject={selectedProject}
                period={period}
                totals={annexBoard.totals}
                validation={annexBoard.validation}
                sync={sync}
            />
        );
    }

    const filteredAnnexes = annexBoard.annexes.filter(
        (annex) => annexFilter === 'all' || annex.key === annexFilter,
    );
    const filteredWeeklyRows = annexBoard.weeklyRows.filter(
        (row) => annexFilter === 'all' || row.annexKey === annexFilter,
    );
    const filteredAgreedRows = annexBoard.agreedRows.filter(
        (row) => annexFilter === 'all' || row.annexKey === annexFilter,
    );
    const filteredTimelineRows = annexBoard.timeline.rows.filter(
        (row) => annexFilter === 'all' || row.annexKey === annexFilter,
    );
    const consumedHours = filteredAnnexes.reduce(
        (total, annex) => total + annex.consumedHours,
        0,
    );
    const allRemainingEstimatesKnown =
        filteredAnnexes.length > 0 &&
        filteredAnnexes.every((annex) => annex.remainingEstimateHours !== null);
    const remainingEstimateHours = allRemainingEstimatesKnown
        ? filteredAnnexes.reduce(
              (total, annex) => total + (annex.remainingEstimateHours ?? 0),
              0,
          )
        : null;
    const closestDueDate = filteredAnnexes
        .map((annex) => annex.closestDueDate)
        .filter((date): date is string => date !== null)
        .sort()[0];
    const timeline = buildTimeline(annexBoard.timeline, period);
    const todayDate = parseDate(today);
    const todayPosition = positionInTimeline(todayDate, timeline);
    const showToday =
        todayDate.getTime() >= timeline.start.getTime() &&
        todayDate.getTime() <= timeline.end.getTime();
    const navigate = (projectId: number, periodType = period.type) => {
        router.visit(
            pmBoardIndex({
                query: {
                    project: projectId,
                    period: periodType,
                    anchor: period.anchor,
                    ...(selectedPmId === null ? {} : { pm: selectedPmId }),
                },
            }),
            { preserveScroll: true },
        );
    };

    return (
        <main
            className="flex min-h-full min-w-0 flex-1 overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8"
            style={{
                fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
        >
            <div className="@container mx-auto grid w-full max-w-[736px] content-start gap-6 text-[14px] leading-[21px]">
                <header className="flex flex-wrap items-end justify-between gap-4">
                    <div className="grid min-w-0 gap-1">
                        <span className="text-xs text-muted-foreground">
                            {selectedProject.label} · {t('PM / TTL review')} ·{' '}
                            {t('ClickUp read-only')}
                        </span>
                        <h1 className="text-xl leading-tight font-medium">
                            {t('Contract delivery board')}
                        </h1>
                        <p className="text-muted-foreground">
                            {formatPeriod(period, languageTag)} ·{' '}
                            {period.type === 'week'
                                ? t('weekly delivery review')
                                : t('all active annexes')}
                        </p>
                    </div>

                    <div className="grid w-full gap-2 @min-[620px]:w-[330px]">
                        <label className="grid gap-1">
                            <span className="font-medium">{t('Project')}</span>
                            <Select
                                value={selectedProject.id.toString()}
                                onValueChange={(value) =>
                                    navigate(Number(value))
                                }
                            >
                                <SelectTrigger
                                    aria-label={t('Project')}
                                    className="h-7 w-full rounded-[10px] bg-foreground/[0.06] px-2 shadow-none data-[size=default]:h-7 dark:bg-foreground/10"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent align="start">
                                    {projects.map((project) => (
                                        <SelectItem
                                            key={project.id}
                                            value={project.id.toString()}
                                        >
                                            {project.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </label>

                        <div
                            className="flex flex-wrap items-end gap-2"
                            aria-label={t('Board filters')}
                        >
                            <div
                                className="inline-flex h-7 overflow-hidden rounded-[10px] border"
                                role="group"
                                aria-label={t('Period view')}
                            >
                                {(['week', 'month'] as const).map((mode) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        aria-pressed={period.type === mode}
                                        className={cn(
                                            'h-full px-2 transition-colors',
                                            mode === 'month' && 'border-l',
                                            period.type === mode
                                                ? 'bg-foreground text-background'
                                                : 'bg-background hover:bg-muted',
                                        )}
                                        onClick={() =>
                                            navigate(selectedProject.id, mode)
                                        }
                                    >
                                        {mode === 'week'
                                            ? t('Week')
                                            : t('Month')}
                                    </button>
                                ))}
                            </div>

                            <label className="grid min-w-[170px] flex-1 gap-1">
                                <span className="font-medium">
                                    {t('Annex')}
                                </span>
                                <Select
                                    value={annexFilter}
                                    onValueChange={setAnnexFilter}
                                >
                                    <SelectTrigger
                                        aria-label={t('Annex')}
                                        className="h-7 w-full rounded-[10px] bg-foreground/[0.06] px-2 shadow-none data-[size=default]:h-7 dark:bg-foreground/10"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent align="start">
                                        <SelectItem value="all">
                                            {t('All active annexes')}
                                        </SelectItem>
                                        {annexBoard.annexes.map((annex) => (
                                            <SelectItem
                                                key={annex.key}
                                                value={annex.key}
                                            >
                                                {annex.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </label>
                        </div>
                    </div>
                </header>

                <div className="grid gap-1 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-amber-500/15 px-2 py-[3px] font-medium text-amber-700 dark:text-amber-300">
                            {t('Contract data missing')}
                        </span>
                        <span className="text-muted-foreground">
                            {t(
                                'ClickUp execution and estimates shown; no contractual values inferred',
                            )}
                        </span>
                    </div>
                    <span className="text-muted-foreground">
                        {t('Contract ID')} — · {t('Approved budget')} — ·{' '}
                        {t('Contract deadline')} —
                    </span>
                </div>

                <section className="grid grid-cols-1 gap-2.5 @min-[620px]:grid-cols-3">
                    <div className="grid gap-0.5 rounded-[20px] bg-foreground/[0.05] p-3 dark:bg-foreground/10">
                        <span className="text-muted-foreground">
                            {t('Hours consumed')}
                        </span>
                        <strong className="text-xl leading-tight font-medium tabular-nums">
                            {formatHours(consumedHours, languageTag)}
                        </strong>
                        <span className="text-xs">
                            {t('Across :count active annexes', {
                                count: filteredAnnexes.length,
                            })}
                        </span>
                    </div>
                    <div className="grid gap-0.5 rounded-[20px] bg-foreground/[0.05] p-3 dark:bg-foreground/10">
                        <span className="text-muted-foreground">
                            {t('Hours remaining')}
                        </span>
                        <strong className="text-xl leading-tight font-medium tabular-nums">
                            {formatHours(remainingEstimateHours, languageTag)}
                        </strong>
                        <span className="text-xs">
                            {remainingEstimateHours === null
                                ? t('Estimate data missing')
                                : t('From ClickUp task estimates')}
                        </span>
                    </div>
                    <div className="grid gap-0.5 rounded-[20px] bg-foreground/[0.05] p-3 dark:bg-foreground/10">
                        <span className="text-muted-foreground">
                            {t('Closest deadline')}
                        </span>
                        <strong className="text-xl leading-tight font-medium tabular-nums">
                            {closestDueDate
                                ? formatDate(closestDueDate, languageTag)
                                : '—'}
                        </strong>
                        <span className="text-xs">
                            {closestDueDate
                                ? t('Closest ClickUp task due date')
                                : t('No deadline data')}
                        </span>
                    </div>
                </section>

                {period.type === 'month' ? (
                    <section
                        className="grid gap-3"
                        aria-labelledby="annex-health-heading"
                    >
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                            <h2
                                id="annex-health-heading"
                                className="text-lg leading-tight font-medium"
                            >
                                {t('1. Annex health')}
                            </h2>
                            <span className="text-xs text-muted-foreground">
                                {t(
                                    'ClickUp estimates, delivered tasks and due dates',
                                )}
                            </span>
                        </div>
                        <div className="grid gap-[18px]">
                            {filteredAnnexes.map((annex) => {
                                const consumptionPercent =
                                    annex.estimatedBudgetHours === null ||
                                    annex.estimatedBudgetHours <= 0
                                        ? 0
                                        : Math.min(
                                              100,
                                              (annex.consumedHours /
                                                  annex.estimatedBudgetHours) *
                                                  100,
                                          );

                                return (
                                    <article
                                        key={annex.key}
                                        className="grid gap-[9px] border-b pb-[18px]"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="grid gap-[3px]">
                                                <strong className="font-medium">
                                                    {annex.type === 'fixed'
                                                        ? `${t('Annex')} · ${annex.label}`
                                                        : annex.label}
                                                </strong>
                                                <span className="text-xs text-muted-foreground">
                                                    {t(
                                                        ':completed of :total ClickUp tasks completed',
                                                        {
                                                            completed:
                                                                annex.completedTasks,
                                                            total: annex.totalTasks,
                                                        },
                                                    )}{' '}
                                                    ·{' '}
                                                    {annex.closestDueDate
                                                        ? t(
                                                              'closest due :date',
                                                              {
                                                                  date: formatDate(
                                                                      annex.closestDueDate,
                                                                      languageTag,
                                                                  ),
                                                              },
                                                          )
                                                        : t('No due date')}
                                                </span>
                                            </div>
                                            <span
                                                className={cn(
                                                    'rounded-full px-2 py-[3px] text-xs leading-4 font-medium',
                                                    healthBadgeClass(
                                                        annex.status,
                                                    ),
                                                )}
                                            >
                                                {annex.status === 'at_risk'
                                                    ? t('At risk')
                                                    : annex.status ===
                                                        'data_missing'
                                                      ? t('Data missing')
                                                      : t('On track')}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                                            <div
                                                className="h-[9px] overflow-hidden rounded-full bg-muted"
                                                aria-label={t(
                                                    ':consumed of :estimate estimated hours consumed',
                                                    {
                                                        consumed:
                                                            annex.consumedHours,
                                                        estimate:
                                                            annex.estimatedBudgetHours ??
                                                            '—',
                                                    },
                                                )}
                                            >
                                                <div
                                                    className={cn(
                                                        'h-full rounded-[inherit]',
                                                        annexBarClass(annex),
                                                    )}
                                                    style={{
                                                        width: `${consumptionPercent}%`,
                                                    }}
                                                />
                                            </div>
                                            <strong className="font-medium tabular-nums">
                                                {formatHours(
                                                    annex.consumedHours,
                                                    languageTag,
                                                )}{' '}
                                                /{' '}
                                                {formatHours(
                                                    annex.estimatedBudgetHours,
                                                    languageTag,
                                                )}
                                            </strong>
                                        </div>
                                        <div className="text-xs">
                                            {annex.remainingEstimateHours ===
                                            null
                                                ? t('Estimate data missing')
                                                : t(
                                                      ':hours estimated remaining',
                                                      {
                                                          hours: formatHours(
                                                              annex.remainingEstimateHours,
                                                              languageTag,
                                                          ),
                                                      },
                                                  )}{' '}
                                            ·{' '}
                                            {t(':percent% delivery progress', {
                                                percent:
                                                    annex.deliveryProgress ?? 0,
                                            })}
                                        </div>
                                    </article>
                                );
                            })}
                            {filteredAnnexes.length === 0 && (
                                <div className="border-b py-4 text-muted-foreground">
                                    {t('No annex scopes are available.')}
                                </div>
                            )}
                        </div>
                    </section>
                ) : (
                    <section
                        className="grid gap-3"
                        aria-labelledby="weekly-delivery-heading"
                    >
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                            <h2
                                id="weekly-delivery-heading"
                                className="text-lg leading-tight font-medium"
                            >
                                {t('1. This week: planned vs. delivered')}
                            </h2>
                            <span className="text-xs text-muted-foreground">
                                {formatPeriod(period, languageTag)}
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[650px] border-collapse">
                                <thead>
                                    <tr>
                                        <th className="border-b px-2 py-2.5 text-left font-medium text-muted-foreground">
                                            {t('Annex / task')}
                                        </th>
                                        <th className="border-b px-2 py-2.5 text-left font-medium text-muted-foreground">
                                            {t('Owner')}
                                        </th>
                                        <th className="border-b px-2 py-2.5 text-right font-medium text-muted-foreground">
                                            {t('Planned')}
                                        </th>
                                        <th className="border-b px-2 py-2.5 text-right font-medium text-muted-foreground">
                                            {t('Worked')}
                                        </th>
                                        <th className="border-b px-2 py-2.5 text-left font-medium text-muted-foreground">
                                            {t('Status')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredWeeklyRows.map((row) => (
                                        <tr key={row.taskId}>
                                            <td className="border-b px-2 py-2.5 font-medium">
                                                <a
                                                    href={row.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="hover:underline"
                                                >
                                                    {row.annexLabel} ·{' '}
                                                    {row.name}
                                                </a>
                                            </td>
                                            <td className="border-b px-2 py-2.5">
                                                {row.owners.join(', ') ||
                                                    t('Unassigned')}
                                            </td>
                                            <td className="border-b px-2 py-2.5 text-right tabular-nums">
                                                {formatHours(
                                                    row.plannedHours,
                                                    languageTag,
                                                )}
                                            </td>
                                            <td className="border-b px-2 py-2.5 text-right tabular-nums">
                                                {formatHours(
                                                    row.workedHours,
                                                    languageTag,
                                                )}
                                            </td>
                                            <td className="border-b px-2 py-2.5">
                                                <span className="rounded-full bg-foreground/[0.07] px-2 py-[3px] text-xs font-medium dark:bg-foreground/10">
                                                    {row.isUnplanned
                                                        ? t('Unplanned work')
                                                        : row.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredWeeklyRows.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={5}
                                                className="border-b px-2 py-6 text-center text-muted-foreground"
                                            >
                                                {t(
                                                    'No planned or worked tasks in this week.',
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                <section
                    className="grid gap-3"
                    aria-labelledby="agreed-work-heading"
                >
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <h2
                            id="agreed-work-heading"
                            className="text-lg leading-tight font-medium"
                        >
                            {period.type === 'week'
                                ? t('2. Tasks agreed for next week')
                                : t('2. Agreed work until delivery')}
                        </h2>
                        <span className="text-xs text-muted-foreground">
                            {t('Read-only from ClickUp task scopes')}
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[650px] border-collapse">
                            <thead>
                                <tr>
                                    <th className="border-b px-2 py-2.5 text-left font-medium text-muted-foreground">
                                        {t('Annex / task')}
                                    </th>
                                    <th className="border-b px-2 py-2.5 text-left font-medium text-muted-foreground">
                                        {t('Owner')}
                                    </th>
                                    <th className="border-b px-2 py-2.5 text-right font-medium text-muted-foreground">
                                        {period.type === 'week'
                                            ? t('Planned next week')
                                            : t('Estimate left')}
                                    </th>
                                    <th className="border-b px-2 py-2.5 text-left font-medium text-muted-foreground">
                                        {t('Due')}
                                    </th>
                                    <th className="border-b px-2 py-2.5 text-left font-medium text-muted-foreground">
                                        {t('Delivery')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAgreedRows.map((row) => (
                                    <tr key={row.taskId}>
                                        <td className="border-b px-2 py-2.5 font-medium">
                                            <a
                                                href={row.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="hover:underline"
                                            >
                                                {row.annexLabel} · {row.name}
                                            </a>
                                        </td>
                                        <td className="border-b px-2 py-2.5">
                                            {row.owners.join(', ') ||
                                                t('Unassigned')}
                                        </td>
                                        <td className="border-b px-2 py-2.5 text-right tabular-nums">
                                            {formatHours(
                                                period.type === 'week'
                                                    ? row.plannedHours
                                                    : row.remainingEstimateHours,
                                                languageTag,
                                            )}
                                        </td>
                                        <td className="border-b px-2 py-2.5">
                                            {row.dueDate
                                                ? formatDate(
                                                      row.dueDate,
                                                      languageTag,
                                                  )
                                                : t('Date missing')}
                                        </td>
                                        <td className="border-b px-2 py-2.5">
                                            {row.status}
                                        </td>
                                    </tr>
                                ))}
                                {filteredAgreedRows.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="border-b px-2 py-6 text-center text-muted-foreground"
                                        >
                                            {period.type === 'week'
                                                ? t(
                                                      'No tasks are agreed for next week.',
                                                  )
                                                : t(
                                                      'No active agreed tasks are available.',
                                                  )}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                {period.type === 'month' && (
                    <section
                        className="grid gap-3"
                        aria-labelledby="contract-timeline-heading"
                    >
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                            <h2
                                id="contract-timeline-heading"
                                className="text-lg leading-tight font-medium"
                            >
                                {t('3. Contract timeline')}
                            </h2>
                            <span className="text-xs text-muted-foreground">
                                {t('Today line + ClickUp annex dates')}
                            </span>
                        </div>
                        <div
                            className="grid grid-cols-[118px_repeat(5,minmax(0,1fr))] items-center gap-x-[3px] gap-y-1.5 @min-[620px]:grid-cols-[minmax(150px,1.2fr)_repeat(5,minmax(0,1fr))] @min-[620px]:gap-x-1.5"
                            role="img"
                            aria-label={t('Timeline for active annex scopes')}
                        >
                            <div />
                            {timeline.ticks.map((tick) => (
                                <div
                                    key={tick.toISOString()}
                                    className="border-b pb-1 text-center text-xs text-muted-foreground"
                                >
                                    {formatDate(tick, languageTag)}
                                </div>
                            ))}
                            {filteredTimelineRows.map((row) => {
                                const start = row.startDate
                                    ? parseDate(row.startDate)
                                    : null;
                                const end = row.dueDate
                                    ? parseDate(row.dueDate)
                                    : null;
                                const left = start
                                    ? positionInTimeline(start, timeline)
                                    : 0;
                                const right = end
                                    ? positionInTimeline(end, timeline)
                                    : left;

                                return (
                                    <Fragment key={row.annexKey}>
                                        <div className="min-w-0">
                                            <strong className="block truncate font-medium">
                                                {row.label}
                                            </strong>
                                            <div className="truncate text-xs text-muted-foreground">
                                                {row.dueDate
                                                    ? formatDate(
                                                          row.dueDate,
                                                          languageTag,
                                                      )
                                                    : t('Date missing')}
                                            </div>
                                        </div>
                                        <div className="relative col-span-5 min-h-[30px] overflow-hidden">
                                            {[20, 40, 60, 80].map(
                                                (position) => (
                                                    <span
                                                        key={position}
                                                        className="absolute inset-y-0 w-px bg-border"
                                                        style={{
                                                            left: `${position}%`,
                                                        }}
                                                    />
                                                ),
                                            )}
                                            {showToday && (
                                                <span
                                                    className="absolute -inset-y-1 z-10 w-0.5 bg-foreground/55"
                                                    style={{
                                                        left: `${todayPosition}%`,
                                                    }}
                                                />
                                            )}
                                            {start && end ? (
                                                <span
                                                    className={cn(
                                                        'absolute top-[9px] h-3 rounded-full',
                                                        annexBarClass(row),
                                                    )}
                                                    style={{
                                                        left: `${left}%`,
                                                        width: `${Math.max(3, right - left)}%`,
                                                    }}
                                                />
                                            ) : (
                                                <span className="absolute inset-0 flex items-center text-xs text-muted-foreground">
                                                    {t('Date data missing')}
                                                </span>
                                            )}
                                        </div>
                                    </Fragment>
                                );
                            })}
                            {filteredTimelineRows.length === 0 && (
                                <div className="col-span-6 border-b py-4 text-muted-foreground">
                                    {t('No annex timeline is available.')}
                                </div>
                            )}
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}
