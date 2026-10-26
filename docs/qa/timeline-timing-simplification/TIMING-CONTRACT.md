# Timing contract

## Questions every item must answer

1. **Which day?** → `day_offset` relative to `event_date` (0 = first event day).
2. **When?** → either a **specific clock time** or **relative to Day-of schedule start**.

## Day rules

| Context | Representation | UI |
|---------|----------------|---|
| Template | Abstract day index `day_offset` | “Day 1 — event date”, “Day 2 — day after event date”, … |
| Event / apply | Same index, clamped to `[0, maxDayOffset(event_date, event_end_date)]` | Select showing weekday + calendar date from actual event range |
| TL-03 labels | Presentation aliases for offsets 0/1/2 | Day Before / Wedding Day / Day After — only when `source_master_key = TL-03`; storage unchanged |

- Do not invent rehearsal or brunch dates. Only days inside the event’s date range are selectable on events.
- If an item’s offset is outside the event span, clamp on write and show the clamped day — do not silently map to wedding day under a false label.
- Templates are not bound to calendar dates; resolution happens at apply.

## Specific clock time (default)

- Template: store `time_of_day`; clear `minutes_offset` when saving in specific mode.
- Apply: copy `time_of_day` → `entry_time`.
- Event editor: edit `entry_time` only (already concrete). No offset math.

## Relative timing (optional)

| Rule | Contract |
|------|----------|
| Named reference | **Day-of schedule start** = `events.start_time` only |
| Storage | `minutes_offset` (negative = before, positive = after, 0 = at start) |
| Apply | Bake into `entry_time` via `resolveEntryTimeFromOffset` |
| Missing start | **Do not invent noon.** Leave `entry_time` empty; UI explains that Day-of schedule start is required |
| After apply | Snapshot — changing start later does **not** recalculate |
| Precedence | If both `time_of_day` and `minutes_offset` exist on a legacy row, specific time wins at apply; editor surfaces dual-set for review |

## Not supported (no silent fake)

- Relative to ceremony / cocktail / reception / getting-ready space times.
- Circular item-to-item anchors (no schema).
- Fabricating multi-day dates beyond `event_end_date`.

## Preview language

- Relative: “30 minutes before Day-of schedule start” (+ “becomes 3:00 PM when start is 3:30 PM” when start known).
- After apply / event editor: clock time only; optional note that the value was baked from the template.

## Reapply

`replaceEventTimelineFromTemplate` replaces venue-owned rows from the template. Event-specific venue edits are discarded by that action — not silently merged. Client-owned entries remain.
