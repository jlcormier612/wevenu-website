# Acceptance matrix — timeline timing simplification

| # | Scenario | Expected | Unit | Browser |
|---|----------|----------|------|---------|
| A | Specific clock + Day 1 on template → apply | Persists time_of_day; event entry_time matches; day_offset 0 | PASS | pending serving |
| B | Relative −30 to Day-of schedule start @ 16:00 | Bake 15:30; UI names Day-of schedule start | PASS | pending |
| C | Relative with missing start | No invented clock; entry_time null/empty | PASS | pending |
| D | Multi-day event dates | Day selector shows real dates; day_offset 1 stays on day 2 | PASS | pending |
| E | Event edit + reapply | Event edit does not mutate template; reapply replaces venue-owned | contract | pending |
| F | Legacy dual time+offset | Surfaced for review; save keeps chosen mode | PASS | pending |
| G | Downstream timeline/schedule | Rendered time/day match persisted entry | — | pending |

Serving evidence fills the Browser column in `STATUS.md` / `browser-results.json`.
