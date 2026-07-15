import { router } from '@inertiajs/react';
import { Fragment } from 'react';
import { ActiveTaskTable } from '@/components/pm-board/active-task-table';
import { PeriodNavigation } from '@/components/pm-board/period-navigation';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@/lib/i18n';
import { index as pmBoardIndex } from '@/routes/pm_board';

export type ProjectSelectorProject = {
    id: number;
    label: string;
    template: 'tm' | 'deliverables' | null;
    templateLabel: string;
    managerIds: number[];
    periodHours: number;
};

export type Period = {
    type: 'week' | 'month';
    anchor: string;
    start: string;
    end: string;
    label: string;
    previousAnchor: string;
    nextAnchor: string;
};

export type BoardTask = {
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
    estimateHours: number | null;
    periodHours: number;
    totalLoggedHours: number;
    remainingHours: number | null;
    progress: number | null;
    isOverrun: boolean;
    startDate: string | null;
    dueDate: string | null;
};

export type ProjectSelectorViewProps = {
    projects: ProjectSelectorProject[];
    selectedPmId: number | null;
    selectedProject: ProjectSelectorProject | null;
    today: string;
    period: Period;
    upcomingTasks: BoardTask[];
    kpis: {
        actualHours: number;
        workedTasks: number;
        activePeople: number;
    };
};

