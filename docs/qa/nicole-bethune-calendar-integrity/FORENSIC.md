# Nicole Bethune — internal calendar vs booking schedule (forensic)

**Captured:** 2026-10-13 (pre-fix; do not mutate rows for diagnosis)  
**Event:** `e15869c8-736d-42cc-a00a-4b4bbdadc0f1` — Nicole Bethune & Colby Yagnesak  
**Venue:** Meadowbrook (`05f16a15-…`)  
**Baseline JSON:** `db-baseline.json`

## Persisted component schedule (authoritative)

| Date | Component | Space | Start | End |
|---|---|---|---|---|
| 2027-05-08 | Rehearsal Dinner | Meadowbrook Barn | 18:00 | **21:00** |
| 2027-05-09 | Getting Ready | Meadowbrook Villa | 14:00 | 16:00 |
| 2027-05-09 | Ceremony | Brook Bridge | 16:00 | 17:00 |
| 2027-05-09 | Cocktail Hour | Meadow Lawn | 17:00 | 18:00 |
| 2027-05-09 | Reception | Meadowbrook Barn | 18:00 | 22:00 |

Event shell: `event_date=2027-05-08`, `event_end_date=2027-05-09`, `start_time=14:00`, `end_time=22:00`, primary `space_id`=Barn.

**Note on 6–10 vs 6–9 PM:** The expected fixture listed Rehearsal Dinner ending 10:00 PM, but the database already stores `end_time=21:00:00`. Calendar showing 6:00–9:00 PM matches persisted truth — not a display truncation of 10:00 PM.

## Timeline

- 38 `timeline_entries`, all `day_offset=0`, **no** `entry_time` / `end_time`, **no** `source_space_use_key`.
- Schedule→timeline sync did not generate timed component entries for this event. Calendar must not depend on those rows for component placement.

## Calendar mapping defect (code)

`lib/calendar/service.ts` `getCalendarData`:

1. Loads assignments **without** `scheduled_date`.
2. Expands `calendarDatesForProtectedEvent(event_date, event_end_date)` → May 8 and May 9.
3. For **each** protected day, emits **every** timed assignment window.

That produces Rehearsal Dinner (and every other component) on both days. Filtering to Meadowbrook Barn then shows Barn components (Rehearsal + Reception) on both days and hides Villa/Bridge/Lawn components — matching the screenshots.

Existing test `venue-calendar-slice1.test.ts` incorrectly asserts aggregation must not mention `scheduled_date`.

## Intended fix (not yet implemented — waiting on vendor deploy lock)

Place each assignment on its `scheduled_date` when present; only fall back to protected-day expansion for legacy rows missing `scheduled_date`. Preserve space filter, tours, holds, blocks.

## Status

Forensic only. Implementation deferred until vendor-approval Sandbox deploy (`97efb665` / run `38328933679`) completes with no overlap.
