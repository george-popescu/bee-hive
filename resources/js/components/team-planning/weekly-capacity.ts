export type WeeklyCapacityStatus =
    'over' | 'unallocated' | 'available' | 'balanced';

export type WeeklyRow = {
    person: {
        id: number;
        name: string;
        jobRole: string | null;
        isExternal: boolean;
    };
    roles: string[];
    teamIds: number[];
    contractHours: number;
    leaveHours: number;
    availableHours: number;
    allocatedHours: number;
    freeHours: number;
    status: WeeklyCapacityStatus;
    allocations: Array<{
        projectId: number;
        label: string;
        hours: number;
        source: 'weekly' | 'prorated' | 'mixed';
    }>;
};

export type WeeklyPlanning = {
    period: {
        start: string;
        end: string;
        previous: string;
        next: string;
    };
    allocationMethod: 'weekly_with_monthly_fallback';
    rows: WeeklyRow[];
    totals: WeeklyTotals;
};

export type WeeklyFilters = {
    teamId: number | null;
    projectId: number | null;
    role: string | null;
    status: WeeklyCapacityStatus | null;
};

export type WeeklyTotals = {
    contractHours: number;
    leaveHours: number;
    availableHours: number;
    allocatedHours: number;
    freeHours: number;
    overallocatedPeople: number;
    unallocatedPeople: number;
};

export type WeeklyProjectLegendItem = {
    projectId: number;
    label: string;
};

export type WeeklyAllocationEmptyState = 'unallocated' | 'unavailable';

export function filterWeeklyRows(
    rows: WeeklyRow[],
    filters: WeeklyFilters,
): WeeklyRow[] {
    return rows.filter(
        (row) =>
            (filters.teamId === null || row.teamIds.includes(filters.teamId)) &&
            (filters.projectId === null ||
                row.allocations.some(
                    (allocation) => allocation.projectId === filters.projectId,
                )) &&
            (filters.role === null || row.roles.includes(filters.role)) &&
            (filters.status === null || row.status === filters.status),
    );
}

export function summarizeWeeklyRows(rows: WeeklyRow[]): WeeklyTotals {
    return rows.reduce<WeeklyTotals>(
        (totals, row) => ({
            contractHours: totals.contractHours + row.contractHours,
            leaveHours: totals.leaveHours + row.leaveHours,
            availableHours: totals.availableHours + row.availableHours,
            allocatedHours: totals.allocatedHours + row.allocatedHours,
            freeHours: totals.freeHours + Math.max(0, row.freeHours),
            overallocatedPeople:
                totals.overallocatedPeople + (row.status === 'over' ? 1 : 0),
            unallocatedPeople:
                totals.unallocatedPeople +
                (row.status === 'unallocated' ? 1 : 0),
        }),
        {
            contractHours: 0,
            leaveHours: 0,
            availableHours: 0,
            allocatedHours: 0,
            freeHours: 0,
            overallocatedPeople: 0,
            unallocatedPeople: 0,
        },
    );
}

export function weeklyAllocationEmptyState(
    row: WeeklyRow,
): WeeklyAllocationEmptyState | null {
    if (row.allocations.length > 0) {
        return null;
    }

    return row.availableHours > 0 ? 'unallocated' : 'unavailable';
}

export function weeklyProjectLegend(
    rows: WeeklyRow[],
): WeeklyProjectLegendItem[] {
    const projects = new Map<number, string>();

    rows.forEach((row) => {
        row.allocations.forEach((allocation) => {
            projects.set(allocation.projectId, allocation.label);
        });
    });

    return Array.from(projects, ([projectId, label]) => ({
        projectId,
        label,
    })).sort((first, second) => first.label.localeCompare(second.label));
}
