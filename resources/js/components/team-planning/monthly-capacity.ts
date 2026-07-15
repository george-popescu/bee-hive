export type PlanningMonth = {
    key: string;
    label: string;
};

export type MonthlyCapacityValue = {
    grossHours: number;
    leaveHours: number;
    availableHours: number;
    allocatedHours: number;
    actualHours: number | null;
    allocationPercent: number | null;
    freeHours: number;
};

export type MonthlyCapacityRow = {
    person: {
        id: number;
        name: string;
        jobRole: string | null;
        isExternal: boolean;
    };
    roles: string[];
    months: Record<string, MonthlyCapacityValue>;
};

export type MonthlySelection = {
    personId: number;
    month: string;
};

export type MonthlyCellPresentation = {
    allocationPercent: number | null;
    barPercent: number;
    isOverallocated: boolean;
    actualMarkerPercent: number | null;
    varianceHours: number | null;
};

const minimumVisibleMonths = 3;

function clampPercent(value: number): number {
    return Math.max(0, Math.min(100, value));
}

function roundToOneDecimal(value: number): number {
    return Math.round(value * 10) / 10;
}

export function monthlyWindow(
    months: PlanningMonth[],
    activeMonth: string,
    visibleCount: number,
): PlanningMonth[] {
    const activeIndex = months.findIndex((month) => month.key === activeMonth);
    const startIndex = activeIndex >= 0 ? activeIndex : 0;

    return months.slice(startIndex, startIndex + visibleCount);
}

export function addMonthlyColumn(
    visibleCount: number,
    availableCount: number,
): number {
    return Math.min(visibleCount + 1, availableCount);
}

export function removeMonthlyColumn(
    visibleCount: number,
    availableCount: number,
): number {
    return Math.max(
        Math.min(minimumVisibleMonths, availableCount),
        visibleCount - 1,
    );
}

export function filterMonthlyRows(
    rows: MonthlyCapacityRow[],
    role: string | null,
): MonthlyCapacityRow[] {
    if (role === null) {
        return rows;
    }

    return rows.filter((row) => row.roles.includes(role));
}

export function resolveMonthlySelection(
    rows: MonthlyCapacityRow[],
    visibleMonths: string[],
    preferred: MonthlySelection | null,
): MonthlySelection | null {
    if (rows.length === 0 || visibleMonths.length === 0) {
        return null;
    }

    const personExists = rows.some(
        (row) => row.person.id === preferred?.personId,
    );
    const monthExists = visibleMonths.includes(preferred?.month ?? '');

    if (preferred !== null && personExists && monthExists) {
        return preferred;
    }

    const firstMonth = visibleMonths[0];
    const rowWithAllocation = rows.find(
        (row) => (row.months[firstMonth]?.allocatedHours ?? 0) > 0,
    );

    return {
        personId: (rowWithAllocation ?? rows[0]).person.id,
        month: firstMonth,
    };
}

export function monthlyCellPresentation(
    value: MonthlyCapacityValue,
): MonthlyCellPresentation {
    const actualMarkerPercent =
        value.actualHours === null || value.availableHours <= 0
            ? null
            : roundToOneDecimal(
                  clampPercent(
                      (value.actualHours / value.availableHours) * 100,
                  ),
              );

    return {
        allocationPercent: value.allocationPercent,
        barPercent: clampPercent(value.allocationPercent ?? 0),
        isOverallocated: value.freeHours < 0,
        actualMarkerPercent,
        varianceHours:
            value.actualHours === null
                ? null
                : roundToOneDecimal(value.actualHours - value.allocatedHours),
    };
}
