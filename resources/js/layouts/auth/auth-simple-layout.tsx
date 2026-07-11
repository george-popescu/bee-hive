import { Link } from '@inertiajs/react';
import {
    BarChart3,
    CheckCircle2,
    ClipboardList,
    ShieldCheck,
} from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

const benefits = [
    {
        icon: BarChart3,
        title: 'Plan și realizat',
        description: 'Aceleași date, fără rapoarte paralele.',
    },
    {
        icon: ClipboardList,
        title: 'Board-uri pe roluri',
        description: 'Management, Team Lead și PM.',
    },
    {
        icon: ShieldCheck,
        title: 'Acces controlat',
        description: 'Permisiuni explicite și audit complet.',
    },
];

export default function AuthSimpleLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    return (
        <div className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(28rem,0.95fr)]">
            <aside className="relative hidden overflow-hidden border-r bg-muted/40 lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14">
                <div className="pointer-events-none absolute -top-24 -left-24 size-96 rounded-full bg-primary/5 blur-3xl" />
                <div className="relative flex flex-col gap-14">
                    <Link href={home()} className="flex items-center gap-3">
                        <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                            <AppLogoIcon className="size-7 fill-current" />
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

                    <div className="flex max-w-xl flex-col gap-6">
                        <Badge variant="outline" className="w-fit">
                            Spațiu intern de lucru
                        </Badge>
                        <div className="flex flex-col gap-3">
                            <h2 className="text-4xl leading-tight font-semibold tracking-tight text-balance">
                                Planificarea echipei, conectată la livrare.
                            </h2>
                            <p className="max-w-lg text-base leading-7 text-pretty text-muted-foreground">
                                Intră în HiveOps pentru capacitate, alocări,
                                utilizare și board-uri PM alimentate din
                                ClickUp.
                            </p>
                        </div>

                        <div className="flex flex-col gap-4">
                            {benefits.map((benefit) => (
                                <div
                                    key={benefit.title}
                                    className="flex items-center gap-3"
                                >
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background">
                                        <benefit.icon className="size-5" />
                                    </span>
                                    <span className="flex flex-col gap-0.5">
                                        <span className="text-sm font-medium">
                                            {benefit.title}
                                        </span>
                                        <span className="text-sm text-muted-foreground">
                                            {benefit.description}
                                        </span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="relative flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="size-4" />
                    ClickUp read-only · acces pe roluri · modificări auditate
                </div>
            </aside>

            <main className="flex min-h-svh items-center justify-center px-6 py-10 sm:px-10 lg:px-14">
                <div className="flex w-full max-w-md flex-col gap-8">
                    <Link
                        href={home()}
                        className="flex items-center gap-3 lg:hidden"
                    >
                        <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                            <AppLogoIcon className="size-6 fill-current" />
                        </span>
                        <span className="text-sm font-semibold tracking-wide">
                            BEE CODED HiveOps
                        </span>
                    </Link>

                    <div className="flex flex-col gap-3">
                        <h1 className="text-3xl font-semibold tracking-tight">
                            {title}
                        </h1>
                        <p className="text-sm leading-6 text-muted-foreground">
                            {description}
                        </p>
                    </div>

                    <Separator />
                    {children}

                    <p className="text-xs leading-5 text-muted-foreground">
                        Accesul este disponibil exclusiv utilizatorilor
                        autorizați de administratorul HiveOps.
                    </p>
                </div>
            </main>
        </div>
    );
}
