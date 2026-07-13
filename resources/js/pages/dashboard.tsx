import { Head, Link, router, setLayoutProps, usePage } from '@inertiajs/react';
import {
    Activity,
    AlertTriangle,
    ArrowRight,
    CalendarDays,
    ChartNoAxesCombined,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    CircleGauge,
    ClipboardList,
    Clock3,
    DatabaseZap,
    FolderGit2,
    SearchCheck,
    Settings2,
    TrendingUp,
    UserRoundX,
    UsersRound,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
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
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import { dashboard as dashboardRoute } from '@/routes';
import { index as adminIndex } from '@/routes/admin';
import { index as managementIndex } from '@/routes/management';
import { index as pmBoardIndex } from '@/routes/pm_board';
import { index as teamLeadIndex } from '@/routes/team_lead';
import type { NavItem } from '@/types';

type TrendPoint = {
    key: string;
    label: string;
    capacityHours: number;
    plannedHours: number;
    actualHours: number | null;
    activePeople: number;
};

type ProjectPerformance = {
    id: number;
    label: string;
    plannedHours: number;
    actualHours: number;
    varianceHours: number;
};

type AttentionPerson = {
    id: number;
    name: string;
    role: string | null;
    capacityHours: number;
    plannedHours: number;
    actualHours: number | null;
    percent: number;
    status: 'over' | 'balanced' | 'under';
};

type DashboardPayload = {
    scope: {
        label: string;
        mode: 'company' | 'team' | 'projects' | 'empty';
    };
    period: {
        selected: string;
        label: string;
        options: Array<{ key: string; label: string }>;
        previous: string | null;
        next: string | null;
        asOf: string | null;
        state: 'past' | 'current' | 'future';
        progressPercent: number;
        elapsedWorkdays: number;
        totalWorkdays: number;
    };
    focusMonth: {
        key: string;
        label: string;
    };
    kpis: {
        capacityHours: number;
        capacityToDateHours: number;
        plannedHours: number;
        actualHours: number;
        utilizationPercent: number | null;
        monthlyUtilizationPercent: number;
        planningPercent: number;
        forecastHours: number | null;
        forecastVsPlanHours: number | null;
        paceStatus: 'over' | 'balanced' | 'under' | 'future' | 'empty';
        activePeople: number;
        people: number;
    };
    trend: TrendPoint[];
    projects: ProjectPerformance[];
    attention: AttentionPerson[];
    alerts: Array<{
        tone: 'danger' | 'warning';
        title: string;
        detail: string;
    }>;
    dataQuality: {
        status: 'healthy' | 'warning' | 'critical';
        entryCount: number;
        totalHours: number;
        mappedPeoplePercent: number;
        mappedProjectsPercent: number;
        issues: Array<{
            key: string;
            tone: 'danger' | 'warning';
            title: string;
            detail: string;
            count: number;
            hours: number;
        }>;
    } | null;
    sync: {
        status: 'pending' | 'running' | 'succeeded' | 'failed';
        startedAt: string | null;
        finishedAt: string | null;
        error: string | null;
        counters: Record<string, number> | null;
    } | null;
};

function hours(value: number, locale: string): string {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}h`;
}

function percent(value: number | null, locale: string): string {
    return value === null
        ? '—'
        : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}%`;
}

function initials(name: string): string {
    return name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();
}

