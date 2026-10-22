# Day-of Sheet ↔ Timeline sync — root cause

## Source of truth (established)

The Day-of Sheet page (`/events/[id]/day-sheet`) loads via `getEvent` → `getTimelineEntries` (RPC `get_event_timeline_merged`). That is the **current saved event-specific Timeline**, not the Library template and not a frozen run-sheet table.

Library templates may initialize an event; they must not override later event-specific edits on the sheet.

## Defect

Timeline mutations revalidated `/events/[id]` (and a mistaken `/clients/[eventId]`) but **not** `/events/[id]/day-sheet` or `/events/[id]/timeline-print`.

Next.js App Router treats those as separate cache entries. After delete/edit/add/template-replace, the Day-of Sheet RSC payload stayed stale until an unrelated full invalidation — matching the user report that Timeline edits did not appear on the sheet.

Secondary UX issue: untimed (often template-seeded) rows rendered inline in “Schedule” with a blank time column, reading as a long stale template dump.

## Fix

1. Revalidate `/events/${id}/day-sheet` and `/timeline-print` on every timeline surface revalidation; revalidate the real `/clients/${client_id}` workspace.
2. Project the sheet through `buildDaySheetSchedule`: timed → chronological Schedule (optional day labels); untimed → **Unscheduled items** (no fabricated times).

## Untimed rule

- Timed entries: Schedule, `compareTimelineEntries` order, HTC `formatTime` (AM/PM).
- Untimed entries: Unscheduled items section; never assigned a clock time on the sheet.
- Deleted entries: absent after save once cache is busted.
