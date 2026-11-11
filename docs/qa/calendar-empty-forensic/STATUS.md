# Calendar empty / filter blank — GREEN

**Status:** GREEN  
**Environment:** Sandbox only  
**Fix commit:** `727a92caf62af61fd05c7f9c8d5b3d1727a2ff1e`  
**Deploy run:** https://github.com/jlcormier612/wevenu-website/actions/runs/38337680818  
**Serving tip verified:** `727a92caf62af61fd05c7f9c8d5b3d1727a2ff1e`

## Defects fixed

1. **Space filter hid venue-wide items** — tours and `calendar_block` / tour-exception closures (no physical space) now remain visible when a named space is selected. Unassigned events/holds still do not match a named space.
2. **Taxonomy chips blanked the calendar** — deselecting the last chip is a no-op; empty `types: []` sanitizes to show-all.

## Evidence

- Automated: `lib/calendar/space-filter.test.ts`, `venue-calendar-taxonomy.test.ts`, related calendar suites (97 pass).
- Browser: `fix-browser-results.json` — VERIFY_GREEN.
- Screenshots: `fix-oct-cleared-month.png`, `fix-oct-tour-barn.png`, `fix-day-oct15-barn.png`, `fix-week-barn.png`, `fix-agenda-barn.png`, `fix-dec25-all-spaces.png`, `fix-dec25-barn.png`, `fix-dec-blocked-chip.png`.

## DB

Persisted Lucy tour `061714de-…` and Christmas exception `a32242fa-…` unchanged (read-only verification).

## Prior calendar corrections

`5fe3d13e` appointment time / view-vs-edit / public past-date behavior covered by existing suites; not altered by this filter fix.
