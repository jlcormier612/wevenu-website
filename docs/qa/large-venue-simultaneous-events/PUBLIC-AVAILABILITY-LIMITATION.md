# Public availability — verified behavior and deferred decisions

**Status:** Documented only — **no implementation change** in the permitted-use follow-up.  
**Proven on tip:** `38f709412ba3a033074e708d3546f72ba3b36c93` (large-venue acceptance) and unchanged by later UX/permitted-use commits unless noted.

## Verified current behavior

Source of truth: `venues.allow_simultaneous_public_availability` (default **false**), `lib/availability/event-occupancy.ts` → `isInquiryEventDateAvailable`, Postgres `_is_event_date_available`.

| Condition | Public inquiry date result |
|---|---|
| Default flag `false`, any occupying non-cancelled Event on the date | **Unavailable** (venue-wide for inquiry, even if other spaces are free and `max_simultaneous_events` ≥ 2) |
| Flag `true` and `max_simultaneous_events` ≥ 2 | **Available** if **any** active Event Space would accept a full-day Event under staff occupancy rules |
| Venue at overlapping capacity (`venue_at_capacity`) | **Unavailable** even with the flag on |
| Staff Event write / same-space conflict | **Unaffected** by the public flag |

## Limitation (not a defect claim for this follow-up)

Public inquiry answers a **date-level** question (“is this calendar day open for inquiry?”), not “is Barn free?” or “is Ballroom free?”. Space filters on the staff calendar and space-specific booking rules do **not** automatically produce per-space public availability.

## Deferred product decision

Whether Hello to Cheers should expose **per-space** (or use-aware) public availability is a separate product decision. Do **not** change defaults, the setting, inquiry UI, booking rules, or the availability model until that decision is made.

## Related evidence

- Large-venue acceptance: `FINAL-ACCEPTANCE.md`, `BEHAVIOR-MATRIX.md`, `browser-results.json` (Phase 5 rows)
- Gate A / confirmed-event policy: `docs/qa/confirmed-event-availability-default/`, `docs/qa/booked-event-date-blocking/GATE-A-STATUS.md`