function dateTime(value: string | null, locale: string): string {
    if (!value) {
        return '—';
    }

    return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function MetricCard({
    icon: Icon,
    label,
    value,
    detail,
    tone = 'default',
    href,
}: {
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    label: string;
    value: string;
    detail: string;
    tone?: 'default' | 'success' | 'warning';
    href?: string;
}) {
    const card = (
        <Card className="relative overflow-hidden">
            <CardHeader className="gap-3 pb-2">
                <div className="flex items-center justify-between gap-3">
                    <CardDescription>{label}</CardDescription>
                    <span
                        className={cn(
                            'flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground',
                            tone === 'success' && 'bg-success/10 text-success',
                            tone === 'warning' &&
                                'bg-warning/15 text-warning-foreground',
                        )}
                    >
                        <Icon className="size-4" />
                    </span>
                </div>
                <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-xs text-muted-foreground">{detail}</p>
            </CardContent>
        </Card>
    );

    return href ? (
        <Link
            href={href}
            prefetch
            className="rounded-xl transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
            {card}
        </Link>
    ) : (
        card
    );
}

function TrendChart({ data }: { data: TrendPoint[] }) {
    const { languageTag, t } = useTranslations();
    const numberFormatter = new Intl.NumberFormat(languageTag, {
        maximumFractionDigits: 1,
    });
    const width = 760;
    const height = 250;
    const padding = { top: 18, right: 18, bottom: 42, left: 48 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const maximum = Math.max(
        1,
        ...data.flatMap((point) => [
            point.capacityHours,
            point.plannedHours,
            point.actualHours ?? 0,
        ]),
    );
    const roundedMaximum = Math.ceil(maximum / 100) * 100 || maximum;
    const x = (index: number) =>
        padding.left +
        (data.length <= 1
            ? chartWidth / 2
            : (index / (data.length - 1)) * chartWidth);
    const y = (value: number) =>
        padding.top + chartHeight - (value / roundedMaximum) * chartHeight;
    const linePath = (
        key: 'capacityHours' | 'plannedHours' | 'actualHours',
    ) => {
        let path = '';
        let drawing = false;

        data.forEach((point, index) => {
            const value = point[key];

            if (value === null) {
                drawing = false;

                return;
            }

            path += `${drawing ? ' L' : ' M'} ${x(index)} ${y(value)}`;
            drawing = true;
        });

        return path.trim();
    };

    if (data.length === 0) {
        return (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                {t('No data yet for the active period.')}
            </div>
        );
    }

    return (
        <div className="w-full overflow-x-auto">
            <svg
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-label={t(
                    'Capacity, planned hours and actual hours over time',
                )}
                className="min-w-[620px]"
            >
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                    const value = roundedMaximum * ratio;
                    const position = y(value);

                    return (
                        <g key={ratio}>
                            <line
                                x1={padding.left}
                                y1={position}
                                x2={width - padding.right}
                                y2={position}
                                stroke="var(--border)"
                                strokeWidth="1"
                            />
                            <text
                                x={padding.left - 10}
                                y={position + 4}
                                textAnchor="end"
                                fill="var(--muted-foreground)"
                                fontSize="11"
                            >
                                {numberFormatter.format(value)}
                            </text>
                        </g>
                    );
                })}

                <path
                    d={linePath('capacityHours')}
                    fill="none"
                    stroke="var(--chart-2)"
                    strokeWidth="2.5"
                    strokeDasharray="7 6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d={linePath('plannedHours')}
                    fill="none"
                    stroke="var(--chart-1)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d={linePath('actualHours')}
                    fill="none"
                    stroke="var(--chart-3)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {data.map((point, index) => (
                    <g key={point.key}>
                        <text
                            x={x(index)}
                            y={height - 14}
                            textAnchor="middle"
                            fill="var(--muted-foreground)"
                            fontSize="11"
                        >
                            {point.label}
                        </text>
                        <circle
                            cx={x(index)}
                            cy={y(point.plannedHours)}
                            r="3.5"
                            fill="var(--card)"
                            stroke="var(--chart-1)"
                            strokeWidth="2"
                        >
                            <title>{`${point.label}: ${hours(point.plannedHours, languageTag)} ${t('Planned').toLocaleLowerCase(languageTag)}`}</title>
                        </circle>
                        {point.actualHours !== null && (
                            <circle
                                cx={x(index)}
                                cy={y(point.actualHours)}
                                r="3.5"
                                fill="var(--card)"
                                stroke="var(--chart-3)"
                                strokeWidth="2"
                            >
                                <title>{`${point.label}: ${hours(point.actualHours, languageTag)} ${t('Actual').toLocaleLowerCase(languageTag)}`}</title>
                            </circle>
                        )}
                    </g>
                ))}
            </svg>
        </div>
    );
}

