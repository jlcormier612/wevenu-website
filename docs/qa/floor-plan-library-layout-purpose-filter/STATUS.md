# Floor Plan Library layout-purpose filter — STATUS

**Verdict: NOT GREEN** — fix committed; Sandbox deploy + browser verification pending.

| Field | Value |
|-------|-------|
| Fix commit | `b2377f578c48be0c226d5323c8a635cdd10c59b1` |
| Unit tests | **28/28 PASS** (layout-purpose + starters + event-type-options) |
| Production | Untouched |
| Unrelated dirty tree | Preserved |

## Root cause

Event-type filter value `reception` (“Reception Only” **booking**) does not match FP-02’s stored `event_type = wedding`. Layout purpose lived only in name/`source_master_key`.

## Fix

- Derived layout purpose from `source_master_key` (no migration).
- Library **Layout** filter + purpose badge; event-type filter unchanged in meaning.
- Empty-state hint when booking-type Reception Only yields no rows.

## Remaining for GREEN

1. Deploy `b2377f57` to Sandbox; confirm image digest.
2. `EXPECTED_SHA=b2377f57… npx tsx docs/qa/floor-plan-library-layout-purpose-filter/verify-browser.mts`
3. Confirm Layout → Reception Only shows `Standard Wedding — Reception Only`; Wedding event type still lists wedding starters; FP-01/custom unchanged.
