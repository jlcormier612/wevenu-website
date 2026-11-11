# Relative-day model (template + event)

## Root cause of prior gaps

1. **Change for this event** gated the Day control on `multiDay` (`dayOptions.length > 1` under a span-only options list). Single-day events showed a disabled Day 1 input even though event-specific `day_offset` persistence already existed.
2. Template builder offered only Day 1–7 (non-negative `day_offset`), with SQL `*_day_offset_nonneg` constraints. Before-event and after-event items could not be expressed; end-relative scheduling had no anchor field.

## Chosen model (smallest coherent)

| Concept | Storage | Meaning |
| --- | --- | --- |
| Template `day_anchor` | `event_start` \| `event_end` | Which calendar date the offset is measured from |
| Template `day_offset` | signed int | Days before/on/after that anchor |
| Entry `day_offset` | signed int | Always **start-relative** after apply (`0` = `event_date`) |

Anchors supported now: **event start** and **event end**. Explicit “pick day N of this event” is available on the **event** editor via calendar labels (Day 1 · date …). Named milestones are not added (no reliable product milestone dates yet).

## Legacy

- Existing rows default `day_anchor = event_start`.
- Prior non-negative offsets keep the same start-relative meaning.
- Migration drops nonneg checks, adds `day_anchor`, replaces clamp with ±14 pad (no invented end date).

## Immutability

Event-specific day/time edits write `timeline_entries` only. Library template items are unchanged unless edited in Timeline Templates.
