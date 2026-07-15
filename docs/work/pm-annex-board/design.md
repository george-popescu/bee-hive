# PM Annex Board — Design

## Problem

Projects marked Deliverables currently reuse the generic selector view and do not reproduce `02-project-board-anexe.html`. Users cannot filter delivery work by annex scope, compare planned and delivered work for the week, or see annex health, agreed work and timeline in the approved hierarchy. Sales OS is excluded from this implementation, so contract identifiers, approved budgets and contractual deadlines must not be simulated from ClickUp execution data.

## Approach

A selected Deliverables project renders a dedicated React annex board while T&M and unconfigured projects continue using template 01. The server groups ClickUp tasks into annex scopes using an explicit `board_config.annex_modules` mapping when present, otherwise a bracketed scope from the synchronized task name; work without a reliable scope is grouped as „Annex data missing”. ClickUp estimates, time entries, owners, statuses and dates power execution metrics, weekly planned-vs-worked rows, agreed work and the timeline. Contract identifier, approved budget and contract deadline remain nullable and are labeled as missing; ClickUp estimate totals and task due dates are displayed with their real source instead of being renamed as contractual values.

The project selector remains available as an application navigation control even though the standalone HTML assumes a project was already selected. The alternatives of treating every ClickUp list as an annex and of copying the MiM demo annexes were rejected because Backlog/Features are execution structures, not contracts. A Sales OS-shaped local table was rejected because Sales OS integration is explicitly out of scope.

## Acceptance criteria

- [x] Selecting a project with template Deliverables renders the dedicated Contract delivery board; selecting T&M or an unconfigured project still renders template 01.
- [x] The header preserves project navigation and exposes Week/Month plus an annex filter whose options come only from grouped synchronized tasks.
- [x] Month view displays three KPI cards, annex health rows, agreed work until delivery and a timeline with a today marker; Week view replaces health/timeline with planned vs delivered and changes the agreed-work section to next-week tasks.
- [x] Each annex health row separates estimate consumption from delivery progress and displays consumed, estimated remaining, completed/total work and the closest ClickUp due date without calling those values contractual.
- [x] Contract identifier, approved budget or contract deadline that is unavailable appears as `—` or „Date lipsă”; unknown values never become zero and no forecast is invented.
- [x] Tasks without a reliable annex scope remain visible under an explicit missing-data group, and missing owner, estimate, start or due date is visible at row or timeline level.
- [x] No client names, task names, people, hours or dates from the HTML are hardcoded in production PHP or React.
- [x] The view is verified in light and dark at desktop, tablet and mobile, with working project/period/annex controls, no relevant console errors and no uncontrolled horizontal overflow.

## Out of scope

- Sales OS integration or a local imitation of Sales OS contract data.
- Editing ClickUp tasks, estimates, owners, statuses or time entries.
- Treating ClickUp lists as contractual annexes without an explicit mapping.
- The BTL-specific validation and data-quality hardening from template 03.
