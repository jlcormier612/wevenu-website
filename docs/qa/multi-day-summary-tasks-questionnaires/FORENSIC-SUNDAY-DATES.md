# Forensic — Sunday component dates missing (Nicole May 8–9)

**Environment:** Sandbox  
**Event:** `e15869c8-736d-42cc-a00a-4b4bbdadc0f1` (Nicole Bethune & Colby Yagnesak, Meadowbrook)  
**Deployed tip at investigation:** `6a7a47b5` (serving); repo tip `e6028b6c`  
**Prior GREEN tip cited in failure:** `d1531f9e` — prior proof used Ellie and **seeded** rehearsal `scheduled_date`; it did not prove booking-confirmation persistence for all components.

## Persisted `event_space_assignments` (authoritative)

| Component | scheduled_date | start | end | space |
|---|---|---|---|---|
| Rehearsal Dinner | **2027-05-08** | 18:00 | 22:00 | Meadowbrook Barn |
| Getting Ready | **null** | 14:00 | 16:00 | Meadowbrook Villa |
| Ceremony | **null** | 16:00 | 17:00 | Brook Bridge |
| Cocktail Hour | **null** | 17:00 | 18:00 | Meadow Lawn |
| Reception | **null** | 18:00 | 22:00 | Meadowbrook Barn |

Event range: `2027-05-08` … `2027-05-09`. Lead prefs (`lead_event_space_preferences`) also have `scheduled_date` null for all five uses.

## Discrepancy vs UI

Summary groups by persisted `scheduled_date` only. Rehearsal → Saturday. The four null rows → **Date not set**. Read path is truthful; dates were never stored for Sunday components.

## Root cause (write boundary)

`EventSpaceAssignmentsEditor` (`withTimes`) **displays** `eventDate` in the date input when `scheduledDate` is null, but does **not** write that value into assignment state unless the user changes the date field or re-selects the space.

Effects:
1. Prefill from lead prefs (spaces only, all `scheduled_date` null) shows phantom dates.
2. Preview (`BookingSchedulePreview`) and availability (`assignmentWindows`) also fall back to `eventDate`.
3. Submit (`toConfirmedBookingOccupancy`) persists `scheduledDate: null` when state never received a date.
4. `bookingConfirmationError` does not require a component date when times are present.

So a venue can configure a multi-day range, see dates in the form/preview, and still persist null for every component whose date control never fired `onChange`. Rehearsal having May 8 matches an explicit date write (or space re-select) for that row only.

RPC `book_relationship` / `replace_event_space_assignments` correctly extract `scheduledDate` when provided. Load path maps `scheduled_date`. **No silent invent of Sunday dates on Nicole** — recovery via Edit schedule after fix.

## Connected gap

Booking summary card is display-only — no Edit schedule to correct persisted nulls after booking.
