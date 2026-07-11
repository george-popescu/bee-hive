import { Head, Link, usePage } from '@inertiajs/react';
import {
    Activity,
    AlertTriangle,
    ArrowRight,
    ChartNoAxesCombined,
    CheckCircle2,
    CircleGauge,
    ClipboardList,
    Clock3,
    DatabaseZap,
    Settings2,
    TrendingUp,
    UsersRound,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
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
    focusMonth: {
        key: string;
        label: string;
    };
    kpis: {
        capacityHours: number;
        plannedHours: number;
        actualHours: number;
        utilizationPercent: number;
        planningPercent: number;
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
    sync: {
        status: 'pending' | 'running' | 'succeeded' | 'failed';
        startedAt: string | null;
        finishedAt: string | null;
        error: string | null;
        counters: Record<string, number> | null;
    } | null;
};

const modules: Array<
    NavItem & {
        description: string;
        permissions: string[];
        badge: string;
    }
> = [
    {
        title: 'Utilizare echipă',
        description: 'Capacitate, planificat și realizat.',
        href: managementIndex(),
        icon: ChartNoAxesCombined,
        permissions: ['management.view'],
        badge: 'Management',
    },
    {
        title: 'Planificare echipă',
        description: 'Alocări lunare și ajustări.',
        href: teamLeadIndex(),
        icon: UsersRound,
        permissions: ['team-lead.view'],
        badge: 'Team Lead',
    },
    {
        title: 'Board-uri PM',
        description: 'Proiecte, livrare și pontaje.',
        href: pmBoardIndex(),
        icon: ClipboardList,
        permissions: ['pm-boards.view'],
        badge: 'PM',
    },
    {
        title: 'Administrare',
        description: 'Echipă, proiecte și acces.',
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

const numberFormatter = new Intl.NumberFormat('ro-RO', {
    maximumFractionDigits: 1,
});

function hours(value: number): string {
    return `${numberFormatter.format(value)}h`;
}

function percent(value: number): string {
    return `${numberFormatter.format(value)}%`;
}

function initials(name: string): string {
    return name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();
}

function dateTime(value: string | null): string {
    if (!value) {
        return '—';
    }

    return new Intl.DateTimeFormat('ro-RO', {
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
}: {
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    label: string;
    value: string;
    detail: string;
    tone?: 'default' | 'success' | 'warning';
}) {
    return (
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
}

function TrendChart({ data }: { data: TrendPoint[] }) {
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
                Nu există încă date pentru perioada activă.
            </div>
        );
    }

    return (
        <div className="w-full overflow-x-auto">
            <svg
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-label="Evoluția capacității, orelor planificate și orelor realizate"
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
                            <title>{`${point.label}: ${hours(point.plannedHours)} planificate`}</title>
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
                                <title>{`${point.label}: ${hours(point.actualHours)} realizate`}</title>
                            </circle>
                        )}
                    </g>
                ))}
            </svg>
        </div>
    );
}