function SyncStatus({ sync }: { sync: DashboardPayload['sync'] }) {
    const { languageTag, t } = useTranslations();
    const status = sync?.status ?? 'missing';
    const statusConfig = {
        missing: {
            label: t('Not synchronized'),
            className: 'bg-muted text-muted-foreground',
        },
        pending: {
            label: t('Pending'),
            className: 'bg-warning/15 text-warning-foreground',
        },
        running: {
            label: t('In progress'),
            className: 'bg-warning/15 text-warning-foreground',
        },
        succeeded: {
            label: t('Synchronized'),
            className: 'bg-success/10 text-success',
        },
        failed: {
            label: t('Error'),
            className: 'bg-destructive/10 text-destructive',
        },
    }[status];

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <DatabaseZap className="size-4" />
                    </span>
                    <Badge className={statusConfig.className}>
                        {statusConfig.label}
                    </Badge>
                </div>
                <CardTitle className="text-base">{t('ClickUp data')}</CardTitle>
                <CardDescription>
                    {sync
                        ? t('Last run: :time', {
                              time: dateTime(
                                  sync.finishedAt ?? sync.startedAt,
                                  languageTag,
                              ),
                          })
                        : t('No synchronization has run yet.')}
                </CardDescription>
            </CardHeader>
            {sync?.error && (
                <CardContent>
                    <p className="line-clamp-3 text-xs leading-5 text-destructive">
                        {sync.error}
                    </p>
                </CardContent>
            )}
        </Card>
    );
}

