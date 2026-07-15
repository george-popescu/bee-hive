import { Head, setLayoutProps, useForm } from '@inertiajs/react';
import { Edit3, Save, Settings2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { update as updatePerson } from '@/actions/App/Http/Controllers/Admin/AdminPersonController';
import { update as updateProject } from '@/actions/App/Http/Controllers/Admin/AdminProjectController';
import { update as updateRole } from '@/actions/App/Http/Controllers/Admin/AdminRoleController';
import { update as updateSettings } from '@/actions/App/Http/Controllers/Admin/AdminSettingController';
import { update as updateUser } from '@/actions/App/Http/Controllers/Admin/AdminUserController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTranslations } from '@/hooks/use-translations';

type Person = {
    id: number;
    name: string;
    email: string | null;
    jobRole: string | null;
    monthlyCapacityHours: number;
    weeklyCapacityHours: number | null;
    hourlyRate: number | null;
    external: boolean;
    active: boolean;
};
type Project = {
    id: number;
    label: string;
    contractType: 'tm' | 'deliverables' | null;
    boardVisible: boolean;
    active: boolean;
    managerIds: number[];
    boardConfig: {
        excluded_task_ids?: string[];
        allowed_resource_names?: string[];
    };
};
type UserRow = { id: number; name: string; email: string; roles: string[] };
type RoleRow = { id: number; name: string; permissions: string[] };
type AuditRow = {
    id: number;
    action: string;
    actor: string;
    subject: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    createdAt: string | null;
};
type Props = {
    people?: Person[];
    managers?: Array<{ id: number; name: string }>;
    projects?: Project[];
    users?: UserRow[];
    roles?: RoleRow[];
    permissions?: string[];
    settings?: Record<string, string | number | null>;
    auditLogs?: AuditRow[];
    capabilities: {
        manageSettings: boolean;
        manageUsers: boolean;
        manageRoles: boolean;
        viewAudit: boolean;
    };
};
type Section = 'people' | 'projects' | 'access' | 'settings' | 'audit';

function FieldError({ message }: { message?: string }) {
    return message ? (
        <p className="text-xs text-destructive">{message}</p>
    ) : null;
}

function PersonDialog({ person }: { person: Person }) {
    const { t } = useTranslations();
    const [open, setOpen] = useState(false);
    const form = useForm({
        job_role: person.jobRole ?? '',
        default_monthly_capacity_hours: person.monthlyCapacityHours,
        weekly_capacity_hours: person.weeklyCapacityHours ?? '',
        hourly_rate: person.hourlyRate ?? '',
        active: person.active,
    });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.put(updatePerson(person.id).url, {
            preserveScroll: true,
            onSuccess: () => setOpen(false),
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                    <Edit3 /> {t('Configure')}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <form onSubmit={submit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>{person.name}</DialogTitle>
                        <DialogDescription>
                            {t(
                                'Name, email, and ClickUp identity are read-only. Only internal data is managed here.',
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="grid gap-2">
                            <Label>{t('Primary role')}</Label>
                            <Input
                                value={form.data.job_role}
                                onChange={(e) =>
                                    form.setData('job_role', e.target.value)
                                }
                            />
                            <FieldError message={form.errors.job_role} />
                        </label>
                        <label className="grid gap-2">
                            <Label>{t('Monthly capacity (h)')}</Label>
                            <Input
                                type="number"
                                min={1}
                                step={0.25}
                                value={form.data.default_monthly_capacity_hours}
                                onChange={(e) =>
                                    form.setData(
                                        'default_monthly_capacity_hours',
                                        Number(e.target.value),
                                    )
                                }
                            />
                            <FieldError
                                message={
                                    form.errors.default_monthly_capacity_hours
                                }
                            />
                        </label>
                        <label className="grid gap-2">
                            <Label>{t('Weekly capacity (h)')}</Label>
                            <Input
                                type="number"
                                min={0}
                                step={0.25}
                                value={form.data.weekly_capacity_hours}
                                onChange={(e) =>
                                    form.setData(
                                        'weekly_capacity_hours',
                                        e.target.value === ''
                                            ? ''
                                            : Number(e.target.value),
                                    )
                                }
                            />
                            <FieldError
                                message={form.errors.weekly_capacity_hours}
                            />
                        </label>
                        <label className="grid gap-2">
                            <Label>{t('Hourly rate')}</Label>
                            <Input
                                type="number"
                                min={0}
                                step={0.01}
                                value={form.data.hourly_rate}
                                onChange={(e) =>
                                    form.setData(
                                        'hourly_rate',
                                        e.target.value === ''
                                            ? ''
                                            : Number(e.target.value),
                                    )
                                }
                            />
                            <FieldError message={form.errors.hourly_rate} />
                        </label>
                    </div>
                    <label className="flex items-center gap-2">
                        <Checkbox
                            checked={form.data.active}
                            onCheckedChange={(value) =>
                                form.setData('active', value === true)
                            }
                        />{' '}
                        {t('Active in planning and reports')}
                    </label>
                    <DialogFooter>
                        <Button disabled={form.processing} type="submit">
                            <Save /> {t('Save')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function ProjectDialog({
    project,
    managers,
}: {
    project: Project;
    managers: NonNullable<Props['managers']>;
}) {
    const { t } = useTranslations();
    const [open, setOpen] = useState(false);
    const form = useForm({
        contract_type: project.contractType,
        board_visible: project.boardVisible,
        active: project.active,
        manager_ids: project.managerIds,
        excluded_task_ids: project.boardConfig.excluded_task_ids ?? [],
        allowed_resource_names:
            project.boardConfig.allowed_resource_names ?? [],
    });
    const [excluded, setExcluded] = useState(
        form.data.excluded_task_ids.join('\n'),
    );
    const toggle = (field: 'manager_ids', value: number, enabled: boolean) => {
        const values = form.data[field];
        form.setData(
            field,
            enabled
                ? [...values, value]
                : values.filter((item) => item !== value),
        );
    };
    const toggleResource = (name: string, enabled: boolean) => {
        const values = form.data.allowed_resource_names;
        form.setData(
            'allowed_resource_names',
            enabled
                ? [...values, name]
                : values.filter((item) => item !== name),
        );
    };
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.put(updateProject(project.id).url, {
            preserveScroll: true,
            onSuccess: () => setOpen(false),
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                    <Edit3 /> {t('Configure')}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                <form onSubmit={submit} className="space-y-5">
                    <DialogHeader>
                        <DialogTitle>{project.label}</DialogTitle>
                        <DialogDescription>
                            {t(
                                'The template, visibility, project managers, and board rules are local settings.',
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="grid gap-2">
                            <Label>{t('Board template')}</Label>
                            <Select
                                value={form.data.contract_type ?? undefined}
                                onValueChange={(value) =>
                                    form.setData(
                                        'contract_type',
                                        value as Project['contractType'],
                                    )
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue
                                        placeholder={t('Not configured')}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="tm">
                                        Time & Materials
                                    </SelectItem>
                                    <SelectItem value="deliverables">
                                        {t('Deliverables / Fixed')}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </label>
                        <div className="space-y-3 pt-7">
                            <label className="flex items-center gap-2">
                                <Checkbox
                                    checked={form.data.active}
                                    onCheckedChange={(value) =>
                                        form.setData('active', value === true)
                                    }
                                />{' '}
                                {t('Active project')}
                            </label>
                            <label className="flex items-center gap-2">
                                <Checkbox
                                    checked={form.data.board_visible}
                                    onCheckedChange={(value) =>
                                        form.setData(
                                            'board_visible',
                                            value === true,
                                        )
                                    }
                                />{' '}
                                {t('Visible board')}
                            </label>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>{t('Project Managers')}</Label>
                        <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
                            {managers.map((manager) => (
                                <label
                                    key={manager.id}
                                    className="flex items-center gap-2 text-sm"
                                >
                                    <Checkbox
                                        checked={form.data.manager_ids.includes(
                                            manager.id,
                                        )}
                                        onCheckedChange={(value) =>
                                            toggle(
                                                'manager_ids',
                                                manager.id,
                                                value === true,
                                            )
                                        }
                                    />
                                    {manager.name}
                                </label>
                            ))}
                        </div>
                        <FieldError message={form.errors.manager_ids} />
                    </div>
                    <div className="space-y-2">
                        <Label>{t('Planning resource pool')}</Label>
                        <div className="grid max-h-48 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
                            {managers.map((manager) => (
                                <label
                                    key={manager.id}
                                    className="flex items-center gap-2 text-sm"
                                >
                                    <Checkbox
                                        checked={form.data.allowed_resource_names.includes(
                                            manager.name,
                                        )}
                                        onCheckedChange={(value) =>
                                            toggleResource(
                                                manager.name,
                                                value === true,
                                            )
                                        }
                                    />
                                    {manager.name}
                                </label>
                            ))}
                        </div>
                    </div>
                    <label className="grid gap-2">
                        <Label>
                            {t('Excluded recurring task IDs (one per line)')}
                        </Label>
                        <Textarea
                            rows={5}
                            value={excluded}
                            onChange={(e) => {
                                const value = e.target.value;
                                setExcluded(value);
                                form.setData(
                                    'excluded_task_ids',
                                    value
                                        .split(/\s+/)
                                        .map((id) => id.trim())
                                        .filter(Boolean),
                                );
                            }}
                        />
                        <FieldError message={form.errors.excluded_task_ids} />
                    </label>
                    <DialogFooter>
                        <Button disabled={form.processing} type="submit">
                            <Save /> {t('Save')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function UserRoles({ user, roles }: { user: UserRow; roles: RoleRow[] }) {
    const { t } = useTranslations();
    const form = useForm({ role_names: user.roles });
    const toggle = (name: string, enabled: boolean) =>
        form.setData(
            'role_names',
            enabled
                ? [...form.data.role_names, name]
                : form.data.role_names.filter((role) => role !== name),
        );

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                form.put(updateUser(user.id).url, { preserveScroll: true });
            }}
            className="flex flex-wrap items-center gap-3 rounded-md border p-3"
        >
            <div className="mr-auto">
                <p className="font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            {roles.map((role) => (
                <label
                    key={role.id}
                    className="flex items-center gap-1.5 text-sm"
                >
                    <Checkbox
                        checked={form.data.role_names.includes(role.name)}
                        onCheckedChange={(value) =>
                            toggle(role.name, value === true)
                        }
                    />
                    {role.name}
                </label>
            ))}
            <Button size="sm" disabled={form.processing} type="submit">
                {t('Save roles')}
            </Button>
            <FieldError message={form.errors.role_names} />
        </form>
    );
}

function RolePermissions({
    role,
    permissions,
}: {
    role: RoleRow;
    permissions: string[];
}) {
    const { t } = useTranslations();
    const form = useForm({ permission_names: role.permissions });
    const toggle = (name: string, enabled: boolean) =>
        form.setData(
            'permission_names',
            enabled
                ? [...form.data.permission_names, name]
                : form.data.permission_names.filter(
                      (permission) => permission !== name,
                  ),
        );

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                form.put(updateRole(role.id).url, { preserveScroll: true });
            }}
            className="space-y-3 rounded-md border p-4"
        >
            <div className="flex items-center justify-between">
                <h3 className="font-semibold">{role.name}</h3>
                <Button size="sm" disabled={form.processing} type="submit">
                    {t('Save permissions')}
                </Button>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {permissions.map((permission) => (
                    <label
                        key={permission}
                        className="flex items-center gap-2 text-sm"
                    >
                        <Checkbox
                            checked={form.data.permission_names.includes(
                                permission,
                            )}
                            onCheckedChange={(value) =>
                                toggle(permission, value === true)
                            }
                        />
                        {permission}
                    </label>
                ))}
            </div>
            <FieldError message={form.errors.permission_names} />
        </form>
    );
}

function GeneralSettings({
    settings,
}: {
    settings: NonNullable<Props['settings']>;
}) {
    const { t } = useTranslations();
    const form = useForm({
        active_period_start: String(
            settings['planning.active_start'] ?? '',
        ).slice(0, 7),
        active_period_end: String(settings['planning.active_end'] ?? '').slice(
            0,
            7,
        ),
        default_monthly_capacity_hours: Number(
            settings['capacity.default_monthly_hours'] ?? 138,
        ),
        hours_per_leave_day: Number(
            settings['capacity.hours_per_leave_day'] ?? 8,
        ),
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('General settings')}</CardTitle>
                <CardDescription>
                    {t(
                        'The active horizon and default values used in calculations.',
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.put(updateSettings().url, {
                            preserveScroll: true,
                        });
                    }}
                    className="grid gap-4 sm:grid-cols-2"
                >
                    <label className="grid gap-2">
                        <Label>{t('Period start')}</Label>
                        <Input
                            type="month"
                            value={form.data.active_period_start}
                            onChange={(e) =>
                                form.setData(
                                    'active_period_start',
                                    e.target.value,
                                )
                            }
                        />
                        <FieldError message={form.errors.active_period_start} />
                    </label>
                    <label className="grid gap-2">
                        <Label>{t('Period end')}</Label>
                        <Input
                            type="month"
                            value={form.data.active_period_end}
                            onChange={(e) =>
                                form.setData(
                                    'active_period_end',
                                    e.target.value,
                                )
                            }
                        />
                        <FieldError message={form.errors.active_period_end} />
                    </label>
                    <label className="grid gap-2">
                        <Label>{t('Default monthly capacity')}</Label>
                        <Input
                            type="number"
                            min={1}
                            step={0.25}
                            value={form.data.default_monthly_capacity_hours}
                            onChange={(e) =>
                                form.setData(
                                    'default_monthly_capacity_hours',
                                    Number(e.target.value),
                                )
                            }
                        />
                        <FieldError
                            message={form.errors.default_monthly_capacity_hours}
                        />
                    </label>
                    <label className="grid gap-2">
                        <Label>{t('Hours / leave day')}</Label>
                        <Input
                            type="number"
                            min={0.25}
                            max={24}
                            step={0.25}
                            value={form.data.hours_per_leave_day}
                            onChange={(e) =>
                                form.setData(
                                    'hours_per_leave_day',
                                    Number(e.target.value),
                                )
                            }
                        />
                        <FieldError message={form.errors.hours_per_leave_day} />
                    </label>
                    <div className="sm:col-span-2">
                        <Button disabled={form.processing} type="submit">
                            <Save /> {t('Save settings')}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

export default function AdminIndex({
    people = [],
    managers = [],
    projects = [],
    users = [],
    roles = [],
    permissions = [],
    settings = {},
    auditLogs = [],
    capabilities,
}: Props) {
    const { languageTag, t } = useTranslations();
    const [section, setSection] = useState<Section>(
        capabilities.manageSettings ? 'people' : 'access',
    );

    setLayoutProps({ title: t('Administration') });

    return (
        <>
            <Head title={t('Administration')} />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Settings2 className="size-6" />
                        <h1 className="text-2xl font-semibold">
                            {t('Administration')}
                        </h1>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {t(
                            'Operational settings, access, and the log of important changes.',
                        )}
                    </p>
                </div>
                <ToggleGroup
                    type="single"
                    variant="outline"
                    value={section}
                    onValueChange={(value) =>
                        value && setSection(value as Section)
                    }
                    className="flex-wrap justify-start"
                >
                    {capabilities.manageSettings && (
                        <>
                            <ToggleGroupItem value="people">
                                {t('Team')}
                            </ToggleGroupItem>
                            <ToggleGroupItem value="projects">
                                {t('Projects')}
                            </ToggleGroupItem>
                            <ToggleGroupItem value="settings">
                                {t('Settings')}
                            </ToggleGroupItem>
                        </>
                    )}
                    {(capabilities.manageUsers || capabilities.manageRoles) && (
                        <ToggleGroupItem value="access">
                            {t('Access')}
                        </ToggleGroupItem>
                    )}
                    {capabilities.viewAudit && (
                        <ToggleGroupItem value="audit">
                            {t('Audit')}
                        </ToggleGroupItem>
                    )}
                </ToggleGroup>
                {section === 'people' && capabilities.manageSettings && (
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('Team')}</CardTitle>
                            <CardDescription>
                                {t(
                                    ':count synchronized people; ClickUp identity cannot be edited here.',
                                    { count: people.length },
                                )}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t('Person')}</TableHead>
                                        <TableHead>{t('Role')}</TableHead>
                                        <TableHead>
                                            {t('Monthly capacity')}
                                        </TableHead>
                                        <TableHead>
                                            {t('Weekly capacity')}
                                        </TableHead>
                                        <TableHead>{t('Status')}</TableHead>
                                        <TableHead />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {people.map((person) => (
                                        <TableRow key={person.id}>
                                            <TableCell>
                                                <div className="font-medium">
                                                    {person.name}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {person.email ??
                                                        t('no email')}{' '}
                                                    {person.external &&
                                                        `· ${t('external')}`}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {person.jobRole ?? '—'}
                                            </TableCell>
                                            <TableCell>
                                                {person.monthlyCapacityHours}h
                                            </TableCell>
                                            <TableCell>
                                                {person.weeklyCapacityHours ===
                                                null
                                                    ? t('automatic')
                                                    : `${person.weeklyCapacityHours}h`}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={
                                                        person.active
                                                            ? 'success'
                                                            : 'secondary'
                                                    }
                                                >
                                                    {person.active
                                                        ? t('active')
                                                        : t('inactive')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <PersonDialog person={person} />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}
                {section === 'projects' && capabilities.manageSettings && (
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('Projects and boards')}</CardTitle>
                            <CardDescription>
                                {t(
                                    'Project manager mapping and templates are internal; project names remain synchronized.',
                                )}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t('Project')}</TableHead>
                                        <TableHead>{t('Template')}</TableHead>
                                        <TableHead>PM</TableHead>
                                        <TableHead>{t('Status')}</TableHead>
                                        <TableHead />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {projects.map((project) => (
                                        <TableRow key={project.id}>
                                            <TableCell className="font-medium">
                                                {project.label}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">
                                                    {project.contractType ===
                                                    null
                                                        ? t('Not configured')
                                                        : project.contractType ===
                                                            'deliverables'
                                                          ? t(
                                                                'Deliverables / Fixed',
                                                            )
                                                          : 'T&M'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {project.managerIds
                                                    .map(
                                                        (id) =>
                                                            managers.find(
                                                                (manager) =>
                                                                    manager.id ===
                                                                    id,
                                                            )?.name,
                                                    )
                                                    .filter(Boolean)
                                                    .join(', ') || '—'}
                                            </TableCell>
                                            <TableCell>
                                                {project.active
                                                    ? t('active')
                                                    : t('inactive')}{' '}
                                                ·{' '}
                                                {project.boardVisible
                                                    ? t('visible')
                                                    : t('hidden')}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <ProjectDialog
                                                    project={project}
                                                    managers={managers}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}
                {section === 'access' &&
                    (capabilities.manageUsers || capabilities.manageRoles) && (
                        <div className="space-y-4">
                            {capabilities.manageUsers && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <ShieldCheck />{' '}
                                            {t('Users and roles')}
                                        </CardTitle>
                                        <CardDescription>
                                            {t(
                                                'Default roles have safe permissions and can be adjusted by an administrator.',
                                            )}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {users.map((user) => (
                                            <UserRoles
                                                key={user.id}
                                                user={user}
                                                roles={roles}
                                            />
                                        ))}
                                    </CardContent>
                                </Card>
                            )}
                            {capabilities.manageRoles && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>
                                            {t('Permissions by role')}
                                        </CardTitle>
                                        <CardDescription>
                                            {t(
                                                'The Admin role cannot lose the critical capabilities that prevent access lockout.',
                                            )}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {roles.map((role) => (
                                            <RolePermissions
                                                key={role.id}
                                                role={role}
                                                permissions={permissions}
                                            />
                                        ))}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}
                {section === 'settings' && capabilities.manageSettings && (
                    <GeneralSettings settings={settings} />
                )}
                {section === 'audit' && capabilities.viewAudit && (
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('Audit log')}</CardTitle>
                            <CardDescription>
                                {t('Latest :count important changes.', {
                                    count: auditLogs.length,
                                })}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t('Time')}</TableHead>
                                        <TableHead>{t('Author')}</TableHead>
                                        <TableHead>{t('Action')}</TableHead>
                                        <TableHead>{t('Subject')}</TableHead>
                                        <TableHead>{t('Change')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {auditLogs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="whitespace-nowrap">
                                                {log.createdAt
                                                    ? new Date(
                                                          log.createdAt,
                                                      ).toLocaleString(
                                                          languageTag,
                                                      )
                                                    : '—'}
                                            </TableCell>
                                            <TableCell>{log.actor}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">
                                                    {log.action}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{log.subject}</TableCell>
                                            <TableCell className="max-w-xl font-mono text-xs whitespace-normal">
                                                {JSON.stringify(log.before)} →{' '}
                                                {JSON.stringify(log.after)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}
            </div>
        </>
    );
}
