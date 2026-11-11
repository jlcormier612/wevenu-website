# Floor Plan & Seating Functionality Gap Closure

**Verdict: GREEN**

Production untouched. Unrelated dirty tree preserved.

## SHAs / runs

| Item | Value |
| --- | --- |
| Product (catalog + limits) | `23e59a03c22202a8c7c7ccc58f89f0eeed9a7281` |
| Serving `dpl=` | exact match `23e59a03…` |
| Migration | [39858761866](https://github.com/jlcormier612/wevenu-website/actions/runs/39858761866) SUCCESS — `20261422300000_floor_plan_portal_furniture_catalog_limits.sql` |
| Deploy tracked | [39858765184](https://github.com/jlcormier612/wevenu-website/actions/runs/39858765184) (cancelled mid-run; serving still reached `23e59a03…`) |

## Gap matrix (closed)

| Area | Root cause | Fix | Verified |
| --- | --- | --- | --- |
| Add table UX | Hardcoded round table | Inventory catalog + plan-type fallback | Browser catalog 12 items + 2 plan types |
| Quantity limits | None server-side | Inventory qty + safety cap; `quantity_exceeded` | API 3rd add rejected |
| Room placement | Weak bounds | `outside_room` when ft dims set | Move outside rejected |
| Capacity | Hidden on canvas | Seats labels + seating totals | Capacity source 11 tables / 82 seats |
| Assignments | — | Move preserves; remove requires confirm | DB proof |
| Template isolation | — | Event working copy only | 17=17 unchanged |

## Browser / regression

```text
EXPECTED_SHA=23e59a03… npx tsx scripts/qa/floor-plan-seating-gap-closure.mts
→ GREEN passed=20 failed=0

EXPECTED_SHA=23e59a03… npx tsx scripts/qa/floor-plan-collab-complete.mts
→ GREEN passed=18 failed=0
```

Evidence: `browser-results.json`, `browser-run.log`, `catalog-1280.png`, `seating-1280.png`; collab-complete `browser-results.json`.

## Unit tests

```text
npx tsx --test lib/floor-plans/floor-plan-portal-catalog-limits.test.ts \
  lib/floor-plans/floor-plan-collab-complete.test.ts
→ 15/15 pass
```

## Coordinate model

Canvas units = **inches**. Room bounds = `room_width_ft × 12` × `room_depth_ft × 12` when configured. Starter inventory `quantity_available = 0` means not configured (not inventable stock); catalog shows that honestly; seeded qty used only in harness.
