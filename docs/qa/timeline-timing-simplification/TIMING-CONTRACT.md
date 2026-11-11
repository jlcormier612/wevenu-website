# Timeline timing contract

## Two axes (always separate)

1. **Which day?** → `day_offset` relative to `event_date` after resolve (0 = first event day). Negative = before the event starts; values past the last event day = after the event ends.
2. **What time that day?** → Specific clock (`time_of_day` / `entry_time`) **or** relative minutes from **Day-of schedule start** (`events.start_time`). Never invent noon or another fake clock when the anchor is missing.

## Template vs event

| Layer | Day model | Time model |
| --- | --- | --- |
| Template item | Signed `day_offset` + `day_anchor` (`event_start` \| `event_end`) | `time_of_day` **or** `minutes_offset` (mutually exclusive in the editor) |
| Event entry | Start-relative signed `day_offset` (anchor already resolved on apply) | Baked `entry_time` clock only |

### Day anchors

- **event_start** — offset from the first calendar day (`event_date`).
- **event_end** — offset from the final calendar day (`event_end_date`). On apply, converted to start-relative `day_offset`. If end date is missing/invalid, **do not invent an end** — fall back to treating the offset as start-relative.

### Labels

- Template: “2 days before event start”, “On the event’s last day”, “1 day after event end”, …
- Event planning: “Day 1 · Thu, Oct 5”, “1 day before · Wed, Oct 4”, “1 day after · Sat, Oct 7”, … using the event’s real dates plus a ±14 planning pad.

### Soft clamp

Entries clamp to `[-14, spanMax + 14]` (`TIMELINE_DAY_PAD`). Templates accept ±30 in the UI; apply still clamps onto the event.

## Relative minutes

- Anchor name in UI: **Day-of schedule start**.
- Apply prefers `time_of_day` when both legacy fields exist; UI surfaces the conflict.
- `resolveEntryTimeFromOffset(minutes, null)` → `null` (no invent).

## Event-specific overrides

- **Change for this event** may edit day and clock for venue-owned items **without** mutating the Library template.
- Changing day must not silently reset clock time.
- Released / published client schedules follow the existing publish/republish workflow; this contract does not invent a parallel publish path.
