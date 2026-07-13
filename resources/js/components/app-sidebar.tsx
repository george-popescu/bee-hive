import { Link, usePage } from '@inertiajs/react';
import {
    ChartNoAxesCombined,
    ClipboardList,
    House,
    Settings2,
    UsersRound,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useTranslations } from '@/hooks/use-translations';
import { dashboard } from '@/routes';
import { index as adminIndex } from '@/routes/admin';
import { index as managementIndex } from '@/routes/management';
import { index as pmBoardIndex } from '@/routes/pm_board';
import { index as teamLeadIndex } from '@/routes/team_lead';
import type { NavItem } from '@/types';

export function AppSidebar() {
    const { auth } = usePage().props;
    const { t } = useTranslations();
    const workspaceNavItems: Array<NavItem & { permissions?: string[] }> = [
        { title: t('Home'), href: dashboard(), icon: House },
        {
            title: t('Team utilization'),
            href: managementIndex(),
            icon: ChartNoAxesCombined,
            permissions: ['management.view'],
        },
        {
            title: t('Team planning'),
            href: teamLeadIndex(),
            icon: UsersRound,
            permissions: ['team-lead.view'],
        },
        {
            title: t('PM boards'),
            href: pmBoardIndex(),
            icon: ClipboardList,
            permissions: ['pm-boards.view'],
        },
    ];
    const systemNavItems: Array<NavItem & { permissions?: string[] }> = [
        {
            title: t('Administration'),
            href: adminIndex(),
            icon: Settings2,
            permissions: [
                'settings.manage',
                'users.manage',
                'roles-and-permissions.manage',
            ],
        },
    ];
    const visibleItems = (items: Array<NavItem & { permissions?: string[] }>) =>
        items.filter(
            (item) =>
                !item.permissions ||
                item.permissions.some((permission) =>
                    auth.permissions.includes(permission),
                ),
        );
    const visibleWorkspaceItems = visibleItems(workspaceNavItems);
    const visibleSystemItems = visibleItems(systemNavItems);

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={visibleWorkspaceItems} />
                {visibleSystemItems.length > 0 && (
                    <NavMain items={visibleSystemItems} label={t('System')} />
                )}
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
