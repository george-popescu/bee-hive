import { Link } from '@inertiajs/react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
    filterWeeklyRows,
    summarizeWeeklyRows,
    weeklyAllocationEmptyState,
    weeklyProjectLegend,
} from '@/components/team-planning/weekly-capacity';
import type {
    WeeklyCapacityStatus,
    WeeklyPlanning,
    WeeklyRow,
} from '@/components/team-planning/weekly-capacity';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectGroup,
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import { index as teamLeadIndex } from '@/routes/team_lead';

const projectColors = [
    'bg-chart-1',
    'bg-chart-2',
    'bg-chart-3',
    'bg-chart-4',
    'bg-chart-5',
    'bg-sky-500',
    'bg-emerald-500',
    'bg-amber-500',
];

type WeeklyCapacityViewProps = {
    weekly: WeeklyPlanning;
    projects: Array<{ id: number; label: string }>;
    roles: string[];
    teams: Array<{ id: number; name: string }>;
    onShowMonthly: () => void;
};

function parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);

    return new Date(year, month - 1, day, 12);
}

function formatHours(value: number, locale: string): string {
    return `${value.toLocaleString(locale, { maximumFractionDigits: 2 })}h`;
}

function formatWeekPeriod(
    startDate: string,
    endDate: string,
    locale: string,
): string {
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    const startMonth = new Intl.DateTimeFormat(locale, {
        month: 'short',
    }).format(start);
    const endMonth = new Intl.DateTimeFormat(locale, {
        month: 'short',
    }).format(end);

    if (startMonth === endMonth) {
        return `${start.getDate()}–${end.getDate()} ${endMonth} ${end.getFullYear()}`;
    }

    return `${start.getDate()} ${startMonth}–${end.getDate()} ${endMonth} ${end.getFullYear()}`;
}

function selectionValue(value: string): string | null {
    return value === 'all' ? null : value;
}

function sourceLabel(
    source: WeeklyRow['allocations'][number]['source'],
    t: ReturnType<typeof useTranslations>['t'],
): string | null {
    if (source === 'prorated') {
        return t('Monthly fallback');
    }

    if (source === 'mixed') {
        return t('Mixed weekly / monthly');
    }

    return null;
}

function capacityBadgeClass(status: WeeklyCapacityStatus): string {
    if (status === 'over') {
        return 'border-destructive/40 bg-destructive/10 text-destructive';
    }

    if (status === 'unallocated') {
        return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    }

    if (status === 'balanced') {
        return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    }

    return 'border-border bg-background text-foreground';
}

