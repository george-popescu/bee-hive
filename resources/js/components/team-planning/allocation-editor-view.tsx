import { router } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    History,
    Plus,
    Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { replacePersonMonth } from '@/actions/App/Http/Controllers/AllocationController';
import {
    allocationDraftPayload,
    allocationDraftRowTotal,
    allocationDraftTotal,
    buildAllocationDraft,
    monthWeekStarts,
} from '@/components/team-planning/allocation-editor';
import type {
    AllocationDraftRow,
    AllocationEntry,
    AllocationHistoryRecord,
} from '@/components/team-planning/allocation-editor';
import type {
    MonthlyCapacityRow,
    MonthlyCapacityValue,
    MonthlySelection,
    PlanningMonth,
} from '@/components/team-planning/monthly-capacity';
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
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';

type Project = {
    id: number;
    label: string;
    active: boolean;
};

type AllocationEditorViewProps = {
    selection: MonthlySelection;
    row: MonthlyCapacityRow;
    value: MonthlyCapacityValue;
    people: MonthlyCapacityRow[];
    months: PlanningMonth[];
    projects: Project[];
    entries: AllocationEntry[];
    history: AllocationHistoryRecord[];
    canManage: boolean;
    onSelect: (selection: MonthlySelection) => void;
};

function cloneDraft(rows: AllocationDraftRow[]): AllocationDraftRow[] {
    return rows.map((row) => ({
        ...row,
        weeks: row.weeks.map((week) => ({ ...week })),
    }));
}

function formatHours(value: number | null, locale: string): string {
    if (value === null) {
        return '—';
    }

    return `${value.toLocaleString(locale, { maximumFractionDigits: 2 })}h`;
}

function formatMonth(month: PlanningMonth, locale: string): string {
    const [year, monthNumber] = month.key.split('-').map(Number);

    return new Intl.DateTimeFormat(locale, {
        month: 'long',
        year: 'numeric',
    }).format(new Date(year, monthNumber - 1, 1, 12));
}

function formatWeek(weekStart: string, locale: string): string {
    return new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: 'short',
    }).format(new Date(`${weekStart}T12:00:00`));
}

