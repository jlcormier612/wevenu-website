# Platform Orchestration Architecture

**Status:** Architecture only. No application code, database schema, or existing feature is changed by this document.
**Read first:** `docs/calendar-platform-integration.md`, `docs/luv-platform-reconciliation.md`, `docs/client-workspace-collaboration-architecture.md`. `docs/platform-workspace-architecture.md` and `docs/platform-intelligence-contract.md` do not exist in this repository at the time of writing (confirmed directly, as in every prior architecture document this program) — this document proceeds without them.
**Grounded in the live implementation, not assumption:** every migration in `supabase/migrations/`, every trigger and trigger function in the live database (queried directly via `pg_trigger`/`pg_proc`, not inferred from migration filenames), `lib/notifications/`, `lib/message-sequences/`, `lib/leads/service.ts`, `lib/requests/`, and the type files for every capability named below.

**Product Philosophy, stated once, governing every section below:** features own data. Features own business rules. The platform reacts to events. No consumer duplicates business logic. If two consumers need the same information, they consume the same event — they do not derive it independently.

---

## 0. What already exists — the orchestration baseline

This is the section every other section depends on, because the honest answer to "does an event system exist today" is **not simply no.** Five distinct, uncoordinated mechanisms already do part of this job, each built for exactly one consumer, none reusable by any other. Naming them precisely is the difference between this document proposing something genuinely new and this document silently duplicating something that already half-exists.

### (a) Trigger-based in-app notifications — real, working, single-consumer

A shared Postgres function, `create_venue_notification(venue_id, event_id, type, title, body, link, emoji)`, is called from nine dedicated triggers:

| Trigger | Table / condition | `type` emitted |
|---|---|---|
| `notify_new_lead` | `leads` AFTER INSERT | `new_lead` |
| `notify_rsvp` | `couple_guests` AFTER UPDATE OF `rsvp_status`, only `attending`/`declined` | `rsvp_received` |
| `notify_task_completed` | `event_tasks` AFTER UPDATE OF `status`, only when `completed_by IN ('couple','vendor')` — **coordinator completions are deliberately excluded** | `task_completed_couple` / `task_completed_vendor` |
| `notify_vendor_checkin` | `event_vendor_assignments` AFTER UPDATE OF `checked_in_at` | `vendor_checked_in` |
| `vendor_selection_notification` | `event_vendor_recommendations` AFTER UPDATE, only when `selected_at` newly set | `vendor_selected` |
| `notify_feedback` | `couple_venue_feedback` AFTER INSERT | `feedback_received` |
| `notify_referral` | `couple_referrals` AFTER INSERT | `referral_received` |
| `notify_inbound_message` | `messages` AFTER INSERT (the **legacy** thread table only) | `message_received` |

Every row lands in `venue_notifications` (`venue_id, event_id, type, title, body, link, emoji, read_at, created_at`), gated per-type by `venue_notification_preferences`, and is read by exactly one consumer: `components/shell/notification-bell.tsx` via `GET /api/notifications`. This is a real, working, if narrow, event mechanism — but the event and its one consumer are welded together: `title`/`body`/`emoji` are presentation strings baked into the trigger itself, not a data payload a second consumer (Calendar, Luv, Reporting) could reinterpret for its own purpose. Adding a new event type means hand-writing a new SQL trigger function.

### (b) Inline synchronous "fire-and-forget" calls — a second, unrelated mechanism, for a different consumer

`lib/leads/service.ts` calls `void triggerSequencesForRelationship(supabase, venueId, relationshipId, "lead_created")` and `"lead_stage_changed"` inline, directly, at exactly two call sites (lines 80 and 124), each un-awaited. This is a completely separate code path from (a) — the same underlying facts ("a lead was created," "a lead's stage changed") are independently detected twice, once by a DB trigger feeding the notification bell, once by an application-code call feeding Message Sequences enrollment. Neither knows the other exists. A third consumer wanting to react to "lead created" today has no shared thing to attach to — it would have to add a third independent call site inside `lib/leads/service.ts` itself.

