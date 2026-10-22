# Floor Plan & Seating Functionality Gap Closure

**Verdict: NOT GREEN (browser pending deploy)** — migration + DB RPC proof GREEN; product on `23e59a03` / QA harness `aa3b0dd8`; Sandbox deploy in progress; serving still `3dbc2a45` until deploy finishes.

Production untouched. Unrelated dirty tree preserved.

## Gap matrix (forensic)

| Area | Root cause | Fix |
| --- | --- | --- |
| Add table UX | Hardcoded `table_round` / capacity 8 / no catalog | Catalog from venue inventory + plan-type fallback |
| Quantity limits | None server-side | Inventory `quantity_available` enforced with `FOR UPDATE`; plan-type safety cap 40 |
| Dimensions | Catalog dims unused by portal | Place with inventory width/length; show on catalog + selection meta |
| Room context | Objects rendered but no room outline / scale honesty | Room boundary + ft×12 inch model label |
| Capacity | Seating `sum(capacity)` OK; canvas hid capacity | Show “N seats” on seatable tables; header seat sum |
| Chairs | Inventory chairs exist; seating is guest-to-table | No seat-level assignment invented; chairs excluded from add catalog |
| Fidelity | Working plan already copies template objects | Verified 17=17; capacity labels + locked cue |
| Remove | No safe remove | `remove_portal_floor_plan_object` + confirm when assignments exist |

## Canonical data model

- **Room:** `floor_plans.room_width_ft` / `room_depth_ft`; canvas units = inches (`ft × 12`).
- **Furniture instances:** `floor_plan_objects` (type, label, capacity, x/y/w/h/rotation, `display_shape`, `inventory_item_id`, `locked`).
- **Catalog / stock:** `inventory_items` (`quantity_available`, dims, shape, `available_for_floor_plans`). Starter qty `0` = not configured (honest UI; not addable until set).
- **Seating:** guest-to-table via `guest_seat_assignments.table_object_id` → `floor_plan_objects.id`. Capacity = `floor_plan_objects.capacity`. No per-chair seats.
- **Lifecycle:** Ready = `finalized_at`; share/seating via `shared_with_couple` + `client_access=view`; `couple_may_add_tables`.

## SHAs / runs

| Item | Value |
| --- | --- |
| Product | `23e59a03c22202a8c7c7ccc58f89f0eeed9a7281` (catalog SQL fix) |
| QA harness fix | `aa3b0dd8` |
| Migration file | `20261422300000_floor_plan_portal_furniture_catalog_limits.sql` |
| Migration | [39858761866](https://github.com/jlcormier612/wevenu-website/actions/runs/39858761866) **SUCCESS** |
| Deploy | [39858765184](https://github.com/jlcormier612/wevenu-website/actions/runs/39858765184) in progress (`23e59a03`) |
| Serving `dpl=` | still `3dbc2a45…` (pre-deploy) |

## Unit tests

```text
npx tsx --test lib/floor-plans/floor-plan-portal-catalog-limits.test.ts \
  lib/floor-plans/floor-plan-collab-complete.test.ts
→ 15/15 pass
```

## DB / persistence / auth proof (Sandbox, post-migration)

```text
DB_PROOF_GREEN passed=11 failed=0
```

Evidence: `db-proof-results.json` — fidelity 17=17, catalog qty, add×2, 3rd `quantity_exceeded`, `outside_room`, move keeps assignment, remove blocked then confirmed, template unchanged.

## Browser A–F

Pending serving SHA `23e59a03…`:

```text
EXPECTED_SHA=23e59a03c22202a8c7c7ccc58f89f0eeed9a7281 \
  npx tsx scripts/qa/floor-plan-seating-gap-closure.mts
EXPECTED_SHA=23e59a03… npx tsx scripts/qa/floor-plan-collab-complete.mts
```

## Dispositions

| Area | Status |
| --- | --- |
| Room and template fidelity | GREEN (DB 17=17); browser pending |
| Furniture catalog and quantity limits | GREEN (DB); UI pending deploy |
| Dimensions and physical placement | GREEN (DB outside_room + dims on add) |
| Fixed-element rendering and permissions | Partial — locked move already enforced; fixed fixtures render from plan |
| Chair/seat model and table capacity | GREEN — guest-to-table; capacity on objects; chairs not falsely seat-assignable |
| Guest assignment integrity | GREEN (DB move/remove) |
| Venue review and locking | Prior Ready/lock retained; DB Ready reject still in harness |
| Template/event isolation | GREEN (DB) |
| Complete client floor-plan and seating workflow | **NOT GREEN** until browser on new serving SHA |