export function WeeklyCapacityView({
    weekly,
    projects,
    roles,
    teams,
    onShowMonthly,
}: WeeklyCapacityViewProps) {
    const { languageTag, t } = useTranslations();
    const [teamFilter, setTeamFilter] = useState('all');
    const [projectFilter, setProjectFilter] = useState('all');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const rows = useMemo(
        () =>
            filterWeeklyRows(weekly.rows, {
                teamId: teamFilter === 'all' ? null : Number(teamFilter),
                projectId:
                    projectFilter === 'all' ? null : Number(projectFilter),
                role: selectionValue(roleFilter),
                status: selectionValue(
                    statusFilter,
                ) as WeeklyCapacityStatus | null,
            }),
        [projectFilter, roleFilter, statusFilter, teamFilter, weekly.rows],
    );
    const totals = useMemo(() => summarizeWeeklyRows(rows), [rows]);
    const legend = useMemo(() => weeklyProjectLegend(rows), [rows]);
    const projectColorById = useMemo(
        () =>
            new Map(
                legend.map((project, index) => [
                    project.projectId,
                    projectColors[index % projectColors.length],
                ]),
            ),
        [legend],
    );
    const periodLabel = formatWeekPeriod(
        weekly.period.start,
        weekly.period.end,
        languageTag,
    );

    return (
        <div className="flex min-w-0 flex-col gap-5">
            <section className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
                <div className="flex flex-col gap-1">
                    <p className="text-xs text-muted-foreground">
                        {t('Workspace / Team planning')}
                    </p>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {t('Weekly team capacity')}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {t('All visible people and all projects')} ·{' '}
                        {periodLabel}
                    </p>
                </div>

                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-end justify-start gap-2 xl:justify-end">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-muted-foreground">
                                {t('Planning period')}
                            </span>
                            <ToggleGroup
                                type="single"
                                value="weekly"
                                variant="outline"
                                aria-label={t('Planning period')}
                                onValueChange={(value) => {
                                    if (value === 'monthly') {
                                        onShowMonthly();
                                    }
                                }}
                            >
                                <ToggleGroupItem value="weekly">
                                    {t('Week')}
                                </ToggleGroupItem>
                                <ToggleGroupItem value="monthly">
                                    {t('Month')}
                                </ToggleGroupItem>
                            </ToggleGroup>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-muted-foreground">
                                {t('Week')}
                            </span>
                            <div className="flex items-center gap-1">
                                <Button size="icon" variant="outline" asChild>
                                    <Link
                                        href={teamLeadIndex({
                                            query: {
                                                week: weekly.period.previous,
                                            },
                                        })}
                                        preserveScroll
                                        aria-label={t('Previous week')}
                                    >
                                        <ArrowLeft />
                                    </Link>
                                </Button>
                                <span className="min-w-44 rounded-md border bg-background px-3 py-2 text-center text-sm font-medium tabular-nums">
                                    {periodLabel}
                                </span>
                                <Button size="icon" variant="outline" asChild>
                                    <Link
                                        href={teamLeadIndex({
                                            query: {
                                                week: weekly.period.next,
                                            },
                                        })}
                                        preserveScroll
                                        aria-label={t('Next week')}
                                    >
                                        <ArrowRight />
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <Select
                            value={teamFilter}
                            onValueChange={setTeamFilter}
                        >
                            <SelectTrigger aria-label={t('Team')}>
                                <SelectValue placeholder={t('All teams')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="all">
                                        {t('All teams')}
                                    </SelectItem>
                                    {teams.map((team) => (
                                        <SelectItem
                                            key={team.id}
                                            value={String(team.id)}
                                        >
                                            {team.name}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        <Select
                            value={projectFilter}
                            onValueChange={setProjectFilter}
                        >
                            <SelectTrigger aria-label={t('Project')}>
                                <SelectValue placeholder={t('All projects')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="all">
                                        {t('All projects')}
                                    </SelectItem>
                                    {projects.map((project) => (
                                        <SelectItem
                                            key={project.id}
                                            value={String(project.id)}
                                        >
                                            {project.label}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        <Select
                            value={roleFilter}
                            onValueChange={setRoleFilter}
                        >
                            <SelectTrigger aria-label={t('Role')}>
                                <SelectValue placeholder={t('All roles')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="all">
                                        {t('All roles')}
                                    </SelectItem>
                                    {roles.map((role) => (
                                        <SelectItem key={role} value={role}>
                                            {role}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        <Select
                            value={statusFilter}
                            onValueChange={setStatusFilter}
                        >
                            <SelectTrigger aria-label={t('Capacity status')}>
                                <SelectValue
                                    placeholder={t('All capacity states')}
                                />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="all">
                                        {t('All capacity states')}
                                    </SelectItem>
                                    <SelectItem value="over">
                                        {t('Over capacity')}
                                    </SelectItem>
                                    <SelectItem value="available">
                                        {t('Capacity available')}
                                    </SelectItem>
                                    <SelectItem value="balanced">
                                        {t('Fully allocated')}
                                    </SelectItem>
                                    <SelectItem value="unallocated">
                                        {t('Without allocation')}
                                    </SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </section>

            <section className="grid gap-3 md:grid-cols-3">
                <Card>
                    <CardHeader className="gap-1">
                        <CardDescription>
                            {t('Contract capacity')}
                        </CardDescription>
                        <CardTitle className="text-3xl tabular-nums">
                            {formatHours(totals.contractHours, languageTag)}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                            {t(':count people', { count: rows.length })}
                        </p>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="gap-1">
                        <CardDescription>
                            {t('Available after leave')}
                        </CardDescription>
                        <CardTitle className="text-3xl tabular-nums">
                            {formatHours(totals.availableHours, languageTag)}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                            {t(':hours leave / unavailable', {
                                hours: formatHours(
                                    totals.leaveHours,
                                    languageTag,
                                ),
                            })}
                        </p>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="gap-1">
                        <CardDescription>{t('Unallocated')}</CardDescription>
                        <CardTitle className="text-3xl tabular-nums">
                            {formatHours(totals.freeHours, languageTag)}
                        </CardTitle>
                        <p
                            className={cn(
                                'text-xs text-muted-foreground',
                                totals.overallocatedPeople > 0 &&
                                    'font-medium text-destructive',
                            )}
                        >
                            {totals.overallocatedPeople > 0
                                ? t(':count people over capacity', {
                                      count: totals.overallocatedPeople,
                                  })
                                : t('No over-allocation')}
                        </p>
                    </CardHeader>
                </Card>
            </section>

            <div
                className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground"
                aria-label={t('Project legend')}
            >
                {legend.map((project) => (
                    <span
                        key={project.projectId}
                        className="inline-flex items-center gap-1.5"
                    >
                        <span
                            className={cn(
                                'size-2.5 rounded-full',
                                projectColorById.get(project.projectId),
                            )}
                        />
                        {project.label}
                    </span>
                ))}
                <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-muted-foreground/25" />
                    {t('Unallocated')}
                </span>
            </div>

            <Card className="min-w-0">
                <CardHeader className="gap-1">
                    <CardTitle>{t('Team overview')}</CardTitle>
                    <CardDescription>
                        {t(
                            'Available capacity equals contract capacity minus approved leave and unavailability.',
                        )}
                    </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto px-0">
                    <Table className="min-w-[780px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="min-w-52 pl-6">
                                    {t('Person')}
                                </TableHead>
                                <TableHead className="text-right">
                                    {t('Contract')}
                                </TableHead>
                                <TableHead className="text-right">
                                    {t('Leave')}
                                </TableHead>
                                <TableHead className="text-right">
                                    {t('Available')}
                                </TableHead>
                                <TableHead className="min-w-80">
                                    {t('Allocation across all projects')}
                                </TableHead>
                                <TableHead className="text-right">
                                    {t('Allocated')}
                                </TableHead>
                                <TableHead className="pr-6 text-right">
                                    {t('Free')}
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row) => {
                                const emptyAllocationState =
                                    weeklyAllocationEmptyState(row);
                                const denominator = Math.max(
                                    row.availableHours,
                                    row.allocatedHours,
                                    1,
                                );
                                const overWidth =
                                    row.freeHours < 0
                                        ? (Math.abs(row.freeHours) /
                                              denominator) *
                                          100
                                        : 0;

                                return (
                                    <TableRow
                                        key={row.person.id}
                                        className={cn(
                                            row.status === 'over' &&
                                                'bg-destructive/5 hover:bg-destructive/10',
                                            row.status === 'unallocated' &&
                                                'bg-amber-500/5 hover:bg-amber-500/10',
                                        )}
                                    >
                                        <TableCell className="pl-6">
                                            <p className="font-medium">
                                                {row.person.name}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {row.roles.join(' / ') ||
                                                    t('Role missing')}
                                            </p>
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatHours(
                                                row.contractHours,
                                                languageTag,
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {row.leaveHours > 0
                                                ? formatHours(
                                                      row.leaveHours,
                                                      languageTag,
                                                  )
                                                : '—'}
                                        </TableCell>
                                        <TableCell className="text-right font-medium tabular-nums">
                                            {formatHours(
                                                row.availableHours,
                                                languageTag,
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div
                                                className="relative flex h-3.5 overflow-hidden rounded-full bg-muted"
                                                aria-label={t(
                                                    'Allocation for :person',
                                                    {
                                                        person: row.person.name,
                                                    },
                                                )}
                                            >
                                                {row.allocations.map(
                                                    (allocation) => (
                                                        <span
                                                            key={
                                                                allocation.projectId
                                                            }
                                                            className={cn(
                                                                'h-full',
                                                                projectColorById.get(
                                                                    allocation.projectId,
                                                                ),
                                                            )}
                                                            style={{
                                                                width: `${(allocation.hours / denominator) * 100}%`,
                                                            }}
                                                            title={`${allocation.label}: ${formatHours(allocation.hours, languageTag)}`}
                                                        />
                                                    ),
                                                )}
                                                {overWidth > 0 && (
                                                    <span
                                                        className="absolute inset-y-0 right-0 bg-destructive"
                                                        style={{
                                                            width: `${overWidth}%`,
                                                        }}
                                                    />
                                                )}
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                {row.allocations.map(
                                                    (allocation) => {
                                                        const fallback =
                                                            sourceLabel(
                                                                allocation.source,
                                                                t,
                                                            );

                                                        return (
                                                            <span
                                                                key={
                                                                    allocation.projectId
                                                                }
                                                                className="inline-flex items-center gap-1"
                                                            >
                                                                <span
                                                                    className={cn(
                                                                        'size-2 rounded-full',
                                                                        projectColorById.get(
                                                                            allocation.projectId,
                                                                        ),
                                                                    )}
                                                                />
                                                                {
                                                                    allocation.label
                                                                }{' '}
                                                                {formatHours(
                                                                    allocation.hours,
                                                                    languageTag,
                                                                )}
                                                                {fallback && (
                                                                    <span className="text-[10px] text-amber-700 dark:text-amber-300">
                                                                        ·{' '}
                                                                        {
                                                                            fallback
                                                                        }
                                                                    </span>
                                                                )}
                                                            </span>
                                                        );
                                                    },
                                                )}
                                                {emptyAllocationState && (
                                                    <span
                                                        className={cn(
                                                            'font-medium',
                                                            emptyAllocationState ===
                                                                'unallocated'
                                                                ? 'text-amber-700 dark:text-amber-300'
                                                                : 'text-muted-foreground',
                                                        )}
                                                    >
                                                        {emptyAllocationState ===
                                                        'unallocated'
                                                            ? t('No allocation')
                                                            : t(
                                                                  'No available capacity',
                                                              )}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatHours(
                                                row.allocatedHours,
                                                languageTag,
                                            )}
                                        </TableCell>
                                        <TableCell className="pr-6 text-right">
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    'tabular-nums',
                                                    capacityBadgeClass(
                                                        row.status,
                                                    ),
                                                )}
                                            >
                                                {formatHours(
                                                    row.freeHours,
                                                    languageTag,
                                                )}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {rows.length === 0 && (
                                <TableRow>
                                    <TableCell
                                        colSpan={7}
                                        className="h-24 text-center text-muted-foreground"
                                    >
                                        {t(
                                            'No people match the selected filters.',
                                        )}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground">
                {t(
                    'Saved weekly hours are used when available. Allocations without a weekly distribution are prorated from the monthly plan by working days.',
                )}
            </p>
        </div>
    );
}