### (c) Scheduled polling — a third, time-based mechanism

`lib/notifications/engine.ts`'s `processReminders()` sweeps `task_reminders WHERE status='pending' AND scheduled_for <= now()` (populated once, at task-creation time, from `reminderBeforeDays`) and `mark_overdue_payments(venue_id)` flips `payment_line_items.status` from `pending` to `overdue` once `due_date < current_date` — called lazily, only when `getPaymentSchedules()`/`getPaymentSchedule()` run (a finding first surfaced in `docs/calendar-platform-integration.md`'s Phase 2/3 work). Both are time-crossing checks, not reactions to something a person did — a structurally different kind of "event" from (a) and (b), covered explicitly in §1 below.

### (d) Passive activity logs — a fourth mechanism, zero fan-out

`log_lead_created`/`log_lead_status_changed`, `log_client_created`/`log_client_status_changed`, `log_event_created`/`log_event_status_changed` each write one row into that record's own `*_activities` table (`lead_activities`, `client_activities`, `event_activities`) — a real, working audit trail, but read *only* by that same record's own activity-feed UI. `request_lifecycle_events` (`created`/`status_changed`/`assigned`/`reassigned`) is the same pattern for Requests specifically — confirmed read only from `lib/requests/service.ts`, `app/(app)/requests/actions.ts`, and Requests' own detail page. Nothing outside each feature reads its own log.

### (e) Direct synchronous reads at render time — the platform's actual default today

