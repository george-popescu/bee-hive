import { Head, router, setLayoutProps, usePage } from '@inertiajs/react';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { store as syncClickUp } from '@/actions/App/Http/Controllers/ClickUpSyncController';
import { AnnexBoardView } from '@/components/pm-board/annex-board-view';
import type { AnnexBoardData } from '@/components/pm-board/annex-board-view';
import { ProjectSelectorView } from '@/components/pm-board/project-selector-view';
import type { ProjectSelectorViewProps } from '@/components/pm-board/project-selector-view';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import { index as pmBoardIndex } from '@/routes/pm_board';
import type { AppLayoutProps } from '@/types';

type PmBoardProps = ProjectSelectorViewProps & {
    annexBoard: AnnexBoardData | null;
    sync: {
        status: string;
        startedAt: string | null;
        finishedAt: string | null;
        error: string | null;
    } | null;
    permissions: { managePlanning: boolean; syncClickUp: boolean };
};

function formatSyncDate(value: string, languageTag: string): string {
    return new Intl.DateTimeFormat(languageTag, {
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(new Date(value));
}

function PmBoardHeaderActions() {
    const props = usePage<PmBoardProps>().props;
    const { languageTag, t } = useTranslations();
    const [isSyncing, setIsSyncing] = useState(false);
    const syncDate = props.sync?.finishedAt ?? props.sync?.startedAt;

    const refreshClickUp = () => {
        router.post(
            syncClickUp().url,
            {},
            {
                preserveScroll: true,
                onStart: () => setIsSyncing(true),
                onFinish: () => setIsSyncing(false),
            },
        );
    };

    return (
        <>
            <span className="hidden text-xs text-muted-foreground lg:inline">
                {props.sync?.status === 'failed'
                    ? t('Last synchronization failed:error', {
                          error: props.sync.error ? ` ${props.sync.error}` : '',
                      })
                    : syncDate
                      ? `${t('Last synchronization:')} ${formatSyncDate(syncDate, languageTag)}`
                      : t('ClickUp · synchronization date missing')}
            </span>
            {props.permissions.syncClickUp && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSyncing}
                    onClick={refreshClickUp}
                >
                    <RefreshCw
                        className={isSyncing ? 'animate-spin' : undefined}
                    />
                    {t('Refresh ClickUp')}
                </Button>
            )}
        </>
    );
}

export default function PmBoard(props: PmBoardProps) {
    const { t } = useTranslations();

    setLayoutProps<Pick<AppLayoutProps, 'breadcrumbs' | 'headerActions'>>({
        breadcrumbs: [{ title: t('PM boards'), href: pmBoardIndex() }],
        headerActions: PmBoardHeaderActions,
    });

    return (
        <div className="flex min-h-full min-w-0 flex-1 flex-col overflow-x-hidden">
            <Head title={t('PM boards')} />
            {props.selectedProject?.template === 'deliverables' &&
            props.annexBoard ? (
                <AnnexBoardView
                    projects={props.projects}
                    selectedPmId={props.selectedPmId}
                    selectedProject={props.selectedProject}
                    today={props.today}
                    period={props.period}
                    annexBoard={props.annexBoard}
                    sync={props.sync}
                />
            ) : (
                <ProjectSelectorView {...props} />
            )}
        </div>
    );
}
