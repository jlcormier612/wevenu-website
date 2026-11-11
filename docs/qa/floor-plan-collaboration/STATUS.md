# Floor Plan Collaboration — STATUS

**Verdict: GREEN** for the established Venue-Owned floor-plan + Client-Owned seating collaboration model on Sandbox.

Production untouched. Unrelated dirty tree preserved.

## SHAs

| Item | Value |
| --- | --- |
| Product | `5f4eb7ed81a78908ae529922298c22587498fa65` |
| Prior foundation | `ec77b705` (select → share layout view) |
| Deploy | [39849384878](https://github.com/jlcormier612/wevenu-website/actions/runs/39849384878) |
| Migration | [39846082709](https://github.com/jlcormier612/wevenu-website/actions/runs/39846082709) `20261422100000_floor_plan_select_shares_layout_view.sql` |
| Serving `dpl=` | exact match `5f4eb7ed…` |

## Product model (locked — not overturned)

Floor Plans remain **Venue-Owned**. Couple collaboration:

1. Choose offered layout → event working-copy clone + layout view shared
2. View working layout (furniture placement is venue-authored — view only)
3. Assign guests when venue **Share for Seating**
4. Venue **Mark as Ready** (checkpoint; not an immutability lock)

Couple furniture rearrange/add is **Not implemented** by architecture (`client_access='edit'` retired). See `docs/floor-plan-seating-architecture.md`.

## Gap closed

After selection, portal was a dead end (`shared_with_couple=false`). Selection now sets `shared_with_couple=true` while leaving seating (`client_access`) venue-explicit. Portal + venue next-action copy updated. Ready status surfaced to the couple.

## Browser proof

```text
EXPECTED_SHA=5f4eb7ed… npx tsx scripts/qa/floor-plan-collaboration-lifecycle.mts
→ GREEN passed=15 failed=0

EXPECTED_SHA=ec77b705… npx tsx scripts/qa/floor-plans-portal-multi-offer-selection.mts
→ GREEN passed=18 failed=0 (select shares layout; working layout after select)
```

## Evidence

- `collaboration-lifecycle-results.json` / `collaboration-lifecycle.log`
- `01-after-select-1280.png` / `02-ready-1280.png`
- Unit: `lib/floor-plans/select-shares-layout.test.ts`
