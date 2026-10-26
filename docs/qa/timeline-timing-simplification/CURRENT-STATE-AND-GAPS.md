# Current state and gaps — timeline timing

## Data flow (verified in code)

```
timeline_template_items
  time_of_day | minutes_offset | day_offset
        │
        ▼  applyTimelineTemplateToEvent / replaceEventTimelineFromTemplate
timeline_entries
  entry_time (baked clock) | day_offset
        │
        ▼  venue timeline UI / portal / day-of schedule
```

There is **no live link** back to the template after apply. Offsets are not recalculated when `events.start_time` changes later (`docs/qa/timeline-relative-time/STATUS.md`).

## Schema (no new fields required for this fix)

| Layer | Timing fields | Day field |
|-------|---------------|-----------|
| Template item | `time_of_day`, `minutes_offset` | `day_offset` (≥0) |
| Event entry | `entry_time` (clock only) | `day_offset` clamped to event span |
| Event | `event_date`, `event_end_date`, `start_time` (Day-of schedule Start) | — |

## What relative minutes actually measure

**Implemented:** `resolveEntryTimeFromOffset(minutesOffset, eventStartTime)` in `lib/timeline/constants.ts`, called from `lib/timeline-templates/apply.ts`.

- Anchor = `events.start_time` (Day-of schedule Start time on the event form).
- **Not** ceremony / reception / getting-ready space assignment times.
- If `time_of_day` is set, it wins over `minutes_offset` at apply.
- If `minutes_offset` is null, `entry_time` stays empty (starters never invent clocks).
- If `start_time` is null today, code falls back to **12:00 noon** — silent invent; treat as a gap.

## What day offset means

- `day_offset` is **0-based from `event_date`**. Offset 0 = first calendar day of the event.
- Multi-day span = inclusive `event_date` … `event_end_date` (`eventDayCount` / `clampDayOffset`).
- Template UI labels are abstract “Day 1 / Day 2” (`formatTemplateDayLabel`).
- Wedding Weekend starter (TL-03) uses offsets 0/1/2 labeled Day Before / Wedding Day / Day After in **presentation only**. On apply those offsets still mean days from `event_date`, so a correct weekend requires a three-day event range (or intentional date setup). Not invented ceremony dates.

## Editors today

| Surface | Day UI | Time UI | Problem |
|---------|--------|---------|---------|
| Template item sheet | Day 1/2 select | Fixed `type=time` **and** raw “Relative Time (min)” side by side | Forces two timing systems; “−30” has no named reference in the control itself (only dense helper prose) |
| Event Timeline Setup (Overview) | Raw **Day offset** number | Clock AM/PM | No dates; owner must know 0 = event date |
| Working Timeline entry form | `timelineDayOptions` with dates when multi-day | Clock only | Already clearer; event-level relative does not exist (baked) |

## Apply / reapply / edits

- `replaceEventTimelineFromTemplate` deletes **venue-owned** entries then re-inserts from template. Client-owned preserved.
- Event-specific edits are **not** merged; reapply replaces venue rows (documented contract).
- Template unchanged by event edits.

## Gaps this task closes

1. Ambiguous relative control (no named reference in the primary UI).
2. Ambiguous Day offset in event setup customize path.
3. Inconsistent language between template and event editors.
4. Silent noon invent when schedule start is missing (relative apply).
5. Dual Time + Relative fields inviting conflict without a clear mode.

## Out of scope (documented, not invented)

Named anchors such as “Ceremony begins” / “Cocktail Hour” are **not** first-class fields. Relative timing remains to **Day-of schedule start** only unless a future schema adds item anchors. Venue owners set ceremony/reception as **specific clock times**.
