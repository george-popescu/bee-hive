import { Link, usePage } from '@inertiajs/react';
import {
    BookOpen,
    ChartNoAxesCombined,
    ClipboardList,
    FolderGit2,
    LayoutGrid,
    Settings2,
    UsersRound,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavFooter } from '@/components/nav-footer';
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

const mainNavItems: Array<NavItem & { permissions?: string[] }> = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
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

const footerNavItems: NavItem[] = [
    {
        title: 'Repository',
        href: 'https://github.com/laravel/react-starter-kit',
        icon: FolderGit2,
    },
    {
        title: 'Documentation',
        href: 'https://laravel.com/docs/starter-kits#react',
        icon: BookOpen,
    },
];

export function AppSidebar() {
    const { auth } = usePage().props;
    const visibleNavItems = mainNavItems.filter(
        (item) =>
            !item.permissions ||
            item.permissions.some((permission) =>
                auth.permissions.includes(permission),
            ),
    );

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
                <NavMain items={visibleNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
