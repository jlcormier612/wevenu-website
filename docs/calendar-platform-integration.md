# Calendar — Platform Integration Architecture

**Status:** Architecture and planning only. No application code, database schema, or existing Calendar functionality is changed by this document.
**Read first:** `docs/wedding-workspace-architecture.md`, `docs/client-workspace-collaboration-architecture.md`, `docs/luv-platform-intelligence-architecture.md`, `docs/luv-platform-reconciliation.md`, `docs/floor-plan-seating-architecture.md`. `docs/platform-workspace-architecture.md` does not exist in this repository at the time of writing (confirmed, as in the two prior Luv documents) — this document proceeds without it.
**Grounded in the live implementation, not assumption:** `lib/calendar/types.ts`, `lib/calendar/service.ts`, `app/(app)/calendar/page.tsx`, `components/calendar/calendar-view.tsx`, and the live schema of every table Calendar already reads or could read (`event_tasks`, `task_reminders`, `client_key_dates`, `date_holds`, `tour_appointments`) — checked directly against the database, not inferred from older docs, per the same discipline the two Luv documents established after finding those docs were sometimes imprecise.

**Product Goal, stated once, governing every section below:** the Calendar is not where dates are displayed — it is where operational work becomes visible over time. It answers what is happening, what requires attention, who is involved, what depends on this, and what happens next, without duplicating Planning, Timeline, Requests, Communication, or Event Readiness. The Calendar owns time. It does not own work.

---

## 0. What Calendar already is (read this before anything else)

Per Sprint 17's own header comment (`lib/calendar/types.ts`), Calendar has never been anything but an aggregation: "No new DB tables — aggregates data from existing tables." That discipline has held. Today, concretely:

