import { router } from '@inertiajs/react';
import { useState } from 'react';
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
import type { TranslationKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { index as pmBoardIndex } from '@/routes/pm_board';

type ValidationDeliverable = {
    annexKey: string;
    annexLabel: string;
    taskId: number;
    name: string;
    url: string;
    estimateHours: number | null;
    owners: string[];
    startDate: string | null;
    dueDate: string | null;
    status: string;
    isDone: boolean;
    missingFields: string[];
};

type ValidationIssue = {
    field:
        | 'contractBudgetHours'
        | 'contractDeadline'
        | 'contractIdentifier'
        | 'dueDate'
        | 'estimateHours'
        | 'owners'
        | 'startDate';
    count: number;
    reason: string;
};

export type AnnexValidationData = {
    enabled: boolean;
    budgetSourceLabels: string[];
    operationalSourceLabels: string[];
    deliverables: ValidationDeliverable[];
    issues: ValidationIssue[];
    people: string[];
};

type ValidationTotals = {
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

type AnnexValidationViewProps = {
    projects: ProjectSelectorProject[];
    selectedPmId: number | null;
    selectedProject: ProjectSelectorProject;
    period: Period;
    totals: ValidationTotals;
    validation: AnnexValidationData;
    sync: {
        startedAt: string | null;
        finishedAt: string | null;
    } | null;
};

type Tab = 'deliverables' | 'overview' | 'timeline';

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

function formatSyncDate(value: string, languageTag: string): string {
    return new Intl.DateTimeFormat(languageTag, {
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(new Date(value));
}

function buildTimeline(
    deliverables: ValidationDeliverable[],
    period: Period,
): Timeline {
    const knownStarts = deliverables
        .map((deliverable) => deliverable.startDate)
        .filter((date): date is string => date !== null)
        .sort();
    const knownEnds = deliverables
        .map((deliverable) => deliverable.dueDate)
        .filter((date): date is string => date !== null)
        .sort();
    const start = parseDate(knownStarts[0] ?? period.start);
    const candidateEnd = parseDate(
        knownEnds[knownEnds.length - 1] ?? period.end,
    );
    const end =
        candidateEnd.getTime() <= start.getTime()
            ? addDays(start, 35)
            : candidateEnd;
    const span = end.getTime() - start.getTime();
    const ticks = Array.from(
        { length: 6 },
        (_, index) => new Date(start.getTime() + (span * index) / 5),
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

function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');
}

function issueCopy(field: ValidationIssue['field']): {
    detail: TranslationKey;
    title: TranslationKey;
} {
    if (field === 'contractIdentifier') {
        return {
            title: 'Annex identifier is missing',
            detail: 'The contract cannot be linked to its Sales OS annex yet.',
        };
    }

    if (field === 'contractBudgetHours') {
        return {
            title: 'Contract budget is missing',
            detail: 'ClickUp estimates are shown separately from the approved budget.',
        };
    }

    if (field === 'contractDeadline') {
        return {
            title: 'Annex deadline is missing',
            detail: 'Forecast cannot be compared with contractual time remaining.',
        };
    }

    if (field === 'owners') {
        return {
            title: ':count deliverables are unassigned',
            detail: 'Assign owners in ClickUp before committing the delivery plan.',
        };
    }

    if (field === 'startDate') {
        return {
            title: ':count deliverables have no start date',
            detail: 'The derived timeline cannot place these deliverables.',
        };
    }

    if (field === 'dueDate') {
        return {
            title: ':count deliverables have no due date',
            detail: 'The timeline remains incomplete without ClickUp due dates.',
        };
    }

    return {
        title: ':count deliverables have no estimate',
        detail: 'The estimated delivery budget remains incomplete.',
    };
}

export function AnnexValidationView({
    projects,
    selectedPmId,
    selectedProject,
    period,
    totals,
    validation,
    sync,
}: AnnexValidationViewProps) {
    const { languageTag, t } = useTranslations();
    const [tab, setTab] = useState<Tab>('overview');
    const estimatedBudget = totals.estimatedBudgetHours;
    const consumptionPercent =
        estimatedBudget === null || estimatedBudget <= 0
            ? null
            : (totals.consumedHours / estimatedBudget) * 100;
    const deliverables = [...validation.deliverables].sort(
        (first, second) =>
            (second.estimateHours ?? -1) - (first.estimateHours ?? -1),
    );
    const maxEstimate = Math.max(
        0,
        ...deliverables.map((deliverable) => deliverable.estimateHours ?? 0),
    );
    const timeline = buildTimeline(validation.deliverables, period);
    const timelineIncomplete = validation.deliverables.some(
        (deliverable) =>
            deliverable.startDate === null || deliverable.dueDate === null,
    );
    const syncDate = sync?.finishedAt ?? sync?.startedAt;
    const navigate = (projectId: number) => {
        router.visit(
            pmBoardIndex({
                query: {
                    project: projectId,
                    period: period.type,
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
            <div className="@container mx-auto grid w-full max-w-[980px] content-start gap-5 text-[14px] leading-[21px]">
                <header className="flex flex-wrap items-start justify-between gap-4">
                    <div className="grid gap-1">
                        <p className="text-xs text-muted-foreground">
                            {selectedProject.label} ·{' '}
                            {t('Contract model: annex')}
                        </p>
                        <h1 className="text-xl leading-tight font-medium">
                            {t('Annex and delivery control')}
                        </h1>
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                            <span className="rounded-full bg-foreground/[0.07] px-2 py-[3px] font-medium dark:bg-foreground/10">
                                {syncDate
                                    ? t('ClickUp · updated :date', {
                                          date: formatSyncDate(
                                              syncDate,
                                              languageTag,
                                          ),
                                      })
                                    : t(
                                          'ClickUp · synchronization date missing',
                                      )}
                            </span>
                            <span className="rounded-full bg-foreground/[0.07] px-2 py-[3px] font-medium dark:bg-foreground/10">
                                {t('Read-only')}
                            </span>
                        </div>
                    </div>

                    <div className="grid w-full gap-2 @min-[700px]:w-[360px]">
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
                            className="flex flex-wrap gap-1"
                            role="tablist"
                            aria-label={t('Dashboard sections')}
                        >
                            {(
                                [
                                    ['overview', t('Overview')],
                                    ['deliverables', t('Deliverables')],
                                    ['timeline', t('Timeline')],
                                ] as const
                            ).map(([key, label]) => (
                                <button
                                    key={key}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === key}
                                    className={cn(
                                        'h-7 rounded-[10px] border px-2 transition-colors',
                                        tab === key
                                            ? 'border-foreground bg-foreground text-background'
                                            : 'bg-background hover:bg-muted',
                                    )}
                                    onClick={() => setTab(key)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </header>

                {tab === 'overview' && (
                    <section
                        role="tabpanel"
                        aria-label={t('Overview')}
                        className="grid gap-6"
                    >
                        <div className="grid grid-cols-2 gap-3 @min-[700px]:grid-cols-4">
                            <div className="grid min-w-0 gap-0.5 rounded-[20px] bg-foreground/[0.05] p-3 dark:bg-foreground/10">
                                <span className="text-muted-foreground">
                                    {t('Estimated budget')}
                                </span>
                                <strong className="text-xl leading-tight font-medium whitespace-nowrap tabular-nums">
                                    {formatHours(estimatedBudget, languageTag)}
                                </strong>
                                <span className="truncate text-xs text-muted-foreground">
                                    {t(':count deliverables · :source', {
                                        count: validation.deliverables.length,
                                        source:
                                            validation.budgetSourceLabels.join(
                                                ', ',
                                            ) || '—',
                                    })}
                                </span>
                            </div>
                            <div className="grid min-w-0 gap-0.5 rounded-[20px] bg-foreground/[0.05] p-3 dark:bg-foreground/10">
                                <span className="text-muted-foreground">
                                    {t('Recorded hours')}
                                </span>
                                <strong className="text-xl leading-tight font-medium whitespace-nowrap tabular-nums">
                                    {formatHours(
                                        totals.consumedHours,
                                        languageTag,
                                    )}
                                </strong>
                                <span className="truncate text-xs text-muted-foreground">
                                    {validation.operationalSourceLabels.join(
                                        ', ',
                                    ) || '—'}
                                </span>
                            </div>
                            <div className="grid min-w-0 gap-0.5 rounded-[20px] bg-foreground/[0.05] p-3 dark:bg-foreground/10">
                                <span className="text-muted-foreground">
                                    {t('Estimate remaining')}
                                </span>
                                <strong className="text-xl leading-tight font-medium whitespace-nowrap tabular-nums">
                                    {formatHours(
                                        totals.remainingEstimateHours,
                                        languageTag,
                                    )}
                                </strong>
                                <span className="text-xs text-muted-foreground">
                                    {consumptionPercent === null
                                        ? t('Estimate data missing')
                                        : t(':percent% available', {
                                              percent: Math.max(
                                                  0,
                                                  100 - consumptionPercent,
                                              ).toLocaleString(languageTag, {
                                                  maximumFractionDigits: 1,
                                              }),
                                          })}
                                </span>
                            </div>
                            <div className="grid min-w-0 gap-0.5 rounded-[20px] bg-foreground/[0.05] p-3 dark:bg-foreground/10">
                                <span className="text-muted-foreground">
                                    {t('Annex deadline')}
                                </span>
                                <strong className="text-xl leading-tight font-medium whitespace-nowrap">
                                    {totals.contractDeadline
                                        ? formatDate(
                                              totals.contractDeadline,
                                              languageTag,
                                          )
                                        : '—'}
                                </strong>
                                <span className="text-xs text-destructive">
                                    {t('Forecast unavailable')}
                                </span>
                            </div>
                        </div>

                        <div className="grid items-start gap-6 @min-[700px]:grid-cols-[minmax(0,1.7fr)_minmax(240px,.8fr)]">
                            <div className="min-w-0">
                                <div className="mb-2.5 flex flex-wrap items-end justify-between gap-3">
                                    <div>
                                        <h2 className="text-lg font-medium">
                                            {t('Annex consumption')}
                                        </h2>
                                        <span className="text-xs text-muted-foreground">
                                            {t(
                                                'Recorded hours compared with deliverable estimates',
                                            )}
                                        </span>
                                    </div>
                                    <strong className="font-medium tabular-nums">
                                        {consumptionPercent === null
                                            ? '—'
                                            : `${consumptionPercent.toLocaleString(languageTag, { maximumFractionDigits: 1 })}%`}
                                    </strong>
                                </div>
                                <div
                                    className="my-3 h-3.5 overflow-hidden rounded-full bg-muted"
                                    aria-label={t(
                                        ':consumed of :estimate estimated hours consumed',
                                        {
                                            consumed: totals.consumedHours,
                                            estimate: estimatedBudget ?? '—',
                                        },
                                    )}
                                >
                                    {consumptionPercent !== null && (
                                        <span
                                            className="block h-full min-w-[5px] rounded-full bg-chart-1"
                                            style={{
                                                width: `${Math.min(100, consumptionPercent)}%`,
                                            }}
                                        />
                                    )}
                                </div>
                                <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                                    <span>
                                        {formatHours(
                                            totals.consumedHours,
                                            languageTag,
                                        )}{' '}
                                        {t('consumed')}
                                    </span>
                                    <span>
                                        {formatHours(
                                            totals.remainingEstimateHours,
                                            languageTag,
                                        )}{' '}
                                        {t('remaining')}
                                    </span>
                                </div>

                                <div className="mt-6 mb-2.5">
                                    <h2 className="text-lg font-medium">
                                        {t('Estimate distribution')}
                                    </h2>
                                    <span className="text-xs text-muted-foreground">
                                        {t(
                                            'Configured deliverable level · operational tasks are not counted twice',
                                        )}
                                    </span>
                                </div>
                                <div
                                    className="grid gap-2.5"
                                    aria-label={t(
                                        'Estimated hours per deliverable',
                                    )}
                                >
                                    {deliverables.map((deliverable) => (
                                        <div
                                            key={deliverable.taskId}
                                            className="grid grid-cols-[minmax(140px,1fr)_1.4fr_52px] items-center gap-3 @min-[700px]:grid-cols-[minmax(180px,1.3fr)_2.4fr_58px]"
                                        >
                                            <a
                                                href={deliverable.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="truncate hover:underline"
                                            >
                                                {deliverable.name}
                                            </a>
                                            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                                                {deliverable.estimateHours !==
                                                    null &&
                                                    maxEstimate > 0 && (
                                                        <div
                                                            className="h-full rounded-full bg-chart-2"
                                                            style={{
                                                                width: `${(deliverable.estimateHours / maxEstimate) * 100}%`,
                                                            }}
                                                        />
                                                    )}
                                            </div>
                                            <strong className="text-right font-medium tabular-nums">
                                                {formatHours(
                                                    deliverable.estimateHours,
                                                    languageTag,
                                                )}
                                            </strong>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <aside>
                                <h2 className="text-lg font-medium">
                                    {t('Meeting readiness')}
                                </h2>
                                <div className="mt-3 grid gap-3.5">
                                    {validation.issues.map((issue) => {
                                        const copy = issueCopy(issue.field);

                                        return (
                                            <div
                                                key={issue.field}
                                                className="grid grid-cols-[20px_1fr] items-start gap-2.5"
                                            >
                                                <span
                                                    className="mt-0.5 flex size-5 items-center justify-center rounded-full bg-amber-500/15 text-xs font-medium text-amber-700 dark:text-amber-300"
                                                    aria-hidden="true"
                                                >
                                                    !
                                                </span>
                                                <div>
                                                    <strong className="font-medium">
                                                        {t(copy.title, {
                                                            count: issue.count,
                                                        })}
                                                    </strong>
                                                    <div className="text-xs text-muted-foreground">
                                                        {t(copy.detail)}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <h2 className="mt-6 text-lg font-medium">
                                    {t('Identified people')}
                                </h2>
                                <div className="mt-2.5 flex flex-wrap gap-2">
                                    {validation.people.map((person) => (
                                        <span
                                            key={person}
                                            className="rounded-full bg-foreground/[0.07] px-2 py-[3px] text-xs font-medium dark:bg-foreground/10"
                                        >
                                            {initials(person)} · {person}
                                        </span>
                                    ))}
                                    {validation.deliverables.some(
                                        (deliverable) =>
                                            deliverable.owners.length === 0,
                                    ) && (
                                        <span className="rounded-full bg-foreground/[0.07] px-2 py-[3px] text-xs font-medium dark:bg-foreground/10">
                                            + {t('unassigned')}
                                        </span>
                                    )}
                                </div>
                            </aside>
                        </div>
                    </section>
                )}

                {tab === 'deliverables' && (
                    <section
                        role="tabpanel"
                        aria-label={t('Deliverables')}
                        className="grid gap-3"
                    >
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-medium">
                                    {t('Annex deliverables')}
                                </h2>
                                <span className="text-xs text-muted-foreground">
                                    {t('Real data from :source', {
                                        source:
                                            validation.budgetSourceLabels.join(
                                                ', ',
                                            ) || '—',
                                    })}
                                </span>
                            </div>
                            <span className="rounded-full bg-foreground/[0.07] px-2 py-[3px] text-xs font-medium dark:bg-foreground/10">
                                {t(':count deliverables', {
                                    count: validation.deliverables.length,
                                })}
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[720px] border-collapse">
                                <thead>
                                    <tr>
                                        <th className="border-b px-2 py-2.5 text-left font-medium text-muted-foreground">
                                            {t('Deliverable')}
                                        </th>
                                        <th className="border-b px-2 py-2.5 text-left font-medium text-muted-foreground">
                                            {t('Estimate')}
                                        </th>
                                        <th className="border-b px-2 py-2.5 text-left font-medium text-muted-foreground">
                                            {t('Owner')}
                                        </th>
                                        <th className="border-b px-2 py-2.5 text-left font-medium text-muted-foreground">
                                            {t('Start')}
                                        </th>
                                        <th className="border-b px-2 py-2.5 text-left font-medium text-muted-foreground">
                                            {t('Deadline')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {validation.deliverables.map(
                                        (deliverable) => (
                                            <tr key={deliverable.taskId}>
                                                <td className="border-b px-2 py-2.5 font-medium">
                                                    <a
                                                        href={deliverable.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="hover:underline"
                                                    >
                                                        {deliverable.name}
                                                    </a>
                                                </td>
                                                <td className="border-b px-2 py-2.5 tabular-nums">
                                                    {formatHours(
                                                        deliverable.estimateHours,
                                                        languageTag,
                                                    )}
                                                </td>
                                                <td className="border-b px-2 py-2.5">
                                                    {deliverable.owners.join(
                                                        ', ',
                                                    ) || t('Unassigned')}
                                                </td>
                                                <td className="border-b px-2 py-2.5">
                                                    {deliverable.startDate
                                                        ? formatDate(
                                                              deliverable.startDate,
                                                              languageTag,
                                                          )
                                                        : '—'}
                                                </td>
                                                <td className="border-b px-2 py-2.5">
                                                    {deliverable.dueDate
                                                        ? formatDate(
                                                              deliverable.dueDate,
                                                              languageTag,
                                                          )
                                                        : '—'}
                                                </td>
                                            </tr>
                                        ),
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {tab === 'timeline' && (
                    <section
                        role="tabpanel"
                        aria-label={t('Timeline')}
                        className="grid gap-3"
                    >
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-medium">
                                    {t('Timeline derived from ClickUp')}
                                </h2>
                                <span className="text-xs text-muted-foreground">
                                    {timelineIncomplete
                                        ? t(
                                              'Deliverables with missing start or due dates remain explicit',
                                          )
                                        : t(
                                              'Deliverable dates synchronized from ClickUp',
                                          )}
                                </span>
                            </div>
                            <span className="rounded-full bg-foreground/[0.07] px-2 py-[3px] text-xs font-medium dark:bg-foreground/10">
                                {timelineIncomplete
                                    ? t('Incomplete draft')
                                    : t('Complete')}
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <div
                                className="grid min-w-[700px] grid-cols-[150px_repeat(6,minmax(70px,1fr))] items-center gap-x-1.5 gap-y-2"
                                role="img"
                                aria-label={t(
                                    'Timeline for configured deliverables',
                                )}
                            >
                                <div />
                                {timeline.ticks.map((tick) => (
                                    <div
                                        key={tick.toISOString()}
                                        className="text-center text-xs text-muted-foreground"
                                    >
                                        {formatDate(tick, languageTag)}
                                    </div>
                                ))}
                                {validation.deliverables.map((deliverable) => {
                                    const start = deliverable.startDate
                                        ? parseDate(deliverable.startDate)
                                        : null;
                                    const end = deliverable.dueDate
                                        ? parseDate(deliverable.dueDate)
                                        : null;
                                    const left = start
                                        ? positionInTimeline(start, timeline)
                                        : 0;
                                    const right = end
                                        ? positionInTimeline(end, timeline)
                                        : left;

                                    return (
                                        <div
                                            key={deliverable.taskId}
                                            className="contents"
                                        >
                                            <a
                                                href={deliverable.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="truncate hover:underline"
                                            >
                                                {deliverable.name}
                                            </a>
                                            <div className="relative col-span-6 h-6 overflow-hidden rounded-md border bg-muted/35">
                                                {start && end ? (
                                                    <span
                                                        className="absolute inset-y-0 flex items-center overflow-hidden rounded-md border border-chart-1/45 bg-chart-1/25 px-2 text-xs whitespace-nowrap"
                                                        style={{
                                                            left: `${left}%`,
                                                            width: `${Math.max(4, right - left)}%`,
                                                        }}
                                                    >
                                                        {formatHours(
                                                            deliverable.estimateHours,
                                                            languageTag,
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                                                        {t(
                                                            'Missing start and/or due date',
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </section>
                )}

                <footer className="pt-1 text-xs text-muted-foreground">
                    {t(
                        'Source: ClickUp · estimated budget from :budget; recorded hours from :operations.',
                        {
                            budget:
                                validation.budgetSourceLabels.join(', ') || '—',
                            operations:
                                validation.operationalSourceLabels.join(', ') ||
                                '—',
                        },
                    )}
                </footer>
            </div>
        </main>
    );
}
