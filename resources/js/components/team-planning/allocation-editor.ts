export type AllocationEntry = {
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

export type AllocationHistoryRecord = {
    id: number;
    allocationId: number;
    personId: number | null;
    projectId: number | null;
    role: string;
    month: string | null;
    action: string;
    author: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    createdAt: string | null;
};

export type AllocationDraftWeek = {
    weekStart: string;
    hours: number;
};

export type AllocationDraftRow = {
    key: string;
    id: number | null;
    projectId: number;
    role: string;
    weeks: AllocationDraftWeek[];
    planningComment: string;
};

function isoDate(date: Date): string {
    return [
        date.getUTCFullYear(),
        String(date.getUTCMonth() + 1).padStart(2, '0'),
        String(date.getUTCDate()).padStart(2, '0'),
    ].join('-');
}

function addDays(date: string, days: number): string {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);

    return isoDate(value);
}

function lastDateOfMonth(month: string): string {
    const [year, monthNumber] = month.split('-').map(Number);

    return isoDate(new Date(Date.UTC(year, monthNumber, 0)));
}

export function monthWeekStarts(month: string): string[] {
    const [year, monthNumber] = month.split('-').map(Number);
    const first = new Date(Date.UTC(year, monthNumber - 1, 1));
    const last = new Date(Date.UTC(year, monthNumber, 0));
    const cursor = new Date(first);
    cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7));
    const weeks: string[] = [];

    while (cursor <= last) {
        weeks.push(isoDate(cursor));
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

export function distributeMonthlyHours(
    month: string,
    hours: number,
): AllocationDraftWeek[] {
    const weeks = monthWeekStarts(month);
    const weights = weeks.map((week) => workingDaysInMonthWeek(month, week));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const totalUnits = Math.max(0, Math.round(hours * 4));

    if (totalWeight === 0) {
        return weeks.map((weekStart) => ({ weekStart, hours: 0 }));
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

    return weeks.map((weekStart, index) => ({
        weekStart,
        hours: units[index] / 4,
    }));
}

export function buildAllocationDraft(
    entries: AllocationEntry[],
    personId: number,
    month: string,
): AllocationDraftRow[] {
    return entries
        .filter((entry) => entry.personId === personId && entry.month === month)
        .map((entry) => {
            const savedHours = new Map(
                entry.weeklyHours.map((week) => [week.weekStart, week.hours]),
            );
            const weeks =
                entry.weeklyHours.length === 0
                    ? distributeMonthlyHours(month, entry.hours)
                    : monthWeekStarts(month).map((weekStart) => ({
                          weekStart,
                          hours: savedHours.get(weekStart) ?? 0,
                      }));

            return {
                key: `allocation-${entry.id}`,
                id: entry.id,
                projectId: entry.projectId,
                role: entry.role,
                weeks,
                planningComment: entry.planningComment ?? '',
            };
        });
}

export function allocationDraftRowTotal(row: AllocationDraftRow): number {
    return row.weeks.reduce((total, week) => total + week.hours, 0);
}

export function allocationDraftTotal(rows: AllocationDraftRow[]): number {
    return rows.reduce(
        (total, allocation) => total + allocationDraftRowTotal(allocation),
        0,
    );
}

export function allocationDraftPayload(rows: AllocationDraftRow[]) {
    return rows.map((row) => ({
        ...(row.id === null ? {} : { id: row.id }),
        project_id: row.projectId,
        role: row.role,
        planned_hours: allocationDraftRowTotal(row),
        weekly_hours: row.weeks.map((week) => ({
            week_start: week.weekStart,
            hours: week.hours,
        })),
        planning_comment: row.planningComment.trim() || null,
    }));
}
