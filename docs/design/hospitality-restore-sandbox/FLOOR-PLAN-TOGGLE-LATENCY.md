# Floor Plan Working Layout toggle latency

**Branch:** `fix/floor-plan-toggle-latency` (separate from PR #30)  
**Base:** `origin/main` @ `df1aa331`  
**Sandbox:** not deployed (no merge/deploy without approval)  
**Fixture:** Willow Grove · Morgan & Taylor Reed · C04 Demo Carriage House Reception Working Layout  

## Root cause (measured)

Visible toggle state waited on the server action **and** then `router.refresh()`:

1. Click → `startTransition(async () => { await action…; if (ok) setState; router.refresh() })`
2. Switch stayed `disabled={pending}` for the entire transition (save + RSC refresh).
3. UI flipped only after confirmation — so click→visible included network + DB + full workspace refresh.

Bottleneck ranking:

1. **Primary:** Optimistic UI absent — local state updated only after `result.ok`.
2. **Primary:** `useTransition` pending spanned `router.refresh()` (expensive RSC re-fetch).
3. **Secondary:** Control disabled for that whole window (card felt stuck).
4. Not primarily RLS/query cost alone (those still run async after the fix).

## Fix

- `useOptimisticPermissionToggle` — flip immediately; generation counter ignores stale saves; rollback + toast on failure.
- Holds optimistic value until server props match the last successful intent (prevents stale `router.refresh()` from overwriting a confirmed selection).
- Per-toggle pending (`aria-busy` / `data-pending`) without disabling the switch.
- Persistence still via existing server actions; `await router.refresh()` after success for background reconcile.

## Measured timings

Source: `recovery-evidence/floor-plan-toggle/before-sandbox-timing.json`, `after-local-timing.json`, `after-local-persist-diag.json`.

| Metric | Before (live Sandbox `df1aa331`) | After (local optimistic) |
| --- | --- | --- |
| Click → visible toggle | **avg 11.5s** (max **23.0s**; seating 2.3s) | **avg 17ms** (max 49ms); persist diag **57ms** |
| Click → save starts | Often delayed until transition runs | Immediate (~5–50ms) |
| Request → server confirm | ~0.4–12s depending on action | Unchanged order (~1–8s local) |
| Click → persisted | Same as visible (UI blocked) | Persist diag **~3.3s** with UI already correct; DB confirmed |

### Before detail (Sandbox)

| Toggle | Visible ms | Confirm ms |
| --- | ---: | ---: |
| Couple can see it | 8181 | 3137 |
| Couple can seat guests | 2336 | 2324 |
| Couple can add tables | 22972 | 8370 |
| Vendors can see it | 12458 | 12337 |

### After detail

- Visible feedback within one/few frames (5–57ms observed).
- Rapid on/off/on: last click wins (`matchesLastClick: true`).
- Independent pending per toggle (no card-wide disable).
- Refresh persistence: exercised on Sandbox before suite; local persist diag wrote `shared_with_couple` and held optimistic UI.

## Permission / race notes

- Generation counter drops stale responses (`optimistic-permission-controller.ts`).
- Failure path restores previous value + toast (no silent rollback without error).
- Delayed / out-of-order saves covered by unit simulations in `use-optimistic-permission-toggle.test.ts` (9/9 PASS) — see `recovery-evidence/floor-plan-toggle/race-acceptance.json`.
- Event/plan IDs still passed into existing actions (wrong-layout writes unchanged / prevented by existing auth).
- Downstream seating reconciliation cost remains on the async path (visible path no longer waits).

## Remaining before Sandbox deploy of this PR alone

- Browser failure injection against a live action (network abort) still recommended on the combined release candidate.
- Do not merge/deploy until the reconciled multi-PR candidate is approved.
