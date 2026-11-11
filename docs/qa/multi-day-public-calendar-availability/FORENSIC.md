# Multi-day booked event vs public calendar — forensic baseline

**Environment:** Sandbox  
**Date:** 2026-10-12  
**Event:** Ellie Yagnesak & Hunter Lomberto (`ef980240-359a-439b-a731-5ef80d1f1471`)  
**Venue:** Meadowbrook Valley Venue (`05f16a15-1752-4855-8a3b-aad5c593d8d9`)

## Persisted booking (authoritative)

| Field | Value |
|---|---|
| status | `confirmed` |
| booked_at | `2026-10-12` |
| event_date / event_end_date | `2027-09-03` … `2027-09-04` |
| guest_count | 175 |
| primary space_id | Meadowbrook Barn |

| Component | scheduled_date | time | space |
|---|---|---|---|
| Rehearsal Dinner | 2027-09-03 | 17:00–22:00 | Meadowbrook Barn |
| Getting Ready | 2027-09-04 | 14:00–16:00 | Meadowbrook Villa |
| Cocktail Hour | 2027-09-04 | 16:00–17:00 | Meadowbrook Barn |
| Ceremony | 2027-09-04 | 17:00–18:00 | Brook Bridge |
| Reception | 2027-09-04 | 18:00–23:00 | Meadowbrook Barn |

## Venue availability settings

| Setting | Value |
|---|---|
| inquiry_event_date_mode | `choose_available` |
| space_operating_mode | `multi` |
| max_simultaneous_events | **4** |
| min_turnaround_hours | 2 |
| hold_blocks_availability | true |
| Active spaces | Barn, Villa, Brook Bridge, **Meadow Lawn** |

## Public calendar result (pre-fix)

`_is_event_date_available` / `get_public_availability_calendar` for 2027-09-03 and 2027-09-04 → **Available** (both in `dates[]`).

Per-space `evaluate_event_availability` (full-day, null times) before day-scope fix:

| Space | 2027-09-03 | Notes |
|---|---|---|
| Barn | blocked | Correct — rehearsal |
| Villa | blocked | **False positive** — Villa only used Sat |
| Bridge | blocked | **False positive** — Bridge only used Sat |
| Lawn | ok | Never assigned → keeps date Available |

## Established calendar semantics (unchanged)

Public copy: *“Available dates can still be requested. Not available means this venue cannot take an event that day.”*

For simultaneous venues, `_is_event_date_available` returns true when **at least one** active space would accept a full-day Event. That matches TS `isInquiryEventDateAvailable`.

Therefore Sept 3–4 correctly remain **Available** because Meadow Lawn can still accept a full-day inquiry Event. The booking is present in occupancy; it does not blank the whole venue.

## Secondary defect (fixed)

`schedule_overlap_kind` / undated candidate windows treated `occ_date IS NULL` as matching every day, so clock-overlapping components on other days of a multi-day event falsely refused same-space bookings (e.g. Bridge Friday evening vs Saturday ceremony).

Migration `20261418300000_schedule_overlap_same_calendar_day.sql` makes `evaluate_event_availability` require the same calendar day, matching TS `datedIntervalsOverlap`.
