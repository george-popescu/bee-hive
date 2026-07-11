import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    ChartNoAxesCombined,
    ClipboardList,
    Clock3,
    Settings2,
    ShieldCheck,
    UsersRound,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { dashboard } from '@/routes';
import { index as adminIndex } from '@/routes/admin';
import { index as managementIndex } from '@/routes/management';
import { index as pmBoardIndex } from '@/routes/pm_board';
import { index as teamLeadIndex } from '@/routes/team_lead';
import type { NavItem } from '@/types';

const modules: Array<
    NavItem & {
        description: string;
        permissions: string[];
        badge: string;
    }
> = [
    {
        title: 'Utilizare echipă',
        description:
            'Capacitate disponibilă, planificat vs. realizat și semnale de supra-alocare.',
        href: managementIndex(),
        icon: ChartNoAxesCombined,
        permissions: ['management.view'],
        badge: 'Management',
    },
    {
        title: 'Planificare echipă',
        description:
            'Alocări lunare în ore și comparația cu activitatea sincronizată.',
        href: teamLeadIndex(),
        icon: UsersRound,
        permissions: ['team-lead.view'],
        badge: 'Team Lead',
    },
    {
        title: 'Board-uri PM',
        description: 'T&M, livrabile, planificare săptămânală și vedere Gantt.',
        href: pmBoardIndex(),
        icon: ClipboardList,
        permissions: ['pm-boards.view'],
        badge: 'PM',
    },
    {
        title: 'Administrare',
        description:
            'Echipă, proiecte, roluri, permisiuni, setări și jurnal audit.',
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

export default function Dashboard() {
    const { auth } = usePage().props;
    const visibleModules = modules.filter((module) =>
        module.permissions.some((permission) =>
            auth.permissions.includes(permission),
        ),
    );
    const firstName = auth.user?.name?.split(' ')[0] ?? 'coleg';

    return (
        <>
            <Head title="Acasă" />
            <div className="flex h-full flex-1 flex-col gap-8 p-4 md:p-6">
                <section className="relative overflow-hidden rounded-2xl border bg-muted/30 p-6 md:p-8">
                    <div className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-primary/5 blur-3xl" />
                    <div className="relative flex max-w-3xl flex-col gap-4">
                        <Badge variant="outline" className="w-fit">
                            BEE CODED HiveOps
                        </Badge>
                        <div className="flex flex-col gap-2">
                            <h1 className="text-3xl font-semibold tracking-tight">
                                Bun venit, {firstName}.
                            </h1>
                            <p className="text-base leading-7 text-muted-foreground">
                                Alege zona în care lucrezi. Opțiunile sunt
                                adaptate automat rolului și permisiunilor tale.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-2">
                                <Clock3 className="size-4" />
                                ClickUp read-only
                            </span>
                            <span className="flex items-center gap-2">
                                <ShieldCheck className="size-4" />
                                Acces pe roluri
                            </span>
                        </div>
                    </div>
                </section>

                {visibleModules.length > 0 ? (
                    <section className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-xl font-semibold">
                                Spațiul tău de lucru
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Acces rapid la dashboardurile disponibile.
                            </p>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {visibleModules.map((module) => (
                                <Card key={module.title}>
                                    <CardHeader>
                                        <div className="flex items-start justify-between gap-4">
                                            <span className="flex size-10 items-center justify-center rounded-lg bg-muted">
                                                {module.icon && (
                                                    <module.icon className="size-5" />
                                                )}
                                            </span>
                                            <Badge variant="secondary">
                                                {module.badge}
                                            </Badge>
                                        </div>
                                        <CardTitle>{module.title}</CardTitle>
                                        <CardDescription className="leading-6">
                                            {module.description}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <Button asChild variant="outline">
                                            <Link href={module.href} prefetch>
                                                Deschide
                                                <ArrowRight data-icon="inline-end" />
                                            </Link>
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </section>
                ) : (
                    <Card>
                        <CardHeader>
                            <span className="flex size-10 items-center justify-center rounded-lg bg-muted">
                                <ShieldCheck className="size-5" />
                            </span>
                            <CardTitle>Acces în curs de configurare</CardTitle>
                            <CardDescription>
                                Contul tău este activ, dar nu are încă un rol
                                operațional. Contactează administratorul
                                HiveOps.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                )}
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Acasă',
            href: dashboard(),
        },
    ],
};