function SyncStatus({ sync }: { sync: DashboardPayload['sync'] }) {
    const status = sync?.status ?? 'missing';
    const statusConfig = {
        missing: {
            label: 'Nesincronizat',
            className: 'bg-muted text-muted-foreground',
        },
        pending: {
            label: 'În așteptare',
            className: 'bg-warning/15 text-warning-foreground',
        },
        running: {
            label: 'În desfășurare',
            className: 'bg-warning/15 text-warning-foreground',
        },
        succeeded: {
            label: 'Sincronizat',
            className: 'bg-success/10 text-success',
        },
        failed: {
            label: 'Eroare',
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
                <CardTitle className="text-base">Date ClickUp</CardTitle>
                <CardDescription>
                    {sync
                        ? `Ultima rulare: ${dateTime(sync.finishedAt ?? sync.startedAt)}`
                        : 'Nu există încă nicio sincronizare.'}
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

export default function Dashboard({
    dashboard,
}: {
    dashboard: DashboardPayload;
}) {
    const { auth } = usePage().props;
    const visibleModules = modules.filter((module) =>
        module.permissions.some((permission) =>
            auth.permissions.includes(permission),
        ),
    );
    const firstName = auth.user?.name?.split(' ')[0] ?? 'coleg';
    const maximumProjectHours = Math.max(
        1,
        ...dashboard.projects.flatMap((project) => [
            project.actualHours,
            project.plannedHours,
        ]),
    );

    return (
        <>
            <Head title="Acasă" />
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
                            Bun venit, {firstName}. Iată imaginea de ansamblu.
                        </h1>
                        <p className="text-sm leading-6 text-muted-foreground">
                            Capacitate, alocări și execuție într-un singur loc,
                            pe baza accesului tău.
                        </p>
                    </div>
                    {visibleModules[0] && (
                        <Button asChild>
                            <Link href={visibleModules[0].href} prefetch>
                                Deschide {visibleModules[0].title.toLowerCase()}
                                <ArrowRight data-icon="inline-end" />
                            </Link>
                        </Button>
                    )}
                </section>

                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                        icon={CircleGauge}
                        label="Capacitate disponibilă"
                        value={hours(dashboard.kpis.capacityHours)}
                        detail={`${dashboard.kpis.people} persoane în scope`}
                    />
                    <MetricCard
                        icon={TrendingUp}
                        label="Planificat"
                        value={hours(dashboard.kpis.plannedHours)}
                        detail={`${percent(dashboard.kpis.planningPercent)} din capacitate`}
                        tone={
                            dashboard.kpis.planningPercent > 105
                                ? 'warning'
                                : 'default'
                        }
                    />
                    <MetricCard
                        icon={Activity}
                        label="Realizat"
                        value={hours(dashboard.kpis.actualHours)}
                        detail={
                            dashboard.kpis.activePeople === 1
                                ? '1 persoană cu pontaje'
                                : `${dashboard.kpis.activePeople} persoane cu pontaje`
                        }
                        tone="success"
                    />
                    <MetricCard
                        icon={ChartNoAxesCombined}
                        label="Utilizare realizată"
                        value={percent(dashboard.kpis.utilizationPercent)}
                        detail={`Diferență față de plan: ${hours(dashboard.kpis.actualHours - dashboard.kpis.plannedHours)}`}
                    />
                </section>

                <section className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,0.8fr)]">
                    <Card>
                        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                            <div>
                                <CardTitle>Capacitate vs. execuție</CardTitle>
                                <CardDescription>
                                    Evoluție lunară în perioada activă.
                                </CardDescription>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                    <span className="size-2 rounded-full bg-chart-2" />
                                    Capacitate
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="size-2 rounded-full bg-chart-1" />
                                    Planificat
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="size-2 rounded-full bg-chart-3" />
                                    Realizat
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
                                            ? `${dashboard.alerts.length} semnale`
                                            : 'Fără alerte'}
                                    </Badge>
                                </div>
                                <CardTitle className="text-base">
                                    De urmărit
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                {dashboard.alerts.length === 0 ? (
                                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                                        Nu există semnale critice în
                                        planificarea lunii.
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

                <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)]">
                    <Card>
                        <CardHeader>
                            <CardTitle>Proiecte cu impact</CardTitle>
                            <CardDescription>
                                Primele proiecte după volumul planificat și
                                realizat în {dashboard.focusMonth.label}.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-5">
                            {dashboard.projects.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">
                                    Nu există activitate pe proiecte în luna de
                                    focus.
                                </p>
                            ) : (
                                dashboard.projects.map((project) => (
                                    <div
                                        key={project.id}
                                        className="flex flex-col gap-2"
                                    >
                                        <div className="flex items-start justify-between gap-4 text-sm">
                                            <span className="line-clamp-1 font-medium">
                                                {project.label}
                                            </span>
                                            <span className="shrink-0 text-muted-foreground tabular-nums">
                                                {hours(project.actualHours)} /{' '}
                                                {hours(project.plannedHours)}
                                            </span>
                                        </div>
                                        <div className="grid gap-1.5">
                                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                                                <div
                                                    className="h-full rounded-full bg-chart-3"
                                                    style={{
                                                        width: `${(project.actualHours / maximumProjectHours) * 100}%`,
                                                    }}
                                                />
                                            </div>
                                            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                                <div
                                                    className="h-full rounded-full bg-chart-1"
                                                    style={{
                                                        width: `${(project.plannedHours / maximumProjectHours) * 100}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Echipa care cere atenție</CardTitle>
                            <CardDescription>
                                Abateri față de capacitatea planificată pentru
                                luna de focus.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            {dashboard.attention.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">
                                    Nu există persoane în scope-ul curent.
                                </p>
                            ) : (
                                dashboard.attention.map((person) => (
                                    <div
                                        key={person.id}
                                        className="flex items-center gap-3"
                                    >
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
                                                        {person.role ??
                                                            'Rol nesetat'}
                                                    </p>
                                                </div>
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        'tabular-nums',
                                                        person.status ===
                                                            'over' &&
                                                            'border-destructive/30 bg-destructive/10 text-destructive',
                                                        person.status ===
                                                            'balanced' &&
                                                            'border-success/30 bg-success/10 text-success',
                                                        person.status ===
                                                            'under' &&
                                                            'border-warning/40 bg-warning/15 text-warning-foreground',
                                                    )}
                                                >
                                                    {percent(person.percent)}
                                                </Badge>
                                            </div>
                                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                                                <div
                                                    className={cn(
                                                        'h-full rounded-full',
                                                        person.status === 'over'
                                                            ? 'bg-destructive'
                                                            : person.status ===
                                                                'balanced'
                                                              ? 'bg-success'
                                                              : 'bg-warning',
                                                    )}
                                                    style={{
                                                        width: `${Math.min(100, person.percent)}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </section>

                {visibleModules.length > 0 && (
                    <section className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="font-semibold">
                                    Zone operaționale
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    Acces rapid în funcție de rol și permisiuni.
                                </p>
                            </div>
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Clock3 className="size-3.5" />
                                ClickUp read-only
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

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Acasă',
            href: dashboardRoute(),
        },
    ],
};
