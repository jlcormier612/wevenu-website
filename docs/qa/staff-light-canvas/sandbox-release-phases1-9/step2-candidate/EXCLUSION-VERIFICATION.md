# Step 2 — Exclusion Verification

Candidate vs baseline `cf84a4ee…`. Every changed path maps to Step 1 Phase 1–9 manifest or focused tests/docs.

## Phase 10 — absent from candidate

| Check | Result |
|---|---|
| `rg` for `htc-hospitality-intro-accent` / `htc-hospitality-filter` / `htc-hospitality-section-label` / `data-htc-phase10` under candidate `app/` + `components/` + `globals.css` | **No matches** |
| `components/reporting/reports-layout-shell.tsx` | Baseline (no accent class) |
| `components/reporting/date-range-control.tsx` | Baseline |
| `components/reporting/report-tabs.tsx` | Baseline |
| `components/document-workspace/*` Phase 10 chrome | Unchanged vs baseline |
| `app/(app)/library/documents/page.tsx` | Unchanged vs baseline |
| `lib/theme/color-distribution-phase10*.test.ts` | **Not present** in candidate |
| Browser `/reporting`, `/documents`, `/library/documents` | `phase10Markers: 0` |

## Unrelated product work — absent

| Area | Evidence |
|---|---|
| Tours B3/B4 / tours workspace CSS | No tours hospitality blocks in candidate `globals.css`; no tours component diffs |
| Floor Plans / Seating / Timeline feature dirt | No matching paths in `git diff --name-only` |
| Booking lifecycle / leads pipeline dirt | Not in candidate diff |
| Marketing / portal / HQ | Not in candidate diff |
| SQL migrations | No migration/SQL paths in candidate diff (only `migration-guidance-panel.tsx` UI) |

## Diff inventory (source)

**Modified (30):** Phase 1–9 app/components + surgical `app/globals.css`  
**Added (11 code):** `stage-section-runs.ts` + 10 focused tests  
**Docs/evidence:** `docs/qa/staff-light-canvas/sandbox-release-phases1-9/step2-candidate/**`

No unexplained hunks.

## Original workspace Phase 10 preserved

`/Users/jensmac/Developer/wevenu-website` still dirty (~1664 paths) with Phase 10 accent in `app/globals.css` and `components/reporting/reports-layout-shell.tsx`.
