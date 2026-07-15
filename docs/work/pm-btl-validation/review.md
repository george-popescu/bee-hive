# PM BTL Validation — Review

## Scope

Reviewed the template 03 implementation across payload correctness, configured ClickUp source boundaries, Laravel/Inertia conventions, test quality, read-only security, responsive behavior and fidelity to `03-project-board-anexe-btl-exemplu.html`.

## Findings resolved

### MEDIUM Tablet content was clipped beside the expanded sidebar

- **Where:** `resources/js/components/pm-board/annex-validation-view.tsx:279`
- **Evidence:** the root used `w-full flex-1`; at 768×1024 the viewport had no horizontal scrollbar but the project controls and cards extended behind the right edge.
- **Why it matters:** tablet users lost visible controls and content even though the page appeared not to overflow.
- **Suggested fix:** let the flex item use the available width with `min-w-0 flex-1`.
- **Verdict:** CONFIRMED.
- **Validation note:** Browser inspection showed the clipped state at 768px; after the fix the content occupied the available area beside the expanded sidebar and the page remained exactly 768px wide.
- **Resolution:** fixed in all three PM board view roots and rechecked at 1440×1200, 768×1024 and 390×844 in light and dark.

### MEDIUM Identified people included unrelated ClickUp lists

- **Where:** `app/Services/PmBoard/PmBoardData.php:1009`
- **Evidence:** `$people = $scopedTasks->flatMap(...)` aggregated owners and contributors before restricting rows to `isBudgetTask` or `isOperationalTask`.
- **Why it matters:** a project with additional ClickUp lists could show people unrelated to the configured annex budget and operational activity.
- **Suggested fix:** filter scoped tasks to configured budget or operational sources before collecting people.
- **Verdict:** CONFIRMED.
- **Validation note:** a regression test added an `Archive` list contributor and failed with `Expecting [...] not to contain 'Unrelated Contributor'` before the filter.
- **Resolution:** fixed; the focused regression now passes with 40 assertions.

No CONFIRMED correctness, conventions, security or test findings remain. Project access still flows through the existing PM Board scope, the view is read-only, ClickUp links retain safe external-link attributes, and configuration is generic list-level data rather than a runtime BTL name branch.

## Verification

- `composer run ci:check`: ESLint, Prettier, TypeScript, Pint and PHPStan passed; Pest passed with 187 tests and 1,997 assertions.
- `npm run build`: Vite production build passed with 2,324 modules transformed.
- Focused PM suite: 23 tests and 745 assertions passed before the final regression; the new source-boundary regression passed with 40 assertions.
- Browser flow: Overview, Deliverables and Timeline rendered from a reversible local `Features`/`Backlog` configuration; the three tab interactions passed with no console errors.
- Responsive behavior: desktop, tablet and mobile passed in light and dark; page widths stayed at 1440px, 768px and 390px. The mobile Deliverables table uses controlled internal overflow (`358px` viewport, `720px` table) without widening the page.
- Data safety: the temporary local configuration was restored; MiM DEV has `board_config = null` and again renders the generic template 02 board. Stage was not accessed.
- Demo-value scan: no template 03 people, hours, deliverable names or dates occur in the implementation scope.

## Clean pass

Round 2 completed after both confirmed findings were fixed and the full lens set, automated suite and behavioral browser flow were rerun. Clean pass confirmed.