type Timeline = {
    start: Date;
    end: Date;
    tasks: BoardTask[];
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

function formatShortDate(value: string | Date, languageTag: string): string {
    const date = typeof value === 'string' ? parseDate(value) : value;

    return new Intl.DateTimeFormat(languageTag, {
        day: 'numeric',
        month: 'short',
    }).format(date);
}

function formatPeriod(period: Period, languageTag: string): string {
    const start = parseDate(period.start);
    const end = parseDate(period.end);
    const startMonth = new Intl.DateTimeFormat(languageTag, {
        month: 'short',
    }).format(start);
    const endMonth = new Intl.DateTimeFormat(languageTag, {
        month: 'short',
    }).format(end);

    if (period.type === 'month') {
        return new Intl.DateTimeFormat(languageTag, {
            month: 'long',
            year: 'numeric',
        }).format(start);
    }

    if (startMonth === endMonth) {
        return `${start.getDate()}–${end.getDate()} ${endMonth} ${end.getFullYear()}`;
    }

    return `${start.getDate()} ${startMonth}–${end.getDate()} ${endMonth} ${end.getFullYear()}`;
}

function templateSubtitle(
    template: ProjectSelectorProject['template'],
): TranslationKey {
    if (template === 'tm') {
        return 'T&M · approved task estimates · weekly execution';
    }

    if (template === 'deliverables') {
        return 'Fixed annexes · ClickUp execution and estimates';
    }

    return 'Contract template not configured · ClickUp execution only';
}

function templateBadge(
    template: ProjectSelectorProject['template'],
): TranslationKey {
    if (template === 'tm') {
        return 'Template: T&M execution';
    }

    if (template === 'deliverables') {
        return 'Template: Fixed annex delivery';
    }

    return 'Template: Not configured';
}

function buildTimeline(tasks: BoardTask[], period: Period): Timeline | null {
    const datedTasks = tasks
        .filter((task) => task.startDate !== null || task.dueDate !== null)
        .sort((first, second) =>
            (first.dueDate ?? '9999-12-31').localeCompare(
                second.dueDate ?? '9999-12-31',
            ),
        )
        .slice(0, 3);

    if (datedTasks.length === 0) {
        return null;
    }

    const start = parseDate(period.start);
    const minimumEnd = addDays(start, period.type === 'week' ? 21 : 30);
    const taskEnds = datedTasks
        .map((task) => task.dueDate)
        .filter((date): date is string => date !== null)
        .map(parseDate);
    const end = new Date(
        Math.max(
            minimumEnd.getTime(),
            parseDate(period.end).getTime(),
            ...taskEnds.map((date) => date.getTime()),
        ),
    );
    const span = end.getTime() - start.getTime();
    const ticks = Array.from(
        { length: 4 },
        (_, index) => new Date(start.getTime() + (span * index) / 3),
    );

    return { start, end, tasks: datedTasks, ticks };
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

function taskDecision(task: BoardTask, today: string): TranslationKey {
    if (task.isOverrun) {
        return 'Review estimate';
    }

    if (task.dueDate !== null && task.dueDate < today) {
        return 'Recover deadline';
    }

    if (task.owners.length === 0) {
        return 'Confirm owner';
    }

    if (task.startDate === null) {
        return 'Confirm start';
    }

    return 'Confirm allocation';
}

function taskPriority(task: BoardTask, today: string): number {
    if (task.dueDate !== null && task.dueDate < today) {
        return 0;
    }

    if (task.isOverrun) {
        return 1;
    }

    if (task.dueDate !== null) {
        return 2;
    }

    return 3;
}

export function ProjectSelectorView({
    projects,
    selectedPmId,
    selectedProject,
    today,
    period,
    upcomingTasks,
    kpis,
}: ProjectSelectorViewProps) {
    const { languageTag, t } = useTranslations();
    const estimatedTasks = upcomingTasks
        .filter((task) => task.estimateHours !== null)
        .sort(
            (first, second) => (second.progress ?? -1) - (first.progress ?? -1),
        )
        .slice(0, 3);
    const remainingTasks = upcomingTasks.filter(
        (task) => task.remainingHours !== null,
    );
    const remainingHours = remainingTasks.reduce(
        (total, task) => total + Math.max(0, task.remainingHours ?? 0),
        0,
    );
    const deadlineTasks = upcomingTasks
        .filter((task) => task.dueDate !== null)
        .sort((first, second) =>
            (first.dueDate ?? '').localeCompare(second.dueDate ?? ''),
        );
    const closestDeadline = deadlineTasks[0] ?? null;
    const overdueTasks = deadlineTasks.filter(
        (task) => task.dueDate !== null && task.dueDate < today,
    );
    const timeline = buildTimeline(upcomingTasks, period);
    const nextDiscussion = [...upcomingTasks]
        .sort((first, second) => {
            const priority =
                taskPriority(first, today) - taskPriority(second, today);

            return priority !== 0
                ? priority
                : (first.dueDate ?? '9999-12-31').localeCompare(
                      second.dueDate ?? '9999-12-31',
                  );
        })
        .slice(0, 3);
    const todayPosition = timeline
        ? positionInTimeline(parseDate(today), timeline)
        : null;
    const navigate = (
        projectId: number,
        periodType = period.type,
        anchor = period.anchor,
    ) => {
        router.visit(
            pmBoardIndex({
                query: {
                    project: projectId,
                    period: periodType,
                    anchor,
                    ...(selectedPmId === null ? {} : { pm: selectedPmId }),
                },
            }),
            { preserveScroll: true },
        );
    };

    return (
        <main
            className="flex min-w-0 flex-1 overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8"
            style={{
                fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
        >
            <div className="@container grid w-full content-start gap-6 text-[14px] leading-[21px]">
                <header className="flex flex-wrap items-end justify-between gap-4">
                    <div className="grid min-w-0 gap-1">
                        <span className="text-xs text-muted-foreground">
                            {t('PM boards · read-only from ClickUp')}
                        </span>
                        <h1 className="truncate text-xl leading-tight font-medium">
                            {selectedProject?.label ?? t('No project selected')}
                        </h1>
                        <p className="text-muted-foreground">
                            {selectedProject
                                ? t(templateSubtitle(selectedProject.template))
                                : t('No visible projects are available.')}
                        </p>
                    </div>

                    <div className="grid w-full gap-2 @min-[620px]:w-[293px]">
                        <label className="grid gap-1">
                            <span className="font-medium">{t('Project')}</span>
                            <Select
                                value={selectedProject?.id.toString()}
                                onValueChange={(value) =>
                                    navigate(Number(value))
                                }
                                disabled={projects.length === 0}
                            >
                                <SelectTrigger
                                    aria-label={t('Project')}
                                    className="h-7 w-full rounded-[10px] bg-foreground/[0.06] px-2 shadow-none data-[size=default]:h-7 dark:bg-foreground/10"
                                >
                                    <SelectValue
                                        placeholder={t('No project selected')}
                                    />
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

                        <label className="grid gap-1">
                            <span className="font-medium">{t('View')}</span>
                            <Select
                                value={period.type}
                                onValueChange={(value) => {
                                    if (selectedProject) {
                                        navigate(
                                            selectedProject.id,
                                            value as Period['type'],
                                        );
                                    }
                                }}
                                disabled={selectedProject === null}
                            >
                                <SelectTrigger
                                    aria-label={t('View')}
                                    className="h-7 w-full rounded-[10px] bg-foreground/[0.06] px-2 shadow-none data-[size=default]:h-7 dark:bg-foreground/10"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent align="start">
                                    <SelectItem value="week">
                                        {t('Week')}
                                    </SelectItem>
                                    <SelectItem value="month">
                                        {t('Month')}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </label>

                        {selectedProject && (
                            <PeriodNavigation
                                label={formatPeriod(period, languageTag)}
                                onPrevious={() =>
                                    navigate(
                                        selectedProject.id,
                                        period.type,
                                        period.previousAnchor,
                                    )
                                }
                                onNext={() =>
                                    navigate(
                                        selectedProject.id,
                                        period.type,
                                        period.nextAnchor,
                                    )
                                }
                            />
                        )}
                    </div>
                </header>

                {selectedProject && (
                    <>
                        <div className="flex flex-wrap items-center gap-2.5">
                            <span className="rounded-full bg-[#e5f2ff] px-2 py-[3px] text-xs leading-4 font-medium text-[#237cc7] dark:bg-[#0d273f] dark:text-[#83c3ff]">
                                {t(templateBadge(selectedProject.template))}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {formatPeriod(period, languageTag)}
                            </span>
                        </div>

                        <section className="grid grid-cols-1 gap-2.5 @min-[620px]:grid-cols-3">
                            <div className="grid gap-0.5 rounded-[20px] bg-foreground/[0.05] p-3 dark:bg-foreground/10">
                                <span className="text-muted-foreground">
                                    {selectedProject.template === 'deliverables'
                                        ? t('Hours consumed')
                                        : period.type === 'month'
                                          ? t('Worked this month')
                                          : t('Worked this week')}
                                </span>
                                <strong className="text-xl leading-tight font-medium tabular-nums">
                                    {formatHours(kpis.actualHours, languageTag)}
                                </strong>
                                <span className="text-xs">
                                    {selectedProject.template === 'deliverables'
                                        ? t('Across active deliverables')
                                        : selectedProject.template === 'tm'
                                          ? t('Approved and operational work')
                                          : t('ClickUp execution only')}
                                </span>
                            </div>
                            <div className="grid gap-0.5 rounded-[20px] bg-foreground/[0.05] p-3 dark:bg-foreground/10">
                                <span className="text-muted-foreground">
                                    {t('Estimate remaining')}
                                </span>
                                <strong className="text-xl leading-tight font-medium tabular-nums">
                                    {remainingTasks.length > 0
                                        ? formatHours(
                                              remainingHours,
                                              languageTag,
                                          )
                                        : '—'}
                                </strong>
                                <span className="text-xs">
                                    {remainingTasks.length > 0
                                        ? t('Across scheduled tasks')
                                        : t('Estimate data missing')}
                                </span>
                            </div>
                            <div className="grid gap-0.5 rounded-[20px] bg-foreground/[0.05] p-3 dark:bg-foreground/10">
                                <span className="text-muted-foreground">
                                    {t('Closest deadline')}
                                </span>
                                <strong className="text-xl leading-tight font-medium tabular-nums">
                                    {closestDeadline?.dueDate
                                        ? formatShortDate(
                                              closestDeadline.dueDate,
                                              languageTag,
                                          )
                                        : '—'}
                                </strong>
                                <span className="truncate text-xs">
                                    {overdueTasks.length > 0
                                        ? t(':count overdue tasks', {
                                              count: overdueTasks.length,
                                          })
                                        : closestDeadline
                                          ? closestDeadline.name
                                          : t('No deadline data')}
                                </span>
                            </div>
                        </section>

                        <section className="grid gap-3">
                            <div className="flex flex-wrap items-baseline justify-between gap-3">
                                <h2 className="text-lg leading-tight font-medium">
                                    {selectedProject.template === 'deliverables'
                                        ? t(
                                              'Active deliverables: delivery vs. estimate',
                                          )
                                        : t(
                                              'Approved work: delivery vs. estimate',
                                          )}
                                </h2>
                                <span className="text-xs text-muted-foreground">
                                    {selectedProject.template === 'deliverables'
                                        ? t(
                                              'Contract data missing · ClickUp estimates shown',
                                          )
                                        : t(
                                              'Completion and estimate consumption are separate',
                                          )}
                                </span>
                            </div>

                            <div>
                                {estimatedTasks.map((task) => {
                                    const percentage = Math.max(
                                        0,
                                        task.progress ?? 0,
                                    );
                                    const isMaintenance = task.name
                                        .toLowerCase()
                                        .includes('maintenance');

                                    return (
                                        <div
                                            key={task.id}
                                            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b py-[9px] @min-[620px]:grid-cols-[minmax(150px,1fr)_2fr_auto]"
                                        >
                                            <a
                                                href={task.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="truncate font-medium hover:underline"
                                            >
                                                {task.name}
                                            </a>
                                            <div className="col-span-2 row-start-2 h-[9px] overflow-hidden rounded-full bg-foreground/10 @min-[620px]:col-span-1 @min-[620px]:row-start-auto">
                                                <div
                                                    className={`h-full rounded-full ${
                                                        isMaintenance
                                                            ? 'bg-[#5dc977] dark:bg-[#74d58b]'
                                                            : task.isOverrun ||
                                                                percentage >= 85
                                                              ? 'bg-[#f3883b] dark:bg-[#f59a56]'
                                                              : 'bg-[#339cff] dark:bg-[#83c3ff]'
                                                    }`}
                                                    style={{
                                                        width: `${Math.min(percentage, 100)}%`,
                                                    }}
                                                />
                                            </div>
                                            <span
                                                className={`text-right tabular-nums ${task.isOverrun ? 'text-destructive' : ''}`}
                                            >
                                                {task.isOverrun
                                                    ? t(':percent% consumed', {
                                                          percent:
                                                              Math.round(
                                                                  percentage,
                                                              ),
                                                      })
                                                    : `${formatHours(task.totalLoggedHours, languageTag).replace('h', '')} / ${formatHours(task.estimateHours, languageTag)}`}
                                            </span>
                                        </div>
                                    );
                                })}
                                {estimatedTasks.length === 0 && (
                                    <div className="border-b py-4 text-muted-foreground">
                                        {t('No estimated active tasks.')}
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="grid gap-3">
                            <div className="flex flex-wrap items-baseline justify-between gap-3">
                                <h2 className="text-lg leading-tight font-medium">
                                    {t('ClickUp timeline')}
                                </h2>
                                <span className="text-xs text-muted-foreground">
                                    {t(
                                        'Task dates, estimates and owners from ClickUp',
                                    )}
                                </span>
                            </div>

                            {timeline ? (
                                <div
                                    className="grid grid-cols-[112px_repeat(4,minmax(0,1fr))] items-center gap-x-[3px] gap-y-1.5 @min-[620px]:grid-cols-[minmax(142px,1.2fr)_repeat(4,minmax(0,1fr))] @min-[620px]:gap-x-1.5"
                                    role="img"
                                    aria-label={t(
                                        'Task dates, estimates and owners from ClickUp',
                                    )}
                                >
                                    <div />
                                    {timeline.ticks.map((tick) => (
                                        <div
                                            key={tick.toISOString()}
                                            className="border-b pb-1 text-center text-muted-foreground"
                                        >
                                            {formatShortDate(tick, languageTag)}
                                        </div>
                                    ))}
                                    {timeline.tasks.map((task) => {
                                        const barStart = task.startDate
                                            ? parseDate(task.startDate)
                                            : timeline.start;
                                        const barEnd = task.dueDate
                                            ? parseDate(task.dueDate)
                                            : addDays(barStart, 1);
                                        const left = positionInTimeline(
                                            barStart,
                                            timeline,
                                        );
                                        const right = positionInTimeline(
                                            barEnd,
                                            timeline,
                                        );
                                        const overdue =
                                            task.dueDate !== null &&
                                            task.dueDate < today;

                                        return (
                                            <Fragment key={task.id}>
                                                <div className="min-w-0">
                                                    <a
                                                        href={task.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="block truncate font-medium hover:underline"
                                                    >
                                                        {task.name}
                                                    </a>
                                                    <div className="truncate text-xs text-muted-foreground">
                                                        {overdue
                                                            ? t('overdue')
                                                            : task.dueDate
                                                              ? formatShortDate(
                                                                    task.dueDate,
                                                                    languageTag,
                                                                )
                                                              : t(
                                                                    'No due date',
                                                                )}
                                                    </div>
                                                </div>
                                                <div className="relative col-span-4 min-h-7 overflow-hidden">
                                                    {[25, 50, 75].map(
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
                                                    {todayPosition !== null &&
                                                        todayPosition >= 0 &&
                                                        todayPosition <=
                                                            100 && (
                                                            <span
                                                                className="absolute -inset-y-1 z-10 w-0.5 bg-foreground/55"
                                                                style={{
                                                                    left: `${todayPosition}%`,
                                                                }}
                                                            />
                                                        )}
                                                    <span
                                                        className={`absolute top-2 h-3 rounded-full ${
                                                            overdue ||
                                                            task.isOverrun
                                                                ? 'bg-destructive'
                                                                : task.name
                                                                        .toLowerCase()
                                                                        .includes(
                                                                            'maintenance',
                                                                        )
                                                                  ? 'bg-[#5dc977] dark:bg-[#74d58b]'
                                                                  : 'bg-[#339cff] dark:bg-[#83c3ff]'
                                                        }`}
                                                        style={{
                                                            left: `${left}%`,
                                                            width: `${Math.max(3, right - left)}%`,
                                                        }}
                                                    />
                                                </div>
                                            </Fragment>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="border-b py-4 text-muted-foreground">
                                    {t('Date data missing for active tasks.')}
                                </div>
                            )}
                        </section>

                        <section className="grid gap-3">
                            <div className="flex flex-wrap items-baseline justify-between gap-3">
                                <h2 className="text-lg leading-tight font-medium">
                                    {t('Next discussion')}
                                </h2>
                                <span className="text-xs text-muted-foreground">
                                    {t('Tasks requiring a delivery decision')}
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[620px] border-collapse">
                                    <colgroup>
                                        <col className="w-[35%]" />
                                        <col className="w-[28%]" />
                                        <col className="w-[12%]" />
                                        <col className="w-[25%]" />
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th className="border-b px-2 py-2.5 text-left font-medium text-muted-foreground">
                                                {t('Work item')}
                                            </th>
                                            <th className="border-b px-2 py-2.5 text-left font-medium text-muted-foreground">
                                                {t('Owner')}
                                            </th>
                                            <th className="border-b px-2 py-2.5 text-right font-medium text-muted-foreground">
                                                {t('Hours left')}
                                            </th>
                                            <th className="border-b px-2 py-2.5 text-left font-medium text-muted-foreground">
                                                {t('Decision')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {nextDiscussion.map((task) => (
                                            <tr key={task.id}>
                                                <td className="border-b px-2 py-2.5 font-medium">
                                                    <a
                                                        href={task.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="hover:underline"
                                                    >
                                                        {task.name}
                                                    </a>
                                                </td>
                                                <td className="border-b px-2 py-2.5">
                                                    {task.owners.join(', ') ||
                                                        t('Unassigned')}
                                                </td>
                                                <td
                                                    className={`border-b px-2 py-2.5 text-right tabular-nums ${task.isOverrun ? 'text-destructive' : ''}`}
                                                >
                                                    {task.isOverrun
                                                        ? t('Overrun')
                                                        : formatHours(
                                                              task.remainingHours,
                                                              languageTag,
                                                          )}
                                                </td>
                                                <td className="border-b px-2 py-2.5">
                                                    {t(
                                                        taskDecision(
                                                            task,
                                                            today,
                                                        ),
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {nextDiscussion.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={4}
                                                    className="border-b px-2 py-6 text-center text-muted-foreground"
                                                >
                                                    {t(
                                                        'No active tasks require discussion.',
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        <ActiveTaskTable rows={upcomingTasks} />
                    </>
                )}
            </div>
        </main>
    );
}