Everything this program has built so far (Calendar's `getCalendarData()`, Luv's `observations.ts`, Event Readiness's `buildEventReadiness()`) works by reading another feature's tables or calling another feature's service function *at the moment a page renders* — never by reacting to a discrete moment something changed. This is not a flaw introduced by any one feature; it is the platform's only general-purpose integration mechanism today, and it is precisely what (a)–(d) exist alongside without replacing.

**The finding this section exists to state plainly:** the platform does not lack event-like mechanisms — it has five of them, each hand-built for one consumer, none shared, none discoverable by the next feature that needs the same fact. This is the concrete version of "no consumer duplicates business logic" already being violated today (lead creation is detected twice, independently, by mechanisms (a) and (b)), and it is the baseline every recommendation below is measured against.

---

## 1. Operational Events

For every event in the task's own list: what state transition it actually corresponds to, and which of §0's five mechanisms (if any) already touches it. **"Emitted" here means some mechanism already reacts at the moment it happens — not that the fact is unknowable.** Every event below is already *readable* (it's a column in a table); the question this table answers is narrower and more specific: does anything already *react*, or does every consumer have to independently notice.

| Event | State transition | Today |
|---|---|---|
| Planning task completed | `event_tasks.status → 'complete'` | **Partially emitted** — (a) fires, but only for `completed_by IN ('couple','vendor')`; a coordinator completing their own task emits nothing |
| Planning task scheduled | `event_tasks.scheduled_date` set (Calendar Integration Phase 1) | **Not emitted** — Calendar reads it directly, synchronously, every render |
| Request created | `requests` row inserted | **Logged, not emitted** — (d) writes `request_lifecycle_events`, read only by Requests itself |
| Request submitted | `requests.status → 'submitted'` | **Logged, not emitted** — same (d) log; Luv (§7 of the reconciliation doc) and Calendar (§2 of the Calendar doc) each independently re-derive this exact transition from `dueDate`/`status` today — a live example of the "two consumers deriving the same fact separately" problem this document exists to close |
| Request reviewed | `requests.status → 'reviewed'` | **Logged, not emitted** |
| Request completed | `requests.status → 'completed'` | **Logged, not emitted** |
| Contract signed | `contracts.status → 'signed'`, `signed_at` set | **Not emitted** — no trigger, no inline call, nothing |
| Payment received | `payment_line_items.status → 'paid'`, `paid_at` set | **Not emitted** |
| Document expired | `documents.expires_at < today` | **Not a transition at all** — a *time-crossing* event, not a *state-mutation* event (see the distinction drawn below); needs a sweep, the same shape as (c)'s `mark_overdue_payments`, not a trigger |
| Guest RSVP submitted | `couple_guests.rsvp_status → 'attending'/'declined'` | **Emitted** — (a)'s `notify_rsvp` — **with a genuine tension worth flagging now and returning to in §2/§9: the trigger's notification title is literally `"{first_name} {last_name} RSVP'd"`, naming an individual guest to the venue.** `couple_guests`' own founding migration comment states "the venue does NOT see individual records" (the Client-Ownership precedent `docs/client-workspace-collaboration-architecture.md` §4 documents). This existing trigger already crosses that line in a narrow, single-purpose way; any future orchestration layer must decide deliberately whether the *event payload* for this fact is allowed to carry a guest's name at all, rather than inheriting the current trigger's choice by default |
| Guest count finalized | No such flag or flow exists | **Not modeled** — there is no "finalize" action anywhere; only a live-computed aggregate (`GuestReadinessSummary`) read on demand |
| Floor Plan shared | `floor_plans.client_access: 'hidden' → 'view'/'edit'` | **Not emitted, and barely built** — per the collaboration doc, this column exists but no UI sets it; the state this event would represent is itself mostly unbuilt |
| Floor Plan approved | No such concept exists | **Not modeled at all** — `floor_plans` has no approval state, only the three-value `client_access` |
| Seating completed | `needsReassignmentCount === 0 && totalAssigned === totalAttending` | **Not modeled as a transition** — a derived condition already computed fresh by `SeatingReadinessSummary`; "completed" is a threshold on that computation, not a stored fact |
| Timeline published | No such concept exists | **Not modeled** — Timeline has no draft/published state; entries are always live, distinguished only by the `audiences` tag array (per collaboration doc §3, §9.6) |
| Website published | `couple_websites.isPublished: false → true` | **Not emitted** — a real boolean flip, no trigger on it |
| Vendor accepted | `event_vendor_recommendations.selected_at` newly set | **Emitted** — (a)'s `vendor_selection_notification` |
| Communication replied | New row in `messages` (legacy) or `conversation_messages` (new) | **Emitted for the legacy schema only** — (a)'s `notify_inbound_message` triggers on `messages`; the newer `conversation_messages` table has a `touch`-style trigger (`conversation_messages_touch`) that only updates a timestamp, *no notification fires at all* for venues migrated to the new Conversation experience. This is the same legacy/new fork `docs/client-workspace-collaboration-architecture.md` §9.1–9.2 already named for the Portal side — it exists on the notification side too, independently |
| Tour booked | `tour_appointments` row inserted/confirmed | **Not emitted** — Calendar reads `tour_appointments` directly via `getTourCalendarEntries` |
| Booking confirmed | `events.status: 'draft' → 'confirmed'` | **Logged, not emitted** — (d)'s `log_event_status_changed` writes `event_activities` only |
| Event completed | `events.status → 'complete'` | **Logged, not emitted** — same (d) mechanism |

**A distinction worth naming explicitly, because it changes what "emit this event" even means:** most rows above are **state-transition events** — something inserted or updated a row, and a trigger or inline call *could* fire at that exact moment. "Document expired" is structurally different — a **time-crossing event**: nothing is mutated when a document's `expires_at` passes; the fact becomes true purely because the clock did. These can only ever be *discovered*, on a sweep (exactly `mark_overdue_payments`'s existing shape), never *triggered*. Any future event emission layer needs both mechanisms, not one generalized to cover both — a state-transition emitter and a time-crossing sweep are different pieces of infrastructure.

---

## 2. Event Ownership

For every event: which feature emits it, and who would consume it. "Owns" and "emits" are the same feature for every event below — no event in this platform is emitted by a feature that doesn't own the underlying data, which is itself a constraint worth stating explicitly (an orchestration layer must never let a *consumer* emit an event on behalf of the feature it read from; that would immediately reintroduce duplicated business logic one layer sideways).

| Event | Owns / Emits | Calendar | Luv | Notifications | Automation | Reporting |
|---|---|---|---|---|---|---|
| Planning task completed | Planning | — | ✓ (celebration) | ✓ (already, partially) | ✓ (could enroll a follow-up) | ✓ |
| Planning task scheduled | Planning | ✓ (already reads directly) | ✓ | ✓ (future attendance reminder, per Calendar §2a) | — | ✓ |
| Request created | Requests | — | ✓ | ✓ | — | ✓ |
| Request submitted | Requests | ✓ (already reads directly) | ✓ (recommendation) | ✓ | — | ✓ |
| Request reviewed | Requests | — | — | ✓ | — | ✓ |
| Request completed | Requests | — | ✓ (celebration) | ✓ | — | ✓ |
| Contract signed | Contracts | ✓ (expiration item could retire) | ✓ (celebration) | ✓ | ✓ (create onboarding tasks) | ✓ |
| Payment received | Payments | — | ✓ | ✓ | — | ✓ |
| Document expired | Documents | ✓ (already reads directly) | ✓ (risk) | ✓ | ✓ (create a renewal Request) | ✓ |
| Guest RSVP submitted | Guests | — | ✓ (aggregate only, §8 of reconciliation doc) | ✓ (aggregate only — see the flag above) | — | ✓ (aggregate only) |
| Guest count finalized | Guests | — | ✓ | ✓ | ✓ (could trigger a Planning task) | ✓ |
| Floor Plan shared | Floor Plans | — | ✓ (inference, per reconciliation §3) | ✓ | — | ✓ |
| Floor Plan approved | Floor Plans | — | — | ✓ | — | — |
| Seating completed | Seating | — | ✓ (risk when *not* complete) | ✓ | — | ✓ |
| Timeline published | Timeline | ✓ | — | ✓ | — | — |
| Website published | Website | — | ✓ (replaces Luv's own ad hoc heuristic, per reconciliation §2) | ✓ | — | ✓ |
| Vendor accepted | Vendor Management | — | ✓ (already, partially) | ✓ (already) | ✓ (could create a follow-up task) | ✓ |
| Communication replied | Communication | — | ✓ | ✓ (already, legacy schema only) | ✓ (sequence exit hook — already exists for Leads, per §0(b)) | ✓ |
| Tour booked | Tours | ✓ (already reads directly) | ✓ | ✓ | ✓ (enroll in a pre-tour sequence) | ✓ |
| Booking confirmed | Events | ✓ | ✓ | ✓ | ✓ (apply a Planning template — already a manual action today, `applyPlaybookToEvent`) | ✓ |
| Event completed | Events | ✓ | ✓ | ✓ | ✓ (trigger a feedback request — `couple_venue_feedback` already exists as a destination) | ✓ |

**Daily Briefing is deliberately not its own column** — per §5 of the reconciliation doc and §6 below, it is not a sixth independent consumer with its own read logic; it is Luv's own observation feed, fanned out venue-wide on a daily cadence. Anything that reaches the Briefing reaches it *through* Luv's consumption of these events, not around it.

---

## 3. Consumers

How each responds — as a pattern, not eighteen repeated paragraphs, since every event above maps onto the same few shapes per consumer:

- **Calendar** consumes only events that change *when* something is (a date, a time, an expiration). It never consumes "submitted"/"completed"/"signed" as a status fact to display a badge about — it already reads the current value of `dueDate`/`scheduledDate`/`expiresAt` directly (`docs/calendar-platform-integration.md`'s entire model). An event bus would let Calendar *invalidate a cached render* the moment a relevant date changes, rather than recomputing on every page load — a performance optimization, not a new capability. Calendar should never subscribe to "Request submitted" the way Luv does; it has no submitted/reviewed concept of its own to update.
- **Luv** consumes almost every event in §1, because narrating "what happened and why" is its entire purpose (reconciliation doc §3, §4). Every event Luv consumes becomes, at most, one `Observation` (§4 of the reconciliation doc's own envelope) — `kind` chosen from that document's six-value enum, never a seventh invented here. Luv is also the *only* consumer that needs the "last observed state" mechanism named in that document's §5/§9 — the thing that turns "Request completed" into a Celebration specifically because it's the first time that request has been in that state, not merely a fact re-read on every visit.
- **Notifications** consumes events to decide *whether and how* to alert a human right now — the delivery half of what (a) and (c) in §0 already do separately. An orchestration layer's job here is narrow and mechanical: replace nine hand-written trigger functions and one polling sweep with one place that says "this event → this notification," not to invent new notification content (§4 covers the *kind* of notification each event naturally produces, not its wording).
- **Automation** consumes events to decide whether to *take an action* (§5) — enroll in a sequence, create a Request, create a Planning task. This is the one consumer for which "consuming an event" and "the platform doing something on its own" are the same sentence, which is exactly why §5 exists as its own section with explicit boundaries.
- **Event Readiness** does **not** consume operational events at all, by design, and this document does not change that. Event Readiness computes its four-status model fresh, on every read, from each feature's live state (`lib/readiness/compute.ts`) — no memory, no event log, nothing to subscribe to. Every event in §1 already changes some field Event Readiness would re-read next time anyway. Adding event consumption to Event Readiness would be the single most direct way to reintroduce "two engines computing the same fact" (the reconciliation doc's own §6 failure mode, stated there for Luv and equally true here) — it stays a pure, stateless function of current state, always.
- **Reporting** consumes events as the raw material for aggregation over time (counts, trends, conversion) — the one consumer for which *volume* matters more than any single event's content. Reporting is the natural home for a durable, append-only event log (§8), where Luv and Notifications are natural homes for a transient, fan-out reaction to the same log.
- **Daily Briefing** does not consume events directly — see §6. It consumes Luv's own already-produced observations, on a daily cadence, exactly as the reconciliation doc's §5 table already describes.

---

## 4. Notification Philosophy

Five categories, reconciled against — not invented alongside — the six-value `ObservationKind` enum `docs/luv-platform-reconciliation.md` §4 already established (`fact | inference | recommendation | celebration | waiting | risk`). A notification is not a new concept sitting next to an observation; it is the subset of observations urgent or noteworthy enough to interrupt someone, so the mapping below is a *filter and re-label* of that existing model, not a parallel taxonomy:

| Notification category | Nearest `ObservationKind` | What naturally produces it |
|---|---|---|
| **Informational** | `fact` | A state changed, nothing is owed and nothing is at risk — "Contract signed," "Vendor accepted." Lowest urgency; fine to batch into a digest rather than push immediately. |
| **Reminder** | `waiting`, or a scheduled derivative of `fact` | Something has a known future moment attached to it — `event_tasks.reminder_before_days`, a Planning scheduled activity approaching (per Calendar §2a's "attendance reminder" distinction), a Request `sent` but not yet acted on. Time-anchored, not urgency-anchored. |
| **Attention Required** | `risk` | An existing, feature-native threshold already crossed — a Request overdue, a Document expired, `needsReassignmentCount > 0`. Never a threshold the notification layer invents itself — always cited from the same field Event Readiness already flags (reconciliation doc §4's traceability rule, unchanged here). |
| **Celebration** | `celebration` | A one-time, positive transition — "Request completed," "Contract signed," "Guest RSVP: attending." Exactly the reconciliation doc's own definition (a Fact promoted because it's the *first occurrence* of a transition) — this document does not redefine it, only confirms it maps onto "notification" as directly as it maps onto "observation." |
| **Escalation** | A `risk` that has *aged* past a second threshold | The one category with no existing `ObservationKind` equivalent, and the one genuinely new idea in this section. `event_tasks.escalation_after_days` already exists as a real, unused-by-any-trigger-today field — the schema already anticipated this exact concept (a Risk that's gone unaddressed long enough to escalate to someone else, e.g., a coordinator's manager) before an orchestration layer existed to act on it. |

**What this section deliberately does not do:** design a template, a subject line, a channel-selection rule, or a digest cadence — those are `lib/notifications/templates.ts`/`preferences.ts`'s job, unchanged. This section answers exactly one question — *which of the five buckets does a given event naturally fall into* — and nothing about wording.

---

## 5. Automation Philosophy

**What the automation engine is allowed to do**, stated as an explicit allow-list, not a description of aspiration:

- Send a reminder (already real: `task_reminders` → `lib/notifications/engine.ts`).
- Enroll a relationship in a sequence (already real: `triggerSequencesForRelationship`, currently called from exactly two places in Leads — §0(b)).
- Exit an enrollment early (already real: `exitEnrollmentsForBooking`, the "stop on reply" behavior `lib/message-sequences/repository.ts` documents).
- Create a Request (not yet built as an automated action anywhere, but structurally identical to the existing manual `createRequestForTaskAction` — Automation would call the same function a coordinator's own click already calls, never a parallel code path).
- Create a Planning task (same reasoning — `applyPlaybookToEvent` already exists as the manual version of this action).

**What it is never allowed to do:** silently modify **Client-Owned** information — anything on the "Client Only" side of `docs/client-workspace-collaboration-architecture.md` §8's own table (Guests, Budget, Seating, Website, Our Story, Journey, People, Ask Luv). Automation may *read* an event about these (e.g., "Guest RSVP submitted") and *act elsewhere* (create a coordinator-side Planning task), but it may never *write into* the couple's own data on their behalf. This is the same boundary the reconciliation doc's §8 already drew for Luv's *observations* ("aggregate-only, never individual") — this section draws the parallel, stricter line for Automation's *actions*: Luv may not expose Client-Owned detail; Automation may not touch it at all, in either direction.

**Observation vs. action, the distinction this section exists to make explicit:** every consumer in §3 *observes* an event. Only Automation *acts* on one. The difference is not subtle and should never be allowed to blur: an Automation action must always be one of the five bullet points above — an existing, already-callable, already-audited function — never a new, bespoke database write invented specifically for automation's own convenience. If a proposed automation doesn't map onto something a coordinator could already do by hand today, it isn't an automation of an existing capability — it's an undesigned new feature wearing automation's name, and belongs back in a feature-specific architecture document, not this one.

---

## 6. Daily Briefing

Restated from `docs/luv-platform-reconciliation.md` §5, applied specifically to *events* rather than to Luv's seven existing pieces generally:

**What belongs:** any event from §1 that is (a) time-relevant to *today or tomorrow specifically* and (b) already resolved, by Luv, into one of the six `ObservationKind`s. A Celebration from yesterday ("Contract signed"), a Risk active right now ("Document expired," "Request overdue"), a Reminder due today or tomorrow ("Planning task scheduled — Final Walkthrough at 2pm"). The Briefing is a *view* over Luv's own already-produced observations, filtered to a tight time window — not a second computation of the same events.

**What does not belong:**
- Anything venue-wide but not booking-shaped — Calendar's own tours-today/holds-expiring-this-week feed (reconciliation doc §3's explicit carve-out: Calendar belongs in the Briefing, but *as itself*, not folded into per-booking Luv narration).
- Weekly Roll-ups (`luv_rollups`) — a different cadence, not a subset of the daily feed (reconciliation doc §5's table, unchanged).
- Long-horizon Memories — context and color, never priority-ordering material (same table).
- Anything Event Readiness computes that hasn't crossed into `risk`/`celebration` territory — a `waiting` or plain `fact` observation about one booking, among fifty, is not automatically Briefing-worthy just because it's true; the Briefing is a *filtered* feed, and volume discipline is as much its job as content selection.

**The one new mechanism this still requires — restated, not reinvented:** the same "last observed state" record the reconciliation doc already named as its one remaining gap (§5, §9 there). Without it, "what changed since I last looked" cannot be answered for *any* event in §1, no matter how orchestration wires the events themselves.

---

## 7. Event Lifecycle — three representative flows, traced end-to-end

### Example A: Planning task → Request → Client submission → Review → Completion

1. **Planning task created** — a coordinator (or a template, via `applyPlaybookToEvent`) creates an `event_tasks` row. No event needed yet; nothing downstream cares until a client is involved.
2. **`createRequestForTaskAction` turns it into a Request** — `Request.sourceFeature = 'planning'`, `Request.sourceId = task.id`, `event_tasks.request_id` set. **This is the first genuine "Request created" event** (§1, §2) — Requests emits, Notifications could inform the client their action is needed, Reporting counts it.
3. **Client submits** — `requests.status → 'submitted'`. **"Request submitted"** emits. Luv turns it into a Recommendation ("ready for your review," reconciliation doc §7); Notifications alerts the coordinator; Calendar's own `request_due` item (already built, Calendar Integration Phase 2) independently shows the same "Submitted — awaiting review" state today — **the exact duplication named in §1's table**, which event-based orchestration would resolve by having Calendar consume the same event Luv does, rather than recomputing the identical `dueDate`/`status` comparison a second time.
4. **Coordinator reviews** — `requests.status → 'reviewed'`. **"Request reviewed"** emits; Notifications could confirm to the client their submission was seen.
5. **Completion** — `requests.status → 'completed'`, `completed_at` set. **"Request completed"** emits as a Celebration (reconciliation doc §4's own worked example uses this exact transition). Luv narrates it; Reporting counts a closed loop; if `sourceFeature = 'planning'`, the *originating* Planning task remains untouched by this event — Requests and Planning are linked by `request_id`/`sourceId`, never merged, exactly as `event_tasks_scheduled_start_requires_date`-style additive design has kept every pairing in this platform separate rather than collapsed.

### Example B: Booking confirmed → Timeline → Calendar → Event Readiness → Luv

1. **Booking confirmed** — `events.status: 'draft' → 'confirmed'`. Today, only (d)'s activity log fires (`event_activities`); no other consumer reacts. **"Booking confirmed"** is the emitted event.
2. **Timeline** consumes it structurally, not automatically: a confirmed booking is the trigger point at which a coordinator applies a Timeline Template (`lib/timeline-templates/`) — today a manual action, and this document does not propose automating it (§5's allow-list would permit Automation to *offer* it, never to silently populate a couple's day-of schedule unasked).
3. **Calendar** already surfaces the booking the moment `events.status != 'cancelled'` and `event_date` falls in the queried month — no event needed for Calendar's own Month/Week/Day/Agenda views (Calendar Integration Phase 3), because Calendar re-reads on every render by design. Where an event *would* help: invalidating any future cached Calendar view the instant "Booking confirmed" fires, rather than waiting for the next natural page load.
4. **Event Readiness** recomputes automatically on next read — it has no subscription, by design (§3 above). "Booking confirmed" changing `events.status` doesn't need to reach Readiness as an event; Readiness's Planning/Timeline/Contracts/etc. sections simply reflect whatever is now true the next time anyone opens the booking.
5. **Luv** consumes "Booking confirmed" directly as a Celebration-kind observation (a new client relationship formally beginning), and *separately* consumes Event Readiness's own output as an ongoing input (reconciliation doc §6) — two different relationships to the same booking, one event-driven (the confirmation itself, a one-time transition), one poll-driven (Readiness, re-read every time Luv looks), coexisting correctly rather than needing to be unified into one mechanism.

### Example C: Guest RSVP → Guest counts → Seating → Readiness → Daily Briefing

1. **Guest RSVP submitted** — `couple_guests.rsvp_status → 'attending'/'declined'`. Already emitted today (§0(a), `notify_rsvp`) — with the individual-guest-name tension flagged in §1 carried forward here unresolved; this document names it as a decision a future implementer must make deliberately, not one this document makes for them.
2. **Guest counts** — no stored "finalized" state exists (§1); `GuestReadinessSummary` recomputes the aggregate (`attending`/`declined`/`pending` counts) fresh, every time it's asked, directly from `couple_guests.rsvp_status`. The RSVP event doesn't need to *update* a count anywhere — there is no cached count to keep in sync, by design, matching Event Readiness's own no-memory model.
3. **Seating** reads `totalAttending` (from that same live aggregate) against existing seat assignments to compute `needsReassignmentCount` — again fresh, again no stored "Seating completed" flag (§1). An RSVP flipping from `pending` to `declined` after that guest was already seated is exactly what turns `needsReassignmentCount` from 0 to 1, live, the next time anyone asks — no event delivery required for Seating's own correctness, only for *telling someone* it just happened.
4. **Readiness** folds `SeatingReadinessSummary` into its own `computeSeatingReadiness` section — same non-memory pattern, one more layer up.
5. **Daily Briefing**, the one place in this chain that *does* need the event, not just the current state: "3 guests moved from attending to declined overnight, 2 now need reseating" is a *change*, not a *snapshot* — Readiness can say "Seating needs attention," but only an event (or the "last observed state" comparison in §6) can say *what changed since yesterday morning*, which is the entire value the Daily Briefing adds over a coordinator just opening the Seating tab themselves.

**What all three flows demonstrate together:** most of a flow's middle steps need no event at all — they're already correctly served by live recomputation (Event Readiness, Calendar, Seating). Events earn their place at exactly two kinds of moment: a **one-time transition worth narrating** (Celebration-shaped) and a **change worth surfacing before someone asks** (the Daily Briefing's entire reason to exist). Everything else should stay exactly as stateless as it is today.

---

## 8. Future Extensibility

A mobile app, a public API, or a third-party integration (a Zapier-style outbound webhook, a calendar-sync integration, an accounting export) should all consume **the same event model** described above — not a parallel one built for "external" consumers:

- **Mobile app**: push notifications are §4's five categories delivered over a different channel (APNs/FCM instead of email) — the *decision* of which category an event falls into does not change based on which device receives it. A mobile-specific consumer subscribes the same way Notifications does today, it just renders differently at the edge.
- **Public API / webhooks**: an external integration is, structurally, one more consumer in §3's table — it would subscribe to the same emitted events (Contract signed, Payment received, Booking confirmed) that Notifications and Reporting already do, never a bespoke export job that re-derives "did a contract get signed" by polling `contracts` on its own schedule. The moment an external system needs its own polling loop to detect a fact the platform already knows the instant it happens, that is the orchestration layer failing to do its one job.
- **Future integrations built by this team** (accounting, e-signature providers beyond the current `/sign/[token]` flow, a CRM sync) inherit the same rule §5 sets for Automation: they may *read* events and *act* through existing, already-audited functions — never write a second, parallel path into feature-owned tables.

The event model this document describes is not a Calendar feature, a Luv feature, or a Notifications feature — it is the one seam every future consumer, internal or external, is meant to attach to.

---

## Closing constraint, restated

Design the platform as if every meaningful change emits an event exactly once. Every downstream capability reacts to that event rather than polling, re-computing, or inventing parallel business logic. If two consumers need the same information, they consume the same event — not derive it independently. Section §1's own table shows this is not yet true (Request submitted is independently re-derived by Luv and Calendar today); closing that gap, not adding a sixth parallel mechanism alongside §0's existing five, is what "orchestration" means in this document's title.

*End of document. No implementation, migration plan, or code is proposed — see task scope.*
