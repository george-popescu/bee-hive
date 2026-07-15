import { Head, setLayoutProps, usePage } from '@inertiajs/react';
import { useState } from 'react';
import type {
    MonthlyCapacityRow,
    PlanningMonth,
} from '@/components/team-planning/monthly-capacity';
import { MonthlyCapacityView } from '@/components/team-planning/monthly-capacity-view';
import type { WeeklyPlanning } from '@/components/team-planning/weekly-capacity';
import { WeeklyCapacityView } from '@/components/team-planning/weekly-capacity-view';
import { useTranslations } from '@/hooks/use-translations';
import { index as teamLeadIndex } from '@/routes/team_lead';

type Team = {
    id: number;
    name: string;
};

type Project = {
    id: number;
    label: string;
};

type Props = {
    months: PlanningMonth[];
    teams: Team[];
    projects: Project[];
    roles: string[];
    capacityRows: MonthlyCapacityRow[];
    weekly: WeeklyPlanning;
};

export default function TeamLeadPlan({
    months,
    teams,
    projects,
    roles,
    capacityRows,
    weekly,
}: Props) {
    const { t } = useTranslations();
    const pageUrl = usePage().url;
    const requestedPersonId = Number(
        new URLSearchParams(pageUrl.split('?')[1] ?? '').get('person'),
    );
    const hasRequestedPerson = capacityRows.some(
        (row) => row.person.id === requestedPersonId,
    );
    const [planningView, setPlanningView] = useState<'weekly' | 'monthly'>(
        hasRequestedPerson ? 'monthly' : 'weekly',
    );

    setLayoutProps({
        breadcrumbs: [{ title: t('Team planning'), href: teamLeadIndex() }],
    });

    return (
        <>
            <Head title={t('Team planning')} />
            <div className="flex h-full min-w-0 flex-1 flex-col overflow-x-hidden p-3 sm:p-4">
                {planningView === 'weekly' ? (
                    <WeeklyCapacityView
                        weekly={weekly}
                        projects={projects}
                        roles={roles}
                        teams={teams}
                        onShowMonthly={() => setPlanningView('monthly')}
                    />
                ) : (
                    <MonthlyCapacityView
                        months={months}
                        rows={capacityRows}
                        initialPersonId={
                            hasRequestedPerson ? requestedPersonId : undefined
                        }
                        onShowWeekly={() => setPlanningView('weekly')}
                    />
                )}
            </div>
        </>
    );
}
