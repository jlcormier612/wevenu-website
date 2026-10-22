# Floor Plans — Working layout + operational workspace — STATUS

**Verdict: GREEN** (working-layout lifecycle on Sandbox) with noted collaboration gaps below.

Production untouched. Unrelated dirty tree preserved.

## SHAs

| Item | Value |
| --- | --- |
| Product commit | `c0266abdb6d88acfbe04b4064239bf399bdb5c2c` |
| Harness nav fix | `06108a0f` (acceptance only; serving remains product tip) |
| Deploy | [39715674640](https://github.com/jlcormier612/wevenu-website/actions/runs/39715674640) success |
| Serving `dpl=` | `c0266abdb6d88acfbe04b4064239bf399bdb5c2c` (exact match) |
| Portal select migration | `20261422000000_floor_plan_select_sets_operational.sql` applied via [39716485320](https://github.com/jlcormier612/wevenu-website/actions/runs/39716485320) |

## Root cause

Prior design treated **offers ≠ operational plans** as intentional. Event Setup created `event_floor_plan_offers` only; the Floor Plans tab showed “Offer layouts to couple” and “No floor plans for this booking yet,” forcing a redundant Apply Template step. Locked product decision: offers must initialize the working layout, and the Floor Plans tab must open that layout.

## Fix (minimal)

1. `ensureWorkingLayoutForEvent` — idempotent clone/reuse from sole or preferred offer; reconcile `operational_floor_plan_id` to `couple_selected_floor_plan_id` when set; never deletes prior plans.
2. Wired into offer upsert/ensure, inherit, prepare-release, and `ensureWorkingFloorPlanAction`.
3. Floor Plans tab — removed offer panel; opens/ensures working layout editor; truthful selection status copy.
4. Setup Change editor — removed redundant “Open Floor Plans workspace” section; offers still managed here.
5. Portal RPC — selection also sets `operational_floor_plan_id`.

## Tests

```text
npx tsx --test \
  lib/floor-plans/ensure-working-layout.test.ts \
  lib/floor-plan-offers/selection.test.ts \
  lib/event-setup/floor-plans-setup-editor.test.ts \
  lib/event-setup/readiness-detail.test.ts
→ 37/37 pass

EXPECTED_SHA=c0266abdb6d88acfbe04b4064239bf399bdb5c2c \
  npx tsx scripts/qa/booking-to-portal-simplification-acceptance.mts
→ browser-results.json: GREEN, passed=107, failed=0
```

## Demonstrated end-to-end (this fixture)

- Booking with profile floor offers → working `floor_plans` row + `operational_floor_plan_id` set.
- Change editor shows truthful “client has not selected” while naming the ready working layout.
- Offering another layout persists; working pointer remains; Library + other events unchanged.
- **Open Floor Plans** deep-links to `/events/{id}/floor-plans/{operationalId}` (editable editor).
- Offer-management chrome (“Offer layouts to couple”) absent from that workspace.
- Withdraw offer persists; reopen idempotent.
- Fixture: `eventId=2ca692f9-83de-41db-99e3-1ac5e63dc981`, operational=`3cd0befe-2d94-4672-a238-28aee4dde2f0`.

## Seating on working layout (follow-up DB + browser)

```text
docs/qa/booking-to-portal-simplification/seating-working-layout-results.json
→ 9/9 PASS
```

Created `couple_guests` + `guest_seat_assignments` on operational plan `3cd0befe…` / table C1; seating page and plan editor loaded without offer panel; seat row persisted; cleaned up; Library template object count unchanged (36).

## Remaining limitations

1. **Portal multi-offer client select UI** — migration applied (`select_portal_floor_plan_offer` sets operational); this pass used a sole active offer and did not drive the portal chooser. Venue-side reconcile path is covered by `ensureWorkingLayoutForEvent` + unit wiring.
2. Collaboration remains existing Share Floor Plan / Share for Seating / vendor share — no new features invented.

## Evidence paths

- `docs/qa/booking-to-portal-simplification/browser-results.json` (107/107)
- `docs/qa/booking-to-portal-simplification/floor-working-layout-acceptance.log`
- `docs/qa/booking-to-portal-simplification/seating-working-layout-results.json`
- `docs/qa/booking-to-portal-simplification/03h-floor-plans-setup-editor-1280.png`
- `docs/qa/booking-to-portal-simplification/04-working-layout-editor-1280.png`
- `docs/qa/booking-to-portal-simplification/05-seating-working-layout-1280.png`
