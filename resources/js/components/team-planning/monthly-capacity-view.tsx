import { Minus, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
    AllocationEntry,
    AllocationHistoryRecord,
} from '@/components/team-planning/allocation-editor';
import { AllocationEditorView } from '@/components/team-planning/allocation-editor-view';
import {
    addMonthlyColumn,
    filterMonthlyRows,
    monthlyCellPresentation,
    monthlyWindow,
    removeMonthlyColumn,
    resolveMonthlySelection,
} from '@/components/team-planning/monthly-capacity';
import type {
    MonthlyCapacityRow,
    MonthlySelection,
    PlanningMonth,
} from '@/components/team-planning/monthly-capacity';
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

type MonthlyCapacityViewProps = {
    months: PlanningMonth[];
    rows: MonthlyCapacityRow[];
    projects: Array<{
        id: number;
        label: string;
        active: boolean;
    }>;
    allocationEntries: AllocationEntry[];
    allocationHistory: AllocationHistoryRecord[];
    canManageAllocations: boolean;
    initialPersonId?: number;
    onShowWeekly: () => void;
};

function localMonthKey(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    return `${now.getFullYear()}-${month}`;
}

function formatHours(value: number, locale: string): string {
    return `${value.toLocaleString(locale, { maximumFractionDigits: 2 })}h`;
}

