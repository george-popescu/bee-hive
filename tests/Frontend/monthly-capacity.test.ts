import assert from 'node:assert/strict';
import test from 'node:test';
import {
    addMonthlyColumn,
    filterMonthlyRows,
    monthlyCellPresentation,
    monthlyWindow,
    removeMonthlyColumn,
    resolveMonthlySelection,
} from '../../resources/js/components/team-planning/monthly-capacity.ts';
import type {
    MonthlyCapacityRow,
    PlanningMonth,
} from '../../resources/js/components/team-planning/monthly-capacity.ts';

const months: PlanningMonth[] = [
    { key: '2026-05', label: 'May 26' },
    { key: '2026-06', label: 'Jun 26' },
    { key: '2026-07', label: 'Jul 26' },
    { key: '2026-08', label: 'Aug 26' },
    { key: '2026-09', label: 'Sep 26' },
    { key: '2026-10', label: 'Oct 26' },
];

const rows: MonthlyCapacityRow[] = [
    {
        person: {
            id: 1,
            name: 'Ana',
            jobRole: 'Backend Developer',
            isExternal: false,
        },
        roles: ['Backend Developer'],
        months: {
            '2026-07': {
                grossHours: 160,
                leaveHours: 8,
                availableHours: 152,
                allocatedHours: 160,
                actualHours: 144,
                allocationPercent: 105.3,
                freeHours: -8,
            },
        },
    },
    {
        person: {
            id: 2,
            name: 'Bogdan',
            jobRole: 'Quality Assurance',
            isExternal: false,
        },
        roles: ['Quality Assurance'],
        months: {
            '2026-07': {
                grossHours: 160,
                leaveHours: 0,
                availableHours: 160,
                allocatedHours: 80,
                actualHours: null,
                allocationPercent: 50,
                freeHours: 80,
            },
        },
    },
];

test('starts at the active month with three columns and changes one column at a time', () => {
    assert.deepEqual(
        monthlyWindow(months, '2026-07', 3).map((month) => month.key),
        ['2026-07', '2026-08', '2026-09'],
    );
    assert.equal(addMonthlyColumn(3, 4), 4);
    assert.equal(addMonthlyColumn(4, 4), 4);
    assert.equal(removeMonthlyColumn(4, 4), 3);
    assert.equal(removeMonthlyColumn(3, 4), 3);
});

test('keeps the selected person valid when the role filter changes', () => {
    const visibleRows = filterMonthlyRows(rows, 'Quality Assurance');

    assert.deepEqual(
        visibleRows.map((row) => row.person.name),
        ['Bogdan'],
    );
    assert.deepEqual(
        resolveMonthlySelection(visibleRows, ['2026-07'], {
            personId: 1,
            month: '2026-07',
        }),
        { personId: 2, month: '2026-07' },
    );
});

test('shows over-allocation but omits the actual marker and variance when actuals are unknown', () => {
    assert.deepEqual(monthlyCellPresentation(rows[0].months['2026-07']), {
        allocationPercent: 105.3,
        barPercent: 100,
        isOverallocated: true,
        actualMarkerPercent: 94.7,
        varianceHours: -16,
    });
    assert.deepEqual(monthlyCellPresentation(rows[1].months['2026-07']), {
        allocationPercent: 50,
        barPercent: 50,
        isOverallocated: false,
        actualMarkerPercent: null,
        varianceHours: null,
    });
});
