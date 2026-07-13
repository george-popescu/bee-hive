import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    BarChart3,
    CalendarRange,
    CheckCircle2,
    ClipboardList,
    Clock3,
    ShieldCheck,
    UsersRound,
} from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useTranslations } from '@/hooks/use-translations';
import { dashboard, login } from '@/routes';

export default function Welcome() {
    const { auth } = usePage().props;
    const { t } = useTranslations();
    const primaryHref = auth.user ? dashboard() : login();
    const primaryLabel = auth.user ? t('Open application') : t('Log in');
    const productAreas = [
        {
            icon: UsersRound,
            title: t('Capacity and allocation'),
            description: t(
                'Monthly plan in hours, availability after leave, and clear visibility across teams and projects.',
            ),
        },
        {
            icon: BarChart3,
            title: t('Planned vs. actual'),
            description: t(
                'ClickUp read-only time entries, audited adjustments, and fast signals for variances and over-allocation.',
            ),
        },
        {
            icon: ClipboardList,
            title: t('PM boards'),
            description: t(
                'T&M, deliverables, weekly planning and Gantt in one operational workspace.',
            ),
        },
    ];

    return (
        <>
            <Head title={t('Capacity, allocation and delivery')} />
            <div className="relative min-h-svh overflow-hidden bg-background">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-linear-to-b from-muted to-transparent" />
                <div className="pointer-events-none absolute top-24 -right-32 size-96 rounded-full bg-primary/5 blur-3xl" />

                <header className="relative border-b bg-background/80 backdrop-blur">
                    <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-6 lg:px-8">
                        <Link href="/" className="flex items-center gap-3">
                            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                                <AppLogoIcon className="size-6 fill-current" />
                            </span>
                            <span className="flex flex-col">
                                <span className="text-sm font-semibold tracking-wide">
                                    BEE CODED HiveOps
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    Capacity, Allocation & Delivery
                                </span>
                            </span>
                        </Link>

                        <div className="flex items-center gap-3">
                            <LanguageSwitcher />
                            <Badge variant="outline" className="hidden sm:flex">
                                {t('Internal application')}
                            </Badge>
                            <Button asChild size="sm">
                                <Link href={primaryHref}>
                                    {primaryLabel}
                                    <ArrowRight data-icon="inline-end" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                </header>

                <main className="relative">
                    <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
                        <div className="flex flex-col items-start gap-7">
                            <Badge variant="secondary">
                                {t('Clear operations, in one place')}
                            </Badge>
                            <div className="flex max-w-3xl flex-col gap-5">
                                <h1 className="text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                                    {t(
                                        'We know who is available, where we work, and what we deliver.',
                                    )}
                                </h1>
                                <p className="max-w-2xl text-lg leading-8 text-pretty text-muted-foreground">
                                    {t(
                                        'HiveOps connects team planning with real ClickUp activity, without changing source data or maintaining parallel spreadsheets.',
                                    )}
                                </p>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row">
                                <Button asChild size="lg">
                                    <Link href={primaryHref}>
                                        {primaryLabel}
                                        <ArrowRight data-icon="inline-end" />
                                    </Link>
                                </Button>
                                <Button asChild size="lg" variant="outline">
                                    <a href="#capabilitati">
                                        {t('Go to capabilities')}
                                    </a>
                                </Button>
                            </div>

                            <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
                                <span className="flex items-center gap-2">
                                    <ShieldCheck className="size-4" />
                                    {t('Role-based access')}
                                </span>
                                <span className="flex items-center gap-2">
                                    <Clock3 className="size-4" />
                                    {t('ClickUp read-only')}
                                </span>
                                <span className="flex items-center gap-2">
                                    <CheckCircle2 className="size-4" />
                                    {t('All changes are audited')}
                                </span>
                            </div>
                        </div>

                        <Card className="relative overflow-hidden shadow-xl shadow-foreground/5">
                            <CardHeader className="border-b bg-muted/40">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex flex-col gap-1">
                                        <CardTitle>
                                            {t('Operational overview')}
                                        </CardTitle>
                                        <CardDescription>
                                            {t(
                                                'Plan, capacity and execution in one view.',
                                            )}
                                        </CardDescription>
                                    </div>
                                    <Badge variant="outline">{t('Live')}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-5 pt-6">
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <Metric
                                        label={t('Capacity')}
                                        value={t('Available')}
                                        detail={t('after leave')}
                                    />
                                    <Metric
                                        label={t('Plan')}
                                        value={t('In hours')}
                                        detail={t('by project')}
                                    />
                                    <Metric
                                        label={t('Actual')}
                                        value="ClickUp"
                                        detail="read-only"
                                    />
                                </div>

                                <Separator />

                                <div className="flex flex-col gap-3">
                                    <PreviewRow
                                        icon={UsersRound}
                                        title={t('Team utilization')}
                                        detail={t(
                                            'Capacity and monthly variances',
                                        )}
                                        badge="Management"
                                    />
                                    <PreviewRow
                                        icon={CalendarRange}
                                        title={t('Weekly planning')}
                                        detail={t(
                                            'Deliverables, resources and Gantt',
                                        )}
                                        badge="PM"
                                    />
                                    <PreviewRow
                                        icon={ClipboardList}
                                        title={t('Allocation')}
                                        detail={t(
                                            'Allocation plan in hours, by team',
                                        )}
                                        badge="Team Lead"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </section>

                    <section id="capabilitati" className="border-y bg-muted/30">
                        <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-16 lg:px-8">
                            <div className="flex max-w-2xl flex-col gap-3">
                                <Badge variant="outline" className="w-fit">
                                    {t('One flow, multiple roles')}
                                </Badge>
                                <h2 className="text-3xl font-semibold tracking-tight">
                                    {t(
                                        'Every role sees exactly what it needs to decide.',
                                    )}
                                </h2>
                                <p className="text-muted-foreground">
                                    {t(
                                        'Project Managers, Team Leads and Management use the same data, presented for their decisions.',
                                    )}
                                </p>
                            </div>

                            <div className="grid gap-5 md:grid-cols-3">
                                {productAreas.map((area) => (
                                    <Card key={area.title}>
                                        <CardHeader>
                                            <span className="flex size-10 items-center justify-center rounded-lg bg-muted">
                                                <area.icon className="size-5" />
                                            </span>
                                            <CardTitle>{area.title}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <CardDescription className="text-sm leading-6">
                                                {area.description}
                                            </CardDescription>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </section>
                </main>

                <footer className="relative">
                    <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-8">
                        <span>BEE CODED HiveOps</span>
                        <span>{t('Capacity, Allocation & Delivery')}</span>
                    </div>
                </footer>
            </div>
        </>
    );
}

function Metric({
    label,
    value,
    detail,
}: {
    label: string;
    value: string;
    detail: string;
}) {
    return (
        <div className="flex flex-col gap-1 rounded-lg border p-3">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="font-semibold">{value}</span>
            <span className="text-xs text-muted-foreground">{detail}</span>
        </div>
    );
}

function PreviewRow({
    icon: Icon,
    title,
    detail,
    badge,
}: {
    icon: typeof UsersRound;
    title: string;
    detail: string;
    badge: string;
}) {
    return (
        <div className="flex items-center gap-3 rounded-lg border p-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                    {title}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                    {detail}
                </span>
            </span>
            <Badge variant="secondary">{badge}</Badge>
        </div>
    );
}