function formatPercent(value: number, locale: string): string {
    return `${value.toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
}

function formatMonthLabel(month: PlanningMonth, locale: string): string {
    const [year, monthNumber] = month.key.split('-').map(Number);

    return new Intl.DateTimeFormat(locale, {
        month: 'short',
        year: '2-digit',
    }).format(new Date(year, monthNumber - 1, 1, 12));
}

function signedHours(value: number, locale: string): string {
    const sign = value > 0 ? '+' : value < 0 ? '−' : '';

    return `${sign}${formatHours(Math.abs(value), locale)}`;
}

export function MonthlyCapacityView({
    months,
    rows,
    projects,
    allocationEntries,
    allocationHistory,
    canManageAllocations,
    initialPersonId,
    onShowWeekly,
}: MonthlyCapacityViewProps) {
    const { languageTag, t } = useTranslations();
    const activeMonth = localMonthKey();
    const startIndex = Math.max(
        0,
        months.findIndex((month) => month.key === activeMonth),
    );
    const availableMonthCount = months.length - startIndex;
    const [visibleCount, setVisibleCount] = useState(() =>
        Math.min(3, availableMonthCount),
    );
    const [roleFilter, setRoleFilter] = useState('all');
    const [preferredSelection, setPreferredSelection] =
        useState<MonthlySelection | null>(() =>
            initialPersonId === undefined
                ? null
                : { personId: initialPersonId, month: activeMonth },
        );
    const visibleMonths = useMemo(
        () => monthlyWindow(months, activeMonth, visibleCount),
        [activeMonth, months, visibleCount],
    );
    const visibleRows = useMemo(
        () => filterMonthlyRows(rows, roleFilter === 'all' ? null : roleFilter),
        [roleFilter, rows],
    );
    const selection = resolveMonthlySelection(
        visibleRows,
        visibleMonths.map((month) => month.key),
        preferredSelection,
    );
    const selectedRow = visibleRows.find(
        (row) => row.person.id === selection?.personId,
    );
    const selectedMonth = visibleMonths.find(
        (month) => month.key === selection?.month,
    );
    const selectedValue =
        selectedRow && selection
            ? selectedRow.months[selection.month]
            : undefined;
    const selectedPresentation = selectedValue
        ? monthlyCellPresentation(selectedValue)
        : null;
    const roleOptions = useMemo(
        () =>
            Array.from(
                new Set(rows.flatMap((row) => row.roles).filter(Boolean)),
            ).sort((left, right) => left.localeCompare(right, languageTag)),
        [languageTag, rows],
    );
    const canAddMonth = visibleCount < availableMonthCount;
    const canRemoveMonth = visibleCount > Math.min(3, availableMonthCount);
    const editorRevision = selection
        ? allocationEntries
              .filter(
                  (entry) =>
                      entry.personId === selection.personId &&
                      entry.month === selection.month,
              )
              .map((entry) => `${entry.id}:${entry.updatedAt ?? ''}`)
              .join('|')
        : '';

    const removeLastMonth = () => {
        const nextCount = removeMonthlyColumn(
            visibleCount,
            availableMonthCount,
        );
        const nextMonths = monthlyWindow(months, activeMonth, nextCount);

        setVisibleCount(nextCount);

        if (
            preferredSelection !== null &&
            !nextMonths.some((month) => month.key === preferredSelection.month)
        ) {
            setPreferredSelection({
                ...preferredSelection,
                month: nextMonths.at(-1)?.key ?? '',
            });
        }
    };

    return (
        <div className="flex min-w-0 flex-col gap-5">
            <section className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
                <div className="flex flex-col gap-1">
                    <p className="text-xs text-muted-foreground">
                        {t('Team planning / Monthly capacity')}
                    </p>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {t('Allocated vs Actual')}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {t('All people · all projects')}
                    </p>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground">
                            {t('Planning period')}
                        </span>
                        <ToggleGroup
                            type="single"
                            value="monthly"
                            variant="outline"
                            aria-label={t('Planning period')}
                            onValueChange={(value) => {
                                if (value === 'weekly') {
                                    onShowWeekly();
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
                    <div className="flex min-w-48 flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground">
                            {t('Role')}
                        </span>
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
                                    {roleOptions.map((role) => (
                                        <SelectItem key={role} value={role}>
                                            {role}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </section>

            <Card aria-live="polite">
                <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 xl:grid-cols-[1.4fr_repeat(4,1fr)] xl:items-center">
                    <div className="flex flex-col gap-1 sm:col-span-2 xl:col-span-1">
                        <span className="text-sm text-muted-foreground">
                            {t('Selected')}
                        </span>
                        <strong>
                            {selectedRow && selectedMonth
                                ? `${selectedRow.person.name} · ${formatMonthLabel(selectedMonth, languageTag)}`
                                : '—'}
                        </strong>
                        <span
                            className={cn(
                                'text-xs',
                                selectedPresentation?.isOverallocated
                                    ? 'font-medium text-destructive'
                                    : 'text-muted-foreground',
                            )}
                        >
                            {selectedValue
                                ? selectedValue.freeHours < 0
                                    ? t(':hours over capacity', {
                                          hours: formatHours(
                                              Math.abs(selectedValue.freeHours),
                                              languageTag,
                                          ),
                                      })
                                    : t(':hours capacity remaining', {
                                          hours: formatHours(
                                              selectedValue.freeHours,
                                              languageTag,
                                          ),
                                      })
                                : t('Select a cell to see details.')}
                        </span>
                    </div>

                    {[
                        [
                            t('Capacity'),
                            selectedValue
                                ? formatHours(
                                      selectedValue.availableHours,
                                      languageTag,
                                  )
                                : '—',
                        ],
                        [
                            t('Allocated'),
                            selectedValue
                                ? formatHours(
                                      selectedValue.allocatedHours,
                                      languageTag,
                                  )
                                : '—',
                        ],
                        [
                            t('Actual'),
                            selectedValue?.actualHours === null ||
                            selectedValue === undefined
                                ? '—'
                                : formatHours(
                                      selectedValue.actualHours,
                                      languageTag,
                                  ),
                        ],
                        [
                            t('Variance'),
                            selectedPresentation?.varianceHours === null ||
                            selectedPresentation === null
                                ? '—'
                                : t(':hours vs plan', {
                                      hours: signedHours(
                                          selectedPresentation.varianceHours,
                                          languageTag,
                                      ),
                                  }),
                        ],
                    ].map(([label, value]) => (
                        <div key={label} className="flex flex-col gap-1">
                            <span className="text-sm text-muted-foreground">
                                {label}
                            </span>
                            <strong className="tabular-nums">{value}</strong>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-primary" />
                    {t('Allocated / capacity')}
                </span>
                <span className="inline-flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-destructive" />
                    {t('Over capacity')}
                </span>
                <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-0.5 bg-foreground" />
                    {t('Actual marker')}
                </span>
            </div>

            <Card className="min-w-0">
                <CardHeader className="flex flex-row items-baseline justify-between gap-3">
                    <div className="flex flex-col gap-1">
                        <CardTitle>{t('Capacity forecast')}</CardTitle>
                        <CardDescription>
                            {t(':count months visible', {
                                count: visibleMonths.length,
                            })}
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="overflow-x-auto px-0">
                    <Table className="min-w-[640px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="min-w-44 pl-6">
                                    {t('Person')}
                                </TableHead>
                                {visibleMonths.map((month, index) => (
                                    <TableHead
                                        key={month.key}
                                        className="min-w-32"
                                    >
                                        <div className="flex items-center justify-between gap-1">
                                            <span>
                                                {formatMonthLabel(
                                                    month,
                                                    languageTag,
                                                )}
                                            </span>
                                            {canRemoveMonth &&
                                                index ===
                                                    visibleMonths.length -
                                                        1 && (
                                                    <Button
                                                        type="button"
                                                        size="icon"
                                                        className="size-7"
                                                        variant="ghost"
                                                        aria-label={t(
                                                            'Remove :month',
                                                            {
                                                                month: formatMonthLabel(
                                                                    month,
                                                                    languageTag,
                                                                ),
                                                            },
                                                        )}
                                                        onClick={
                                                            removeLastMonth
                                                        }
                                                    >
                                                        <Minus />
                                                    </Button>
                                                )}
                                        </div>
                                    </TableHead>
                                ))}
                                <TableHead className="min-w-36 text-center">
                                    {canAddMonth ? (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                                setVisibleCount((count) =>
                                                    addMonthlyColumn(
                                                        count,
                                                        availableMonthCount,
                                                    ),
                                                )
                                            }
                                        >
                                            <Plus /> {t('Add month')}
                                        </Button>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">
                                            {t('All months loaded')}
                                        </span>
                                    )}
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visibleRows.map((row) => (
                                <TableRow key={row.person.id}>
                                    <TableCell className="pl-6">
                                        <p className="font-medium">
                                            {row.person.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {row.roles.join(' / ') ||
                                                t('Role missing')}
                                        </p>
                                    </TableCell>
                                    {visibleMonths.map((month) => {
                                        const value = row.months[month.key];
                                        const presentation =
                                            monthlyCellPresentation(value);
                                        const isSelected =
                                            selection?.personId ===
                                                row.person.id &&
                                            selection.month === month.key;

                                        return (
                                            <TableCell key={month.key}>
                                                <button
                                                    type="button"
                                                    className={cn(
                                                        'grid w-full gap-1.5 rounded-md border border-transparent p-2 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                                        isSelected &&
                                                            'border-primary bg-primary/5',
                                                    )}
                                                    aria-pressed={isSelected}
                                                    aria-label={t(
                                                        ':person, :month, :percent allocated',
                                                        {
                                                            person: row.person
                                                                .name,
                                                            month: formatMonthLabel(
                                                                month,
                                                                languageTag,
                                                            ),
                                                            percent:
                                                                presentation.allocationPercent ===
                                                                null
                                                                    ? '—'
                                                                    : formatPercent(
                                                                          presentation.allocationPercent,
                                                                          languageTag,
                                                                      ),
                                                        },
                                                    )}
                                                    onClick={() =>
                                                        setPreferredSelection({
                                                            personId:
                                                                row.person.id,
                                                            month: month.key,
                                                        })
                                                    }
                                                >
                                                    <span className="flex items-baseline justify-between gap-2">
                                                        <strong className="text-base tabular-nums">
                                                            {presentation.allocationPercent ===
                                                            null
                                                                ? '—'
                                                                : formatPercent(
                                                                      presentation.allocationPercent,
                                                                      languageTag,
                                                                  )}
                                                        </strong>
                                                        {presentation.isOverallocated && (
                                                            <span className="text-[11px] font-medium text-destructive">
                                                                {t('Over')}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="relative block h-2 overflow-visible rounded-full bg-muted">
                                                        <span
                                                            className={cn(
                                                                'block h-2 rounded-full',
                                                                presentation.isOverallocated
                                                                    ? 'bg-destructive'
                                                                    : 'bg-primary',
                                                            )}
                                                            style={{
                                                                width: `${presentation.barPercent}%`,
                                                            }}
                                                        />
                                                        {presentation.actualMarkerPercent !==
                                                            null && (
                                                            <span
                                                                className="absolute -top-0.5 h-3 w-0.5 bg-foreground"
                                                                style={{
                                                                    left: `${presentation.actualMarkerPercent}%`,
                                                                }}
                                                                title={t(
                                                                    'Actual marker',
                                                                )}
                                                            />
                                                        )}
                                                    </span>
                                                </button>
                                            </TableCell>
                                        );
                                    })}
                                    <TableCell />
                                </TableRow>
                            ))}
                            {visibleRows.length === 0 && (
                                <TableRow>
                                    <TableCell
                                        colSpan={visibleMonths.length + 2}
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

            {selection && selectedRow && selectedValue && (
                <AllocationEditorView
                    key={`${selection.personId}:${selection.month}:${editorRevision}`}
                    selection={selection}
                    row={selectedRow}
                    value={selectedValue}
                    people={visibleRows}
                    months={visibleMonths}
                    projects={projects}
                    entries={allocationEntries}
                    history={allocationHistory}
                    canManage={canManageAllocations}
                    onSelect={setPreferredSelection}
                />
            )}
        </div>
    );
}
