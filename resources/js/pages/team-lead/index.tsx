import {
    Head,
    router,
    setLayoutProps,
    useForm,
    useHttp,
    usePage,
} from '@inertiajs/react';
import {
    AlertTriangle,
    Check,
    ChevronDown,
    LoaderCircle,
    Pencil,
    Plus,
    RotateCcw,
    Trash2,
    Undo2,
    UsersRound,
} from 'lucide-react';
import { Fragment, useCallback, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import {
    reverse as reverseAdjustment,
    store as storeAdjustment,
} from '@/actions/App/Http/Controllers/ActualAdjustmentController';
import {
    destroy as destroyAllocation,
    update as updateAllocation,
    upsert,
} from '@/actions/App/Http/Controllers/AllocationController';
import type { WeeklyPlanning } from '@/components/team-planning/weekly-capacity';
import { WeeklyCapacityView } from '@/components/team-planning/weekly-capacity-view';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTranslations } from '@/hooks/use-translations';
import { index as teamLeadIndex } from '@/routes/team_lead';

type Month = { key: string; label: string };
type Team = { id: number; name: string };
type Person = {
    id: number;
    name: string;
    jobRole: string | null;
    isExternal: boolean;
    capacity: Record<string, number>;
    teamIds?: number[];
};
type Project = {
    id: number | null;
    label: string;
    internal: boolean;
    active?: boolean;
};
type PlanRow = {
    key: string;
    person: Person;
    project: Project & { id: number };
    role: string;
    hours: Record<string, number>;
};
type VarianceStatus =
    'empty' | 'on-plan' | 'significant-variance' | 'neutral' | 'unplanned';
type BoardMonth = {
    planned: number;
    actual: number | null;
    status: VarianceStatus;
};
type BoardRow = {
    key: string;
    person: Person;
    project: Project;
    roles: string[];
    months: Record<string, BoardMonth>;
};
type DisplayMode = 'plan' | 'actual' | 'comparison';
type AdjustmentRecord = {
    id: number;
    person: string;
    project: string;
    month: string;
    effectiveDate: string;
    hoursDelta: number;
    reason: string;
    author: string;
    createdAt: string;
    isReversal: boolean;
    isReversed: boolean;
};
type Props = {
    months: Month[];
    people: Array<
        Pick<Person, 'id' | 'name' | 'jobRole' | 'isExternal'> & {
            teamIds: number[];
        }
    >;
    teams: Team[];
    projects: Array<Project & { id: number }>;
    roles: string[];
    planRows: PlanRow[];
    comparisonRows: BoardRow[];
    capacityRows: CapacityRow[];
    weekly: WeeklyPlanning;
    allocationEntries: AllocationEntry[];
    allocationHistory: AllocationHistoryRecord[];
    adjustments: AdjustmentRecord[];
    permissions: {
        manageAllocations: boolean;
        adjustActualHours: boolean;
    };
};
type AllocationPayload = {
    person_id: number;
    project_id: number;
    role: string;
    month: string;
    planned_hours: number;
    weekly_hours?: WeeklyHourPayload[];
    planning_comment?: string;
};
type WeeklyHourPayload = { week_start: string; hours: number };
type AllocationResponse = {
    allocation: {
        id: number;
        person_id: number;
        project_id: number;
        role: string;
        month: string;
        planned_hours: number;
        weekly_hours: WeeklyHourPayload[];
        planning_comment: string | null;
        updated_at: string | null;
    };
};
type CapacityMonth = {
    grossHours: number;
    leaveHours: number;
    availableHours: number;
    allocatedHours: number;
    actualHours: number | null;
    allocationPercent: number | null;
    freeHours: number;
};
type CapacityRow = {
    person: Pick<Person, 'id' | 'name' | 'jobRole' | 'isExternal'>;
    roles: string[];
    months: Record<string, CapacityMonth>;
};
type AllocationEntry = {
    id: number;
    personId: number;
    projectId: number;
    role: string;
    month: string;
    hours: number;
    weeklyHours: Array<{ weekStart: string; hours: number }>;
    planningComment: string | null;
    updatedBy: string | null;
    updatedAt: string | null;
};
type AllocationHistoryRecord = {
    id: number;
    allocationId: number;
    action: string;
    author: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    createdAt: string | null;
};
type AdjustmentPayload = {
    person_id: number | '';
    project_id: number | null;
    internal_label: string;
    effective_date: string;
    hours_delta: number | '';
    reason: string;
};
type ReversalPayload = { reason: string };

function formatHours(value: number | null, locale: string): string {
    if (value === null) {
        return '—';
    }

    return value.toLocaleString(locale, { maximumFractionDigits: 2 });
}

function EmptyRow({ columns, label }: { columns: number; label: string }) {
    return (
        <TableRow>
            <TableCell
                colSpan={columns}
                className="h-24 text-center text-muted-foreground"
            >
                {label}
            </TableCell>
        </TableRow>
    );
}

function localIsoDate(date: Date): string {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');
}

function utcIsoDate(date: Date): string {
    return [
        date.getUTCFullYear(),
        String(date.getUTCMonth() + 1).padStart(2, '0'),
        String(date.getUTCDate()).padStart(2, '0'),
    ].join('-');
}

function addDays(date: string, days: number): string {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);

    return utcIsoDate(value);
}

function monthWeekStarts(month: string): string[] {
    const [year, monthNumber] = month.split('-').map(Number);
    const first = new Date(Date.UTC(year, monthNumber - 1, 1));
    const last = new Date(Date.UTC(year, monthNumber, 0));
    const cursor = new Date(first);
    cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7));
    const weeks: string[] = [];

    while (cursor <= last) {
        weeks.push(utcIsoDate(cursor));
        cursor.setUTCDate(cursor.getUTCDate() + 7);
    }

    return weeks;
}

function workingDaysInMonthWeek(month: string, weekStart: string): number {
    const monthStart = `${month}-01`;
    const monthEnd = lastDateOfMonth(month);
    let days = 0;

    for (let offset = 0; offset < 7; offset += 1) {
        const date = addDays(weekStart, offset);
        const day = new Date(`${date}T00:00:00Z`).getUTCDay();

        if (date >= monthStart && date <= monthEnd && day >= 1 && day <= 5) {
            days += 1;
        }
    }

    return days;
}

function distributeMonthlyHours(
    month: string,
    hours: number,
): WeeklyHourPayload[] {
    const weeks = monthWeekStarts(month);
    const weights = weeks.map((week) => workingDaysInMonthWeek(month, week));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const totalUnits = Math.max(0, Math.round(hours * 4));

    if (totalWeight === 0) {
        return weeks.map((week_start) => ({ week_start, hours: 0 }));
    }

    const exactUnits = weights.map(
        (weight) => (totalUnits * weight) / totalWeight,
    );
    const units = exactUnits.map(Math.floor);
    const remaining = totalUnits - units.reduce((sum, value) => sum + value, 0);
    const priority = exactUnits
        .map((value, index) => ({ index, fraction: value - units[index] }))
        .sort(
            (left, right) =>
                right.fraction - left.fraction || left.index - right.index,
        );

    for (let index = 0; index < remaining; index += 1) {
        units[priority[index % priority.length].index] += 1;
    }

    return weeks.map((week_start, index) => ({
        week_start,
        hours: units[index] / 4,
    }));
}

function allocationWeekDraft(
    entry: AllocationEntry | null,
    month: string,
    hours: number,
): WeeklyHourPayload[] {
    if (!entry || entry.month !== month || entry.weeklyHours.length === 0) {
        return distributeMonthlyHours(month, hours);
    }

    const savedHours = new Map(
        entry.weeklyHours.map((week) => [week.weekStart, week.hours]),
    );

    return monthWeekStarts(month).map((week_start) => ({
        week_start,
        hours: savedHours.get(week_start) ?? 0,
    }));
}

function lastDateOfMonth(month: string): string {
    const [year, monthNumber] = month.split('-').map(Number);
    const lastDay = new Date(year, monthNumber, 0).getDate();

    return `${month}-${String(lastDay).padStart(2, '0')}`;
}

