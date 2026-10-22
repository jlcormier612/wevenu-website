# Floor Plan & Seating Functionality Gap Closure

**Verdict: IN PROGRESS** — product committed; Sandbox migrate/deploy dispatched; browser A–F pending serving SHA.

Production untouched. Unrelated dirty tree preserved.

## Gap matrix (forensic)

| Area | Root cause | Fix |
| --- | --- | --- |
| Add table UX | Hardcoded `table_round` / capacity 8 / no catalog | Catalog from venue inventory + plan-type fallback |
| Quantity limits | None server-side | Inventory `quantity_available` enforced with row lock; plan-type safety cap 40 |
| Dimensions | Catalog dims unused by portal | Place with inventory width/length; show on catalog + selection meta |
| Room context | Objects rendered but no room outline / scale honesty | Room boundary + ft×12 inch model label |
| Capacity | Seating sum(capacity) OK; canvas hid capacity | Show “N seats” on seatable tables |
| Chairs | Inventory chairs exist; seating is guest-to-table | Do not invent seat-level assignment; chairs excluded from add catalog |
| Fidelity | Working plan copies template objects (already) | Verified + capacity labels; locked cue preserved |
| Remove | No safe remove | `remove_portal_floor_plan_object` + confirm when assignments exist |

## Coordinate model

Canvas units = **inches**. When `room_width_ft` / `room_depth_ft` are set, room bounds = feet × 12. Missing room dims are labeled honestly (not claimed as feet).

## Commits / runs

| Item | Value |
| --- | --- |
| Migration | `20261422300000_floor_plan_portal_furniture_catalog_limits.sql` |
| Product commit | `7904ae019370c207ace8bf6706501ab273b6a7a1` |
| Migration run | [39858646496](https://github.com/jlcormier612/wevenu-website/actions/runs/39858646496) |
| Deploy run | [39858649627](https://github.com/jlcormier612/wevenu-website/actions/runs/39858649627) |
| Serving `dpl=` | pending (baseline was `3dbc2a45…`) |

## Verification

```text
npx tsx --test lib/floor-plans/floor-plan-portal-catalog-limits.test.ts \
  lib/floor-plans/floor-plan-collab-complete.test.ts
→ 15/15 pass (local)

EXPECTED_SHA=<sha> npx tsx scripts/qa/floor-plan-seating-gap-closure.mts
EXPECTED_SHA=<sha> npx tsx scripts/qa/floor-plan-collab-complete.mts
```
