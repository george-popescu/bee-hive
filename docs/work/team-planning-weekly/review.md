# Team Planning Weekly — Review

## Scope

- `app/Services/TeamLead/TeamLeadPlanData.php`
- `tests/Feature/TeamLeadPlanPageTest.php`
- `resources/js/components/team-planning/weekly-capacity.ts`
- `resources/js/components/team-planning/weekly-capacity-view.tsx`
- `resources/js/pages/team-lead/index.tsx`
- `resources/js/lib/i18n.ts`
- `tests/Frontend/weekly-capacity.test.ts`

Lenses: correctness, conventions, tests, security.

## Findings

### [MEDIUM] Zero-capacity people were still presented as needing allocation

- **Where:** `resources/js/components/team-planning/weekly-capacity-view.tsx:603`
- **Evidence:** The first pass rendered `No allocation` whenever `row.allocations.length === 0`, while the backend intentionally classifies a row with `availableHours === 0` as `balanced` and excludes it from the unallocated KPI.
- **Why it matters:** A person unavailable for the entire week appeared as an amber allocation problem even though there was no capacity left to allocate.
- **Suggested fix:** Derive an explicit empty-allocation state from both allocations and available capacity, render unavailable rows neutrally, and cover both states with a regression test.
- **Verdict:** CONFIRMED.
- **Validation note:** Checked the backend status branch and its zero-capacity feature test; the UI had no capacity guard, and the frontend test covered only rows with positive available capacity.
- **Resolution:** Fixed with `weeklyAllocationEmptyState()` and the `No available capacity` presentation; regression coverage added in `tests/Frontend/weekly-capacity.test.ts`.

No other correctness, conventions, tests, or security findings survived adversarial validation. Client-side filters consume controlled select values, the route's existing authorization remains unchanged, and no new write path was introduced.

## Clean pass

Round 2 completed after the fix with zero confirmed findings across the full scope and all four lenses.

- Frontend regression test: `tests 3`, `pass 3`, `fail 0`.
- Production bundle: `✓ built in 2.37s`.
- ESLint: `eslint .` exited successfully.
- Prettier: `All matched files use Prettier code style!`.
- TypeScript: `tsc --noEmit` exited successfully.
- Pint: `{"tool":"pint","result":"passed"}`.
- PHPStan: `{"tool":"phpstan","result":"passed","errors":0}`.
- Pest: `{"tool":"pest","result":"passed","tests":189,"passed":189,"assertions":2061,"duration_ms":5358}`.
- Diff integrity: `git diff --check` exited successfully.

Behavioral verification on `http://hive.test/team-lead` showed the weekly heading, previous/next navigation, four filters, three KPIs, dynamic project legend, all 27 people, and monthly fallback labels. At a 390×844 viewport the page width remained 390px with no page-level horizontal overflow, while the 997px table scrolled inside its 364px container. Browser warnings and errors: `[]`.
