import AppLayoutTemplate from '@/layouts/app/app-sidebar-layout';
import type { AppLayoutProps } from '@/types';

export default function AppLayout({
    breadcrumbs = [],
    headerActions,
    children,
}: AppLayoutProps) {
    return (
        <AppLayoutTemplate
            breadcrumbs={breadcrumbs}
            headerActions={headerActions}
        >
            {children}
        </AppLayoutTemplate>
    );
}
