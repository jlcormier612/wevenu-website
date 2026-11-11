# Hold / booking component schedule — STATUS

**Stream:** Consistent date/space/time across holds and booking confirmation  
**Environment:** Sandbox only  
**Overall:** GREEN

## Root cause (audit)

See [AUDIT.md](./AUDIT.md). Assignment time windows were applied to every day in `event_date`–`event_end_date`, so a Friday rehearsal and Saturday reception both reserved the barn on both days.

## Fix

| Layer | Change |
|---|---|
| DB | `event_space_assignments.scheduled_date` (nullable). Null = legacy every protected day. |
| SQL | Date-aware `event_schedule_windows` (`occ_date`), `schedule_overlap_kind`, turnaround day filter; `book_relationship` / `replace_event_space_assignments` persist `scheduledDate`. |
| TS | `intervalsForScheduleWindow` + occupancy/precheck/repository windows carry `scheduledDate`. |
| UI | Component Date on confirmation rows; date-grouped “Proposed final schedule”; Current hold shows inclusive end date; lead-detail loads a fresh draft on Booked open. |
| Holds | Unchanged continuous inclusive range model (no forced daily duplicates). |

## Migration

`supabase/migrations/20261417100000_assignment_component_scheduled_dates.sql`  
Applied: [Apply Sandbox Migration #38272488694](https://github.com/jlcormier612/wevenu-website/actions/runs/38272488694)

## Commits / deploy

| Item | Value |
|---|---|
| Tip | `7ee3a7d39a28ba3575f144e86b1801d15c61e848` |
| Deploy | [Deploy Sandbox #38273772647](https://github.com/jlcormier612/wevenu-website/actions/runs/38273772647) |
| ALB `dpl=` | matches tip |

## Automated tests

`npx tsx --test lib/availability/event-occupancy.test.ts lib/booking-journey/confirmed-occupancy.test.ts` → **81 pass / 0 fail**

## Sandbox browser + persisted occupancy

Script: `scripts/qa/hold-booking-component-schedule-browser.mts`  
Evidence: `browser-results.json`, `persisted-occupancy.json`, screenshots `01-hold.png`, `02-confirmation-desktop.png`, `02-confirmation-390.png`

| Check | Result |
|---|---|
| Inclusive Fri–Sat hold | PASS |
| Current hold (range + Barn) | PASS |
| Schedule grouped by date | PASS (Fri rehearsal; Sat ceremony/cocktail/reception) |
| Persisted `scheduled_date` | PASS (rehearsal `2027-09-03`, reception `2027-09-04`) |
| Own hold converted | PASS |
| Foreign Sat barn overlap blocked | PASS |
| Primary intact after conflict | PASS |

Disposable Fancy Venue records cleaned after the run. Production untouched.
