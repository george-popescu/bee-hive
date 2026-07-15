import assert from 'node:assert/strict';
import test from 'node:test';
import {
    filterWeeklyRows,
    summarizeWeeklyRows,
    weeklyAllocationEmptyState,
    weeklyProjectLegend,
} from '../../resources/js/components/team-planning/weekly-capacity.ts';
import type { WeeklyRow } from '../../resources/js/components/team-planning/weekly-capacity.ts';

const rows: WeeklyRow[] = [
    {
        person: {
            id: 1,
            name: 'Ana',
            jobRole: 'Backend Developer',
            isExternal: false,
        },
        roles: ['Backend Developer'],
        teamIds: [10],
        contractHours: 40,
        leaveHours: 8,
        availableHours: 32,
        allocatedHours: 36,
        freeHours: -4,
        status: 'over',
        allocations: [
            {
                projectId: 100,
                label: 'Acme — Portal',
                hours: 36,
                source: 'weekly',
            },
        ],
    },
    {
        person: {
            id: 2,
            name: 'Bogdan',
            jobRole: 'Quality Assurance',
            isExternal: false,
        },
        roles: ['Quality Assurance'],
        teamIds: [20],
        contractHours: 40,
        leaveHours: 0,
        availableHours: 40,
        allocatedHours: 24,
        freeHours: 16,
        status: 'available',
        allocations: [
            {
                projectId: 200,
                label: 'Beta — Mobile',
                hours: 16,
                source: 'weekly',
            },
            {
                projectId: 100,
                label: 'Acme — Portal',
                hours: 8,
                source: 'prorated',
            },
        ],
    },
    {
        person: {
            id: 3,
            name: 'Corina',
            jobRole: 'Quality Assurance',
            isExternal: false,
        },
        roles: ['Quality Assurance'],
        teamIds: [20],
        contractHours: 30,
        leaveHours: 0,
        availableHours: 30,
        allocatedHours: 0,
        freeHours: 30,
        status: 'unallocated',
        allocations: [],
    },
];

test('filters weekly rows and recomputes KPIs only from visible people', () => {
    const visibleRows = filterWeeklyRows(rows, {
        teamId: 20,
        projectId: 200,
        role: 'Quality Assurance',
        status: 'available',
    });

    assert.deepEqual(
        visibleRows.map((row) => row.person.name),
        ['Bogdan'],
    );
    assert.deepEqual(summarizeWeeklyRows(visibleRows), {
        contractHours: 40,
        leaveHours: 0,
        availableHours: 40,
        allocatedHours: 24,
        freeHours: 16,
        overallocatedPeople: 0,
        unallocatedPeople: 0,
    });
});

test('builds a unique stable project legend from the visible allocations', () => {
    assert.deepEqual(weeklyProjectLegend(rows), [
        { projectId: 100, label: 'Acme — Portal' },
        { projectId: 200, label: 'Beta — Mobile' },
    ]);
});

test('distinguishes people without capacity from people who still need allocation', () => {
    assert.equal(weeklyAllocationEmptyState(rows[2]), 'unallocated');
    assert.equal(
        weeklyAllocationEmptyState({
            ...rows[2],
            availableHours: 0,
            freeHours: 0,
            status: 'balanced',
        }),
        'unavailable',
    );
});
