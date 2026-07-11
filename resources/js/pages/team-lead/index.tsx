import { Head, useForm, useHttp } from '@inertiajs/react';
import {
    Check,
    ChevronDown,
    LoaderCircle,
    Plus,
    RotateCcw,
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
import { upsert } from '@/actions/App/Http/Controllers/AllocationController';
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
import { index as teamLeadIndex } from '@/routes/team_lead';

type Month = { key: string; label: string };
type Person = {
    id: number;
    name: string;
    jobRole: string | null;
    isExternal: boolean;
    capacity: Record<string, number>;
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
    people: Array<Pick<Person, 'id' | 'name'>>;
    projects: Array<Project & { id: number }>;
    roles: string[];
    planRows: PlanRow[];
    comparisonRows: BoardRow[];
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
};
type AllocationResponse = {
    allocation: { id: number; planned_hours: number; updated_at: string };
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

const varianceLabels: Record<VarianceStatus, string> = {
    empty: 'Fără date',
    'on-plan': 'În plan (±10%)',
    'significant-variance': 'Abatere semnificativă (>25%)',
    neutral: 'Abatere moderată',
    unplanned: 'Ore neplanificate',
};

function formatHours(value: number | null): string {
    if (value === null) {
        return '—';
    }

    return value.toLocaleString('ro-RO', { maximumFractionDigits: 2 });
}

function localIsoDate(date: Date): string {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');
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

function formatDate(date: string): string {
    return new Intl.DateTimeFormat('ro-RO', {
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
            'Orele nu au putut fi salvate. Valoarea anterioară a fost restaurată.',
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
                        ? 'Fără normă configurată'
                        : `${percentage}% din norma lunară`
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
    return (
        <span className="flex items-center gap-2">
            {person.name}
            {person.isExternal && <Badge variant="secondary">extern</Badge>}
        </span>
    );
}

function ProjectLabel({ project }: { project: Project }) {
    return (
        <span className="flex items-center gap-2">
            {project.label}
            {project.internal && <Badge variant="outline">intern</Badge>}
        </span>
    );
}

function VarianceValue({ month }: { month: BoardMonth }) {
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
            {formatHours(month.actual)}
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
    const total = (subset: PlanRow[], month: string) =>
        subset.reduce((sum, row) => sum + (row.hours[month] ?? 0), 0);

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="sticky top-0 left-0 min-w-48 bg-card">
                        Persoană
                    </TableHead>
                    <TableHead className="sticky top-0 min-w-64 bg-card">
                        Proiect
                    </TableHead>
                    <TableHead className="sticky top-0 min-w-28 bg-card">
                        Rol
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
                                        Total {row.person.name}
                                    </TableCell>
                                    <TableCell colSpan={2} />
                                    {months.map((month) => (
                                        <TableCell
                                            key={month.key}
                                            className="text-right tabular-nums"
                                        >
                                            {formatHours(
                                                total(personRows, month.key),
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
                    <TableCell>Total general</TableCell>
                    <TableCell colSpan={2} />
                    {months.map((month) => (
                        <TableCell
                            key={month.key}
                            className="text-right tabular-nums"
                        >
                            {formatHours(total(rows, month.key))}
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
                        Persoană
                    </TableHead>
                    <TableHead
                        rowSpan={comparison ? 2 : 1}
                        className="sticky top-0 min-w-64 bg-card"
                    >
                        Proiect / activitate
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
                                Plan
                            </TableHead>,
                            <TableHead
                                key={`${month.key}-actual`}
                                className="sticky top-10 min-w-28 bg-card text-right"
                            >
                                Realizat
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
                                                  {formatHours(value.planned)}
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
                                                  {formatHours(value.actual)}
                                              </TableCell>,
                                          ];
                                })}
                            </TableRow>
                            {lastForPerson && (
                                <TableRow className="bg-muted/40 font-medium">
                                    <TableCell className="sticky left-0 bg-muted">
                                        Total {row.person.name}
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
                    <TableCell>Total general</TableCell>
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
                toast.success('Ajustarea a fost înregistrată.');
                onOpenChange(false);
                form.reset();
            },
            onError: () =>
                toast.error('Verifică datele ajustării și încearcă din nou.'),
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Adaugă ajustare realizat</DialogTitle>
                    <DialogDescription>
                        Ajustarea este auditată și nu modifică pontajele sursă
                        din ClickUp.
                    </DialogDescription>
                </DialogHeader>
                <form className="flex flex-col gap-5" onSubmit={submit}>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="adjustment-person">Persoană</Label>
                        <Select
                            value={String(form.data.person_id)}
                            onValueChange={(value) =>
                                form.setData('person_id', Number(value))
                            }
                        >
                            <SelectTrigger id="adjustment-person">
                                <SelectValue placeholder="Alege persoana" />
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
                            Proiect / activitate
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
                                <SelectValue placeholder="Alege proiectul" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="internal">
                                        Activitate internă
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
                                Etichetă activitate internă
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
                                Data ajustării
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
                                Ore de adăugat / scăzut
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
                                placeholder="ex. +2,5 sau -1"
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
                                Valoare pozitivă pentru adăugare, negativă
                                pentru scădere.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="adjustment-reason">Motiv</Label>
                        <Textarea
                            id="adjustment-reason"
                            aria-invalid={Boolean(form.errors.reason)}
                            onChange={(event) =>
                                form.setData('reason', event.target.value)
                            }
                            placeholder="Descrie motivul corecției"
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
                            Renunță
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            {form.processing && (
                                <LoaderCircle
                                    data-icon="inline-start"
                                    className="animate-spin"
                                />
                            )}
                            Înregistrează ajustarea
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
    const [open, setOpen] = useState(false);
    const form = useForm<ReversalPayload>({ reason: '' });
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        form.post(reverseAdjustment.url(adjustment.id), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Ajustarea a fost inversată.');
                setOpen(false);
                form.reset();
            },
            onError: () => toast.error('Ajustarea nu a putut fi inversată.'),
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
                {adjustment.isReversed ? 'Inversată' : 'Inversează'}
            </Button>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Inversează ajustarea</DialogTitle>
                    <DialogDescription>
                        Se va crea o înregistrare opusă de{' '}
                        {formatHours(-adjustment.hoursDelta)} ore. Istoricul
                        original rămâne neschimbat.
                    </DialogDescription>
                </DialogHeader>
                <form className="flex flex-col gap-5" onSubmit={submit}>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor={`reversal-reason-${adjustment.id}`}>
                            Motivul inversării
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
                            Renunță
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            {form.processing && (
                                <LoaderCircle
                                    data-icon="inline-start"
                                    className="animate-spin"
                                />
                            )}
                            Confirmă inversarea
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
    return (
        <Card className="min-w-0">
            <CardHeader>
                <CardTitle>Istoric ajustări</CardTitle>
                <CardDescription>
                    {adjustments.length} înregistrări append-only în perioada
                    activă
                </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Data ajustării</TableHead>
                            <TableHead>Persoană</TableHead>
                            <TableHead>Proiect / activitate</TableHead>
                            <TableHead className="text-right">Ore</TableHead>
                            <TableHead>Motiv</TableHead>
                            <TableHead>Autor</TableHead>
                            <TableHead>Status</TableHead>
                            {canReverse && <TableHead>Acțiune</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {adjustments.map((adjustment) => (
                            <TableRow key={adjustment.id}>
                                <TableCell>
                                    {formatDate(adjustment.effectiveDate)}
                                </TableCell>
                                <TableCell>{adjustment.person}</TableCell>
                                <TableCell>{adjustment.project}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatHours(adjustment.hoursDelta)}
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
                                            ? 'inversare'
                                            : adjustment.isReversed
                                              ? 'inversată'
                                              : 'activă'}
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

export default function TeamLeadPlan({
    months,
    people,
    projects,
    roles,
    planRows,
    comparisonRows,
    adjustments,
    permissions,
}: Props) {
    const [mode, setMode] = useState<DisplayMode>('plan');
    const [allPeopleSelected, setAllPeopleSelected] = useState(true);
    const [selectedPersonIds, setSelectedPersonIds] = useState<number[]>(() =>
        people.map((person) => person.id),
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
                            'ro',
                        ) ||
                        left.project.label.localeCompare(
                            right.project.label,
                            'ro',
                        ) ||
                        left.role.localeCompare(right.role, 'ro'),
                ),
        [filterByPersonAndProject, planRows, roleFilter],
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
                            'ro',
                        ) ||
                        left.project.label.localeCompare(
                            right.project.label,
                            'ro',
                        ),
                ),
        [comparisonRows, filterByPersonAndProject, roleFilter],
    );
    const visibleRows =
        mode === 'plan'
            ? filteredPlanRows.length
            : filteredComparisonRows.length;
    const totalRows = mode === 'plan' ? planRows.length : comparisonRows.length;
    const personFilterLabel = allPeopleSelected
        ? 'Toate persoanele'
        : selectedPersonIds.length === 0
          ? 'Nicio persoană'
          : selectedPersonIds.length === 1
            ? (people.find((person) => person.id === selectedPersonIds[0])
                  ?.name ?? '1 persoană')
            : `${selectedPersonIds.length} persoane`;
    const resetFilters = () => {
        setAllPeopleSelected(true);
        setSelectedPersonIds(people.map((person) => person.id));
        setProjectFilter('all');
        setRoleFilter('all');
    };

    return (
        <>
            <Head title="Planificare echipă" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-hidden p-4">
                <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <UsersRound className="size-6" />
                            <h1 className="text-2xl font-semibold tracking-tight">
                                Planificare echipă
                            </h1>
                        </div>
                        <p className="max-w-3xl text-sm text-muted-foreground">
                            Planul este editabil în ore, realizatul vine din
                            ClickUp, iar corecțiile sunt ajustări separate și
                            auditate.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {permissions.adjustActualHours && (
                            <Button
                                variant="outline"
                                onClick={() => setAdjustmentOpen(true)}
                            >
                                <Plus data-icon="inline-start" />
                                Adaugă ajustare
                            </Button>
                        )}
                        <ToggleGroup
                            type="single"
                            value={mode}
                            variant="outline"
                            aria-label="Mod afișare"
                            onValueChange={(value) => {
                                if (value) {
                                    setMode(value as DisplayMode);
                                }
                            }}
                        >
                            <ToggleGroupItem value="plan">
                                Plan (ore)
                            </ToggleGroupItem>
                            <ToggleGroupItem value="actual">
                                Realizat (ore)
                            </ToggleGroupItem>
                            <ToggleGroupItem value="comparison">
                                Plan vs Realizat
                            </ToggleGroupItem>
                        </ToggleGroup>
                    </div>
                </div>

                <Card className="min-w-0">
                    <CardHeader>
                        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                            <div className="flex flex-col gap-1">
                                <CardTitle>
                                    {mode === 'plan'
                                        ? 'Plan lunar în ore'
                                        : mode === 'actual'
                                          ? 'Realizat lunar în ore'
                                          : 'Plan vs Realizat'}
                                </CardTitle>
                                <CardDescription>
                                    {visibleRows} din {totalRows} rânduri
                                    {mode === 'plan' &&
                                        !permissions.manageAllocations &&
                                        ' · acces doar pentru citire'}
                                    {mode !== 'plan' &&
                                        !permissions.adjustActualHours &&
                                        ' · realizat doar pentru citire'}
                                </CardDescription>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            aria-label="Filtru persoane"
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
                                                Persoane
                                            </DropdownMenuLabel>
                                            <DropdownMenuCheckboxItem
                                                checked={allPeopleSelected}
                                                onCheckedChange={(checked) => {
                                                    setAllPeopleSelected(
                                                        checked === true,
                                                    );

                                                    if (checked === true) {
                                                        setSelectedPersonIds(
                                                            people.map(
                                                                (person) =>
                                                                    person.id,
                                                            ),
                                                        );
                                                    }
                                                }}
                                                onSelect={(event) =>
                                                    event.preventDefault()
                                                }
                                            >
                                                Toate persoanele
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
                                                            checked === true
                                                                ? Array.from(
                                                                      new Set([
                                                                          ...selectedPersonIds,
                                                                          person.id,
                                                                      ]),
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
                                        aria-label="Filtru proiect"
                                    >
                                        <SelectValue placeholder="Toate proiectele" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectItem value="all">
                                                Toate proiectele
                                            </SelectItem>
                                            <SelectItem value="internal">
                                                Activități interne
                                            </SelectItem>
                                            {projects.map((project) => (
                                                <SelectItem
                                                    key={project.id}
                                                    value={String(project.id)}
                                                >
                                                    {project.label}
                                                    {project.active === false &&
                                                        ' (inactiv)'}
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
                                        aria-label="Filtru rol"
                                    >
                                        <SelectValue placeholder="Toate rolurile" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectItem value="all">
                                                Toate rolurile
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
                                    Resetează
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

TeamLeadPlan.layout = {
    breadcrumbs: [
        {
            title: 'Planificare echipă',
            href: teamLeadIndex(),
        },
    ],
};
