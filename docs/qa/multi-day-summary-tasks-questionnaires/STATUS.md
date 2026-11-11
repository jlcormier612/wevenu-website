# Multi-day booking summary + Edit schedule — STATUS

**Status:** GREEN (reopened after Sunday-date acceptance failure; re-verified)  
**Environment:** Sandbox only · Production untouched

| Field | Value |
|---|---|
| Feature commits | `14a4a424` (persist + Edit schedule), `c76096fa` (intra-event overlap guard) |
| Serving tip verified | `c76096fa6e556faed945b1ea4817330e4f8c2dd1` |
| Deploy | [38311066890](https://github.com/jlcormier612/wevenu-website/actions/runs/38311066890) success |
| Browser script | `scripts/qa/multi-day-booking-schedule-persist-browser.mts` |
| Evidence | `schedule-persist-browser-results.json`, `schedule-persist-browser-run.log`, confirm/summary screenshots |
| Disposable event | `d6d060ce-95d0-47ab-93ec-a82ffd071e9a` (Sat/Sun 2031-05-24/25) |

## Prior GREEN invalidated

Prior tip `d1531f9e` / Ellie proof seeded rehearsal `scheduled_date` and did **not** exercise booking confirmation for all components. Nicole May 8–9 (`e15869c8-…`) still has Sunday components with `scheduled_date` null — summary correctly shows Date not set. Recover via **Edit schedule** (do not silently invent Sundays). See `FORENSIC-SUNDAY-DATES.md`.

## Root cause

`EventSpaceAssignmentsEditor` (`withTimes`) displayed `eventDate` in date inputs when `scheduledDate` was null without writing it into assignment state. Preview/availability also fell back to `eventDate`. Submit persisted null. Validation did not require component dates.

## Fix (minimal)

1. `materializeMissingScheduledDates` — persist the displayed default into state.
2. `bookingConfirmationError` — require a date for every timed component.
3. Honest preview (no phantom `eventDate` fallback).
4. **Edit schedule** on booking summary → `replace_event_space_assignments`.
5. `intraEventSpaceOverlapError` — reject same-space same-day overlaps inside one event.

## Runtime proof (serving `c76096fa`)

- Booking confirmation with explicit Sat/Sun component dates → all five `scheduled_date` persisted.
- Summary: Saturday Rehearsal Dinner; Sunday Getting Ready / Ceremony / Cocktail / Reception — no Date not set. 1280 + 390.
- Edit schedule: prefill, cancel (no persist), save time change (others preserved), same-space Sat overlap rejected.
- Booking status remains confirmed.

## Automated

`npx tsx --test lib/venue-spaces/assignments.test.ts lib/booking-journey/confirmed-occupancy.test.ts lib/events/space-assignments-scheduled-date.test.ts lib/events/booking-summary.test.ts` — **25 pass / 0 fail**
