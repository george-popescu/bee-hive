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
import { dashboard, login } from '@/routes';

const productAreas = [
    {
        icon: UsersRound,
        title: 'Capacitate și alocare',
        description:
            'Plan lunar în ore, disponibil după concedii și vizibilitate clară pe echipe și proiecte.',
    },
    {
        icon: BarChart3,
        title: 'Planificat vs. realizat',
        description:
            'Pontaje ClickUp read-only, ajustări auditate și semnale rapide pentru abateri și supra-alocare.',
    },
    {
        icon: ClipboardList,
        title: 'Board-uri pentru PM',
        description:
            'T&M, livrabile, planificare săptămânală și Gantt într-un singur spațiu operațional.',
    },
];

export default function Welcome() {
    const { auth } = usePage().props;
    const primaryHref = auth.user ? dashboard() : login();
    const primaryLabel = auth.user ? 'Deschide aplicația' : 'Autentificare';

    return (
        <>
            <Head title="Capacitate, alocare și livrare" />
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
                                    BEE CODED HIVE
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    Capacity & Delivery
                                </span>
                            </span>
                        </Link>

                        <div className="flex items-center gap-3">
                            <Badge variant="outline" className="hidden sm:flex">
                                Aplicație internă
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
                                Operațiuni clare, într-un singur loc
                            </Badge>
                            <div className="flex max-w-3xl flex-col gap-5">
                                <h1 className="text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                                    Știm cine este disponibil, unde lucrăm și ce
                                    livrăm.
                                </h1>
                                <p className="max-w-2xl text-lg leading-8 text-pretty text-muted-foreground">
                                    Hive conectează planificarea echipei cu
                                    activitatea reală din ClickUp, fără să
                                    schimbe datele sursă și fără foi de calcul
                                    paralele.
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
                                        Vezi capabilitățile
                                    </a>
                                </Button>
                            </div>

                            <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
                                <span className="flex items-center gap-2">
                                    <ShieldCheck className="size-4" />
                                    Acces pe roluri
                                </span>
                                <span className="flex items-center gap-2">
                                    <Clock3 className="size-4" />
                                    ClickUp read-only
                                </span>
                                <span className="flex items-center gap-2">
                                    <CheckCircle2 className="size-4" />
                                    Modificări auditate
                                </span>
                            </div>
                        </div>

                        <Card className="relative overflow-hidden shadow-xl shadow-foreground/5">
                            <CardHeader className="border-b bg-muted/40">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex flex-col gap-1">
                                        <CardTitle>
                                            Privire operațională
                                        </CardTitle>
                                        <CardDescription>
                                            Plan, capacitate și execuție în
                                            aceeași imagine.
                                        </CardDescription>
                                    </div>
                                    <Badge variant="outline">Live</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-5 pt-6">
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <Metric
                                        label="Capacitate"
                                        value="Disponibilă"
                                        detail="după concedii"
                                    />
                                    <Metric
                                        label="Plan"
                                        value="În ore"
                                        detail="pe proiect"
                                    />
                                    <Metric
                                        label="Realizat"
                                        value="ClickUp"
                                        detail="read-only"
                                    />
                                </div>

                                <Separator />

                                <div className="flex flex-col gap-3">
                                    <PreviewRow
                                        icon={UsersRound}
                                        title="Utilizare echipă"
                                        detail="capacitate și abateri lunare"
                                        badge="Management"
                                    />
                                    <PreviewRow
                                        icon={CalendarRange}
                                        title="Planificare săptămânală"
                                        detail="resurse, livrabile și Gantt"
                                        badge="PM"
                                    />
                                    <PreviewRow
                                        icon={ClipboardList}
                                        title="Alocări"
                                        detail="plan în ore, pe echipă"
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
                                    Un flux, mai multe roluri
                                </Badge>
                                <h2 className="text-3xl font-semibold tracking-tight">
                                    Fiecare vede exact ce are de decis.
                                </h2>
                                <p className="text-muted-foreground">
                                    Aceleași date, prezentate diferit pentru
                                    Management, Team Leads și Project Managers.
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
                        <span>BEE CODED HIVE</span>
                        <span>Capacitate · Alocare · Livrare</span>
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