- **One function, one shape.** `getCalendarData(year, month)` runs seven parallel queries — `events`, `tour_appointments` (via `getTourCalendarEntries`, tours' own canonical projection), `leads.follow_up_date`, `payment_line_items.due_date`, `client_key_dates`, `date_holds`, `calendar_blocks` — and reduces them to one flat `CalendarItem[]`: `{ id, type, date, title, subtitle, time, link, rawId? }`. Every item already carries a `link` back to its owning page. This is the correct shape; nothing in this document asks it to change.
- **One view.** `app/(app)/calendar/page.tsx` renders a month grid (`CalendarView`), URL-paginated by `?year=&month=`, with a client-side day-selection sidebar for a single day's items. There is no week view, no day-page, no agenda view, no "Upcoming" widget today.
- **One thing Calendar actually writes.** `calendar_blocks` (administrative closures) is the one piece of state Calendar itself creates and owns — the block-creation form lives inside `CalendarView`. Every other item type is read-only from Calendar's side, exactly matching the Guiding Philosophy: Calendar visualizes; it authors nothing else.
- **Venue-wide, not per-booking.** Every query is scoped by `venue_id`, never `event_id` — Calendar today answers "what's happening across the whole venue this month," not "what's the schedule for this one wedding." That second question (§3's "Operational Schedule") is new territory this document names but does not build.

---

## 1. Calendar Ownership

**Calendar owns:**
- **Time itself** — the chronological arrangement of dates that other features already record. This is its entire mandate.
- **`calendar_blocks`** — administrative closures ("the venue is unavailable this day"). This is the one genuinely calendar-native fact in the whole system: no other feature is "about" blocking a date, so no other feature can own it. Calendar authoring this is not a violation of the Guiding Philosophy — it's the one case where the philosophy's own logic ("every other feature owns its own business logic") has no other claimant.
- **The temporal lens** — day/week/month/agenda framing, "how far away is this," and cross-capability chronological ordering. Framing is Calendar's; the underlying fact is never Calendar's.

**Calendar must never own:**
- Task completion or dependency logic (Planning's — `event_tasks.status`, `depends_on_event_task_id`)
- Timeline entry status or the day-of run-of-show itself (Timeline's — `timeline_entries`)
- Request lifecycle (Requests' — `Request.status`)
- Contract or signature state (Contracts')
- Payment or invoice status (Payments' — Calendar already reads `payment_line_items.due_date` correctly today: a date, not a status judgment)
- Guest, RSVP, or seating data (Guests'/Seating's — and see §7's privacy note, since this is the one place Calendar touching a Client-Owned domain needs the same care Luv's own reconciliation already worked out)
- Readiness computation of any kind (Event Readiness's — see §9)
- Notification delivery or send/open/click tracking (Automation's)

**One ownership boundary worth drawing precisely, because the two are easy to conflate:** `calendar_blocks` (Calendar-owned, pure calendar-space administration) versus `date_holds` (Pipeline-owned — a lead's provisional reservation against a date, referenced by `lead_id`). Both are "a date that isn't fully booked yet," but a hold is a *fact about a lead's status* expressed as a date range; a block is a *fact about the venue's own calendar* with no other owner. Calendar visualizes both identically as items; it authors only the first.

---

## 2. Calendar Event Types

Every example from the task's own list, checked against what the owning feature actually stores today — not proposed as new tracking, only identified as either already-flowing, readable-but-not-yet-wired, or genuinely absent.

| Example | Owning feature | Source field | Status |
|---|---|---|---|
| Tours | Leads/Pipeline | `tour_appointments` via `getTourCalendarEntries` | **Already on Calendar** |
| Bookings / Wedding Day | Events | `events.event_date`/`start_time` | **Already on Calendar** (the `event` item type) |
| Client Meetings, Final Walkthroughs | Planning | `event_tasks.due_date` where `category = 'meeting'` (a free-text convention, not an enforced enum — confirmed no check constraint on `event_tasks.category`) | **Not yet wired** — Planning tasks of any kind don't appear on Calendar today |
| Planning Milestones | Planning | `event_tasks.due_date` (required tasks) | **Not yet wired** |
| Timeline Milestones | Timeline | — | **Not a separate calendar-shaped fact.** `timeline_entries` has no date of its own — every entry belongs to the one day already represented by the `event` item. Timeline doesn't need its own Calendar item type; it needs the existing `event` item's link to route into the day-of schedule, exactly as Event Readiness's own card already does for other capabilities (§4). |
| Request Due Dates | Requests | `Request.dueDate` | **Not yet wired** |
| Contract Dates | Contracts | `Contract.expiresAt` | **Not yet wired.** `sentAt`/`signedAt` are historical facts, not forward dates — `expiresAt` is the one genuinely calendar-shaped field Contracts owns. |
| Payment Due Dates | Payments | `payment_line_items.due_date` | **Already on Calendar** |
| Guest RSVP Deadlines | Guests | — | **Does not exist as data anywhere.** No RSVP-deadline field on `couple_guests` or the event. Named honestly as a gap, not invented. |
| Invitation Send Dates | Guests | — | **Does not exist.** Invitations are sent on demand (`log_invitations_sent`), never scheduled to a future date. |
| Website Publish Dates | Website | — | **Does not exist.** `couple_websites.is_published` is a boolean with no target date, confirmed in the prior Luv research. |
| Vendor Deadlines | Vendor Management | — | **Does not exist.** `EventVendorAssignment.arrivalTime` is a day-of time (already implicit in the `event` item, same as Timeline); no pre-event vendor deadline field exists anywhere. |
| Document Due Dates | Documents | `Document.expiresAt` | **Not yet wired**, same shape as Contracts — a lapse/renewal date, not a "must upload by" date (no such field exists). |
| Floor Plan Reviews | Floor Plans | — | **Does not exist as a scheduled concept.** Floor Plans' only date-shaped fact is the event date itself. |
| Seating Reviews | Seating | — | **Does not exist**, same as Floor Plans. |
| Automation Execution | Automation | `task_reminders.scheduled_for` | **Not yet wired** — a real, forward-dated, already-queryable field (confirmed live: `scheduled_for timestamptz not null`, linked back via `event_task_id`/`tour_appointment_id`), simply never read by `getCalendarData` today. |
| Communication Follow-ups | Communication | `leads.follow_up_date` | **Already on Calendar** for the pre-booking (lead) case. Post-booking client communication has no scheduled-date field of its own — nothing to add until one exists. |

**The pattern across every "does not exist" row:** this document does not invent any of them. Where a field is genuinely absent, the correct move is the same one `docs/luv-platform-intelligence-architecture.md`'s Feature Completion Contract already established for Luv — the owning feature adds the field when it needs it, and Calendar reads it the same way it already reads everything else. Calendar inventing a shadow "RSVP deadline" concept of its own would be exactly the "no capability should create separate readiness logic" violation both prior documents warn against, one layer sideways instead of up.

### Differentiating the six kinds

| Kind | Definition | Examples (existing fields) |
|---|---|---|
| **Scheduled Events** | A specific time-of-day; an actual meeting/happening | Tours (`scheduled_at`), the wedding day itself (`start_time`), Date Holds (`start_time`/`end_time`) |
| **Deadlines** | A date something must happen *by*, no specific time | Payment due dates, Request due dates, Contract/Document `expiresAt`, non-meeting Planning tasks |
| **Milestones** | A marker of significance | `client_key_dates` — already the fully generic, free-text bucket for exactly this |
| **Reminders** | Prompts an action; missing it doesn't "expire" anything | `leads.follow_up_date`, `task_reminders.scheduled_for` |
| **Operational Tasks** | Planning's own work items | `event_tasks` generally — Calendar visualizes the due date, Planning owns everything else about the task |
| **System Events** | Platform-internal/administrative, not person-facing | `calendar_blocks`, `task_reminders` firing (the *execution* of a reminder, distinct from the reminder's own scheduled-for date as a Reminder-kind item) |

Note that `event_tasks` supplies both a Deadline-kind item (most tasks) and a Scheduled-Event-kind item (`category = 'meeting'` tasks) from the *same table* — the distinction is presentational, not structural, and Calendar can make it without owning anything new. ~~One honest limitation to name here rather than paper over: `event_tasks.due_date` is a plain `date` with no time-of-day column, so a "Final Walkthrough at 2pm" can only ever render as an all-day item until Planning itself adds a time field — Calendar cannot invent a time Planning doesn't track.~~ **Resolved at Calendar Integration Phase 1**: Planning now has `scheduled_date`/`scheduled_start_time`/`scheduled_end_time`/`location`, additive to `due_date`, exactly for this case.

---

## 3. Time-Based Views

Purpose only — no UI is designed here.

| View | Purpose | Exists today? |
|---|---|---|
| **Month** | Orientation and pattern-spotting at a glance — "is this a busy month," "where are the gaps" | **Yes** — the only view built so far |
| **Week** | A coordinator's working-week lens — tighter than month, looser than day; the natural unit for "what do I have this week" | No |
| **Day** | A single day's full agenda across every capability — the view a coordinator opens each morning. The existing day-selection sidebar is a shadow of this embedded inside the month view, not yet its own page | No |
| **Agenda** | A flat chronological list, not a grid — scanable regardless of which day-of-week things fall on; suited to ranges that don't align to a calendar month ("next 14 days") and to mobile | No |
| **Upcoming** | A prioritized, capped list for embedding elsewhere (a dashboard widget) rather than a calendar page in its own right — this is the exact raw material `docs/luv-platform-reconciliation.md` §4 already described the Daily Briefing needing from Calendar | No |
| **"Timeline" view** | A horizontal/range rendering of dated items — **naming conflict, flagged directly below** | No |
| **Operational Schedule** | A single booking's entire dated footprint — contract deadline, payment due dates, walkthrough, the wedding day itself — in one chronological list, scoped by `event_id` rather than venue-wide | No |

**A naming collision worth resolving before anything is built, not after:** the task's own list of views includes "Timeline" — but Timeline is already the name of a distinct, existing, heavily-built platform capability (the Booking Timeline / day-of run-of-show, `timeline_entries`). A Calendar view also called "Timeline" would recreate, at the UI-naming level, precisely the kind of collision `docs/luv-platform-intelligence-architecture.md` §0 found Luv itself had committed four times over (multiple things sharing one name, able to trivially disagree or confuse a reader). Recommend a different name for this view when it's built — "Strip" or "Range" view reads unambiguously; "Timeline view" does not. This is a documentation/naming finding, not a design decision this document is making on the implementer's behalf.

**Operational Schedule is the one view that changes Calendar's scope, not just its presentation** — every other view above still slices the same venue-wide `CalendarItem[]`; Operational Schedule requires filtering by `event_id`, something `getCalendarData` doesn't do today. This is the closest thing to a "new feature" in this whole document, and it is still pure aggregation: the same items, scoped to one booking, exactly the same non-ownership guarantee as everything else here.

---

## 4. Platform Integration

For every capability: what appears, what never appears, what only ever links back.

| Capability | Appears on Calendar? | Never appears | Links back to |
|---|---|---|---|
| Planning | Yes (task due dates, once wired) | Task notes, dependency chains, sub-task detail | Booking Workspace `#playbook` |
| Timeline | No separate item — folded into the `event` item | The day-of schedule's own contents | Booking Workspace `#timeline` |
| Requests | Yes (`dueDate`, once wired) | Response text, attachments | The owning booking's Overview, or `/clients/{id}` if pre-Event |
| Contracts | Yes (`expiresAt`, once wired) | Contract body, signature status | `/contracts` (existing convention) |
| Payments | Yes (already wired) | Invoice line-item detail | `/payments/{scheduleId}` (unchanged) |
| Documents | Yes (`expiresAt`, once wired) | Document content | Booking Workspace `#documents` |
| Guests | Only if/when a deadline field is added, and only as one aggregate per event (see §7 — never per-guest, never a name) | Individual guest data, RSVP responses, seating assignments, meal/accessibility detail | Booking Workspace, or the couple's own Portal |
| Seating | No — no scheduled concept exists; already implicit in the `event` item | Seating assignments | Booking Workspace `#floorplan` (Seating has no venue-side tab of its own, per `docs/floor-plan-seating-architecture.md`) |
| Floor Plans | No — same reasoning | Object-level detail | Booking Workspace `#floorplan` |
| Inventory | Never — no date-shaped concept exists in Inventory at all | — | — |
| Vendor Management | No — no deadline field exists; day-of arrival is already implicit in the `event` item | Vendor CRM detail | Booking Workspace `#vendors` |
| Communication | Yes for pre-booking lead follow-ups (already wired); no post-booking equivalent exists yet | Message content | `/leads/{id}` or the Booking Workspace Messages tab |
| Automation | Yes (`task_reminders.scheduled_for`, once wired), as a System Event | Delivery/open/click status (Notifications' own `notification_log`, and it doesn't track opens/clicks at all per the prior Luv finding) | Wherever the reminder's source task lives |
| Event Readiness | **Never as its own item** — Readiness is a status summary, not a dated fact | Its own status computation | The `event` item may optionally carry Readiness's `overallStatus` as a visual indicator (see §6), never recomputed |
| Luv | **Never appears, and never produces an item** — Luv narrates; Calendar's aggregation is something Luv *reads*, not the reverse (§6) | — | — |

---

## 5. Event Relationships

The task's own example — a Final Walkthrough relating to Planning, Timeline, Requests, Floor Plans, Seating, and Guests — is exactly the shape of thing Calendar must *reveal*, not *compute*.

**How Calendar reveals a relationship without duplicating it:** every relationship a Final Walkthrough (or any item) has to another capability already exists as a real link in the data model — `event_tasks.request_id` already ties a task to a Request; `Request.sourceFeature` already says which capability spawned it; and every capability sharing that Final Walkthrough's booking is trivially related to it by sharing the same `event_id`. Calendar's job is to surface what's *already linked*, not to build a second graph of relationships:

- A calendar item whose source row carries a foreign key to another capability (a task's `request_id`, a request's `sourceFeature`) can show that relationship as a small, secondary reference on the item — a fact already known, displayed, not inferred.
- A calendar item's relationship to *everything else about the same booking* (Floor Plans, Seating, Guests, the general state of the wedding) is best expressed by linking to that booking's own Overview — where Event Readiness (§6) already aggregates exactly those capabilities side by side. Calendar does not need its own cross-capability summary; Event Readiness already is one, and Calendar's item should route to it.
- **What Calendar must not do:** infer a relationship that isn't already recorded (e.g., guessing that a walkthrough "relates to" Seating because they're thematically similar, with no actual foreign key or shared identifier backing the claim). An inferred-but-unrecorded relationship is exactly the Inference/Fact blur `docs/luv-platform-intelligence-architecture.md` §6 forbids, applied here to Calendar instead of Luv.

---

## 6. Operational Intelligence

**Event Readiness.** Calendar answers *when*; Event Readiness answers *what state*. The relationship is the same one-directional, non-duplicating shape `docs/luv-platform-reconciliation.md` §6 already established for Luv ↔ Event Readiness, extended to a third consumer: Calendar's `event` item may display Event Readiness's own `overallStatus` (a colored indicator, reusing the same `ReadinessStatus` value and the same badge convention `EventReadinessCard` already uses) — it never recomputes readiness, and it never shows per-section detail Event Readiness itself owns.

**Luv.** The relationship is one-directional the other way: Luv *reads* Calendar's aggregation, Calendar never reads Luv's observations. This is exactly what `docs/luv-platform-reconciliation.md` §4/§5 already described — the Daily Briefing's "what's coming up this week" section was always going to be Calendar's own upcoming-items feed, not a separately-invented date computation inside Luv. This document confirms that dependency direction from Calendar's side and adds nothing new to it.

**Notifications.** `task_reminders.scheduled_for` is simultaneously a Notifications-owned fact and a Calendar-visualizable System Event (§2). Calendar shows *when* a reminder will fire; Notifications owns whether it actually sends, and `notification_log` owns whether it was delivered. Calendar must never show delivery status — that data lives entirely outside anything Calendar touches, and (per the prior Luv research) doesn't even track opens/clicks, so nothing about "was this seen" should ever be implied by a Calendar item.

**Automation (Message Sequences).** This is the one place Calendar might need to *project* rather than purely aggregate: a `MessageSequence`'s next scheduled step is computable from `SequenceStep.offsetDays` and the enrollment's own anchor date, but it is not itself a stored date anywhere. If this is ever surfaced on Calendar, it must be presented as a projection, not a fact — the same Fact/Inference distinction `docs/luv-platform-intelligence-architecture.md` §6 draws for Luv applies here: a computed estimate is not the same trust tier as a stored `due_date`, and Calendar's own UI must not blur the two.

---

## 7. User Perspectives

| Perspective | What they'd see | Governing boundary |
|---|---|---|
| **Venue (coordinator/owner)** | Everything — the full venue-wide month/week/day view across every booking, every capability in §4. This is the perspective that exists today and the one the task's closing framing ("begins and ends every workday there") describes. | None beyond ordinary venue-staff RLS, already in place |
| **Client (couple, in the Portal)** | **Nothing today** — confirmed against `docs/wedding-workspace-architecture.md`'s own `NAV_ITEMS` list: there is no Calendar tab in the Wedding Workspace. If one is ever built, it must be a new *aggregation view* over data the couple can already see elsewhere in their own Portal (their own payment due dates, their own `'couple'`-audience Timeline entries) — never a new data grant, and never venue-wide (they'd see only their own booking's items) | Client-Owned/Shared boundaries already established in `docs/client-workspace-collaboration-architecture.md` — unchanged by this document |
| **Vendor** | **Nothing today.** A future vendor-facing calendar view would show only that vendor's own assignments (`event_vendor_assignments` scoped to their own `vendor_id`) — never another vendor's schedule, never the couple's private data | Same non-duplication principle, applied to the Vendor Portal's existing scoping |
| **Guest** | **Not applicable.** A wedding guest's only surfaces are `/rsvp/[token]` and the public wedding website — there is no Guest Workspace for a calendar to exist inside | N/A |

Building the Client or Vendor perspective is explicitly future scope (§10) — this document names the boundary each would need to respect, not a plan to build either now.

---

## 8. Navigation

**The mechanism already exists — extend it, don't replace it.** Every `CalendarItem` already carries a `link`; the pattern this document recommends is simply using it consistently and precisely:

- Link to the *specific* owning workspace and, where one already exists, the specific tab or anchor — exactly the hash-deep-linking convention `EventReadinessCard` already established (`/events/{id}#playbook`, `/events/{id}#requests-summary-card`). Calendar should reuse this convention directly rather than inventing a second navigation mechanism.
- **Two existing links are worth tightening, not because they're broken, but because they're the one place Calendar today points at itself instead of an owning feature:** an unassigned `date_hold` (no `lead_id`) and every `calendar_block` both currently link to `/calendar` — a self-referential dead end. A "manage blocks" affordance (or simply opening the block-edit form Calendar already has) is a more honest destination for the one item type Calendar actually owns; an orphaned hold should probably link to the Pipeline list it came from.
- **Never duplicate an editing experience.** Calendar should not grow its own task editor, request editor, or contract editor just because an item happens to appear on it — every item's `link` is the entire interaction Calendar offers beyond viewing. This is the same discipline `docs/luv-platform-intelligence-architecture.md` §5 describes for Luv: read, narrate/visualize, link — never re-implement the destination.

---

## 9. Readiness & Time

Three distinct questions over the same underlying facts, none of which should collapse into another:

- **Calendar answers: when.** How many days away is this. Calendar is uniquely positioned to compute this for *any* dated item, since collecting dates is its entire job — and per the same principle `docs/luv-platform-intelligence-architecture.md`'s Feature Completion Contract already applied to Timeline ("no 'days until event' awareness of its own... must compute from `event.eventDate`, not from Timeline"), this proximity computation belongs to Calendar precisely because no owning feature tracks it either.
- **Event Readiness answers: is this okay.** The four-status judgment (`complete`/`needs_attention`/`waiting`/`not_started`) stays entirely Event Readiness's, computed exactly as `lib/readiness/compute.ts` already does it.
- **Luv answers: why does this matter.** The narrative layer, per the reconciliation's own model.

**What "urgency changes over time" means for Calendar specifically, without inventing readiness logic:** Calendar may group or visually weight items by *proximity alone* — today / this week / this month / later — a purely temporal grouping that requires no judgment about whether something is actually a problem. It must not let that grouping imply a status Event Readiness hasn't already assigned: an item "due today" is not automatically a Risk-kind fact (per `docs/luv-platform-reconciliation.md` §4's observation model) merely because it's close in time — whether it's actually overdue, blocked, or fine is a question only the owning feature (surfaced through Event Readiness) can answer. Calendar's proximity grouping and Event Readiness's status badge are two different axes on the same item, and a UI showing both must keep them visibly distinct rather than merging "close in time" with "needs attention" into one signal.

---

## 10. Future Vision

No implementation detail — only where each of these already has a natural seam:

- **Daily Briefing.** Already designed in `docs/luv-platform-reconciliation.md` §4/§5 as reading Calendar's own upcoming-items aggregation. This document adds nothing new here beyond confirming Calendar is the correct, and only, source for that feed.
- **Weekly Planning.** The Week view's natural extension — a coordinator's Monday-morning ritual, plausibly paired with a print/export affordance mirroring Timeline's own existing print/PDF pattern for a physical, shareable weekly op-sheet. Not designed here beyond naming the seam.
- **Operational Forecasting.** Cross-month, venue-wide pattern-spotting ("March is unusually booking-dense this year") is *already built*, in `lib/luv/memory-service.ts`'s seasonal-pattern observations. Calendar should not become a second forecasting engine; it should remain a clean, queryable data source the existing memory/insights layer draws from, with forecasting narration staying entirely Luv's job.
- **Cross-event coordination.** Multiple bookings sharing a date or resource is something Calendar can *visualize* (two `event` items on the same day) the moment it renders more than one item per cell — but *detecting* a genuine conflict (e.g., Inventory over-allocated across two concurrent events) is Inventory's own computation to expose, exactly as `docs/luv-platform-intelligence-architecture.md` §7 already named as Inventory's one real gap ("no venue-wide, cross-booking stock-level view exists today"). Calendar surfaces the coincidence; it does not compute the conflict.
- **Resource utilization.** Same shape: Calendar visualizes if and when Inventory or Availability expose a utilization-over-time function. It does not compute utilization itself.

---

## Closing constraint, restated

This document's every recommendation is answerable against one test: does it help Calendar answer *"what should happen on this date"* without turning it into *"where do I edit this information"*? Every new item type in §2 comes from a field an owning feature already has (or will have); every relationship in §5 comes from a foreign key that already exists; every piece of "intelligence" in §6 and §9 is something another system already computes, with Calendar only ever supplying the time axis. Nothing in this document asks Calendar to become a second Planning board, a second Timeline, or a second Task list.

---

*End of document. No implementation, migration plan, or code is proposed — see task scope.*
