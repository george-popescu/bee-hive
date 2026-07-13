import { Link } from '@inertiajs/react';
import {
    BarChart3,
    CheckCircle2,
    ClipboardList,
    ShieldCheck,
} from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTranslations } from '@/hooks/use-translations';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

export default function AuthSimpleLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    const { t } = useTranslations();
    const benefits = [
        {
            icon: BarChart3,
            title: t('Plan and actual'),
            description: t('The same data, without parallel reports.'),
        },
        {
            icon: ClipboardList,
            title: t('Board views by role'),
            description: 'Management, Team Lead & PM.',
        },
        {
            icon: ShieldCheck,
            title: t('Role-based access'),
            description: t('Role-based access and a complete audit trail.'),
        },
    ];

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
                            {t('An internal workspace')}
                        </Badge>
                        <div className="flex flex-col gap-3">
                            <h2 className="text-4xl leading-tight font-semibold tracking-tight text-balance">
                                {t('Team planning connected to delivery.')}
                            </h2>
                            <p className="max-w-lg text-base leading-7 text-pretty text-muted-foreground">
                                {t(
                                    'Sign in to HiveOps for capacity, allocations, utilization, and PM boards powered by ClickUp.',
                                )}
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
                    {t(
                        'ClickUp read-only, role-based access and audited changes',
                    )}
                </div>
            </aside>

            <main className="relative flex min-h-svh items-center justify-center px-6 py-10 sm:px-10 lg:px-14">
                <div className="absolute top-4 right-4">
                    <LanguageSwitcher />
                </div>
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
                        {t(
                            'BEE CODED HiveOps access is available exclusively to users authorized by the platform administrator.',
                        )}
                    </p>
                </div>
            </main>
        </div>
    );
}
