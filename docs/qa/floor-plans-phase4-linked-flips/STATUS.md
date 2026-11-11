# Floor Plans v1.5 Phase 4 — Linked before/after room flips

## Verdict: **GREEN**

## Authorization

PO authorized Phase 4: real persisted before/after layout link, venue-only notes, safe unlink, progressive disclosure, couple privacy. Phase 5 out of scope.

## Commits / deploy

| Item | Value |
|---|---|
| Feature commit | `be71bf3baf0416c0be060bc81d5fdd58b1737d4a` |
| **Serving / acceptance SHA** | `be71bf3baf0416c0be060bc81d5fdd58b1737d4a` |
| Deploy ref | `sandbox-deploy/fp-phase4-be71bf3b` |
| Migration | `20261425100000_floor_plans_phase4_linked_flips.sql` |
| Migration run | https://github.com/jlcormier612/wevenu-website/actions/runs/40591509675 — **success** |
| Deploy run | https://github.com/jlcormier612/wevenu-website/actions/runs/40591513535 — **success** |
| ECS image | `htc-sandbox-venue-app:be71bf3baf0416c0be060bc81d5fdd58b1737d4a` |
| `data-dpl-id` | `be71bf3baf0416c0be060bc81d5fdd58b1737d4a` |
| Health | ok · env+supabase ok |
| Production | Untouched |

## Preflight baseline

| Item | Value |
|---|---|
| Branch | `feat/spaces-booking-e1-smart-fields` |
| Phase 3 serving | `3979637b…` (ancestor) |
| Dirty/untracked | Preserved; Phase 4 scoped |

## Automated tests

```bash
npx tsx --test \
  lib/floor-plans/phase4-linked-flips.test.ts \
  lib/floor-plans/phase1-contract-invariants.test.ts \
  lib/floor-plans/phase3-required-setups.test.ts
→ all pass
```

## Browser harness

```bash
EXPECTED_SHA=be71bf3baf0416c0be060bc81d5fdd58b1737d4a \
  npx tsx docs/qa/floor-plans-phase4-linked-flips/verify-browser.mts
→ GREEN — 28 pass / 0 fail
```

Evidence: `browser-results.json`, `browser-run.log`, `persisted-state.json`, `shots/`

### Acceptance gates P4-1 … P4-9

| Gate | Result |
|---|---|
| P4-1 Real link + reload | **PASS** — before/after IDs persisted; venue UI shows correct pair after reload |
| P4-2 Notes + couple privacy | **PASS** — notes persist/reload; absent from portal floor-plans + setups APIs and portal UI |
| P4-3 Safe unlink | **PASS** — flip row gone; layouts, objects, seats, setup membership, sharing equal |
| P4-4 No side effects | **PASS** — preference/approval/ops/seating-in-use/share/seats unchanged across link and unlink |
| P4-5 Cancel / no partial | **PASS** — cancel leaves no row; after unlink form ready with no partial link |
| P4-6 Simple path | **PASS** — collapsed by default; one-layout event shows need-two copy, no forced editor |
| P4-7 FP-SR honesty | **PASS** — no auto-transition claims on workspace; starter static copy unit-covered |
| P4-8 Phase 3 coexistence | **PASS** — setups package present; 3 memberships intact; portal hasSetups |
| P4-9 Couple sharing | **PASS** — shared before/after visible; unshared alt hidden; notes private |

### Cleanup

| Check | Result |
|---|---|
| leftover flips/plans | 0 / 0 |
| Fancy event count | 83 → 83 |

## Domain model

`event_floor_plan_flips` — one pair per event; distinct before/after floor_plan IDs; venue-only `transition_notes`; unlink deletes only this row. Room `space_id` mismatch is advisory only.

## Out of scope (preserved)

Phase 5 booking flags, Timeline, EO/catering, Production.
