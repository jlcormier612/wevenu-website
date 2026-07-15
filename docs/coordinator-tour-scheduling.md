# Coordinator Tour Scheduling — Completion Pass

The last missing piece of the Sales Operating System, per the Sales → Booking Journey walkthrough's one named Release Blocker: a coordinator had no way to schedule a tour for an existing Lead. `tour_appointments` (the canonical tour-tracking table) had exactly one write path — `book_tour()`, built entirely for the public self-service widget, which always creates a brand-new Lead and has no authenticated equivalent.

## Guiding principle, held throughout

The Lead owns the scheduling workflow. Calendar remains a read-only consumer. The scheduling engine — business hours, conflict detection, `tour_appointments` — stays the single source of truth. Every coordinator-facing RPC added in this pass reuses the exact same conflict-checking logic the public widget already used, refactored into one shared internal SQL function (`_generate_tour_slots`) rather than a second implementation that could drift from the first.

## Built

- **Schedule** — `book_tour_for_lead(lead_id, slot_start, notes?)`. Same validation as `book_tour()` (min notice, max advance, slot conflict), but resolves an existing Lead instead of creating one, populating contact fields from that Lead.
- **Reschedule** — `reschedule_tour(appointment_id, new_slot_start)`. Same row, same id, no delete/recreate — `scheduled_at` updates in place, `status` resets to `scheduled` pending re-confirmation, re-validated against the same conflict engine.
- **Cancel** — reused, not rebuilt. `PATCH /api/tours/status` already handled every status transition including cancellation, with real side effects (`runPostTourAutomation`, `lead_signal_events`, clearing pending `task_reminders`) that a naive new RPC would have either duplicated or silently dropped. Extended it to accept an optional `reason`, stored in a new `cancellation_reason` column — the only new schema this pass needed for cancellation.
- **Confirm / Complete / No-show** — already fully built (`PATCH /api/tours/status`, already wired to the Tours page's own status dropdown) — confirmed working, not reimplemented.
- **UI** — a "Schedule Tour" button on the Lead's Tours card, always visible (not just once a tour exists), opening a slot picker (month calendar → time grid) that only ever shows availability from the shared engine. Each existing appointment gets contextual actions: Reschedule, Confirm, Complete/No-show (once past), Cancel (with an optional reason prompt).
- **One Communication pipeline, not two** — per explicit instruction mid-pass, the public widget's confirmation email (`app/api/tours/book/route.ts`) was rewired off its own raw-fetch-to-Resend implementation and onto the same `sendEmail()` + `conversation_messages` + legacy-mirror pipeline every other message in this platform uses (`lib/tours/communication.ts`). A coordinator-scheduled tour and a website-booked tour now send the literal same confirmation through the literal same code path — verified live, not assumed.
- **Pipeline advance** — scheduling a tour for a lead still sitting at "new" moves it to "contacted" (the canonical "tour" stage), reusing the existing `updateLeadStatus` path so Automation, Activity logging, and score refresh all fire exactly as they already do for any other status change. Never regresses a lead already further along.
- **Notification** — a lightweight `tour_scheduled` venue notification, deep-linked to the Lead, so a tour scheduled by one coordinator is visible to the rest of the team.

## Real defects found and fixed while building this

Every one of these was found by testing against the real database, not by reading code:

1. **`tour_appointments`' RLS policy predated the multi-staff model.** Written in Sprint 45 as `owner_user_id = auth.uid()`, before `current_user_venue_id()` (Sprint 107) existed — any coordinator who isn't literally the venue's account owner was silently blocked from tour_appointments entirely. Fixed to match every other table's modern policy.
2. **`anon` had zero grants on `tour_appointments` at all** — not a missing RLS match, a missing table-level GRANT. Confirmed directly against PostgREST (`permission denied for table tour_appointments`). This meant `book_tour()`'s own post-booking read-back — the one that resolves `venueEmail` for the coordinator notification — has been silently returning nothing since this feature shipped; the coordinator notification has never actually used the venue's real registered email, only ever falling back to `COORDINATOR_NOTIFY_EMAIL` when set. Fixed by using the admin client for this specific session-less read, the same TR-M7 pattern used everywhere else in this codebase for public routes.
3. **A "mailto" fallback was being recorded as `accepted`.** When `sendEmail()` has no real provider configured, it returns a `mailto:` link meant for a human to click — meaningless in a fully automated, backend-only send with nobody there to click it. The first version of `sendTourConfirmation` treated `ok: true` alone as success; fixed to require `method === "resend" || "disabled"` specifically, the exact same distinction already established in Phase 3 of the Communication Trust Experience for legacy compose.
4. **`get_tour_slots` never checked venue closures at all** — only `tour_appointments` and `events`, never `calendar_blocks`. A venue that manually blocked a date (maintenance, holiday, a private event) would still show that date as bookable through the public widget. Folded into the shared slot-generation function, so both paths are closure-aware now, not just the new one.

## Deliberately not duplicated

- Confirm/Complete/No-show/Cancel status transitions — reused `/api/tours/status` entirely rather than building parallel RPCs. An earlier draft of this pass did build `cancel_tour`/`set_tour_status` RPCs before this reuse opportunity was found; both were discarded once found, in favor of extracting the existing route's logic into one shared `lib/tours/service.ts` function (`updateTourStatus`) that both the route and the new Lead-page actions call.
- Slot availability logic — one shared SQL function, two callers (`get_tour_slots` for the public widget, `get_coordinator_tour_slots` for the coordinator), not two implementations of "is this slot free."

## Verified

- Public widget: full live booking via a real HTTP request against a real venue's real `tour_embed_key` — Lead created, Relationship resolved, tour_appointment created, confirmation email sent through the real pipeline, correctly mirrored to legacy Messages for this venue's `conversation_experience_enabled = false` state.
- Coordinator path: `get_coordinator_tour_slots`, `book_tour_for_lead`, and `reschedule_tour` all verified live against the real database via a simulated authenticated session (a real venue owner's user id, real JWT claim), not just read as code — confirmed correct slot generation (including a real closed-Monday date correctly returning zero slots), correct Lead-sourced contact population, correct relationship id resolution, correct old/new timestamp reporting on reschedule.
- Both paths write to the identical table, in the identical shape, and both now send confirmation through the identical Communication pipeline — the "same experience regardless of who booked it" requirement, verified rather than assumed.

`tsc` clean repo-wide. `eslint` clean on every file touched; the one remaining lint note in the new UI (a data-fetching `useEffect`) is the same structurally-necessary, already-pervasive pattern used throughout this codebase's other client components, not a new class of issue.

## Recommendation

# Release Blocker resolved — Sales → Booking Journey is Release Ready

The Sales → Booking Journey walkthrough's one open item (`docs/sales-booking-journey-walkthrough.md`) — no coordinator-facing way to schedule a tour — is closed. Combined with that walkthrough's three earlier fixes (notification deep-link, document handoff, originating-lead backlink), the full Lead → Tour → Booking → Client Workspace journey is now real, verified, and consistent end-to-end.
