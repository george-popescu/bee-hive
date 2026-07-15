import { useId } from 'react';
import { useTranslations } from '@/hooks/use-translations';

export type ActiveTaskTableRow = {
    id: number;
    contextLabel?: string | null;
    name: string;
    url: string;
    status: string;
    owners: string[];
    estimateHours: number | null;
    periodHours: number;
    totalLoggedHours: number;
    remainingHours: number | null;
    progress: number | null;
    dueDate: string | null;
};

type ActiveTaskTableProps = {
    rows: ActiveTaskTableRow[];
};

function parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);

    return new Date(year, month - 1, day, 12);
}

function formatHours(value: number | null, languageTag: string): string {
    if (value === null) {
        return '—';
    }

    return `${value.toLocaleString(languageTag, { maximumFractionDigits: 2 })}h`;
}

function formatDate(value: string, languageTag: string): string {
    return new Intl.DateTimeFormat(languageTag, {
        day: 'numeric',
        month: 'short',
    }).format(parseDate(value));
}

function formatProgress(value: number | null, languageTag: string): string {
    if (value === null) {
        return '—';
    }

    return `${value.toLocaleString(languageTag, { maximumFractionDigits: 1 })}%`;
}

export function ActiveTaskTable({ rows }: ActiveTaskTableProps) {
    const headingId = useId();
    const { languageTag, t } = useTranslations();

    return (
        <section className="grid gap-3" aria-labelledby={headingId}>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                    <h2
                        id={headingId}
                        className="text-lg leading-tight font-medium"
                    >
                        {t('Active tasks')}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        {t('Active tasks are ordered by status and due date.')}
                    </p>
                </div>
                <span className="rounded-full bg-foreground/[0.07] px-2 py-[3px] text-xs font-medium dark:bg-foreground/10">
                    {t(':count active ClickUp tasks', { count: rows.length })}
                </span>
            </div>

            <div className="max-h-[680px] overflow-auto rounded-xl border">
                <table className="w-full min-w-[1280px] border-collapse">
                    <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur">
                        <tr>
                            <th className="border-b px-3 py-2.5 text-left font-medium text-muted-foreground">
                                {t('Task')}
                            </th>
                            <th className="border-b px-3 py-2.5 text-left font-medium text-muted-foreground">
                                {t('Status')}
                            </th>
                            <th className="border-b px-3 py-2.5 text-left font-medium text-muted-foreground">
                                {t('Owner')}
                            </th>
                            <th className="border-b px-3 py-2.5 text-right font-medium text-muted-foreground">
                                {t('Estimate')}
                            </th>
                            <th className="border-b px-3 py-2.5 text-right font-medium text-muted-foreground">
                                {t('Worked in period')}
                            </th>
                            <th className="border-b px-3 py-2.5 text-right font-medium text-muted-foreground">
                                {t('Logged')}
                            </th>
                            <th className="border-b px-3 py-2.5 text-right font-medium text-muted-foreground">
                                {t('Remaining')}
                            </th>
                            <th className="border-b px-3 py-2.5 text-right font-medium text-muted-foreground">
                                {t('Progress')}
                            </th>
                            <th className="border-b px-3 py-2.5 text-right font-medium text-muted-foreground">
                                {t('Due date')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.id}>
                                <td className="border-b px-3 py-2.5 font-medium">
                                    <a
                                        href={row.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="hover:underline"
                                    >
                                        {row.contextLabel
                                            ? `${row.contextLabel} · `
                                            : ''}
                                        {row.name}
                                    </a>
                                </td>
                                <td className="border-b px-3 py-2.5">
                                    <span className="rounded-full bg-foreground/[0.07] px-2 py-[3px] text-xs font-medium dark:bg-foreground/10">
                                        {row.status}
                                    </span>
                                </td>
                                <td className="border-b px-3 py-2.5">
                                    {row.owners.join(', ') || t('Unassigned')}
                                </td>
                                <td className="border-b px-3 py-2.5 text-right tabular-nums">
                                    {formatHours(
                                        row.estimateHours,
                                        languageTag,
                                    )}
                                </td>
                                <td className="border-b px-3 py-2.5 text-right tabular-nums">
                                    {formatHours(row.periodHours, languageTag)}
                                </td>
                                <td className="border-b px-3 py-2.5 text-right tabular-nums">
                                    {formatHours(
                                        row.totalLoggedHours,
                                        languageTag,
                                    )}
                                </td>
                                <td className="border-b px-3 py-2.5 text-right tabular-nums">
                                    {formatHours(
                                        row.remainingHours,
                                        languageTag,
                                    )}
                                </td>
                                <td className="border-b px-3 py-2.5 text-right tabular-nums">
                                    {formatProgress(row.progress, languageTag)}
                                </td>
                                <td className="border-b px-3 py-2.5 text-right tabular-nums">
                                    {row.dueDate
                                        ? formatDate(row.dueDate, languageTag)
                                        : t('No due date')}
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td
                                    colSpan={9}
                                    className="px-3 py-8 text-center text-muted-foreground"
                                >
                                    {t('No active tasks.')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
