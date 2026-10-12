# Hold / booking component schedule — STATUS

**Stream:** Consistent date/space/time across holds and booking confirmation  
**Environment:** Sandbox only  
**Overall:** IN PROGRESS (implementation + unit tests done; Sandbox migrate/deploy/browser pending)

## Root cause (audit)

See [AUDIT.md](./AUDIT.md). Assignment time windows were applied to every day in `event_date`–`event_end_date`, so a Friday rehearsal and Saturday reception both reserved the barn on both days.

## Fix

| Layer | Change |
|---|---|
| DB | `event_space_assignments.scheduled_date` (nullable). Null = legacy every protected day. |
| SQL | Date-aware `event_schedule_windows` (`occ_date`), `schedule_overlap_kind`, turnaround day filter; `book_relationship` / `replace_event_space_assignments` persist `scheduledDate`. |
| TS | `intervalsForScheduleWindow` + occupancy/precheck/repository windows carry `scheduledDate`. |
| UI | Component Date on confirmation assignment rows; date-grouped “Proposed final schedule”; Current hold shows inclusive end date. |
| Holds | Unchanged continuous inclusive range model (no forced daily duplicates). |

## Migration

`supabase/migrations/20261417100000_assignment_component_scheduled_dates.sql`

## Automated tests

- `lib/availability/event-occupancy.test.ts` — Fri rehearsal ≠ Sat reception; legacy undated still every day
- `lib/booking-journey/confirmed-occupancy.test.ts` — migration + validation + preference prefill

## Verification checklist (Sandbox)

- [ ] Migration applied
- [ ] Deploy tip matches commit
- [ ] Browser: inclusive Sep 3–4 hold
- [ ] Browser: confirmation schedule grouped by date
- [ ] Persisted assignments: distinct `scheduled_date` + times
- [ ] Calendar/availability: barn Fri evening ≠ Sat evening only
- [ ] Conflict / foreign hold intact
- [ ] Mobile width usable
