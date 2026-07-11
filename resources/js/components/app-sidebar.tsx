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
import { dashboard } from '@/routes';
import { index as adminIndex } from '@/routes/admin';
import { index as managementIndex } from '@/routes/management';
import { index as pmBoardIndex } from '@/routes/pm_board';
import { index as teamLeadIndex } from '@/routes/team_lead';
import type { NavItem } from '@/types';

const workspaceNavItems: Array<NavItem & { permissions?: string[] }> = [
    {
        title: 'Acasă',
        href: dashboard(),
        icon: House,
    },
    {
        title: 'Utilizare echipă',
        href: managementIndex(),
        icon: ChartNoAxesCombined,
        permissions: ['management.view'],
    },
    {
        title: 'Planificare echipă',
        href: teamLeadIndex(),
        icon: UsersRound,
        permissions: ['team-lead.view'],
    },
    {
        title: 'Board-uri PM',
        href: pmBoardIndex(),
        icon: ClipboardList,
        permissions: ['pm-boards.view'],
    },
];

const systemNavItems: Array<NavItem & { permissions?: string[] }> = [
    {
        title: 'Administrare',
        href: adminIndex(),
        icon: Settings2,
        permissions: [
            'settings.manage',
            'users.manage',
            'roles-and-permissions.manage',
        ],
    },
];

export function AppSidebar() {
    const { auth } = usePage().props;
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
                    <NavMain items={visibleSystemItems} label="Sistem" />
                )}
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
