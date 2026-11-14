# Guest Seating CX + Floor Plans final two discrepancies

**Branch:** `fix/guest-seating-cx-correction`  
**Base:** `origin/main` @ `7a6c2dfd`  
**Status:** STOP before merge/deployment — awaiting review. Production untouched.

## Phase A — root causes

### 1. Guest Seating counts vs table occupancy (`C-guest-seating-assignments`)

**Data is consistent; presentation was wrong.**

On the disposable Barn-master seating host:

- Six `guest_seat_assignments` rows point at real `floor_plan_objects` IDs.
- Those IDs are **Ceremony Row** placements (`table_rect`, `display_shape = null`, ~100×28).
- Reception rounds T1–T8 correctly show **0** occupants because no guests are assigned there.
- Summary `6/6 seated` comes from assignment count, so it disagreed with the **visible round tables**.

**Renderer defect (P0):** `SeatingTableShape` used `displayShape ?? "round"`. Null-shaped thin ceremony rows became giant circles (`r = width/2`), overlapping and unreadable — occupancy looked like blank `0/8` reception tables.

**Secondary:** Guest Seating canvas rendered **only** seating-type objects, so dance floor / bars / gifts were missing and the chart did not match the physical floor plan.

**Fixture note:** Prior acceptance seeding used `.limit(4)` on seating objects, which returned ceremony rows first. Disposable acceptance copies should seat onto labeled reception tables (T1…) for density review. Do **not** change the venue master Barn-master template without approval.

### 2. Ready replacement — editing controls (`C-ready-replacement-pending`)

When `couple_preference_status = proposed_replacement`:

- Portal preferred `coupleSelectedFloorPlanId` (the **requested** layout).
- That layout is typically still `working` / not Ready → `clientMayEditLayout` true → **Add furniture** + editing help appeared.
- Operational Ready layout stayed unchanged in the DB, but the UI implied the couple could edit the requested (or wrong) canvas.

## Phase B — implementation (this PR)

| Change | File(s) |
|--------|---------|
| Resolve display shape from type/aspect (no giant-circle fallback) | `lib/floor-plans/resolve-display-shape.ts` + tests |
| Seating canvas styles, occupancy copy, summary line | `lib/seating/canvas-presentation.ts` + tests |
| Full furnished seating canvas + zoom/fit | `components/portal/seating-floor-canvas.tsx` |
| Desktop two-column Guest Seating workspace; exact completion copy; Your Guests / Unseated / Seated | `components/portal/seating-section.tsx` |
| Pending replacement: show operational layout; hide edit/Add furniture; Current approved vs Requested labels; exact guidance copy | `components/portal/floor-plan-section.tsx`, `lib/floor-plans/portal-guidance.ts` |

No migrations. No lifecycle RPC changes. No curated demo edits. No Production.

## Deviations / remaining

1. Venue seating assistance remains list-based (existing); couple canvas is the corrected visual SoR.
2. Ceremony rows remain `table_rect` seating destinations in Barn-master data (template typing). Renderer now draws them as rectangles with compact **Row N** labels and accurate occupancy. Changing template object types globally was out of scope.
3. Full interaction screenshot package against a running image requires Sandbox deploy of this SHA after review approval.

## Focused tests

```
npx tsx --test \
  lib/floor-plans/resolve-display-shape.test.ts \
  lib/seating/canvas-presentation.test.ts \
  lib/floor-plans/selection-lifecycle.test.ts \
  lib/floor-plans/client-layout-review.test.ts
```

**Result:** 30/30 pass.
