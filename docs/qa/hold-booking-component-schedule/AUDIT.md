# Forensic audit — holds vs booking component schedule

**Date:** 2026-10-12  
**Branch tip at audit:** `d45325c4`  
**Production:** untouched

## Locked semantics (confirmed in code)

1. Inquiry/preferred date does not reserve availability.
2. Active `date_holds` temporarily protect availability (inclusive `hold_date`–`end_date`, optional times, space set or whole venue).
3. Manual Booked confirmation → `book_relationship` with `p_confirmed_occupancy` is the authoritative final occupancy.
4. Proposals/contracts/payments do not call `book_relationship`.

## A. Initial hold model

| Capability | Supported? | Evidence |
|---|---|---|
| Inclusive multi-day hold | Yes | `date_holds.end_date`; hold form Start/End date |
| Space-specific / whole-venue | Yes | `space_ids` empty = whole venue |
| Optional start/end time | Yes | Null pair = all-day for each day in range |
| Link to rehearsal preference | Yes | `preference_id` → syncs `scheduled_date` on preference |
| Different spaces/times on different days inside **one** hold | **No** | One time window applies to every day in `[hold_date, end_date]` |

**Conclusion:** Continuous Friday–Saturday holds remain correct for temporary protection. Per-day component schedules belong on booking confirmation, not as forced daily hold duplicates.

## B. Booking confirmation gap (root cause)

1. `EventSpaceAssignmentInput` has `spaceId` + `startTime`/`endTime` but **no component date**.
2. `lead_event_space_preferences.scheduled_date` exists (rehearsal) but is **not** copied onto confirmation assignments or occupancy.
3. TypeScript `evaluateEventOccupancy` / `intervalsForWindow` applies each assignment window to **every** day in `event_date`–`event_end_date`.
4. SQL `event_schedule_windows` similarly returns undated windows; date-range overlap + time overlap then treats Sep 3 rehearsal hours as occupying Sep 4 (and vice versa).

**Customer-visible defect:** A Fri–Sat event with Rehearsal Dinner Fri 6–9pm Barn and Reception Sat evening Barn incorrectly reserves the Barn at those windows on **both** days.

## C. Shared availability

- Precheck / ConflictWarning already accept per-space `windows` but without `scheduledDate`.
- Hold-vs-hold and hold-vs-event paths remain date-range aware; they do not need per-component dates on holds.
- Fix must update TS occupancy + SQL `event_schedule_windows` / overlap paths + persist `scheduled_date` on `event_space_assignments`.

## D. Hold reconciliation

- `book_relationship` converts this lead’s overlapping holds inside the same transaction before/with occupancy stamp; failure rolls back.
- No change to foreign-hold protection required for this fix.

## Implementation direction (smallest coherent)

1. Add `event_space_assignments.scheduled_date` (nullable).
2. Treat null as “every protected day” (legacy); set date = occupy that day only.
3. Surface date on confirmation component rows; prefill from preference `scheduled_date` / event date defaults without inventing rehearsal = day-before.
4. Date-grouped schedule review before confirm.
5. Show hold `end_date` in Current hold summary.
