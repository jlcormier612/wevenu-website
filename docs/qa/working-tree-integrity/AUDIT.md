# Working-tree integrity audit — 2026-10-13

**Branch:** `feat/spaces-booking-e1-smart-fields`  
**HEAD at audit start:** `275de0e0`  
**Production:** untouched  
**Destructive git ops:** none (`reset`/`clean`/`stash` not used)

## A. Failing test — root cause and fix

| Item | Detail |
|------|--------|
| Failure | `lib/availability/assignment-windows.test.ts` → `stores each space window and uses the overall span on the event` |
| Assertion | `bookingConfirmationError(occupancy, 2) === null` |
| Actual | `"Enter a date for each event component."` |
| Root cause | **Stale test fixture**, not a broken product rule. Committed `bookingConfirmationError` (since `ca39c073` / reinforced later) requires every timed assignment to carry explicit `scheduledDate` so a phantom `eventDate` is never persisted as null. The assignment-windows fixture omitted `scheduledDate`. Canonical coverage already lives in `confirmed-occupancy.test.ts`. |
| Implementation vs assertion | Implementation correct; assertion outdated. |
| Real-flow impact | Runtime gate is intentional and protects multi-day component persistence. UI path uses `materializeMissingScheduledDates` before submit. Missing date at confirmation correctly blocks booking. |
| Fix | Updated fixture with `scheduledDate: "2028-06-16"`; added regression `rejects timed components that omit scheduledDate`. |
| Result | `assignment-windows` + related suites: **171/171 pass** (see Verification). |

## B. Working-tree inventory (grouped)

### Closed / already on HEAD (not dirty)

| Group | Status |
|-------|--------|
| Calendar venue-wide filter `727a92ca` | Closed + Sandbox GREEN |
| Nicole components + cards layout `c7e1fcf4` / evidence `275de0e0` | Closed + Sandbox GREEN |
| Booking `scheduledDate` confirmation gate | Committed; test gap fixed in this audit |

### Modified tracked — product/test (non-docs)

| File | Purpose | Status | Action |
|------|---------|--------|--------|
| `components/portal/portal-shell.tsx` | Button label `Update Password` → `Change password` | Intentional in-progress copy polish (password-recovery stream) | Left uncommitted |
| `lib/communication/contact-permission-attribution.test.ts` | Extra SMS attribution cases | Complete test-only; passes | Left uncommitted (separate stream) |
| `lib/deploy/client-skew-recovery.test.ts` | Assert workspace error boundary consumes skew reload | Complete test-only; passes | Left uncommitted |
| `lib/library/library-templates-ia.test.ts` | Point source reads at client page modules after split | Complete test-path update; passes | Left uncommitted |
| `scripts/qa/*-browser.mts` (5 files) | QA harness hardening (dpl= tip parse, path fixes) | Intentional WIP / evidence tooling | Left uncommitted |

### Modified tracked — docs/qa STATUS & evidence

Dozens of `docs/qa/*/STATUS.md` and proof artifacts (invoice adjust, Luv matrices, password recovery, ledgers, etc.). **QA evidence / status notes for prior workstreams.** Not runtime code. Left intact; not bundled into this fix commit.

### Untracked — significant groups

| Group | Purpose | Status |
|-------|---------|--------|
| `docs/qa/*` (many dirs) | Forensic/browser proof for closed or in-progress streams | Evidence archives — preserve |
| `docs/qa/calendar-empty-forensic/`, `nicole-components-calendar/` | Calendar GREEN proofs | Closed (committed earlier) |
| `scripts/qa/*.mts` (browser proofs) | Harnesses for various QA streams | Intentional WIP tooling |
| `scripts/_tmp-*.mts` | Disposable probes | Temp — do not ship as product |
| `lib/deploy/error-boundary-recovery.runtime.test.ts` | Skew recovery runtime asserts | Passes; uncommitted test |
| `lib/venue/multi-venue-data-integrity.test.ts` | Multi-venue switcher invariants | Passes; uncommitted test |
| `.worktrees/` | Local worktree checkout(s) | Environment — leave alone |

### Confirmed defects found in dirty tree

| Defect | Verdict |
|--------|---------|
| `assignment-windows` vs `scheduledDate` gate | **Fixed** (test) |
| Other dirty product code | No confirmed runtime defect established in this audit beyond the stale test |

## C. Verification

```
NODE_ENV=test npx tsx --test \
  lib/availability/assignment-windows.test.ts \
  lib/booking-journey/confirmed-occupancy.test.ts \
  lib/availability/event-occupancy.test.ts \
  lib/calendar/event-assignment-projection.test.ts \
  lib/calendar/space-filter.test.ts \
  lib/calendar/venue-calendar-taxonomy.test.ts \
  lib/calendar/schedule-item-times.test.ts \
  lib/calendar/schedule-item-detail.test.ts \
  lib/calendar/calendar-usability.test.ts \
  lib/availability/public-calendar.test.ts \
  lib/venue-spaces/assignments.test.ts
```

**171 tests, 171 pass, 0 fail.**

Also spot-checked dirty/untracked lib tests: contact-permission, client-skew, library-templates-ia, error-boundary-recovery, multi-venue-data-integrity — **51 pass**.

No Sandbox deploy required: test-only correction; runtime gate unchanged.

## D. Final state

- Fix commit: (recorded after commit)
- Serving tip for calendar work remains `c7e1fcf4` (docs evidence `275de0e0`) — not redeployed
- Production untouched
- Dirty/untracked work preserved

## E. Launch readiness

| Class | Items |
|-------|--------|
| **Closed** | Calendar filter + Nicole components + layout; `scheduledDate` confirmation gate; assignment-windows test alignment |
| **Intentionally in progress** | Portal password copy; attribution/skew/library test deltas; QA browser scripts; large `docs/qa` evidence backlog; `_tmp` probes |
| **Confirmed defect** | None remaining after this fix |
| **Unresolved** | Full 572-path tree not individually runtime-exercised; treat uncommitted QA/docs as evidence-only unless a workstream is reopened with an explicit acceptance contract |