function defaultEffectiveDate(months: Month[]): string {
    const firstDate = `${months[0]?.key ?? ''}-01`;
    const lastDate = months.length
        ? lastDateOfMonth(months[months.length - 1].key)
        : '';
    const today = localIsoDate(new Date());

    if (firstDate === '-01' || lastDate === '') {
        return '';
    }

    return today < firstDate ? firstDate : today > lastDate ? lastDate : today;
}

function formatDate(date: string, locale: string): string {
    return new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(new Date(`${date}T00:00:00`));
}

function classifyVariance(
    planned: number,
    actual: number | null,
): VarianceStatus {
    if (actual === null) {
        return 'empty';
    }

    if (planned === 0) {
        return actual > 0 ? 'unplanned' : 'empty';
    }

    const relativeVariance = Math.abs(actual - planned) / planned;

    if (relativeVariance <= 0.1) {
        return 'on-plan';
    }

    if (actual > planned * 1.25 || actual < planned * 0.75) {
        return 'significant-variance';
    }

    return 'neutral';
}

function PlanHoursInput({
    row,
    month,
    canEdit,
}: {
    row: PlanRow;
    month: string;
    canEdit: boolean;
}) {
    const { t } = useTranslations();
    const initialValue = row.hours[month] ?? 0;
    const [confirmedValue, setConfirmedValue] = useState(initialValue);
    const [draft, setDraft] = useState(
        initialValue === 0 ? '' : String(initialValue),
    );
    const [saved, setSaved] = useState(false);
    const form = useHttp<AllocationPayload, AllocationResponse>(upsert(), {
        person_id: row.person.id,
        project_id: row.project.id,
        role: row.role,
        month,
        planned_hours: initialValue,
    });
    const capacity = row.person.capacity[month] ?? 0;
    const numericDraft = draft === '' ? 0 : Number(draft.replace(',', '.'));
    const percentage =
        capacity > 0 ? Math.round((numericDraft / capacity) * 1000) / 10 : null;

    const rollback = () => {
        setDraft(confirmedValue === 0 ? '' : String(confirmedValue));
        form.setData('planned_hours', confirmedValue);
        toast.error(
            t('Hours could not be saved. The previous value was restored.'),
        );
    };

    const save = () => {
        if (
            !canEdit ||
            !Number.isFinite(numericDraft) ||
            numericDraft === confirmedValue
        ) {
            return;
        }

        form.setData('planned_hours', numericDraft);
        setSaved(false);
        void form
            .put(upsert.url(), {
                onSuccess: (response) => {
                    setConfirmedValue(response.allocation.planned_hours);
                    setDraft(
                        response.allocation.planned_hours === 0
                            ? ''
                            : String(response.allocation.planned_hours),
                    );
                    setSaved(true);
                    window.setTimeout(() => setSaved(false), 1600);
                },
                onError: rollback,
                onHttpException: rollback,
                onNetworkError: rollback,
            })
            .catch(() => undefined);
    };

    return (
        <div className="flex items-center justify-end gap-1">
            <Input
                aria-label={`${row.person.name}, ${row.project.label}, ${month}`}
                className="h-8 w-24 text-right tabular-nums"
                disabled={!canEdit || form.processing}
                inputMode="decimal"
                min={0}
                onBlur={save}
                onChange={(event) => {
                    setDraft(event.target.value);
                    form.setData(
                        'planned_hours',
                        event.target.value === ''
                            ? 0
                            : Number(event.target.value.replace(',', '.')),
                    );
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.currentTarget.blur();
                    }
                }}
                placeholder="·"
                step={0.25}
                title={
                    percentage === null
                        ? t('No capacity configured')
                        : t(':percentage of monthly capacity', {
                              percentage: `${percentage}%`,
                          })
                }
                type="number"
                value={draft}
            />
            <span
                className="flex size-4 items-center justify-center text-muted-foreground"
                aria-live="polite"
            >
                {form.processing && <LoaderCircle className="animate-spin" />}
                {saved && <Check />}
            </span>
        </div>
    );
}

function PersonLabel({ person }: { person: Person }) {
    const { t } = useTranslations();

    return (
        <span className="flex items-center gap-2">
            {person.name}
            {person.isExternal && (
                <Badge variant="secondary">{t('external')}</Badge>
            )}
        </span>
    );
}

function ProjectLabel({ project }: { project: Project }) {
    const { t } = useTranslations();

    return (
        <span className="flex items-center gap-2">
            {project.label}
            {project.internal && (
                <Badge variant="outline">{t('internal')}</Badge>
            )}
        </span>
    );
}

function VarianceValue({ month }: { month: BoardMonth }) {
    const { languageTag, t } = useTranslations();
    const varianceLabels: Record<VarianceStatus, string> = {
        empty: t('No data'),
        'on-plan': t('On plan (±10%)'),
        'significant-variance': t('Significant variance (>25%)'),
        neutral: t('Moderate variance'),
        unplanned: t('Unplanned hours'),
    };
    const variant =
        month.status === 'significant-variance' || month.status === 'unplanned'
            ? 'destructive'
            : month.status === 'on-plan'
              ? 'success'
              : month.status === 'empty'
                ? 'outline'
                : 'warning';

    return (
        <Badge variant={variant} title={varianceLabels[month.status]}>
            {formatHours(month.actual, languageTag)}
        </Badge>
    );
}

