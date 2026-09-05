# Phase 2D — Deeper attribution

Builds on Phase 2A frozen `acquisition_source` and Phase 2B Business Funnel cohorts.

## Implemented (this phase)

On **Sales** Reporting (existing IA — no new tabs):

1. **Acquisition-source cohort rates** — Lead→Tour, Lead→Booking, Tour→Booking by frozen `acquisition_source` (same cohort population as Business Funnel).
2. **Time-to-book by acquisition source** — median days for period lifecycle bookings (lead-linked only).
3. **Event-type cohort** — Lead→Booking by `leads.event_type`.
4. **Top-of-funnel clues inventory** — UTM source/medium/campaign/content/term, landing page, referrer host, QR campaign, Meta campaign / lead fill — from `leads.source_data` in the lead-created window (includes cancelled/lost; distinct from cohort population).

Evidence/clue dimensions are explicitly **not** HTC acquisition truth and never mutate frozen sources.

## Explicitly blocked / deferred

| Item | Why |
|------|-----|
| Outstanding by source | Mixed clocks (same 2B limitation) |
| Package dimension | No deterministic lead→package join at entry |
| GA4 website visitors / sessions | Phase 2C instrumentation only; no visitor DB |
| Visitor stitching / multi-touch | Out of scope |
| UTM/campaign “caused booking” claims | Evidence join ≠ authoritative acquisition |
| Reporting IA redesign / Phase 3 insights | Out of scope |

## Authoritative fields unchanged

- `leads.acquisition_source`
- `lifecycle_booking_events.acquisition_source`
