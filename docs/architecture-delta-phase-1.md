# Architecture Delta — Program 2, Phase 1 (Lead Lifecycle + Calendar Backbone)

**Status:** Phase 1 substantially complete 2026-07-08. One item explicitly deferred (see below), not silently dropped.
**Format:** Per the venue owner's request, every completed Program 2 phase gets one of these — measuring simplification, not just delivery.

---

## What became canonical

- **`tour_appointments`** is now the single source of truth for "does this lead have a tour scheduled" — regardless of whether it was booked through the public widget (`book_tour`) or scheduled manually by a coordinator on the lead's relationship card. One fact, one place, one entry point doesn't matter which.
- **`find_lead_by_email()`** is the shared match used by both public lead-creation entry points (`create_public_lead`, `book_tour`) — the same person contacting the venue through either channel now resolves to the same Lead record.
- **`getTourCalendarEntries()`** (`lib/tours/service.ts`) is the first real instance of "the owning domain exposes its own calendar projection, Calendar composes" — the pattern the whole Calendar-backbone principle calls for, established here rather than just described.

## What legacy systems were removed

- **`leads.tour_date`, `leads.tour_time`, `leads.tour_completed`, `leads.tour_notes`** — dropped from the schema entirely (`20260718000000_program2_phase1a_canonical_tour_scheduling.sql`), not deprecated-in-place. Any pre-existing data was backfilled into `tour_appointments` first. This is a genuine "replace, don't layer" — the old columns cannot silently drift back out of sync because they no longer exist.
- The inline "tour" query inside `lib/calendar/service.ts` — replaced by a call to the tours domain's own projection function.

## What sources of truth were eliminated

Before this phase, "does this lead have a tour" had **two** independent answers (`tour_appointments` vs. `leads.tour_date`) that could and did disagree — that was TR-B4. After this phase there is **one**. The same elimination closed four *other* places that were independently reading the now-dropped fields and would each have silently kept disagreeing with reality had they not been caught in the same pass:

- `lib/leads/scores.ts` — commitment scoring under-counted tours booked publicly.
- `lib/dashboard/service.ts` — the "Upcoming Tours" widget had its own separate, duplicate lead-mapping logic reading the same stale fields.
- `lib/availability/repository.ts` — the tour-capacity conflict check undercounted real bookings.
- `lib/luv/observations.ts` — the "qualified lead, no tour scheduled" observation could fire incorrectly for a lead that had, in fact, booked one publicly.

Also eliminated: the "two disconnected Lead records for one real person" gap. `find_lead_by_email()` closes it at the two entry points where it was actually found (the public inquiry form and the public tour widget) — verified live: submitting two inquiries and a tour booking with the same email now produces exactly one Lead record with three accumulated activities, not three separate leads.

## What Trust Risks closed

- **TR-B4** — publicly-booked tours now reliably appear on the calendar. Resolved.
- **TR-B5** (new, found during the same pass) — `date_holds.expires_at` is now enforced everywhere an active hold is read (the calendar, and `checkAvailability`'s conflict check); an expired hold no longer blocks bookings indefinitely. Resolved same-day, per instruction to fold it into this work since it's the same temporal-scheduling architecture.

Both verified with rolled-back-transaction database tests against real query logic, not just code review, matching this project's standing verification bar.

## What complexity was reduced

- One canonical tour-scheduling table instead of two.
- Four previously-independent, previously-silent instances of the same stale-field bug are now impossible by construction (the fields they read don't exist anymore) rather than four separate future bugs waiting to be rediscovered one at a time.
- Calendar's own service code no longer contains tours' query logic — it asks the tours domain instead. The next new calendar source (vendor arrivals, staff schedules) has a template to follow rather than a 7th copy-pasted inline query to add.
- Lead identity moved one step closer to being a real invariant: the two highest-volume public entry points now guarantee one Lead per person.

## What's explicitly deferred, not silently dropped

**Manual-create and CSV-import lead deduplication** — the implementation plan called for wiring `findOrCreateLead` into these two entry points too, with an explicit "this looks like an existing lead — use it or create new?" UI prompt, since a human is already in the loop on these more deliberate paths. That UI prompt was not built this pass. The two entry points that were actually named in the original architecture-audit finding (the public inquiry form and the public tour widget — both automatic, both silent) are fixed. Manual-create and CSV import still create a new Lead unconditionally, same as before this phase. This is named here rather than left implicit, per the "honestly absent, not silently different from what was promised" standard the rest of this project has held to.

## Remaining Phase 1 work

- The five other Calendar sources (events, follow-ups, payments due, key dates, calendar blocks) still query their tables inline inside `lib/calendar/service.ts` rather than each being moved into its own owning-domain projection function. This was explicitly scoped as a refactor of already-correct logic — no bug to fix, lower urgency than closing TR-B4/TR-B5 — and can follow as a fast-follow within Phase 1 or fold into whichever Program 2 phase touches those domains next.
- New calendar sources named in the adopted vision (vendor arrivals, staff schedules, walkthroughs, planning milestones) are not built — they trail behind their owning domains' own Program 2 work, as originally scoped.

## Verification summary

Every change in this phase was confirmed against real query behavior in a rolled-back database transaction — not code review alone: tour visibility across both entry points, the manual-scheduling upsert's insert and update-to-completed paths, the backfill logic against synthetic legacy data, the `date_holds` expiry filter against expired/active/no-expiry holds, and lead deduplication across two consecutive inquiry-form submissions plus a tour booking, all with the same email. `tsc --noEmit` and `next build` both clean after every change, including after the legacy columns were actually dropped.