function PlanTable({
    rows,
    months,
    canEdit,
}: {
    rows: PlanRow[];
    months: Month[];
    canEdit: boolean;
}) {
    const { languageTag, t } = useTranslations();
    const total = (subset: PlanRow[], month: string) =>
        subset.reduce((sum, row) => sum + (row.hours[month] ?? 0), 0);

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="sticky top-0 left-0 min-w-48 bg-card">
                        {t('Person')}
                    </TableHead>
                    <TableHead className="sticky top-0 min-w-64 bg-card">
                        {t('Project')}
                    </TableHead>
                    <TableHead className="sticky top-0 min-w-28 bg-card">
                        {t('Role')}
                    </TableHead>
                    {months.map((month) => (
                        <TableHead
                            key={month.key}
                            className="sticky top-0 min-w-32 bg-card text-right"
                        >
                            {month.label}
                        </TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((row, index) => {
                    const firstForPerson =
                        index === 0 ||
                        rows[index - 1].person.id !== row.person.id;
                    const lastForPerson =
                        index === rows.length - 1 ||
                        rows[index + 1].person.id !== row.person.id;
                    const personRows = rows.filter(
                        (candidate) => candidate.person.id === row.person.id,
                    );

                    return (
                        <Fragment key={row.key}>
                            <TableRow>
                                <TableCell className="sticky left-0 bg-card font-medium">
                                    {firstForPerson && (
                                        <PersonLabel person={row.person} />
                                    )}
                                </TableCell>
                                <TableCell>
                                    <ProjectLabel project={row.project} />
                                </TableCell>
                                <TableCell>{row.role || '—'}</TableCell>
                                {months.map((month) => (
                                    <TableCell
                                        key={month.key}
                                        className="text-right"
                                    >
                                        <PlanHoursInput
                                            row={row}
                                            month={month.key}
                                            canEdit={canEdit}
                                        />
                                    </TableCell>
                                ))}
                            </TableRow>
                            {lastForPerson && (
                                <TableRow className="bg-muted/40 font-medium">
                                    <TableCell className="sticky left-0 bg-muted">
                                        {t('Total :name', {
                                            name: row.person.name,
                                        })}
                                    </TableCell>
                                    <TableCell colSpan={2} />
                                    {months.map((month) => (
                                        <TableCell
                                            key={month.key}
                                            className="text-right tabular-nums"
                                        >
                                            {formatHours(
                                                total(personRows, month.key),
                                                languageTag,
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            )}
                        </Fragment>
                    );
                })}
            </TableBody>
            <TableFooter>
                <TableRow>
                    <TableCell>{t('Grand total')}</TableCell>
                    <TableCell colSpan={2} />
                    {months.map((month) => (
                        <TableCell
                            key={month.key}
                            className="text-right tabular-nums"
                        >
                            {formatHours(total(rows, month.key), languageTag)}
                        </TableCell>
                    ))}
                </TableRow>
            </TableFooter>
        </Table>
    );
}

function ActualTable({
    rows,
    months,
    comparison,
}: {
    rows: BoardRow[];
    months: Month[];
    comparison: boolean;
}) {
    const { languageTag, t } = useTranslations();
    const actualTotal = (subset: BoardRow[], month: string): number | null => {
        const values = subset
            .map((row) => row.months[month]?.actual ?? null)
            .filter((value): value is number => value !== null);

        return values.length === 0
            ? null
            : values.reduce((sum, value) => sum + value, 0);
    };
    const plannedTotal = (subset: BoardRow[], month: string) =>
        subset.reduce((sum, row) => sum + (row.months[month]?.planned ?? 0), 0);
    const totalMonth = (subset: BoardRow[], month: string): BoardMonth => {
        const planned = plannedTotal(subset, month);
        const actual = actualTotal(subset, month);

        return {
            planned,
            actual,
            status: classifyVariance(planned, actual),
        };
    };

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead
                        rowSpan={comparison ? 2 : 1}
                        className="sticky top-0 left-0 min-w-48 bg-card"
                    >
                        {t('Person')}
                    </TableHead>
                    <TableHead
                        rowSpan={comparison ? 2 : 1}
                        className="sticky top-0 min-w-64 bg-card"
                    >
                        {t('Project / activity')}
                    </TableHead>
                    {months.map((month) => (
                        <TableHead
                            key={month.key}
                            colSpan={comparison ? 2 : 1}
                            className="sticky top-0 min-w-32 bg-card text-center"
                        >
                            {month.label}
                        </TableHead>
                    ))}
                </TableRow>
                {comparison && (
                    <TableRow>
                        {months.flatMap((month) => [
                            <TableHead
                                key={`${month.key}-planned`}
                                className="sticky top-10 min-w-24 bg-card text-right"
                            >
                                {t('Plan')}
                            </TableHead>,
                            <TableHead
                                key={`${month.key}-actual`}
                                className="sticky top-10 min-w-28 bg-card text-right"
                            >
                                {t('Actual')}
                            </TableHead>,
                        ])}
                    </TableRow>
                )}
            </TableHeader>
            <TableBody>
                {rows.map((row, index) => {
                    const firstForPerson =
                        index === 0 ||
                        rows[index - 1].person.id !== row.person.id;
                    const lastForPerson =
                        index === rows.length - 1 ||
                        rows[index + 1].person.id !== row.person.id;
                    const personRows = rows.filter(
                        (candidate) => candidate.person.id === row.person.id,
                    );

                    return (
                        <Fragment key={row.key}>
                            <TableRow>
                                <TableCell className="sticky left-0 bg-card font-medium">
                                    {firstForPerson && (
                                        <PersonLabel person={row.person} />
                                    )}
                                </TableCell>
                                <TableCell>
                                    <ProjectLabel project={row.project} />
                                </TableCell>
                                {months.flatMap((month) => {
                                    const value = row.months[month.key];

                                    return comparison
                                        ? [
                                              <TableCell
                                                  key={`${month.key}-planned`}
                                                  className="text-right tabular-nums"
                                              >
                                                  {formatHours(
                                                      value.planned,
                                                      languageTag,
                                                  )}
                                              </TableCell>,
                                              <TableCell
                                                  key={`${month.key}-actual`}
                                                  className="text-right tabular-nums"
                                              >
                                                  <VarianceValue
                                                      month={value}
                                                  />
                                              </TableCell>,
                                          ]
                                        : [
                                              <TableCell
                                                  key={`${month.key}-actual`}
                                                  className="text-right tabular-nums"
                                              >
                                                  {formatHours(
                                                      value.actual,
                                                      languageTag,
                                                  )}
                                              </TableCell>,
                                          ];
                                })}
                            </TableRow>
                            {lastForPerson && (
                                <TableRow className="bg-muted/40 font-medium">
                                    <TableCell className="sticky left-0 bg-muted">
                                        {t('Total :name', {
                                            name: row.person.name,
                                        })}
                                    </TableCell>
                                    <TableCell />
                                    {months.flatMap((month) =>
                                        comparison
                                            ? [
                                                  <TableCell
                                                      key={`${month.key}-planned`}
                                                      className="text-right tabular-nums"
                                                  >
                                                      {formatHours(
                                                          plannedTotal(
                                                              personRows,
                                                              month.key,
                                                          ),
                                                          languageTag,
                                                      )}
                                                  </TableCell>,
                                                  <TableCell
                                                      key={`${month.key}-actual`}
                                                      className="text-right tabular-nums"
                                                  >
                                                      <VarianceValue
                                                          month={totalMonth(
                                                              personRows,
                                                              month.key,
                                                          )}
                                                      />
                                                  </TableCell>,
                                              ]
                                            : [
                                                  <TableCell
                                                      key={`${month.key}-actual`}
                                                      className="text-right tabular-nums"
                                                  >
                                                      {formatHours(
                                                          actualTotal(
                                                              personRows,
                                                              month.key,
                                                          ),
                                                          languageTag,
                                                      )}
                                                  </TableCell>,
                                              ],
                                    )}
                                </TableRow>
                            )}
                        </Fragment>
                    );
                })}
            </TableBody>
            <TableFooter>
                <TableRow>
                    <TableCell>{t('Grand total')}</TableCell>
                    <TableCell />
                    {months.flatMap((month) =>
                        comparison
                            ? [
                                  <TableCell
                                      key={`${month.key}-planned`}
                                      className="text-right tabular-nums"
                                  >
                                      {formatHours(
                                          plannedTotal(rows, month.key),
                                          languageTag,
                                      )}
                                  </TableCell>,
                                  <TableCell
                                      key={`${month.key}-actual`}
                                      className="text-right tabular-nums"
                                  >
                                      <VarianceValue
                                          month={totalMonth(rows, month.key)}
                                      />
                                  </TableCell>,
                              ]
                            : [
                                  <TableCell
                                      key={`${month.key}-actual`}
                                      className="text-right tabular-nums"
                                  >
                                      {formatHours(
                                          actualTotal(rows, month.key),
                                          languageTag,
                                      )}
                                  </TableCell>,
                              ],
                    )}
                </TableRow>
            </TableFooter>
        </Table>
    );
}

function AdjustmentDialog({
    open,
    onOpenChange,
    people,
    projects,
    months,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    people: Props['people'];
    projects: Props['projects'];
    months: Month[];
}) {
    const { t } = useTranslations();
    const activeProjects = projects.filter(
        (project) => project.active !== false,
    );
    const minimumDate = months.length ? `${months[0].key}-01` : undefined;
    const maximumDate = months.length
        ? lastDateOfMonth(months[months.length - 1].key)
        : undefined;
    const form = useForm<AdjustmentPayload>({
        person_id: people[0]?.id ?? '',
        project_id: activeProjects[0]?.id ?? null,
        internal_label: '',
        effective_date: defaultEffectiveDate(months),
        hours_delta: '',
        reason: '',
    });

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        form.post(storeAdjustment.url(), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(t('The adjustment was recorded.'));
                onOpenChange(false);
                form.reset();
            },
            onError: () =>
                toast.error(t('Verify the adjustment data and try again.')),
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('Add actual adjustment')}</DialogTitle>
                    <DialogDescription>
                        {t(
                            'The adjustment is audited and does not change the source time entries in ClickUp.',
                        )}
                    </DialogDescription>
                </DialogHeader>
                <form className="flex flex-col gap-5" onSubmit={submit}>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="adjustment-person">{t('Person')}</Label>
                        <Select
                            value={String(form.data.person_id)}
                            onValueChange={(value) =>
                                form.setData('person_id', Number(value))
                            }
                        >
                            <SelectTrigger id="adjustment-person">
                                <SelectValue
                                    placeholder={t('Choose a person')}
                                />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
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
                        {form.errors.person_id && (
                            <p className="text-sm text-destructive">
                                {form.errors.person_id}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="adjustment-project">
                            {t('Project / activity')}
                        </Label>
                        <Select
                            value={
                                form.data.project_id === null
                                    ? 'internal'
                                    : String(form.data.project_id)
                            }
                            onValueChange={(value) =>
                                form.setData(
                                    'project_id',
                                    value === 'internal' ? null : Number(value),
                                )
                            }
                        >
                            <SelectTrigger id="adjustment-project">
                                <SelectValue
                                    placeholder={t('Choose a project')}
                                />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="internal">
                                        {t('Internal activity')}
                                    </SelectItem>
                                    {activeProjects.map((project) => (
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
                    </div>
                    {form.data.project_id === null && (
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="adjustment-label">
                                {t('Internal activity label')}
                            </Label>
                            <Input
                                id="adjustment-label"
                                aria-invalid={Boolean(
                                    form.errors.internal_label,
                                )}
                                onChange={(event) =>
                                    form.setData(
                                        'internal_label',
                                        event.target.value,
                                    )
                                }
                                value={form.data.internal_label}
                            />
                            {form.errors.internal_label && (
                                <p className="text-sm text-destructive">
                                    {form.errors.internal_label}
                                </p>
                            )}
                        </div>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="adjustment-date">
                                {t('Adjustment date')}
                            </Label>
                            <Input
                                id="adjustment-date"
                                aria-invalid={Boolean(
                                    form.errors.effective_date,
                                )}
                                max={maximumDate}
                                min={minimumDate}
                                onChange={(event) =>
                                    form.setData(
                                        'effective_date',
                                        event.target.value,
                                    )
                                }
                                type="date"
                                value={form.data.effective_date}
                            />
                            {form.errors.effective_date && (
                                <p className="text-sm text-destructive">
                                    {form.errors.effective_date}
                                </p>
                            )}
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="adjustment-hours">
                                {t('Hours to add / subtract')}
                            </Label>
                            <Input
                                id="adjustment-hours"
                                aria-invalid={Boolean(form.errors.hours_delta)}
                                inputMode="decimal"
                                onChange={(event) =>
                                    form.setData(
                                        'hours_delta',
                                        event.target.value === ''
                                            ? ''
                                            : Number(event.target.value),
                                    )
                                }
                                placeholder={t('e.g. +2.5 or -1')}
                                step={0.25}
                                type="number"
                                value={form.data.hours_delta}
                            />
                            {form.errors.hours_delta && (
                                <p className="text-sm text-destructive">
                                    {form.errors.hours_delta}
                                </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                                {t(
                                    'Enter a positive value to add hours and a negative value to subtract hours.',
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="adjustment-reason">{t('Reason')}</Label>
                        <Textarea
                            id="adjustment-reason"
                            aria-invalid={Boolean(form.errors.reason)}
                            onChange={(event) =>
                                form.setData('reason', event.target.value)
                            }
                            placeholder={t(
                                'Describe the reason for the correction',
                            )}
                            value={form.data.reason}
                        />
                        {form.errors.reason && (
                            <p className="text-sm text-destructive">
                                {form.errors.reason}
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            {t('Cancel')}
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            {form.processing && (
                                <LoaderCircle
                                    data-icon="inline-start"
                                    className="animate-spin"
                                />
                            )}
                            {t('Record adjustment')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function ReverseAdjustmentButton({
    adjustment,
}: {
    adjustment: AdjustmentRecord;
}) {
    const { languageTag, t } = useTranslations();
    const [open, setOpen] = useState(false);
    const form = useForm<ReversalPayload>({ reason: '' });
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        form.post(reverseAdjustment.url(adjustment.id), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(t('The adjustment was reversed.'));
                setOpen(false);
                form.reset();
            },
            onError: () =>
                toast.error(t('The adjustment could not be reversed.')),
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <Button
                size="sm"
                variant="outline"
                disabled={adjustment.isReversal || adjustment.isReversed}
                onClick={() => setOpen(true)}
            >
                <Undo2 data-icon="inline-start" />
                {adjustment.isReversed
                    ? t('Adjustment reversed')
                    : t('Reverse')}
            </Button>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('Reverse adjustment')}</DialogTitle>
                    <DialogDescription>
                        {t(
                            'A reversing record of :hours hours will be created. The original history remains unchanged.',
                            {
                                hours: formatHours(
                                    -adjustment.hoursDelta,
                                    languageTag,
                                ),
                            },
                        )}
                    </DialogDescription>
                </DialogHeader>
                <form className="flex flex-col gap-5" onSubmit={submit}>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor={`reversal-reason-${adjustment.id}`}>
                            {t('Reason for reversal')}
                        </Label>
                        <Textarea
                            id={`reversal-reason-${adjustment.id}`}
                            aria-invalid={Boolean(form.errors.reason)}
                            onChange={(event) =>
                                form.setData('reason', event.target.value)
                            }
                            value={form.data.reason}
                        />
                        {form.errors.reason && (
                            <p className="text-sm text-destructive">
                                {form.errors.reason}
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                        >
                            {t('Cancel')}
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            {form.processing && (
                                <LoaderCircle
                                    data-icon="inline-start"
                                    className="animate-spin"
                                />
                            )}
                            {t('Confirm reversal')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function AdjustmentHistory({
    adjustments,
    canReverse,
}: {
    adjustments: AdjustmentRecord[];
    canReverse: boolean;
}) {
    const { languageTag, t } = useTranslations();

    return (
        <Card className="min-w-0">
            <CardHeader>
                <CardTitle>{t('Actual adjustment history')}</CardTitle>
                <CardDescription>
                    {t(':count append-only records in the active period', {
                        count: adjustments.length,
                    })}
                </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('Adjustment date')}</TableHead>
                            <TableHead>{t('Person')}</TableHead>
                            <TableHead>{t('Project / activity')}</TableHead>
                            <TableHead className="text-right">
                                {t('Hours')}
                            </TableHead>
                            <TableHead>{t('Reason')}</TableHead>
                            <TableHead>{t('Author')}</TableHead>
                            <TableHead>{t('Status')}</TableHead>
                            {canReverse && <TableHead>{t('Action')}</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {adjustments.map((adjustment) => (
                            <TableRow key={adjustment.id}>
                                <TableCell>
                                    {formatDate(
                                        adjustment.effectiveDate,
                                        languageTag,
                                    )}
                                </TableCell>
                                <TableCell>{adjustment.person}</TableCell>
                                <TableCell>{adjustment.project}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatHours(
                                        adjustment.hoursDelta,
                                        languageTag,
                                    )}
                                </TableCell>
                                <TableCell>{adjustment.reason}</TableCell>
                                <TableCell>{adjustment.author}</TableCell>
                                <TableCell>
                                    <Badge
                                        variant={
                                            adjustment.isReversal
                                                ? 'secondary'
                                                : adjustment.isReversed
                                                  ? 'outline'
                                                  : 'default'
                                        }
                                    >
                                        {adjustment.isReversal
                                            ? t('reversal')
                                            : adjustment.isReversed
                                              ? t('reversed')
                                              : t('active')}
                                    </Badge>
                                </TableCell>
                                {canReverse && (
                                    <TableCell>
                                        <ReverseAdjustmentButton
                                            adjustment={adjustment}
                                        />
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function AllocationEditorForm({
    entry,
    initialPersonId,
    initialMonth,
    people,
    projects,
    months,
    capacityRows,
    onSaved,
    onCancel,
}: {
    entry: AllocationEntry | null;
    initialPersonId: number;
    initialMonth: string;
    people: Props['people'];
    projects: Props['projects'];
    months: Month[];
    capacityRows: CapacityRow[];
    onSaved: () => void;
    onCancel: () => void;
}) {
    const { languageTag, t } = useTranslations();
    const endpoint = entry ? updateAllocation(entry.id) : upsert();
    const deleteEndpoint = destroyAllocation(entry?.id ?? 0);
    const activeProjects = projects.filter(
        (project) => project.active !== false,
    );
    const initialHours = entry?.hours ?? 0;
    const form = useHttp<AllocationPayload, AllocationResponse>(endpoint, {
        person_id: entry?.personId ?? initialPersonId,
        project_id: entry?.projectId ?? activeProjects[0]?.id ?? 0,
        role:
            entry?.role ??
            people.find((person) => person.id === initialPersonId)?.jobRole ??
            '',
        month: entry?.month ?? initialMonth,
        planned_hours: initialHours,
        weekly_hours: allocationWeekDraft(
            entry,
            entry?.month ?? initialMonth,
            initialHours,
        ),
        planning_comment: entry?.planningComment ?? '',
    });
    const deleteForm = useHttp<Record<string, never>, { deleted: boolean }>(
        deleteEndpoint,
        {},
    );
    const [deleteOpen, setDeleteOpen] = useState(false);
    const targetCapacity = capacityRows.find(
        (row) => row.person.id === form.data.person_id,
    )?.months[form.data.month];
    const originalOnTarget =
        entry?.personId === form.data.person_id &&
        entry.month === form.data.month
            ? entry.hours
            : 0;
    const projectedAllocated = targetCapacity
        ? targetCapacity.allocatedHours -
          originalOnTarget +
          Number(form.data.planned_hours || 0)
        : null;
    const projectedFree =
        targetCapacity && projectedAllocated !== null
            ? targetCapacity.availableHours - projectedAllocated
            : null;
    const changeMonth = (month: string) => {
        form.setData({
            ...form.data,
            month,
            weekly_hours: distributeMonthlyHours(
                month,
                Number(form.data.planned_hours || 0),
            ),
        });
    };
    const changeWeekHours = (weekStart: string, hours: number) => {
        const weeklyHours = (form.data.weekly_hours ?? []).map((week) =>
            week.week_start === weekStart ? { ...week, hours } : week,
        );

        form.setData({
            ...form.data,
            weekly_hours: weeklyHours,
            planned_hours: weeklyHours.reduce(
                (total, week) => total + week.hours,
                0,
            ),
        });
    };

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void form
            .put(endpoint.url, {
                onSuccess: () => {
                    toast.success(t('The allocation was saved.'));
                    onSaved();
                    router.reload({
                        only: [
                            'planRows',
                            'comparisonRows',
                            'capacityRows',
                            'roles',
                            'weekly',
                            'allocationEntries',
                            'allocationHistory',
                        ],
                    });
                },
                onError: () => {
                    toast.error(t('Verify the allocation data and try again.'));
                },
                onHttpException: () => {
                    toast.error(t('The allocation could not be saved.'));
                },
                onNetworkError: () => {
                    toast.error(
                        t('Connection failed. The changes were not saved.'),
                    );
                },
            })
            .catch(() => undefined);
    };
    const removeAllocation = () => {
        if (!entry) {
            return;
        }

        void deleteForm
            .delete(deleteEndpoint.url, {
                onSuccess: () => {
                    toast.success(t('The allocation was deleted.'));
                    setDeleteOpen(false);
                    onSaved();
                    router.reload({
                        only: [
                            'planRows',
                            'comparisonRows',
                            'capacityRows',
                            'roles',
                            'weekly',
                            'allocationEntries',
                            'allocationHistory',
                        ],
                    });
                },
                onError: () => {
                    toast.error(t('The allocation could not be deleted.'));
                },
                onNetworkError: () => {
                    toast.error(t('Connection failed. Please try again.'));
                },
            })
            .catch(() => undefined);
    };

    return (
        <form className="flex flex-col gap-4" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                    <Label htmlFor="allocation-person">{t('Person')}</Label>
                    <Select
                        value={String(form.data.person_id)}
                        onValueChange={(value) =>
                            form.setData('person_id', Number(value))
                        }
                    >
                        <SelectTrigger id="allocation-person">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
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
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="allocation-month">{t('Month')}</Label>
                    <Select value={form.data.month} onValueChange={changeMonth}>
                        <SelectTrigger id="allocation-month">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                {months.map((month) => (
                                    <SelectItem
                                        key={month.key}
                                        value={month.key}
                                    >
                                        {month.label}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="allocation-project">{t('Project')}</Label>
                    <Select
                        value={String(form.data.project_id)}
                        onValueChange={(value) =>
                            form.setData('project_id', Number(value))
                        }
                    >
                        <SelectTrigger id="allocation-project">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                {activeProjects.map((project) => (
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
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="allocation-role">{t('Role')}</Label>
                    <Input
                        id="allocation-role"
                        value={form.data.role}
                        onChange={(event) =>
                            form.setData('role', event.target.value)
                        }
                    />
                </div>
            </div>
            <div className="grid gap-3">
                <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-end">
                    <div>
                        <Label>{t('Weekly distribution')}</Label>
                        <p className="text-xs text-muted-foreground">
                            {t(
                                'Edit each week in quarter-hour steps. The monthly total is calculated automatically.',
                            )}
                        </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums">
                        {t('Monthly total')}:{' '}
                        {formatHours(form.data.planned_hours, languageTag)}h
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {(form.data.weekly_hours ?? []).map((week, index) => (
                        <div className="grid gap-1.5" key={week.week_start}>
                            <Label
                                htmlFor={`allocation-week-${week.week_start}`}
                            >
                                {t('W:week', { week: index + 1 })} ·{' '}
                                {formatDate(week.week_start, languageTag)}
                            </Label>
                            <Input
                                id={`allocation-week-${week.week_start}`}
                                type="number"
                                min={0}
                                step={0.25}
                                inputMode="decimal"
                                value={week.hours}
                                onChange={(event) =>
                                    changeWeekHours(
                                        week.week_start,
                                        Number(event.target.value || 0),
                                    )
                                }
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid gap-2">
                <Label htmlFor="allocation-comment">
                    {t('Planning comment')}
                </Label>
                <Textarea
                    id="allocation-comment"
                    rows={3}
                    maxLength={2000}
                    value={form.data.planning_comment ?? ''}
                    placeholder={t(
                        'Add context, dependencies, or a delivery note for this allocation.',
                    )}
                    onChange={(event) =>
                        form.setData('planning_comment', event.target.value)
                    }
                />
            </div>

            {!targetCapacity ||
            projectedAllocated === null ||
            projectedFree === null ? (
                <Alert>
                    <AlertTriangle />
                    <AlertTitle>{t('Capacity data missing')}</AlertTitle>
                    <AlertDescription>
                        {t(
                            'The impact cannot be calculated for the selected person and month.',
                        )}
                    </AlertDescription>
                </Alert>
            ) : (
                <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-3">
                    <div>
                        <p className="text-xs text-muted-foreground">
                            {t('Available capacity')}
                        </p>
                        <p className="font-semibold tabular-nums">
                            {formatHours(
                                targetCapacity.availableHours,
                                languageTag,
                            )}
                            h
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">
                            {t('After save')}
                        </p>
                        <p className="font-semibold tabular-nums">
                            {formatHours(projectedAllocated, languageTag)}h
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">
                            {projectedFree < 0
                                ? t('Over capacity')
                                : t('Capacity remaining')}
                        </p>
                        <p
                            className={`font-semibold tabular-nums ${projectedFree < 0 ? 'text-destructive' : ''}`}
                        >
                            {formatHours(projectedFree, languageTag)}h
                        </p>
                    </div>
                </div>
            )}

            {Object.values(form.errors)[0] && (
                <p className="text-sm text-destructive">
                    {Object.values(form.errors)[0]}
                </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                {entry ? (
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={() => setDeleteOpen(true)}
                    >
                        <Trash2 data-icon="inline-start" />
                        {t('Delete allocation')}
                    </Button>
                ) : (
                    <span />
                )}
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                    <Button type="button" variant="outline" onClick={onCancel}>
                        {t('Cancel')}
                    </Button>
                    <Button type="submit" disabled={form.processing}>
                        {form.processing && (
                            <LoaderCircle className="animate-spin" />
                        )}
                        {t('Save allocation')}
                    </Button>
                </div>
            </div>

            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('Delete allocation?')}</DialogTitle>
                        <DialogDescription>
                            {t(
                                'This removes the planned hours and weekly distribution. The deletion remains in the audit log.',
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDeleteOpen(false)}
                        >
                            {t('Keep allocation')}
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            disabled={deleteForm.processing}
                            onClick={removeAllocation}
                        >
                            {deleteForm.processing && (
                                <LoaderCircle className="animate-spin" />
                            )}
                            <Trash2 data-icon="inline-start" />
                            {t('Delete allocation')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </form>
    );
}

function AllocationEditorDialog({
    open,
    onOpenChange,
    personId,
    month,
    people,
    projects,
    months,
    capacityRows,
    entries,
    history,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    personId: number;
    month: string;
    people: Props['people'];
    projects: Props['projects'];
    months: Month[];
    capacityRows: CapacityRow[];
    entries: AllocationEntry[];
    history: AllocationHistoryRecord[];
}) {
    const { languageTag, t } = useTranslations();
    const cellEntries = entries.filter(
        (entry) => entry.personId === personId && entry.month === month,
    );
    const [selectedEntryId, setSelectedEntryId] = useState(
        cellEntries[0] ? String(cellEntries[0].id) : 'new',
    );

    const selectedEntry =
        entries.find((entry) => String(entry.id) === selectedEntryId) ?? null;
    const visibleHistory = selectedEntry
        ? history
              .filter((record) => record.allocationId === selectedEntry.id)
              .slice(0, 5)
        : [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
                <DialogHeader>
                    <DialogTitle>{t('Edit allocation')}</DialogTitle>
                    <DialogDescription>
                        {t(
                            'Change hours, person, project, role, or month. Capacity impact is calculated before save.',
                        )}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-2">
                    <Label htmlFor="allocation-entry">{t('Allocation')}</Label>
                    <Select
                        value={selectedEntryId}
                        onValueChange={setSelectedEntryId}
                    >
                        <SelectTrigger id="allocation-entry">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                {cellEntries.map((entry) => {
                                    const project = projects.find(
                                        (candidate) =>
                                            candidate.id === entry.projectId,
                                    );

                                    return (
                                        <SelectItem
                                            key={entry.id}
                                            value={String(entry.id)}
                                        >
                                            {project?.label ??
                                                t('Project missing')}{' '}
                                            ·{' '}
                                            {formatHours(
                                                entry.hours,
                                                languageTag,
                                            )}
                                            h
                                        </SelectItem>
                                    );
                                })}
                                <SelectItem value="new">
                                    + {t('Add allocation')}
                                </SelectItem>
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>

                <AllocationEditorForm
                    key={selectedEntry?.id ?? `new-${personId}-${month}`}
                    entry={selectedEntry}
                    initialPersonId={personId}
                    initialMonth={month}
                    people={people}
                    projects={projects}
                    months={months}
                    capacityRows={capacityRows}
                    onSaved={() => onOpenChange(false)}
                    onCancel={() => onOpenChange(false)}
                />

                {visibleHistory.length > 0 && (
                    <div className="space-y-2 border-t pt-4">
                        <p className="text-sm font-medium">
                            {t('Allocation history')}
                        </p>
                        {visibleHistory.map((record) => (
                            <div
                                key={record.id}
                                className="flex flex-col justify-between gap-1 text-xs text-muted-foreground sm:flex-row"
                            >
                                <span>
                                    {record.author} ·{' '}
                                    {record.createdAt
                                        ? new Date(
                                              record.createdAt,
                                          ).toLocaleString(languageTag)
                                        : '—'}
                                </span>
                                <span className="tabular-nums">
                                    {typeof record.before?.planned_hours ===
                                    'number'
                                        ? `${formatHours(record.before.planned_hours, languageTag)}h → `
                                        : ''}
                                    {typeof record.after?.planned_hours ===
                                    'number'
                                        ? `${formatHours(record.after.planned_hours, languageTag)}h`
                                        : '—'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function MonthlyCapacityOverview({
    months,
    rows,
    people,
    projects,
    entries,
    history,
    canEdit,
}: {
    months: Month[];
    rows: CapacityRow[];
    people: Props['people'];
    projects: Props['projects'];
    entries: AllocationEntry[];
    history: AllocationHistoryRecord[];
    canEdit: boolean;
}) {
    const { languageTag, t } = useTranslations();
    const currentMonth = localIsoDate(new Date()).slice(0, 7);
    const currentIndex = months.findIndex(
        (month) => month.key === currentMonth,
    );
    const startIndex = currentIndex >= 0 ? currentIndex : 0;
    const [visibleCount, setVisibleCount] = useState(3);
    const visibleMonths = months.slice(startIndex, startIndex + visibleCount);
    const [roleFilter, setRoleFilter] = useState('all');
    const visibleRows = rows.filter(
        (row) => roleFilter === 'all' || row.roles.includes(roleFilter),
    );
    const initialSelectedMonth = visibleMonths[0]?.key ?? months[0]?.key ?? '';
    const initialSelectedRow =
        rows.find(
            (row) =>
                (row.months[initialSelectedMonth]?.allocatedHours ?? 0) > 0,
        ) ?? rows[0];
    const [selectedPersonId, setSelectedPersonId] = useState(
        initialSelectedRow?.person.id ?? 0,
    );
    const [selectedMonth, setSelectedMonth] = useState(initialSelectedMonth);
    const [editorOpen, setEditorOpen] = useState(false);
    const selectedRow =
        rows.find((row) => row.person.id === selectedPersonId) ?? rows[0];
    const selectedValue = selectedRow?.months[selectedMonth];
    const selectedMonthLabel =
        months.find((month) => month.key === selectedMonth)?.label ??
        selectedMonth;
    const canAddMonth = startIndex + visibleCount < months.length;
    const roleOptions = Array.from(
        new Set(rows.flatMap((row) => row.roles).filter(Boolean)),
    ).sort((left, right) => left.localeCompare(right, languageTag));

    return (
        <>
            <Card className="min-w-0">
                <CardHeader>
                    <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
                        <div>
                            <CardTitle>{t('Allocated vs Actual')}</CardTitle>
                            <CardDescription>
                                {t(
                                    'The dominant value is allocated capacity. Select a cell for capacity, actuals, and variance.',
                                )}
                            </CardDescription>
                        </div>
                        <Select
                            value={roleFilter}
                            onValueChange={setRoleFilter}
                        >
                            <SelectTrigger className="w-44">
                                <SelectValue placeholder={t('All roles')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    {t('All roles')}
                                </SelectItem>
                                {roleOptions.map((role) => (
                                    <SelectItem key={role} value={role}>
                                        {role}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
                    <div className="overflow-x-auto rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="min-w-52">
                                        {t('Person')}
                                    </TableHead>
                                    {visibleMonths.map((month) => (
                                        <TableHead
                                            key={month.key}
                                            className="min-w-36 text-center"
                                        >
                                            {month.label}
                                        </TableHead>
                                    ))}
                                    <TableHead className="min-w-32">
                                        {canAddMonth ? (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    setVisibleCount(
                                                        (count) => count + 1,
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
                                        <TableCell>
                                            <PersonLabel
                                                person={{
                                                    ...row.person,
                                                    capacity: {},
                                                }}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                {row.roles.join(' / ') ||
                                                    t('Role missing')}
                                            </p>
                                        </TableCell>
                                        {visibleMonths.map((month) => {
                                            const value = row.months[month.key];
                                            const isSelected =
                                                selectedRow?.person.id ===
                                                    row.person.id &&
                                                selectedMonth === month.key;
                                            const actualPosition =
                                                value.actualHours !== null &&
                                                value.availableHours > 0
                                                    ? Math.min(
                                                          100,
                                                          (value.actualHours /
                                                              value.availableHours) *
                                                              100,
                                                      )
                                                    : null;

                                            return (
                                                <TableCell key={month.key}>
                                                    <button
                                                        type="button"
                                                        className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${isSelected ? 'border-primary bg-primary/5' : ''}`}
                                                        onClick={() => {
                                                            setSelectedPersonId(
                                                                row.person.id,
                                                            );
                                                            setSelectedMonth(
                                                                month.key,
                                                            );
                                                        }}
                                                    >
                                                        <span className="flex items-center justify-between gap-2">
                                                            <strong className="text-lg tabular-nums">
                                                                {value.allocationPercent ===
                                                                null
                                                                    ? '—'
                                                                    : `${formatHours(value.allocationPercent, languageTag)}%`}
                                                            </strong>
                                                            {value.freeHours <
                                                                0 && (
                                                                <span className="text-xs font-medium text-destructive">
                                                                    {t('Over')}
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span className="relative mt-2 block h-2 rounded-full bg-muted">
                                                            <span
                                                                className={`block h-2 rounded-full ${value.freeHours < 0 ? 'bg-destructive' : 'bg-primary'}`}
                                                                style={{
                                                                    width: `${Math.min(value.allocationPercent ?? 0, 100)}%`,
                                                                }}
                                                            />
                                                            {actualPosition !==
                                                                null && (
                                                                <span
                                                                    className="absolute top-[-3px] h-3.5 w-0.5 bg-foreground"
                                                                    style={{
                                                                        left: `${actualPosition}%`,
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
                                    <EmptyRow
                                        columns={visibleMonths.length + 2}
                                        label={t(
                                            'No people match the selected filters.',
                                        )}
                                    />
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="rounded-lg border bg-muted/20 p-4">
                        {selectedRow && selectedValue ? (
                            <div className="space-y-4">
                                <div>
                                    <p className="font-semibold">
                                        {selectedRow.person.name} ·{' '}
                                        {selectedMonthLabel}
                                    </p>
                                    <Badge
                                        className="mt-2"
                                        variant={
                                            selectedValue.freeHours < 0
                                                ? 'destructive'
                                                : 'success'
                                        }
                                    >
                                        {selectedValue.freeHours < 0
                                            ? t(':hours over capacity', {
                                                  hours: `${formatHours(Math.abs(selectedValue.freeHours), languageTag)}h`,
                                              })
                                            : t(':hours capacity remaining', {
                                                  hours: `${formatHours(selectedValue.freeHours, languageTag)}h`,
                                              })}
                                    </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        [
                                            t('Contract'),
                                            selectedValue.grossHours,
                                        ],
                                        [
                                            t('Leave + unavailable'),
                                            selectedValue.leaveHours,
                                        ],
                                        [
                                            t('Available'),
                                            selectedValue.availableHours,
                                        ],
                                        [
                                            t('Allocated'),
                                            selectedValue.allocatedHours,
                                        ],
                                    ].map(([label, value]) => (
                                        <div key={label}>
                                            <p className="text-xs text-muted-foreground">
                                                {label}
                                            </p>
                                            <p className="font-semibold tabular-nums">
                                                {formatHours(
                                                    Number(value),
                                                    languageTag,
                                                )}
                                                h
                                            </p>
                                        </div>
                                    ))}
                                </div>
                                <div className="border-t pt-3">
                                    <p className="text-xs text-muted-foreground">
                                        {t('Actual')}
                                    </p>
                                    <p className="font-semibold tabular-nums">
                                        {selectedValue.actualHours === null
                                            ? t('No data')
                                            : `${formatHours(selectedValue.actualHours, languageTag)}h`}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {selectedValue.actualHours === null
                                            ? t(
                                                  'No ClickUp time entries or audited adjustments for this month.',
                                              )
                                            : t(':hours versus allocation', {
                                                  hours: `${formatHours(selectedValue.actualHours - selectedValue.allocatedHours, languageTag)}h`,
                                              })}
                                    </p>
                                </div>
                                {canEdit && (
                                    <Button
                                        className="w-full"
                                        onClick={() => setEditorOpen(true)}
                                    >
                                        <Pencil /> {t('Edit allocations')}
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                {t('Select a cell to see details.')}
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {editorOpen && selectedRow && selectedMonth && (
                <AllocationEditorDialog
                    open={editorOpen}
                    onOpenChange={setEditorOpen}
                    personId={selectedRow.person.id}
                    month={selectedMonth}
                    people={people}
                    projects={projects}
                    months={months}
                    capacityRows={rows}
                    entries={entries}
                    history={history}
                />
            )}
        </>
    );
}

export default function TeamLeadPlan({
    months,
    people,
    teams,
    projects,
    roles,
    planRows,
    comparisonRows,
    capacityRows,
    weekly,
    allocationEntries,
    allocationHistory,
    adjustments,
    permissions,
}: Props) {
    const { languageTag, t } = useTranslations();
    const pageUrl = usePage().url;
    const requestedPersonId = Number(
        new URLSearchParams(pageUrl.split('?')[1] ?? '').get('person'),
    );
    const hasRequestedPerson = people.some(
        (person) => person.id === requestedPersonId,
    );
    const [mode, setMode] = useState<DisplayMode>('plan');
    const [planningView, setPlanningView] = useState<'weekly' | 'monthly'>(
        hasRequestedPerson ? 'monthly' : 'weekly',
    );
    const [allPeopleSelected, setAllPeopleSelected] =
        useState(!hasRequestedPerson);
    const [selectedPersonIds, setSelectedPersonIds] = useState<number[]>(() =>
        hasRequestedPerson
            ? [requestedPersonId]
            : people.map((person) => person.id),
    );
    const [projectFilter, setProjectFilter] = useState('all');
    const [roleFilter, setRoleFilter] = useState('all');
    const [adjustmentOpen, setAdjustmentOpen] = useState(false);
    const filterByPersonAndProject = useCallback(
        <T extends PlanRow | BoardRow>(row: T) =>
            (allPeopleSelected || selectedPersonIds.includes(row.person.id)) &&
            (projectFilter === 'all' ||
                (projectFilter === 'internal'
                    ? row.project.internal
                    : String(row.project.id) === projectFilter)),
        [allPeopleSelected, projectFilter, selectedPersonIds],
    );
    const filteredPlanRows = useMemo(
        () =>
            planRows
                .filter(filterByPersonAndProject)
                .filter(
                    (row) => roleFilter === 'all' || row.role === roleFilter,
                )
                .sort(
                    (left, right) =>
                        left.person.name.localeCompare(
                            right.person.name,
                            languageTag,
                        ) ||
                        left.project.label.localeCompare(
                            right.project.label,
                            languageTag,
                        ) ||
                        left.role.localeCompare(right.role, languageTag),
                ),
        [filterByPersonAndProject, languageTag, planRows, roleFilter],
    );
    const filteredComparisonRows = useMemo(
        () =>
            comparisonRows
                .filter(filterByPersonAndProject)
                .filter(
                    (row) =>
                        roleFilter === 'all' || row.roles.includes(roleFilter),
                )
                .sort(
                    (left, right) =>
                        left.person.name.localeCompare(
                            right.person.name,
                            languageTag,
                        ) ||
                        left.project.label.localeCompare(
                            right.project.label,
                            languageTag,
                        ),
                ),
        [comparisonRows, filterByPersonAndProject, languageTag, roleFilter],
    );
    const visibleRows =
        mode === 'plan'
            ? filteredPlanRows.length
            : filteredComparisonRows.length;
    const totalRows = mode === 'plan' ? planRows.length : comparisonRows.length;
    const personFilterLabel = allPeopleSelected
        ? t('All people')
        : selectedPersonIds.length === 0
          ? t('No people')
          : selectedPersonIds.length === 1
            ? (people.find((person) => person.id === selectedPersonIds[0])
                  ?.name ?? t('1 person'))
            : t(':count people', { count: selectedPersonIds.length });
    const resetFilters = () => {
        setAllPeopleSelected(true);
        setSelectedPersonIds(people.map((person) => person.id));
        setProjectFilter('all');
        setRoleFilter('all');
    };

    setLayoutProps({
        breadcrumbs: [{ title: t('Team planning'), href: teamLeadIndex() }],
    });

    return (
        <>
            <Head title={t('Team planning')} />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-hidden p-3 sm:p-4">
                {planningView === 'monthly' && (
                    <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <UsersRound className="size-6" />
                                <h1 className="text-2xl font-semibold tracking-tight">
                                    {t('Team planning')}
                                </h1>
                            </div>
                            <p className="max-w-3xl text-sm text-muted-foreground">
                                {t(
                                    'Actual hours come from ClickUp. Corrections are separate, audited adjustments, while planned hours remain editable for authorized users.',
                                )}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {permissions.adjustActualHours && (
                                <Button
                                    variant="outline"
                                    onClick={() => setAdjustmentOpen(true)}
                                >
                                    <Plus data-icon="inline-start" />
                                    {t('Add adjustment')}
                                </Button>
                            )}
                            <ToggleGroup
                                type="single"
                                value={planningView}
                                variant="outline"
                                aria-label={t('Planning period')}
                                onValueChange={(value) => {
                                    if (value) {
                                        setPlanningView(
                                            value as 'weekly' | 'monthly',
                                        );
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
                    </div>
                )}

                {planningView === 'weekly' ? (
                    <WeeklyCapacityView
                        weekly={weekly}
                        projects={projects}
                        roles={roles}
                        teams={teams}
                        onShowMonthly={() => setPlanningView('monthly')}
                    />
                ) : (
                    <>
                        <MonthlyCapacityOverview
                            months={months}
                            rows={capacityRows}
                            people={people}
                            projects={projects}
                            entries={allocationEntries}
                            history={allocationHistory}
                            canEdit={permissions.manageAllocations}
                        />

                        <Card className="min-w-0">
                            <CardHeader>
                                <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                                    <div className="flex flex-col gap-1">
                                        <CardTitle>
                                            {mode === 'plan'
                                                ? t('Monthly plan in hours')
                                                : mode === 'actual'
                                                  ? t('Monthly actual hours')
                                                  : t('Plan vs Actual')}
                                        </CardTitle>
                                        <CardDescription>
                                            {t(':count of :total rows', {
                                                count: visibleRows,
                                                total: totalRows,
                                            })}
                                            {mode === 'plan' &&
                                                !permissions.manageAllocations &&
                                                ` · ${t('read-only access')}`}
                                            {mode !== 'plan' &&
                                                !permissions.adjustActualHours &&
                                                ` · ${t('actual hours are read-only')}`}
                                        </CardDescription>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <ToggleGroup
                                            type="single"
                                            value={mode}
                                            variant="outline"
                                            aria-label={t('Display mode')}
                                            onValueChange={(value) => {
                                                if (value) {
                                                    setMode(
                                                        value as DisplayMode,
                                                    );
                                                }
                                            }}
                                        >
                                            <ToggleGroupItem value="plan">
                                                {t('Plan (hours)')}
                                            </ToggleGroupItem>
                                            <ToggleGroupItem value="actual">
                                                {t('Actual (hours)')}
                                            </ToggleGroupItem>
                                            <ToggleGroupItem value="comparison">
                                                {t('Plan vs Actual')}
                                            </ToggleGroupItem>
                                        </ToggleGroup>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    aria-label={t(
                                                        'People filter',
                                                    )}
                                                    className="w-52 justify-between"
                                                    variant="outline"
                                                >
                                                    <span className="truncate">
                                                        {personFilterLabel}
                                                    </span>
                                                    <ChevronDown data-icon="inline-end" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                                align="start"
                                                className="max-h-[var(--radix-dropdown-menu-content-available-height)] w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
                                            >
                                                <DropdownMenuGroup>
                                                    <DropdownMenuLabel>
                                                        {t('People')}
                                                    </DropdownMenuLabel>
                                                    <DropdownMenuCheckboxItem
                                                        checked={
                                                            allPeopleSelected
                                                        }
                                                        onCheckedChange={(
                                                            checked,
                                                        ) => {
                                                            setAllPeopleSelected(
                                                                checked ===
                                                                    true,
                                                            );

                                                            if (
                                                                checked === true
                                                            ) {
                                                                setSelectedPersonIds(
                                                                    people.map(
                                                                        (
                                                                            person,
                                                                        ) =>
                                                                            person.id,
                                                                    ),
                                                                );
                                                            }
                                                        }}
                                                        onSelect={(event) =>
                                                            event.preventDefault()
                                                        }
                                                    >
                                                        {t('All people')}
                                                    </DropdownMenuCheckboxItem>
                                                </DropdownMenuGroup>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuGroup>
                                                    {people.map((person) => (
                                                        <DropdownMenuCheckboxItem
                                                            key={person.id}
                                                            checked={selectedPersonIds.includes(
                                                                person.id,
                                                            )}
                                                            onCheckedChange={(
                                                                checked,
                                                            ) => {
                                                                setAllPeopleSelected(
                                                                    false,
                                                                );
                                                                setSelectedPersonIds(
                                                                    checked ===
                                                                        true
                                                                        ? Array.from(
                                                                              new Set(
                                                                                  [
                                                                                      ...selectedPersonIds,
                                                                                      person.id,
                                                                                  ],
                                                                              ),
                                                                          )
                                                                        : selectedPersonIds.filter(
                                                                              (
                                                                                  personId,
                                                                              ) =>
                                                                                  personId !==
                                                                                  person.id,
                                                                          ),
                                                                );
                                                            }}
                                                            onSelect={(event) =>
                                                                event.preventDefault()
                                                            }
                                                        >
                                                            <span className="truncate">
                                                                {person.name}
                                                            </span>
                                                        </DropdownMenuCheckboxItem>
                                                    ))}
                                                </DropdownMenuGroup>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                        <Select
                                            value={projectFilter}
                                            onValueChange={setProjectFilter}
                                        >
                                            <SelectTrigger
                                                className="w-64"
                                                aria-label={t('Project filter')}
                                            >
                                                <SelectValue
                                                    placeholder={t(
                                                        'All projects',
                                                    )}
                                                />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    <SelectItem value="all">
                                                        {t('All projects')}
                                                    </SelectItem>
                                                    <SelectItem value="internal">
                                                        {t(
                                                            'Internal activities',
                                                        )}
                                                    </SelectItem>
                                                    {projects.map((project) => (
                                                        <SelectItem
                                                            key={project.id}
                                                            value={String(
                                                                project.id,
                                                            )}
                                                        >
                                                            {project.label}
                                                            {project.active ===
                                                                false &&
                                                                ` (${t('Inactive').toLocaleLowerCase(languageTag)})`}
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
                                                className="w-40"
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
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={resetFilters}
                                        >
                                            <RotateCcw data-icon="inline-start" />
                                            {t('Reset')}
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="px-0">
                                {mode === 'plan' && (
                                    <PlanTable
                                        rows={filteredPlanRows}
                                        months={months}
                                        canEdit={permissions.manageAllocations}
                                    />
                                )}
                                {mode === 'actual' && (
                                    <ActualTable
                                        rows={filteredComparisonRows}
                                        months={months}
                                        comparison={false}
                                    />
                                )}
                                {mode === 'comparison' && (
                                    <ActualTable
                                        rows={filteredComparisonRows}
                                        months={months}
                                        comparison
                                    />
                                )}
                            </CardContent>
                        </Card>
                        {adjustments.length > 0 && (
                            <AdjustmentHistory
                                adjustments={adjustments}
                                canReverse={permissions.adjustActualHours}
                            />
                        )}
                    </>
                )}
            </div>
            {permissions.adjustActualHours && (
                <AdjustmentDialog
                    open={adjustmentOpen}
                    onOpenChange={setAdjustmentOpen}
                    people={people}
                    projects={projects}
                    months={months}
                />
            )}
        </>
    );
}
