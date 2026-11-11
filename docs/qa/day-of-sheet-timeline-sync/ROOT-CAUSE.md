# Day-of Sheet ↔ Timeline sync — root cause

## Source of truth (established)

The Day-of Sheet page (`/events/[id]/day-sheet`) loads via `getEvent` → `getTimelineEntries` (RPC `get_event_timeline_merged`). That is the **current saved event-specific Timeline**, not the Library template and not a frozen run-sheet table.

## Defect A (cache) — fixed in `ea1abda3`

Timeline mutations revalidated `/events/[id]` but not `/events/[id]/day-sheet`. Deletes appeared to work after a hard refresh path; RSC could still serve a stale sheet. Untimed rows also rendered inline with blank times.

**Fix:** revalidate day-sheet + timeline-print; split timed **Schedule** vs **Unscheduled items**.

## Defect B (missing saved times) — this follow-up

**Symptom:** Editor shows typed times (e.g. 2:00 PM / 6:00 PM) after Save All, but Day-of Sheet still lists those items without times (Unscheduled / blank).

**Evidence:**

1. Persisted `timeline_entries.entry_time` and authenticated `get_event_timeline_merged` **do** return times when the write actually stored them (`"14:00:00"` etc.).
2. Deletes update parent draft state **synchronously** on Remove click → Save All persists deletes → sheet updates (with Defect A fixed).
3. `TimeAmPmInput` only called `onChange` on **blur**. Typing updated local input text; parent `entryTime` stayed `""` until blur.
4. Clicking **Save all changes** while the time field was still focused raced blur’s `setState` against Save All reading the previous `rows` snapshot → **empty `entryTime` persisted** while the input still visually showed AM/PM.

That explains “deletes sync, times don’t” without blaming cache alone.

**Fix:**

- `TimeAmPmInput` publishes parseable values during typing and uses `flushSync` on publish.
- Save All blurs the active input and reads `rowsRef.current` after the flush.
- Day-sheet schedule normalizes `"HH:MM:SS"` → `"HH:MM"` defensively.

## Untimed rule

- Timed → Schedule (chronological, AM/PM via `formatTime`).
- Untimed → Unscheduled items (no fabricated clock).
- Clear time → back to Unscheduled after save.
