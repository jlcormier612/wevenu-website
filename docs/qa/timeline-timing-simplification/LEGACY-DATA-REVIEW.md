# Legacy data review

## No bulk rewrite

Existing `timeline_template_items` and `timeline_entries` rows are left as stored. This change is UX + apply-time null-start behavior only.

## Ambiguous / dual fields

| Pattern | Handling |
|---------|----------|
| `time_of_day` + `minutes_offset` both set | Apply still prefers `time_of_day`. Editor shows conflict banner; save clears the unused mode. |
| `minutes_offset` only, no event start at apply | **New:** `entry_time` stays empty (no noon invent). Prior applies may already have noon-baked times — those are historical snapshots, not recalculated. |
| `day_offset` beyond event span | Existing `clampDayOffset` on write. |
| Untimed starters (null/null) | Unchanged. |
| TL-03 Day Before/Wedding/After labels | Presentation only; storage offsets unchanged. |

## Starter templates

TL-01/02/03 ship with null `time_of_day` / `minutes_offset`. No mass timing rewrite required.
