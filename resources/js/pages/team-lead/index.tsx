import { Head, useHttp } from '@inertiajs/react';
import { Check, LoaderCircle, RotateCcw, UsersRound } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { toast } from 'sonner';
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
import { Input } from '@/components/ui/input';
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
type Project = { id: number; label: string };
type PlanRow = {
    key: string;
    person: Person;
    project: Project;
    role: string;
    hours: Record<string, number>;
};
type Props = {
    months: Month[];
    people: Array<Pick<Person, 'id' | 'name'>>;
    projects: Project[];
    roles: string[];
    planRows: PlanRow[];
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

export default function TeamLeadPlan({
    months,
    people,
    projects,
    roles,
    planRows,
    permissions,
}: Props) {
    const [personFilter, setPersonFilter] = useState('all');
    const [projectFilter, setProjectFilter] = useState('all');
    const [roleFilter, setRoleFilter] = useState('all');
    const filteredRows = useMemo(
        () =>
            planRows
                .filter(
                    (row) =>
                        personFilter === 'all' ||
                        String(row.person.id) === personFilter,
                )
                .filter(
                    (row) =>
                        projectFilter === 'all' ||
                        String(row.project.id) === projectFilter,
                )
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
        [personFilter, planRows, projectFilter, roleFilter],
    );
    const totals = (rows: PlanRow[], month: string) =>
        rows.reduce((total, row) => total + (row.hours[month] ?? 0), 0);
    const resetFilters = () => {
        setPersonFilter('all');
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
                            Planul este stocat în ore. Procentul din normă apare
                            la trecerea peste fiecare celulă. Salvarea se face
                            la ieșirea din câmp sau la Enter.
                        </p>
                    </div>
                    <ToggleGroup
                        type="single"
                        value="plan"
                        variant="outline"
                        aria-label="Mod afișare"
                    >
                        <ToggleGroupItem value="plan">
                            Plan (ore)
                        </ToggleGroupItem>
                        <ToggleGroupItem value="actual" disabled>
                            Realizat (ore)
                        </ToggleGroupItem>
                        <ToggleGroupItem value="comparison" disabled>
                            Plan vs Realizat
                        </ToggleGroupItem>
                    </ToggleGroup>
                </div>

                <Card className="min-w-0">
                    <CardHeader>
                        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                            <div className="flex flex-col gap-1">
                                <CardTitle>Plan lunar în ore</CardTitle>
                                <CardDescription>
                                    {filteredRows.length} din {planRows.length}{' '}
                                    rânduri
                                    {!permissions.manageAllocations &&
                                        ' · acces doar pentru citire'}
                                </CardDescription>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Select
                                    value={personFilter}
                                    onValueChange={setPersonFilter}
                                >
                                    <SelectTrigger
                                        className="w-48"
                                        aria-label="Filtru persoană"
                                    >
                                        <SelectValue placeholder="Toate persoanele" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectItem value="all">
                                                Toate persoanele
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
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="sticky left-0 min-w-48 bg-card">
                                        Persoană
                                    </TableHead>
                                    <TableHead className="min-w-64">
                                        Proiect
                                    </TableHead>
                                    <TableHead className="min-w-28">
                                        Rol
                                    </TableHead>
                                    {months.map((month) => (
                                        <TableHead
                                            key={month.key}
                                            className="min-w-32 text-right"
                                        >
                                            {month.label}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRows.map((row, index) => {
                                    const firstForPerson =
                                        index === 0 ||
                                        filteredRows[index - 1].person.id !==
                                            row.person.id;
                                    const lastForPerson =
                                        index === filteredRows.length - 1 ||
                                        filteredRows[index + 1].person.id !==
                                            row.person.id;
                                    const personRows = filteredRows.filter(
                                        (candidate) =>
                                            candidate.person.id ===
                                            row.person.id,
                                    );

                                    return (
                                        <Fragment key={row.key}>
                                            <TableRow>
                                                <TableCell className="sticky left-0 bg-card font-medium">
                                                    {firstForPerson && (
                                                        <span className="flex items-center gap-2">
                                                            {row.person.name}
                                                            {row.person
                                                                .isExternal && (
                                                                <Badge variant="secondary">
                                                                    extern
                                                                </Badge>
                                                            )}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {row.project.label}
                                                </TableCell>
                                                <TableCell>
                                                    {row.role || '—'}
                                                </TableCell>
                                                {months.map((month) => (
                                                    <TableCell
                                                        key={month.key}
                                                        className="text-right"
                                                    >
                                                        <PlanHoursInput
                                                            row={row}
                                                            month={month.key}
                                                            canEdit={
                                                                permissions.manageAllocations
                                                            }
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
                                                            {totals(
                                                                personRows,
                                                                month.key,
                                                            ).toLocaleString(
                                                                'ro-RO',
                                                            ) || '·'}
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
                                            {totals(
                                                filteredRows,
                                                month.key,
                                            ).toLocaleString('ro-RO') || '·'}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </CardContent>
                </Card>
            </div>
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
