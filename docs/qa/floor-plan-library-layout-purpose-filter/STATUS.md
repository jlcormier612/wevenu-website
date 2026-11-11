# Floor Plan Library layout-purpose filter — STATUS

**Verdict: GREEN** on serving Sandbox image `b2377f57`.

| Field | Value |
|-------|-------|
| Serving commit | `b2377f578c48be0c226d5323c8a635cdd10c59b1` |
| Image digest | `sha256:8902cc9488ea50ca5d2c768698dffbe3cccba2c6962c9a07970d3d57a6289c0d` |
| Browser harness | **18/18 PASS** (`browser-results.json`, `browser-run.log`) |
| Unit tests (prior) | **28/28 PASS** (layout-purpose + starters + event-type-options) |
| Production | Untouched |

## Root cause

Event-type filter value `reception` (“Reception Only” **booking**) does not match FP-02’s stored `event_type = wedding`. Layout purpose lived only in name/`source_master_key`.

## Fix (on serving image)

- Derived layout purpose from `source_master_key` (no migration).
- Library **Layout** filter + purpose badge; event-type filter unchanged in meaning.
- Empty-state hint when booking-type Reception Only yields no rows.

## Browser proof (this run)

| Check | Result |
|-------|--------|
| serving-sha / serving-digest | PASS |
| persisted FP-02 (`event_type=wedding`, layout Reception Only) | PASS |
| persisted legacy FP-01 intact | PASS |
| Layout → Reception Only shows FP-02 | PASS |
| Event type Wedding shows starters | PASS |
| Event type Reception Only explains/empty (distinct from layout) | PASS |
| Search + layout Reception | PASS |
| Layout purpose badge “Reception Only” | PASS |
| Event floor-plan loads; plan count unchanged (1→1) | PASS |
| Client submit confirm source intact | PASS |

Shots under `shots/`. Harness path fix for renamed portal file (`floor-plan-section.tsx` + submit-confirm dialog) recorded in `verify-browser.mts` so the smoke check no longer crashes.
