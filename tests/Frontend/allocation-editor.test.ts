import assert from 'node:assert/strict';
import test from 'node:test';
import {
    allocationDraftPayload,
    allocationDraftTotal,
    buildAllocationDraft,
    distributeMonthlyHours,
    monthWeekStarts,
} from '../../resources/js/components/team-planning/allocation-editor.ts';
import type { AllocationEntry } from '../../resources/js/components/team-planning/allocation-editor.ts';

const entry: AllocationEntry = {
    id: 10,
    personId: 1,
    projectId: 20,
    role: 'BE Dev',
    month: '2026-07',
    hours: 24,
    weeklyHours: [
        { weekStart: '2026-07-06', hours: 8 },
        { weekStart: '2026-07-13', hours: 16 },
    ],
    planningComment: 'Release',
    updatedBy: 'Ionuț',
    updatedAt: '2026-07-15T12:00:00+03:00',
};

test('loads every intersecting week and keeps saved weekly hours', () => {
    assert.deepEqual(monthWeekStarts('2026-07'), [
        '2026-06-29',
        '2026-07-06',
        '2026-07-13',
        '2026-07-20',
        '2026-07-27',
    ]);
    assert.deepEqual(buildAllocationDraft([entry], 1, '2026-07')[0].weeks, [
        { weekStart: '2026-06-29', hours: 0 },
        { weekStart: '2026-07-06', hours: 8 },
        { weekStart: '2026-07-13', hours: 16 },
        { weekStart: '2026-07-20', hours: 0 },
        { weekStart: '2026-07-27', hours: 0 },
    ]);
});

test('distributes monthly fallback in quarter-hour units without losing the total', () => {
    const weeks = distributeMonthlyHours('2026-08', 41.25);

    assert.equal(
        weeks.reduce((total, week) => total + week.hours, 0),
        41.25,
    );
    assert.equal(weeks.every((week) => (week.hours * 4) % 1 === 0), true);
});

test('calculates the live impact and serializes one atomic person-month payload', () => {
    const draft = buildAllocationDraft([entry], 1, '2026-07');

    assert.equal(allocationDraftTotal(draft), 24);
    assert.deepEqual(allocationDraftPayload(draft)[0], {
        id: 10,
        project_id: 20,
        role: 'BE Dev',
        planned_hours: 24,
        weekly_hours: [
            { week_start: '2026-06-29', hours: 0 },
            { week_start: '2026-07-06', hours: 8 },
            { week_start: '2026-07-13', hours: 16 },
            { week_start: '2026-07-20', hours: 0 },
            { week_start: '2026-07-27', hours: 0 },
        ],
        planning_comment: 'Release',
    });
});
