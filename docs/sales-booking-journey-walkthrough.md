# Sales → Booking Journey — Operational Walkthrough

Not a feature audit — an operational walkthrough. Walked exactly as a venue would: submitted a real public inquiry through a real venue's real embed-key form, then followed the resulting Lead through Pipeline, a document upload, and conversion to a Client, verifying the platform's own data at every step rather than assuming the code does what it looks like it does. No browser automation tool was available in this environment (noted up front); every step was exercised either via a real authenticated-equivalent HTTP request or by tracing the exact service-layer function a real click would call, then confirmed against the real local database.

## The journey, as walked

**New Inquiry → Lead created.** A real POST to `/api/public/inquire` against a real venue's embed key, matching exactly what the public form submits. Produced a real Lead (`status: 'new'`), a real `venue_customer_relationship`, and a real `venue_notifications` row — verified directly in the database, not assumed from the `{"ok":true}` response.

**Notification → Lead record.** Following the "New inquiry from X" notification landed on the Leads *list*, not the new lead itself — a real, fixed defect (see below).

**Pipeline.** This venue has an active Pipeline Template ("Prospect Pipeline"); confirmed the canonical-stage mapping (`lib/leads/pipeline-stage-mapping.ts`) correctly resolves "Booked" → `leads.status = 'won'`, which is exactly what gates the "Convert to Client" button — consistent, no surprises.

**Messages / Notes.** Already extensively verified live in the Communication Trust Experience pass immediately preceding this one; not re-walked in depth here.

**Tour scheduled.** See "Major finding," below — this is where the walkthrough found its most significant result.

**Proposal / Documents.** A coordinator can upload a document directly to a Lead (`DocumentsSection entityType="lead"`) — confirmed this UI exists and the upload path is real.

**Booking confirmed → Convert to Client.** Walked with a real document attached, to specifically test the handoff. Confirmed live:
- `relationship_id` is correctly inherited by the new Client row — the enduring identity the Communication system, Conversation history, and Luv all key off of survives the handoff with zero extra work, by design (`lib/clients/repository.ts::insertClient`).
- The pre-existing race-condition guard (`clients_lead_id_unique`, fixed in the earlier Lead Pipeline audit) is still in place and correct.
- The document uploaded to the Lead did **not** survive — a real, fixed defect (see below).

**Client Workspace.** Landed correctly on `/clients/{id}/booked` after conversion. Confirmed the Client Workspace has no path back to the originating Lead at all — a real, fixed defect (see below).

## Release Blockers found and fixed

1. **"New inquiry" notification didn't link to the lead.** `_trigger_new_lead_notification()` hardcoded `/leads` (the list) instead of `/leads/{id}`, even though the new lead's id was right there on `NEW`. Every other notification trigger in this platform already deep-links correctly (`message_received`, `task_completed`, etc.) — this one simply never got the same care. **Fixed** in `_trigger_new_lead_notification()`.

2. **Documents didn't survive Lead → Client conversion.** `convertLeadToClient` never re-tagged a Lead's uploaded documents to the new Client/Event — a signed proposal uploaded before booking became permanently invisible from the Client Workspace's Documents tab the moment the lead converted, with `lead_id` still set and `client_id`/`event_id` both null. Confirmed live: uploaded a real document to a real Lead, converted, confirmed it vanished from the Client-side view; fixed by re-tagging at conversion time (`lib/clients/service.ts`); re-confirmed live it now resolves correctly. One real subtlety caught by testing against the actual database, not just code review: `documents` has a `documents_one_entity` check constraint (`lead_id`/`client_id`/`event_id`/`vendor_id` — at most one may be set) — the first version of this fix set both `client_id` and `event_id` and would have violated that constraint in production; caught immediately by testing, not shipped.

3. **No path from the Client Workspace back to the originating Lead.** Compounds #2's category of problem for everything conversion doesn't explicitly re-link — a Lead's own activity history (status changes, notes, the original inquiry message) remained fully intact and un-corrupted on the Lead record, but had zero reachable path once a venue was looking at the Client Workspace, since nothing pointed back. **Fixed**: a small "View original inquiry" link now appears in the Client Workspace header whenever `client.leadId` is set, reusing data that already existed (`Client.leadId`) rather than adding anything new.

All three verified live against the real local database; `tsc`/`eslint` clean on every file touched.

## Major finding — not fixed, needs a product decision

**A coordinator has no way to schedule a tour for an existing Lead.** Traced exhaustively, not assumed: `tour_appointments` (the canonical tour-tracking table, per its own migration comment) has exactly one write path, `bookTour()` in `lib/tours/service.ts` — and it is built entirely for the public self-service booking widget. It takes a public `embed_key`, always creates a brand-new Lead from scratch, and has no authenticated equivalent. Everything after it in that file, under an explicit `// ── Coordinator (authenticated) ──` comment, is read/update only (`getTourAppointments`, `updateTourOutcome`, etc.) — there is no create function for a signed-in coordinator at all.

The Calendar module does have a "Tour" option in its manual schedule-item picker (from the Calendar Booking Placeholder work earlier this session), but it writes to `calendar_blocks`, a completely different table with no `lead_id` column at all — a tour scheduled this way can never be linked to the Lead it's for, will never appear in that Lead's "Scheduled Tours" card, and is invisible to everything that reads `tour_appointments` (lead scoring, the Client Workspace, Luv's own tour-related observations).

Practical impact: the single most common real-world path — a coordinator on the phone with a bride saying "let's get you in for a tour Tuesday" — has no correct way to record that tour against the Lead. This is compounded by a second, related gap: even a tour that *did* get created correctly (via the public widget) has nowhere to be seen from the Client Workspace after conversion — no fetch, no display, anywhere in `event-detail.tsx` or the Client page.

**Why this wasn't fixed in this pass**: it isn't a regression or a broken existing feature — it's a capability that has never existed, and building it correctly (an authenticated "Schedule Tour" action, real slot-conflict checking against the same capacity logic `book_tour` already enforces for the public widget, new UI on the Lead page, and a decision about whether/how tour history should surface on the Client Workspace) is a real, multi-file feature build, not a bug fix. Per this pass's own instruction — implement only genuine Release Blockers, don't redesign — this is named plainly rather than built unilaterally.

## What worked well, confirmed by walking it rather than assumed

- The enduring `relationship_id` identity model — the single best piece of evidence this pass produced that the Lead → Client handoff is fundamentally sound. Conversation history, Communication status, and Luv all continue to work across the handoff with zero special-casing, because they were built against the Relationship, not the Lead or Client row.
- Pipeline Stage → `leads.status` mapping is consistent and predictable; "Convert to Client" is correctly gated on reaching "won," with clear, correct terminology throughout.
- The race-condition guard on Lead → Client conversion (from the earlier Lead Pipeline audit) held up under direct testing.

## Recommendation

# Almost Ready

Three real, scoped Release Blockers found and fixed, each verified live. The one item keeping this from "Ready" is the missing tour-scheduling capability — real, severe for daily coordinator use, but a feature gap rather than a broken workflow, and correctly out of this pass's authorized scope to build unilaterally. Recommend treating "a coordinator can schedule and track a tour for an existing Lead" as the next authorized piece of work, sized and scoped deliberately rather than folded into a walkthrough pass.

---

## Update — Coordinator Tour Scheduling completion pass

The missing capability named above was built as its own dedicated pass. Full detail in `docs/coordinator-tour-scheduling.md`. With it complete and verified live (both the coordinator path and the public self-service widget, confirmed to produce the identical data model and integrate identically with Communication, Notifications, and the Lead Pipeline):

# Sales → Booking Journey is Release Ready
