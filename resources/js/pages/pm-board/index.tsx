import { Head, setLayoutProps } from '@inertiajs/react';
import { AnnexBoardView } from '@/components/pm-board/annex-board-view';
import type { AnnexBoardData } from '@/components/pm-board/annex-board-view';
import { ProjectSelectorView } from '@/components/pm-board/project-selector-view';
import type { ProjectSelectorViewProps } from '@/components/pm-board/project-selector-view';
import { useTranslations } from '@/hooks/use-translations';
import { index as pmBoardIndex } from '@/routes/pm_board';

type PmBoardProps = ProjectSelectorViewProps & {
    annexBoard: AnnexBoardData | null;
    sync: {
        startedAt: string | null;
        finishedAt: string | null;
    } | null;
};

export default function PmBoard(props: PmBoardProps) {
    const { t } = useTranslations();

    setLayoutProps({
        breadcrumbs: [{ title: t('PM boards'), href: pmBoardIndex() }],
    });

    return (
        <>
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
        </>
    );
}
