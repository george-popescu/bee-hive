import { Head, setLayoutProps, usePage } from '@inertiajs/react';
import { CalendarOff, ChartNoAxesCombined, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
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
import { index as managementIndex } from '@/routes/management';

type UtilizationStatus =
    'overloaded' | 'warning' | 'underloaded' | 'empty' | 'leave' | null;
type Month = { key: string; label: string };
type UtilizationMonth = {
    grossCapacityHours: number;
    leaveDays: number;
    leaveHours: number;
    availableCapacityHours: number;
    plannedHours: number;
    actualHours: number | null;
    estimatedPercent: number | null;
    actualPercent: number | null;
    isFullyOnLeave: boolean;
    estimatedStatus: UtilizationStatus;
    actualStatus: UtilizationStatus;
};
type UtilizationRow = {
    person: {
        id: number;
        name: string;
        jobRole: string | null;
        isExternal: boolean;
    };
    projectIds: number[];
    hasInternalActual: boolean;
    months: Record<string, UtilizationMonth>;
};
type Props = {
    months: Month[];
    defaultStartMonth: string;
    people: Array<{ id: number; name: string }>;
    roles: string[];
    projects: Array<{ id: number; label: string }>;
    rows: UtilizationRow[];
};
type VisibleRange = '3' | '6' | 'all';

function formatHours(value: number | null, locale: string): string {
    if (value === null) {
        return '—';
    }

    return value.toLocaleString(locale, { maximumFractionDigits: 1 });
}

function formatPercent(value: number, locale: string): string {
    return `${value.toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
}

function badgeVariant(status: UtilizationStatus) {
    if (status === 'overloaded') {
        return 'destructive' as const;
    }

    if (status === 'warning') {
        return 'warning' as const;
    }

    if (status === 'underloaded') {
        return 'success' as const;
    }

    return status === 'empty' ? ('secondary' as const) : ('outline' as const);
}

function Metric({
    percent,
    hours,
    status,
    external,
    fullyOnLeave,
    actual,
    showHours = true,
}: {
    percent: number | null;
    hours: number | null;
    status: UtilizationStatus;
    external: boolean;
    fullyOnLeave: boolean;
    actual: boolean;
    showHours?: boolean;
}) {
    const { languageTag, t } = useTranslations();

    if (external) {
        return (
            <span className="text-sm text-muted-foreground tabular-nums">
                {actual && hours !== null
                    ? `${formatHours(hours, languageTag)}h`
                    : actual
                      ? '—'
                      : '·'}
            </span>
        );
    }

    if (fullyOnLeave) {
        return <Badge variant="outline">{t('on leave')}</Badge>;
    }

    if (actual && hours === null && showHours) {
        return <span className="text-muted-foreground">—</span>;
    }

    if (percent === null) {
        return <span className="text-muted-foreground">·</span>;
    }

    return (
        <span className="flex items-center justify-end gap-2">
            <Badge variant={badgeVariant(status)}>
                {formatPercent(percent, languageTag)}
            </Badge>
            {showHours && hours !== null && (
                <span className="text-xs text-muted-foreground tabular-nums">
                    {formatHours(hours, languageTag)}h
                </span>
            )}
        </span>
    );
}

function average(
    row: UtilizationRow,
    months: Month[],
    property: 'estimatedPercent' | 'actualPercent',
): number | null {
    const values = months
        .map((month) => row.months[month.key]?.[property] ?? null)
        .filter((value): value is number => value !== null);

    return values.length === 0
        ? null
        : Math.round(
              (values.reduce((sum, value) => sum + value, 0) / values.length) *
                  100,
          ) / 100;
}

function statusForAverage(value: number | null): UtilizationStatus {
    if (value === null) {
        return null;
    }

    if (value > 105) {
        return 'overloaded';
    }

    if (value >= 90) {
        return 'warning';
    }

    return value > 0 ? 'underloaded' : 'empty';
}

export default function ManagementUtilization({
    months,
    defaultStartMonth,
    people,
    roles,
    projects,
    rows,
}: Props) {
    const { languageTag, t } = useTranslations();
    const pageUrl = usePage().url;
    const requestedPersonId = new URLSearchParams(
        pageUrl.split('?')[1] ?? '',
    ).get('person');
    const requestedMonth = new URLSearchParams(pageUrl.split('?')[1] ?? '').get(
        'month',
    );
    const rangeStartMonth = months.some((month) => month.key === requestedMonth)
        ? requestedMonth
        : defaultStartMonth;
    const [visibleRange, setVisibleRange] = useState<VisibleRange>('6');
    const [personFilter, setPersonFilter] = useState(() =>
        requestedPersonId !== null &&
        people.some((person) => String(person.id) === requestedPersonId)
            ? requestedPersonId
            : 'all',
    );
    const [roleFilter, setRoleFilter] = useState('all');
    const [projectFilter, setProjectFilter] = useState('all');
    const visibleMonths = useMemo(() => {
        if (visibleRange === 'all') {
            return months;
        }

        const startIndex = Math.max(
            0,
            months.findIndex((month) => month.key === rangeStartMonth),
        );

        return months.slice(startIndex, startIndex + Number(visibleRange));
    }, [months, rangeStartMonth, visibleRange]);
    const filteredRows = useMemo(
        () =>
            rows
                .filter(
                    (row) =>
                        personFilter === 'all' ||
                        String(row.person.id) === personFilter,
                )
                .filter(
                    (row) =>
                        roleFilter === 'all' ||
                        row.person.jobRole === roleFilter,
                )
                .filter(
                    (row) =>
                        projectFilter === 'all' ||
                        (projectFilter === 'internal'
                            ? row.hasInternalActual
                            : row.projectIds.includes(Number(projectFilter))),
                )
                .sort(
                    (left, right) =>
                        Number(left.person.isExternal) -
                            Number(right.person.isExternal) ||
                        left.person.name.localeCompare(
                            right.person.name,
                            languageTag,
                        ),
                ),
        [languageTag, personFilter, projectFilter, roleFilter, rows],
    );
    const resetFilters = () => {
        setPersonFilter('all');
        setRoleFilter('all');
        setProjectFilter('all');
    };

    setLayoutProps({
        breadcrumbs: [
            { title: t('Team utilization'), href: managementIndex() },
        ],
    });

    return (
        <>
            <Head title={t('Team utilization')} />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-hidden p-4">
                <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <ChartNoAxesCombined className="size-6" />
                            <h1 className="text-2xl font-semibold tracking-tight">
                                {t('Team utilization — Estimated vs Actual')}
                            </h1>
                        </div>
                        <p className="max-w-4xl text-sm text-muted-foreground">
                            {t(
                                'Estimated values compare the plan against available capacity after leave. Actual values include ClickUp time entries and audited adjustments; “—” means the month has no reporting.',
                            )}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                            {t('Months shown')}
                        </span>
                        <ToggleGroup
                            type="single"
                            variant="outline"
                            value={visibleRange}
                            onValueChange={(value) => {
                                if (value) {
                                    setVisibleRange(value as VisibleRange);
                                }
                            }}
                        >
                            <ToggleGroupItem value="3">3</ToggleGroupItem>
                            <ToggleGroupItem value="6">6</ToggleGroupItem>
                            <ToggleGroupItem value="all">
                                {t('All')}
                            </ToggleGroupItem>
                        </ToggleGroup>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                        {t('Legend:')}
                    </span>
                    <Badge variant="success">{t('under 90%')}</Badge>
                    <Badge variant="warning">90–105%</Badge>
                    <Badge variant="destructive">
                        {t('over 105% — overloaded')}
                    </Badge>
                    <Badge variant="secondary">0%</Badge>
                </div>

                <Card className="min-w-0">
                    <CardHeader>
                        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                            <div className="flex flex-col gap-1">
                                <CardTitle>
                                    {t('Monthly capacity and utilization')}
                                </CardTitle>
                                <CardDescription>
                                    {t(
                                        ':filtered of :total people · :months months',
                                        {
                                            filtered: filteredRows.length,
                                            total: rows.length,
                                            months: visibleMonths.length,
                                        },
                                    )}
                                </CardDescription>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Select
                                    value={personFilter}
                                    onValueChange={setPersonFilter}
                                >
                                    <SelectTrigger
                                        className="w-48"
                                        aria-label={t('Person filter')}
                                    >
                                        <SelectValue
                                            placeholder={t('All people')}
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectItem value="all">
                                                {t('All people')}
                                            </SelectItem>
                                            {people.map((person) => (
                                                <SelectItem
                                                    key={person.id}
                                                    value={String(person.id)}
                                                >
                                                    {person.name}
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                                <Select
                                    value={roleFilter}
                                    onValueChange={setRoleFilter}
                                >
                                    <SelectTrigger
                                        className="w-44"
                                        aria-label={t('Role filter')}
                                    >
                                        <SelectValue
                                            placeholder={t('All roles')}
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectItem value="all">
                                                {t('All roles')}
                                            </SelectItem>
                                            {roles.map((role) => (
                                                <SelectItem
                                                    key={role}
                                                    value={role}
                                                >
                                                    {role}
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                                <Select
                                    value={projectFilter}
                                    onValueChange={setProjectFilter}
                                >
                                    <SelectTrigger
                                        className="w-64"
                                        aria-label={t('Project filter')}
                                    >
                                        <SelectValue
                                            placeholder={t('All projects')}
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectItem value="all">
                                                {t('All projects')}
                                            </SelectItem>
                                            <SelectItem value="internal">
                                                {t('Internal activities')}
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
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={resetFilters}
                                >
                                    <RotateCcw data-icon="inline-start" />
                                    {t('Reset')}
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="px-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead
                                        rowSpan={2}
                                        className="sticky top-0 left-0 min-w-48 bg-card"
                                    >
                                        {t('Person')}
                                    </TableHead>
                                    <TableHead
                                        rowSpan={2}
                                        className="sticky top-0 min-w-32 bg-card"
                                    >
                                        {t('Role')}
                                    </TableHead>
                                    {visibleMonths.map((month) => (
                                        <TableHead
                                            key={month.key}
                                            colSpan={2}
                                            className="sticky top-0 min-w-56 bg-card text-center"
                                        >
                                            {month.label}
                                        </TableHead>
                                    ))}
                                    <TableHead
                                        colSpan={2}
                                        className="sticky top-0 min-w-48 bg-card text-center"
                                    >
                                        {t('Average')}
                                    </TableHead>
                                </TableRow>
                                <TableRow>
                                    {visibleMonths.flatMap((month) => [
                                        <TableHead
                                            key={`${month.key}-estimated`}
                                            className="sticky top-10 min-w-28 bg-card text-right"
                                        >
                                            {t('Est.')}
                                        </TableHead>,
                                        <TableHead
                                            key={`${month.key}-actual`}
                                            className="sticky top-10 min-w-28 bg-card text-right"
                                        >
                                            {t('Act.')}
                                        </TableHead>,
                                    ])}
                                    <TableHead className="sticky top-10 min-w-24 bg-card text-right">
                                        {t('Est.')}
                                    </TableHead>
                                    <TableHead className="sticky top-10 min-w-24 bg-card text-right">
                                        {t('Act.')}
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRows.map((row) => {
                                    const estimatedAverage = average(
                                        row,
                                        months,
                                        'estimatedPercent',
                                    );
                                    const actualAverage = average(
                                        row,
                                        months,
                                        'actualPercent',
                                    );

                                    return (
                                        <TableRow key={row.person.id}>
                                            <TableCell className="sticky left-0 bg-card font-medium">
                                                <span className="flex items-center gap-2">
                                                    {row.person.name}
                                                    {row.person.isExternal && (
                                                        <Badge variant="secondary">
                                                            {t('external')}
                                                        </Badge>
                                                    )}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {row.person.jobRole ?? '—'}
                                            </TableCell>
                                            {visibleMonths.flatMap((month) => {
                                                const value =
                                                    row.months[month.key];
                                                const leaveIndicator =
                                                    value.leaveDays > 0 && (
                                                        <Badge variant="outline">
                                                            <CalendarOff />
                                                            {t(':count days', {
                                                                count: value.leaveDays,
                                                            })}
                                                        </Badge>
                                                    );

                                                return [
                                                    <TableCell
                                                        key={`${month.key}-estimated`}
                                                        className="text-right"
                                                    >
                                                        <span className="flex flex-col items-end gap-1">
                                                            <Metric
                                                                percent={
                                                                    value.estimatedPercent
                                                                }
                                                                hours={
                                                                    value.plannedHours
                                                                }
                                                                status={
                                                                    value.estimatedStatus
                                                                }
                                                                external={
                                                                    row.person
                                                                        .isExternal
                                                                }
                                                                fullyOnLeave={
                                                                    value.isFullyOnLeave
                                                                }
                                                                actual={false}
                                                            />
                                                            {leaveIndicator}
                                                        </span>
                                                    </TableCell>,
                                                    <TableCell
                                                        key={`${month.key}-actual`}
                                                        className="text-right"
                                                    >
                                                        <Metric
                                                            percent={
                                                                value.actualPercent
                                                            }
                                                            hours={
                                                                value.actualHours
                                                            }
                                                            status={
                                                                value.actualStatus
                                                            }
                                                            external={
                                                                row.person
                                                                    .isExternal
                                                            }
                                                            fullyOnLeave={
                                                                value.isFullyOnLeave
                                                            }
                                                            actual
                                                        />
                                                    </TableCell>,
                                                ];
                                            })}
                                            <TableCell className="text-right">
                                                <Metric
                                                    percent={estimatedAverage}
                                                    hours={null}
                                                    status={statusForAverage(
                                                        estimatedAverage,
                                                    )}
                                                    external={
                                                        row.person.isExternal
                                                    }
                                                    fullyOnLeave={false}
                                                    actual={false}
                                                    showHours={false}
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Metric
                                                    percent={actualAverage}
                                                    hours={null}
                                                    status={statusForAverage(
                                                        actualAverage,
                                                    )}
                                                    external={
                                                        row.person.isExternal
                                                    }
                                                    fullyOnLeave={false}
                                                    actual
                                                    showHours={false}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