function DataQualityCard({
    quality,
}: {
    quality: DashboardPayload['dataQuality'];
}) {
    const { languageTag, t } = useTranslations();

    if (!quality) {
        return null;
    }

    const status = {
        healthy: { label: t('Clean data'), variant: 'success' as const },
        warning: { label: t('Needs attention'), variant: 'warning' as const },
        critical: {
            label: t('Incomplete mappings'),
            variant: 'destructive' as const,
        },
    }[quality.status];

    return (
        <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                        <SearchCheck className="size-5" />
                        <CardTitle>{t('ClickUp data quality')}</CardTitle>
                    </div>
                    <CardDescription>
                        {t(
                            ':count time entries · :hours analyzed in the selected period.',
                            {
                                count: quality.entryCount,
                                hours: hours(quality.totalHours, languageTag),
                            },
                        )}
                    </CardDescription>
                </div>
                <Badge variant={status.variant}>{status.label}</Badge>
            </CardHeader>
            <CardContent className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <div className="rounded-lg border p-4">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-muted-foreground">
                                {t('Mapped people')}
                            </span>
                            <UserRoundX className="size-4 text-muted-foreground" />
                        </div>
                        <p className="mt-2 text-2xl font-semibold tabular-nums">
                            {percent(quality.mappedPeoplePercent, languageTag)}
                        </p>
                    </div>
                    <div className="rounded-lg border p-4">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-muted-foreground">
                                {t('Mapped projects')}
                            </span>
                            <FolderGit2 className="size-4 text-muted-foreground" />
                        </div>
                        <p className="mt-2 text-2xl font-semibold tabular-nums">
                            {percent(
                                quality.mappedProjectsPercent,
                                languageTag,
                            )}
                        </p>
                    </div>
                </div>

                <div className="grid content-start gap-3 md:grid-cols-2">
                    {quality.issues.length === 0 ? (
                        <Alert className="md:col-span-2">
                            <CheckCircle2 />
                            <AlertTitle>
                                {t('No mapping issues found')}
                            </AlertTitle>
                            <AlertDescription>
                                {t(
                                    'All analyzed time entries have an identifiable person and project.',
                                )}
                            </AlertDescription>
                        </Alert>
                    ) : (
                        quality.issues.map((issue) => (
                            <Alert
                                key={issue.key}
                                variant={
                                    issue.tone === 'danger'
                                        ? 'destructive'
                                        : 'default'
                                }
                            >
                                <AlertTriangle />
                                <AlertTitle>{issue.title}</AlertTitle>
                                <AlertDescription>
                                    <p>{issue.detail}</p>
                                    <p className="font-medium text-foreground">
                                        {t(
                                            issue.key === 'locations'
                                                ? ':count folders'
                                                : ':count records',
                                            { count: issue.count },
                                        )}
                                        {issue.hours > 0
                                            ? ` · ${hours(issue.hours, languageTag)}`
                                            : ''}
                                    </p>
                                </AlertDescription>
                            </Alert>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function dashboardHref(month: string): string {
    return dashboardRoute.url({ query: { month } });
}

function projectHref(projectId: number, month: string): string {
    return pmBoardIndex.url({
        query:
            projectId === 0
                ? {
                      selection: 'custom',
                      include_internal: true,
                      period: 'month',
                      anchor: `${month}-01`,
                  }
                : {
                      project: projectId,
                      period: 'month',
                      anchor: `${month}-01`,
                  },
    });
}

function ProjectImpactRow({
    project,
    maximumHours,
    href,
}: {
    project: ProjectPerformance;
    maximumHours: number;
    href?: string;
}) {
    const { languageTag } = useTranslations();
    const content = (
        <>
            <div className="flex items-start justify-between gap-4 text-sm">
                <span className="line-clamp-1 font-medium">
                    {project.label}
                </span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                    {hours(project.actualHours, languageTag)} /{' '}
                    {hours(project.plannedHours, languageTag)}
                </span>
            </div>
            <div className="grid gap-1.5">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                        className="h-full rounded-full bg-chart-3"
                        style={{
                            width: `${(project.actualHours / maximumHours) * 100}%`,
                        }}
                    />
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                        className="h-full rounded-full bg-chart-1"
                        style={{
                            width: `${(project.plannedHours / maximumHours) * 100}%`,
                        }}
                    />
                </div>
            </div>
        </>
    );

    return href ? (
        <Link
            href={href}
            prefetch
            className="flex flex-col gap-2 rounded-md transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
            {content}
        </Link>
    ) : (
        <div className="flex flex-col gap-2">{content}</div>
    );
}

function AttentionRow({
    person,
    href,
}: {
    person: AttentionPerson;
    href?: string;
}) {
    const { languageTag, t } = useTranslations();
    const content = (
        <>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {initials(person.name)}
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                            {person.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                            {person.role ?? t('Role not set')}
                        </p>
                    </div>
                    <Badge
                        variant="outline"
                        className={cn(
                            'tabular-nums',
                            person.status === 'over' &&
                                'border-destructive/30 bg-destructive/10 text-destructive',
                            person.status === 'balanced' &&
                                'border-success/30 bg-success/10 text-success',
                            person.status === 'under' &&
                                'border-warning/40 bg-warning/15 text-warning-foreground',
                        )}
                    >
                        {percent(person.percent, languageTag)}
                    </Badge>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                        className={cn(
                            'h-full rounded-full',
                            person.status === 'over'
                                ? 'bg-destructive'
                                : person.status === 'balanced'
                                  ? 'bg-success'
                                  : 'bg-warning',
                        )}
                        style={{ width: `${Math.min(100, person.percent)}%` }}
                    />
                </div>
            </div>
        </>
    );

    return href ? (
        <Link
            href={href}
            prefetch
            className="flex items-center gap-3 rounded-md transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
            {content}
        </Link>
    ) : (
        <div className="flex items-center gap-3">{content}</div>
    );
}

export default function Dashboard({
    dashboard,
}: {
    dashboard: DashboardPayload;
}) {
    const { auth } = usePage().props;
    const { languageTag, t } = useTranslations();
    const modules: Array<
        NavItem & {
            description: string;
            permissions: string[];
            badge: string;
        }
    > = [
        {
            title: t('Team utilization'),
            description: t('Capacity, planned and actual hours.'),
            href: managementIndex(),
            icon: ChartNoAxesCombined,
            permissions: ['management.view'],
            badge: 'Management',
        },
        {
            title: t('Team planning'),
            description: t('Allocations and audited adjustments'),
            href: teamLeadIndex(),
            icon: UsersRound,
            permissions: ['team-lead.view'],
            badge: 'Team Lead',
        },
        {
            title: t('PM boards'),
            description: t('Projects, delivery and time entries.'),
            href: pmBoardIndex(),
            icon: ClipboardList,
            permissions: ['pm-boards.view'],
            badge: 'PM',
        },
        {
            title: t('Administration'),
            description: t('Team, projects and access.'),
            href: adminIndex(),
            icon: Settings2,
            permissions: [
                'settings.manage',
                'users.manage',
                'roles-and-permissions.manage',
            ],
            badge: 'Admin',
        },
    ];
    const visibleModules = modules.filter((module) =>
        module.permissions.some((permission) =>
            auth.permissions.includes(permission),
        ),
    );
    const firstName = auth.user?.name?.split(' ')[0] ?? t('colleague');
    const canViewManagement = auth.permissions.includes('management.view');
    const canViewTeamLead = auth.permissions.includes('team-lead.view');
    const canViewPmBoards = auth.permissions.includes('pm-boards.view');
    const pmBoardMonthHref = pmBoardIndex.url({
        query: {
            period: 'month',
            anchor: `${dashboard.period.selected}-01`,
        },
    });
    const reportingDetail =
        dashboard.period.state === 'future'
            ? t('The month has not started yet')
            : t(':elapsed of :total working days', {
                  elapsed: dashboard.period.elapsedWorkdays,
                  total: dashboard.period.totalWorkdays,
              });
    const maximumProjectHours = Math.max(
        1,
        ...dashboard.projects.flatMap((project) => [
            project.actualHours,
            project.plannedHours,
        ]),
    );

    setLayoutProps({
        breadcrumbs: [{ title: t('Home'), href: dashboardRoute() }],
    });

    return (
        <>
            <Head title={t('Home')} />
            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                <section className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
                    <div className="flex max-w-3xl flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">BEE CODED HiveOps</Badge>
                            <Badge variant="secondary">
                                {dashboard.scope.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                                {dashboard.focusMonth.label}
                            </span>
                        </div>
                        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                            {t('Hello, :name. Here is the big picture.', {
                                name: firstName,
                            })}
                        </h1>
                        <p className="text-sm leading-6 text-muted-foreground">
                            {t(
                                'Capacity, allocations and execution in one place, based on your access.',
                            )}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {dashboard.period.previous ? (
                            <Button variant="outline" size="icon" asChild>
                                <Link
                                    href={dashboardHref(
                                        dashboard.period.previous,
                                    )}
                                    preserveScroll
                                    aria-label={t('Previous month')}
                                >
                                    <ChevronLeft />
                                </Link>
                            </Button>
                        ) : (
                            <Button
                                variant="outline"
                                size="icon"
                                disabled
                                aria-label={t('No previous month is available')}
                            >
                                <ChevronLeft />
                            </Button>
                        )}
                        <Select
                            value={dashboard.period.selected}
                            onValueChange={(month) =>
                                router.visit(dashboardHref(month), {
                                    preserveScroll: true,
                                })
                            }
                        >
                            <SelectTrigger
                                className="w-36"
                                aria-label={t('Current dashboard month')}
                            >
                                <CalendarDays />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    {dashboard.period.options.map((month) => (
                                        <SelectItem
                                            key={month.key}
                                            value={month.key}
                                        >
                                            {month.label}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        {dashboard.period.next ? (
                            <Button variant="outline" size="icon" asChild>
                                <Link
                                    href={dashboardHref(dashboard.period.next)}
                                    preserveScroll
                                    aria-label={t('Next month')}
                                >
                                    <ChevronRight />
                                </Link>
                            </Button>
                        ) : (
                            <Button
                                variant="outline"
                                size="icon"
                                disabled
                                aria-label={t('No next month is available')}
                            >
                                <ChevronRight />
                            </Button>
                        )}
                    </div>
                </section>

                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <MetricCard
                        icon={CircleGauge}
                        label={t('Monthly capacity')}
                        value={hours(dashboard.kpis.capacityHours, languageTag)}
                        detail={t(':hours as of the reporting date', {
                            hours: hours(
                                dashboard.kpis.capacityToDateHours,
                                languageTag,
                            ),
                        })}
                        href={
                            canViewManagement
                                ? managementIndex.url({
                                      query: {
                                          month: dashboard.period.selected,
                                      },
                                  })
                                : undefined
                        }
                    />
                    <MetricCard
                        icon={CalendarDays}
                        label={t('Planned')}
                        value={hours(dashboard.kpis.plannedHours, languageTag)}
                        detail={t(':percent of capacity', {
                            percent: percent(
                                dashboard.kpis.planningPercent,
                                languageTag,
                            ),
                        })}
                        tone={
                            dashboard.kpis.planningPercent > 105
                                ? 'warning'
                                : 'default'
                        }
                        href={canViewTeamLead ? teamLeadIndex.url() : undefined}
                    />
                    <MetricCard
                        icon={Activity}
                        label={t('Actual')}
                        value={hours(dashboard.kpis.actualHours, languageTag)}
                        detail={
                            dashboard.kpis.activePeople === 1
                                ? t('Time entries from :count person', {
                                      count: dashboard.kpis.activePeople,
                                  })
                                : t('Time entries from :count people', {
                                      count: dashboard.kpis.activePeople,
                                  })
                        }
                        tone="success"
                        href={canViewPmBoards ? pmBoardMonthHref : undefined}
                    />
                    <MetricCard
                        icon={ChartNoAxesCombined}
                        label={t("Today's utilization")}
                        value={percent(
                            dashboard.kpis.utilizationPercent,
                            languageTag,
                        )}
                        detail={reportingDetail}
                        href={canViewPmBoards ? pmBoardMonthHref : undefined}
                    />
                    <MetricCard
                        icon={TrendingUp}
                        label={t('Final month forecast')}
                        value={
                            dashboard.kpis.forecastHours === null
                                ? '—'
                                : hours(
                                      dashboard.kpis.forecastHours,
                                      languageTag,
                                  )
                        }
                        detail={
                            dashboard.kpis.forecastVsPlanHours === null
                                ? t('Available after the month starts')
                                : t(':value versus plan', {
                                      value: `${dashboard.kpis.forecastVsPlanHours >= 0 ? '+' : ''}${hours(
                                          dashboard.kpis.forecastVsPlanHours,
                                          languageTag,
                                      )}`,
                                  })
                        }
                        tone={
                            dashboard.kpis.paceStatus === 'over'
                                ? 'warning'
                                : dashboard.kpis.paceStatus === 'balanced'
                                  ? 'success'
                                  : 'default'
                        }
                    />
                </section>

                <section className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,0.8fr)]">
                    <Card>
                        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                            <div>
                                <CardTitle>
                                    {t('Capacity and execution')}
                                </CardTitle>
                                <CardDescription>
                                    {t(
                                        'Monthly evolution over the active period.',
                                    )}
                                </CardDescription>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                    <span className="size-2 rounded-full bg-chart-2" />
                                    {t('Capacity')}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="size-2 rounded-full bg-chart-1" />
                                    {t('Planned')}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="size-2 rounded-full bg-chart-3" />
                                    {t('Actual')}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <TrendChart data={dashboard.trend} />
                        </CardContent>
                    </Card>

                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                        <SyncStatus sync={dashboard.sync} />
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-3">
                                    <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                        <AlertTriangle className="size-4" />
                                    </span>
                                    <Badge
                                        variant={
                                            dashboard.alerts.length > 0
                                                ? 'secondary'
                                                : 'outline'
                                        }
                                    >
                                        {dashboard.alerts.length > 0
                                            ? t(':count signals', {
                                                  count: dashboard.alerts
                                                      .length,
                                              })
                                            : t('No alerts')}
                                    </Badge>
                                </div>
                                <CardTitle className="text-base">
                                    {t('To watch')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                {dashboard.alerts.length === 0 ? (
                                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                                        {t(
                                            "No critical signals in this month's planning.",
                                        )}
                                    </div>
                                ) : (
                                    dashboard.alerts.map((alert) => (
                                        <div
                                            key={alert.title}
                                            className="flex items-start gap-2 border-b pb-3 last:border-0 last:pb-0"
                                        >
                                            <span
                                                className={cn(
                                                    'mt-1 size-2 shrink-0 rounded-full',
                                                    alert.tone === 'danger'
                                                        ? 'bg-destructive'
                                                        : 'bg-warning',
                                                )}
                                            />
                                            <div>
                                                <p className="text-sm font-medium">
                                                    {alert.title}
                                                </p>
                                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                                    {alert.detail}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </section>

                <DataQualityCard quality={dashboard.dataQuality} />

                <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)]">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('Impact projects')}</CardTitle>
                            <CardDescription>
                                {t(
                                    'First projects by planned and actual volume in :month.',
                                    {
                                        month: dashboard.focusMonth.label,
                                    },
                                )}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-5">
                            {dashboard.projects.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">
                                    {t(
                                        'No project activity in the focus month.',
                                    )}
                                </p>
                            ) : (
                                dashboard.projects.map((project) => (
                                    <ProjectImpactRow
                                        key={project.id}
                                        project={project}
                                        maximumHours={maximumProjectHours}
                                        href={
                                            canViewPmBoards
                                                ? projectHref(
                                                      project.id,
                                                      dashboard.period.selected,
                                                  )
                                                : undefined
                                        }
                                    />
                                ))
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>
                                {t('Team members requiring attention')}
                            </CardTitle>
                            <CardDescription>
                                {t(
                                    'Variances from planned capacity for the focus month.',
                                )}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            {dashboard.attention.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">
                                    {t('Current scope has no people.')}
                                </p>
                            ) : (
                                dashboard.attention.map((person) => {
                                    const href = canViewManagement
                                        ? managementIndex.url({
                                              query: {
                                                  person: person.id,
                                                  month: dashboard.period
                                                      .selected,
                                              },
                                          })
                                        : canViewTeamLead
                                          ? teamLeadIndex.url({
                                                query: { person: person.id },
                                            })
                                          : undefined;

                                    return (
                                        <AttentionRow
                                            key={person.id}
                                            person={person}
                                            href={href}
                                        />
                                    );
                                })
                            )}
                        </CardContent>
                    </Card>
                </section>

                {visibleModules.length > 0 && (
                    <section className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="font-semibold">
                                    {t('Operational areas')}
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    {t(
                                        'Quick access based on your role and permissions.',
                                    )}
                                </p>
                            </div>
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Clock3 className="size-3.5" />
                                {t('ClickUp read-only')}
                            </span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {visibleModules.map((module) => (
                                <Link
                                    key={module.title}
                                    href={module.href}
                                    prefetch
                                    className="group flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent"
                                >
                                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                                        {module.icon && (
                                            <module.icon className="size-4" />
                                        )}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-medium">
                                            {module.title}
                                        </span>
                                        <span className="block truncate text-xs text-muted-foreground">
                                            {module.description}
                                        </span>
                                    </span>
                                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                                </Link>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </>
    );
}