export function AllocationEditorView({
    selection,
    row,
    value,
    people,
    months,
    projects,
    entries,
    history,
    canManage,
    onSelect,
}: AllocationEditorViewProps) {
    const { languageTag, t } = useTranslations();
    const baseline = useMemo(
        () =>
            buildAllocationDraft(entries, selection.personId, selection.month),
        [entries, selection.month, selection.personId],
    );
    const [draft, setDraft] = useState(() => cloneDraft(baseline));
    const [addProjectId, setAddProjectId] = useState('');
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const selectedMonth =
        months.find((month) => month.key === selection.month) ?? months[0];
    const activeProjects = projects.filter((project) => project.active);
    const draftTotal = allocationDraftTotal(draft);
    const freeHours = value.availableHours - draftTotal;
    const isDirty = JSON.stringify(draft) !== JSON.stringify(baseline);
    const personIndex = people.findIndex(
        (person) => person.person.id === selection.personId,
    );
    const contextHistory = history
        .filter(
            (record) =>
                record.personId === selection.personId &&
                record.month === selection.month,
        )
        .slice(0, 5);
    const firstError = Object.values(errors)[0];

    const selectAdjacentPerson = (offset: number) => {
        const nextIndex = Math.max(
            0,
            Math.min(people.length - 1, personIndex + offset),
        );
        const person = people[nextIndex];

        if (person) {
            onSelect({ ...selection, personId: person.person.id });
        }
    };

    const addAllocation = () => {
        const projectId = Number(addProjectId);

        if (!projectId) {
            return;
        }

        const role = row.person.jobRole ?? '';
        const duplicate = draft.some(
            (allocation) =>
                allocation.projectId === projectId && allocation.role === role,
        );

        if (duplicate) {
            setErrors({ project_id: t('This project is already allocated.') });

            return;
        }

        setErrors({});
        setDraft((current) => [
            ...current,
            {
                key: `new-${projectId}-${Date.now()}`,
                id: null,
                projectId,
                role,
                weeks: monthWeekStarts(selection.month).map((weekStart) => ({
                    weekStart,
                    hours: 0,
                })),
                planningComment: '',
            },
        ]);
        setAddProjectId('');
    };

    const save = () => {
        setProcessing(true);
        setErrors({});
        router.put(
            replacePersonMonth().url,
            {
                person_id: selection.personId,
                month: selection.month,
                allocations: allocationDraftPayload(draft),
            },
            {
                preserveScroll: true,
                onError: (nextErrors) => setErrors(nextErrors),
                onFinish: () => setProcessing(false),
            },
        );
    };

    return (
        <Card className="min-w-0 border-primary/20" id="allocation-editor">
            <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex flex-col gap-1">
                    <CardDescription>{t('Edit allocation')}</CardDescription>
                    <CardTitle>
                        {row.person.name} ·{' '}
                        {selectedMonth
                            ? formatMonth(selectedMonth, languageTag)
                            : selection.month}
                    </CardTitle>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={t('Previous person')}
                        disabled={personIndex <= 0}
                        onClick={() => selectAdjacentPerson(-1)}
                    >
                        <ArrowLeft />
                    </Button>
                    <div className="flex min-w-48 flex-col gap-1">
                        <Label>{t('Person')}</Label>
                        <Select
                            value={String(selection.personId)}
                            onValueChange={(personId) =>
                                onSelect({
                                    ...selection,
                                    personId: Number(personId),
                                })
                            }
                        >
                            <SelectTrigger aria-label={t('Person')}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    {people.map((person) => (
                                        <SelectItem
                                            key={person.person.id}
                                            value={String(person.person.id)}
                                        >
                                            {person.person.name}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex min-w-40 flex-col gap-1">
                        <Label>{t('Month')}</Label>
                        <Select
                            value={selection.month}
                            onValueChange={(month) =>
                                onSelect({ ...selection, month })
                            }
                        >
                            <SelectTrigger aria-label={t('Month')}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    {months.map((month) => (
                                        <SelectItem
                                            key={month.key}
                                            value={month.key}
                                        >
                                            {formatMonth(month, languageTag)}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={t('Next person')}
                        disabled={personIndex >= people.length - 1}
                        onClick={() => selectAdjacentPerson(1)}
                    >
                        <ArrowRight />
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="flex min-w-0 flex-col gap-5">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                    {[
                        [
                            t('Contract'),
                            formatHours(value.grossHours, languageTag),
                        ],
                        [
                            t('Leave + holidays'),
                            formatHours(value.leaveHours, languageTag),
                        ],
                        [
                            t('Capacity'),
                            formatHours(value.availableHours, languageTag),
                        ],
                        [t('Allocated'), formatHours(draftTotal, languageTag)],
                        [
                            t('Actual'),
                            formatHours(value.actualHours, languageTag),
                        ],
                    ].map(([label, metric]) => (
                        <div key={label} className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">
                                {label}
                            </span>
                            <strong className="tabular-nums">{metric}</strong>
                        </div>
                    ))}
                </div>

                {freeHours < 0 && (
                    <Alert variant="destructive">
                        <AlertTriangle />
                        <AlertTitle>{t('Over capacity')}</AlertTitle>
                        <AlertDescription>
                            {t(
                                ':hours over capacity; saving is still allowed.',
                                {
                                    hours: formatHours(
                                        Math.abs(freeHours),
                                        languageTag,
                                    ),
                                },
                            )}
                        </AlertDescription>
                    </Alert>
                )}

                <div className="flex min-w-0 flex-col divide-y rounded-lg border">
                    {draft.map((allocation) => (
                        <div
                            key={allocation.key}
                            className="grid min-w-0 gap-3 p-3 lg:grid-cols-[minmax(180px,1fr)_minmax(360px,2fr)_auto] lg:items-start"
                        >
                            <div className="grid gap-2">
                                <Select
                                    value={String(allocation.projectId)}
                                    disabled={!canManage}
                                    onValueChange={(projectId) =>
                                        setDraft((current) =>
                                            current.map((row) =>
                                                row.key === allocation.key
                                                    ? {
                                                          ...row,
                                                          projectId:
                                                              Number(projectId),
                                                      }
                                                    : row,
                                            ),
                                        )
                                    }
                                >
                                    <SelectTrigger aria-label={t('Project')}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            {projects
                                                .filter(
                                                    (project) =>
                                                        project.active ||
                                                        project.id ===
                                                            allocation.projectId,
                                                )
                                                .map((project) => (
                                                    <SelectItem
                                                        key={project.id}
                                                        value={String(
                                                            project.id,
                                                        )}
                                                    >
                                                        {project.label}
                                                    </SelectItem>
                                                ))}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                                <Input
                                    value={allocation.planningComment}
                                    disabled={!canManage}
                                    maxLength={2000}
                                    aria-label={t('Planning note')}
                                    placeholder={t('Planning note')}
                                    onChange={(event) =>
                                        setDraft((current) =>
                                            current.map((row) =>
                                                row.key === allocation.key
                                                    ? {
                                                          ...row,
                                                          planningComment:
                                                              event.target
                                                                  .value,
                                                      }
                                                    : row,
                                            ),
                                        )
                                    }
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                                {allocation.weeks.map((week, weekIndex) => (
                                    <Label
                                        key={week.weekStart}
                                        className="grid gap-1 text-xs text-muted-foreground"
                                    >
                                        {t('W:week · :date', {
                                            week: weekIndex + 1,
                                            date: formatWeek(
                                                week.weekStart,
                                                languageTag,
                                            ),
                                        })}
                                        <Input
                                            type="number"
                                            min={0}
                                            step={0.25}
                                            value={week.hours}
                                            disabled={!canManage}
                                            className="tabular-nums"
                                            onChange={(event) => {
                                                const hours = Math.max(
                                                    0,
                                                    Number(event.target.value),
                                                );

                                                setDraft((current) =>
                                                    current.map((row) =>
                                                        row.key ===
                                                        allocation.key
                                                            ? {
                                                                  ...row,
                                                                  weeks: row.weeks.map(
                                                                      (
                                                                          candidate,
                                                                      ) =>
                                                                          candidate.weekStart ===
                                                                          week.weekStart
                                                                              ? {
                                                                                    ...candidate,
                                                                                    hours,
                                                                                }
                                                                              : candidate,
                                                                  ),
                                                              }
                                                            : row,
                                                    ),
                                                );
                                            }}
                                        />
                                    </Label>
                                ))}
                            </div>

                            <div className="flex items-center justify-between gap-2 lg:flex-col lg:items-end">
                                <strong className="min-w-16 text-right tabular-nums">
                                    {formatHours(
                                        allocationDraftRowTotal(allocation),
                                        languageTag,
                                    )}
                                </strong>
                                {canManage && (
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        aria-label={t('Remove allocation')}
                                        onClick={() =>
                                            setDraft((current) =>
                                                current.filter(
                                                    (row) =>
                                                        row.key !==
                                                        allocation.key,
                                                ),
                                            )
                                        }
                                    >
                                        <Trash2 />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}

                    {draft.length === 0 && (
                        <p className="p-6 text-center text-sm text-muted-foreground">
                            {t('No allocations for this person and month.')}
                        </p>
                    )}
                </div>

                {canManage && (
                    <div className="flex flex-wrap items-end gap-2">
                        <div className="flex min-w-64 flex-1 flex-col gap-1">
                            <Label>{t('Add project')}</Label>
                            <Select
                                value={addProjectId}
                                onValueChange={setAddProjectId}
                            >
                                <SelectTrigger aria-label={t('Add project')}>
                                    <SelectValue
                                        placeholder={t('Select a project')}
                                    />
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
                        <Button
                            type="button"
                            variant="outline"
                            disabled={addProjectId === ''}
                            onClick={addAllocation}
                        >
                            <Plus /> {t('Add allocation')}
                        </Button>
                        <Badge
                            variant={
                                freeHours < 0 ? 'destructive' : 'secondary'
                            }
                            className="h-9 px-3"
                        >
                            {freeHours < 0
                                ? t(':hours over capacity', {
                                      hours: formatHours(
                                          Math.abs(freeHours),
                                          languageTag,
                                      ),
                                  })
                                : t(':hours available', {
                                      hours: formatHours(
                                          freeHours,
                                          languageTag,
                                      ),
                                  })}
                        </Badge>
                    </div>
                )}

                {firstError && (
                    <p className="text-sm text-destructive" role="alert">
                        {firstError}
                    </p>
                )}

                <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <span
                        className={cn(
                            'text-sm',
                            isDirty
                                ? 'font-medium text-foreground'
                                : 'text-muted-foreground',
                        )}
                    >
                        {isDirty
                            ? t('Unsaved changes.')
                            : t('No unsaved changes.')}
                    </span>
                    {canManage && (
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={!isDirty || processing}
                                onClick={() => {
                                    setDraft(cloneDraft(baseline));
                                    setErrors({});
                                }}
                            >
                                {t('Discard')}
                            </Button>
                            <Button
                                type="button"
                                disabled={!isDirty || processing}
                                onClick={save}
                            >
                                {processing
                                    ? t('Saving...')
                                    : t('Save allocation')}
                            </Button>
                        </div>
                    )}
                </div>

                <div className="grid gap-2 border-t pt-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <History className="size-4" /> {t('Recent changes')}
                    </div>
                    {contextHistory.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {t('No allocation changes recorded yet.')}
                        </p>
                    ) : (
                        <ul className="grid gap-1 text-sm text-muted-foreground">
                            {contextHistory.map((record) => (
                                <li key={record.id}>
                                    <span className="font-medium text-foreground">
                                        {record.author}
                                    </span>{' '}
                                    ·{' '}
                                    {record.action === 'allocation.deleted'
                                        ? t('allocation.deleted')
                                        : record.action === 'allocation.updated'
                                          ? t('allocation.updated')
                                          : t('allocation.upserted')}{' '}
                                    ·{' '}
                                    {projects.find(
                                        (project) =>
                                            project.id === record.projectId,
                                    )?.label ?? t('Unknown project')}{' '}
                                    ·{' '}
                                    {record.createdAt
                                        ? new Intl.DateTimeFormat(languageTag, {
                                              dateStyle: 'medium',
                                              timeStyle: 'short',
                                          }).format(new Date(record.createdAt))
                                        : '—'}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
