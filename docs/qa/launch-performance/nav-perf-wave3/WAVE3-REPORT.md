# NAV-PERF Wave 3 — Optimize Today's Focus Data Loading

**Branch:** `perf/nav-perf-wave3` (worktree `.worktrees/nav-perf-wave1`)  
**Base tip:** `ddb368fb` (evidence PR #95)  
**Sandbox serving (unchanged):** `7191fffa`  
**Status:** Coded + locally verified — **STOP for founder review before commit / PR / merge / deploy**

## 1. Ranked remaining Focus bottlenecks (post–Wave 2)

| Rank | Bottleneck | Blocks real Focus? | Wave 3 action |
|------|------------|--------------------|---------------|
| 1 | Fat venue-wide `payment_line_items` (`*` ≈ 126 KB / 149 rows) | Yes | Lean select (id, schedule_id, status, due_date, amount) ≈ 31 KB |
| 2 | Fat venue-wide `invoices` with client/event joins ≈ 77 KB / 64 rows | Yes | Lean select (balance/status/due/ids) ≈ 19 KB |
| 3 | Fat venue-wide `payment_schedules` with joins ≈ 28 KB / 45 rows | Yes | Lean select (id, event_id) ≈ 9 KB |
| 4 | All non-cancelled events ≈ 25 KB / 139 rows iterated for readiness | Yes (CPU + payload) | Fetch only readiness candidate events (Fancy: 8) — **no date cutoff** |
| 5 | Lean contracts (Wave 2) ≈ 62 KB / 60 rows | Yes | Kept (already lean) |
| 6 | `/api/notifications` | Interaction, not Focus assembly | Out of scope (no blocking dependency proven) |

## 2. Implemented changes

Focus path only (`getFocusNeedsAttentionBriefing` → `loadFocusReadinessInputs`):

1. **Lean loaders**
   - `getInvoicesForDashboardBriefing`
   - `getSchedulesForDashboardBriefing`
   - `getLineItemsForDashboardBriefing`
   - `getRequestsForDashboardBriefing`
   - (Wave 2) `getContractsForDashboardBriefing` unchanged
2. **Candidate event filter** via `selectFocusCandidateEventIds` — same `compute*Readiness` rules as Focus item emission. Historical overdue obligations remain. No `event_date` cutoff.
3. **Events query** `.in("id", candidateIds)` after lean parallel financial/request loads.
4. **Daily Briefing** (`getDailyBriefing`) still uses fat venue-wide loaders (coming-up / celebrations need full event set).

Files: `lib/luv/briefing-service.ts`, `lib/luv/focus-candidate-events.ts`, `lib/invoices/repository.ts`, `lib/payments/repository.ts`, `lib/requests/service.ts`, `lib/dashboard/nav-perf-wave3.test.ts`, docs under `docs/qa/launch-performance/nav-perf-wave3/`, `docs/launch/LAUNCH-READINESS.md`.

## 3. Before/after query measurements (Sandbox Fancy, local DB profiling)

| Metric | Before (fat parallel bundle) | After (lean Focus path) |
|--------|------------------------------|-------------------------|
| Payload bytes (median) | 319,866 | 115,908 (−64%) |
| Wall ms (median, warm) | 225 | 159 (−29%) |
| Events loaded for Focus loop | 139 | 8 |

Per-table lean vs fat (earlier profile, warm r2): invoices 77→19 KB; schedules 28→9 KB; lines 126→31 KB; requests 1.9→0.6 KB.

These are **DB/query** timings, not deployed Sandbox end-to-end Focus readiness.

## 4. Focus correctness parity (Fancy fixtures)

Baseline: 8 Focus items spanning overdue payments (incl. historical), draft contracts, submitted request, multi-invoice balances, cancelled-excluded events.

| Check | Result |
|-------|--------|
| Item count | 8 → 8 |
| Identity / category / status / order | Match |
| Labels, details, links | Match (baseline keys) |
| Invoice IDs, overdue counts, balanceDueSum | Match |
| Contract / request ID+status sets | Match |
| Unexplained mismatches | **0** |

Evidence: `profile-and-baseline.json`, `parity-after.json`.

## 5. Focused regression tests

```
npx tsx --test lib/dashboard/nav-perf-wave3.test.ts \
  lib/dashboard/nav-perf-wave2.test.ts \
  lib/luv/briefing-service.test.ts
```

**13/13 pass** — Wave 1/2 source protections preserved; Wave 3 lean path + candidate rules (incl. historical overdue, no date cutoff); Daily Briefing fat path retained.

## 6. Remaining critical-path delays

- Cold TTFB ~2.2 s (app/SSR shell — outside this wave’s Focus query cut)
- Deployed warm/cold real Focus/greeting not yet remeasured (code not on Sandbox)
- `/api/notifications` still a candidate interaction delay (unchanged)
- Broader venue navigation beyond Dashboard Focus

## 7. Recommendation

**Approve controlled Sandbox release** after founder review: commit → PR → merge to `main` → deploy Sandbox from `main` only → remasure cold/warm real Focus (not skeletons) + functional spot-check. Keep **NAV-PERF OPEN** until launch-bar acceptance.

No Production. No migrations. No commit/push/merge/deploy in this wave without approval.
