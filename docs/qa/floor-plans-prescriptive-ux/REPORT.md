# Floor Plans — Prescriptive Final UX Implementation

**Branch:** `feat/floor-plans-prescriptive-ux`  
**Base:** `main` @ `35aa20db` (approved functional workflow)  
**Status:** STOP — PR open for review. **Not merged. Not deployed. Not CLOSED.**

## Scope delivered

Client portal (A1–A8, C1–C3) and venue workspace (B1–B5) presentation-only refinements. No RPC, migration, approval-snapshot, seating-assignment, or lifecycle rule changes.

## Implementation map

| Spec | Change |
|------|--------|
| A1–A8 | `components/portal/floor-plan-section.tsx` — mobile-first order; removed “Make it yours” card; canvas ≥340px target; **Send layout for review**; compact capacity; collapsed help |
| A3 / C | `lib/floor-plans/portal-guidance.ts` — exact state instructions |
| A7 | `lib/floor-plans/capacity.ts` — `formatFloorPlanCapacityCompact` |
| A4 | Pre-submit horizontal offer selector; post-submit static summary + **Request a different layout** dialog (uses existing select API → `proposed_replacement` when approved) |
| B1 | `components/events/event-detail.tsx` — scroll Floor Plans workspace into view on tab select |
| B2–B5 | `components/events/floor-plan-workspace.tsx` + `venueFloorPlanNextStep` — status badge + next-step; **Approve layout**; replacement decision copy; Selected / Offered / Working vocabulary |
| C3 | Zero-offer empty copy on portal section + `floor-plan-view.tsx` |

## Focused tests

```
npx tsx --test \
  lib/floor-plans/selection-lifecycle.test.ts \
  lib/floor-plans/capacity.test.ts \
  lib/floor-plans/client-layout-review.test.ts \
  lib/floor-plans/floor-plan-collab-complete.test.ts \
  lib/floor-plans/phase2-preference-decouple.test.ts \
  lib/floor-plans/floor-plan-workspace-nav.test.ts \
  lib/floor-plans/select-shares-layout.test.ts \
  lib/floor-plans/workspace-status.test.ts \
  lib/client-portal-preview/portal-preview-fidelity.test.ts
```

**Result:** 76/76 pass. `tsc --noEmit` clean for changed surfaces.

## Visual evidence

### Before (approved package at `35aa20db`)

Customer-experience review used the 26-screen Sandbox package referenced in the brief (C01, C03, C04, V01, V07, V08, V11, V13). Those captures showed:

- Large “Make it yours” guidance card above the canvas
- Capacity warning dominating the initial view
- Instant multi-layout switchers after submission
- Venue “Couple preference” vocabulary / status stacking
- Workspace heading below unrelated event summary content

### After

Local fixture screenshots for every lifecycle state require Sandbox portal/venue sessions (disposable fixtures + live plans). **After screens are deferred to the authorized Sandbox deploy of this PR’s merge commit on `main`**, per sandbox-from-main policy.

States that need Sandbox capture after deploy approval:

- Client working desktop/mobile (canvas + Send layout for review + compact capacity)
- Client submitted / changes requested (with and without notes)
- Client approved / Ready / seating-only
- Replacement request + venue Accept/Keep
- Venue submitted-review Approve layout / Request changes
- Zero / one / multiple offers + Additional shared layout
- Mobile 390px: no horizontal overflow; canvas + primary action placement

## Deviations

None intentional. Notes:

1. **Initial multi-offer with no shared plan yet** still uses the existing `ChooseLayoutSection` preview chooser (permitted initial-selection behavior). Once a working shared plan exists, the compact horizontal selector is used.
2. **Venue next-step sentences** live in `venueFloorPlanNextStep` (presentation helper) rather than duplicating long copy in JSX.
3. **Sandbox after-screens** not produced in this pass — deploy not authorized.

## Boundaries preserved

- No Production changes
- No migrations
- No EO / onboarding / Luv / marketing / curated demo edits
- Dirty trees outside this worktree untouched
