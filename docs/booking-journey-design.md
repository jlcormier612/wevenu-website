# Booking Journey & Client Lifecycle — Design

**Status:** Design only, no code. Do not implement until this and the Client Lifecycle redesign are approved, per explicit instruction.
**Checked against:** `docs/product-strategy-charter.md` in full. Reuses `docs/planning-playbooks-design.md`, `docs/notification-system-redesign.md`, `docs/conversation-lifecycle-design.md`, and `docs/contract-lifecycle-design.md` throughout rather than inventing parallel mechanisms — this is the point in the program where those four previously-separate design efforts converge into one operational journey.

---

## Grounding: what's actually there today

- **Lead status is already close to venue-language**, not raw CRM jargon: `new → contacted → qualified → proposal_sent → won/lost/cancelled` (`lib/leads/constants.ts`). The gap isn't terminology so much as granularity — "Tour Scheduled" and "Tour Completed" don't exist as distinct states; both collapse into "contacted" today, even though `tour_appointments` already tracks the real underlying fact.
- **Zero automation exists on any lead status change today.** I checked `updateLeadStatus` directly — it logs an activity and fires one scoring signal on `won`. No email, task, calendar event, or notification fires from a stage change today. This isn't a redesign of broken automation — it's genuinely new capability, worth stating plainly rather than implying something is being fixed.
- **The Booked → Client transition today creates exactly three things**: the Client record, the Event (if a date is set), and a couple portal session (`lib/clients/service.ts`'s `convertLeadToClient`). It does **not** create a payment schedule, apply a Planning Playbook, or generate a contract. Those are all separate, fully manual steps a coordinator does afterward today.
- **Payment schedules have no template concept at all** — every one is hand-built, line by line, per client, in `new-schedule-form.tsx`. This is a real gap relative to Playbooks, which already have templates and seed data to build on. Naming this now so it isn't mistaken for "reuse an existing template" work later — it's the one piece of net-new infrastructure this design actually requires, beyond `playbook_milestones` already scoped in the Planning Playbook work.
- **There is no existing pipeline/kanban view to preserve or migrate** — leads today are a sortable flat list. The Booking Journey redesign isn't replacing a visual pipeline; it's the first one.

---

## 1. The default Booking Journey, in venue language

| Stage | What it means | What's already real underneath |
|---|---|---|
| **Inquiry** | A couple reached out | `leads.status = 'new'`, unchanged |
| **Tour Scheduled** | A tour is on the calendar | `tour_appointments` row exists — already tracked, just not reflected as its own stage |
| **Tour Completed** | The tour happened | `tour_appointments.status = 'completed'` — same |
| **Proposal Sent** | Pricing/contract sent | `leads.status = 'proposal_sent'`, unchanged |
| **Decision Pending** | Ball is in the couple's court | New — the gap between "we sent it" and "they said yes," currently invisible |
| **Booked** | They said yes | `leads.status = 'won'` → triggers the Client transition below |
| *(Lost / Cancelled stay as-is — they're already plain language)* | | |

**"Contacted" and "qualified" collapse into the tour stages** for the default journey — a venue doesn't think "qualified," they think "did we show them the space yet." This isn't a data loss: `contacted`/`qualified` remain valid states underneath for venues that don't do tours (corporate bookings, for instance), addressed directly in the customization section next.

## 2. Customization without sacrificing reporting

This is the same shape of tension already resolved once this program, for Task categories and Playbook milestones: **a small, fixed canonical set drives reporting and automation eligibility; venue-facing labels and ordering are fully theirs.**

Concretely, two layers:

- **Canonical stage** (fixed, small, never venue-editable): `inquiry → tour → proposal → decision → booked` (plus `lost`/`cancelled` as terminal, non-sequential states). Every reporting rollup, every conversion-rate metric, every cross-venue benchmark Wevenu HQ might ever compute is keyed to this list, permanently.
- **Venue-facing stage** (fully customizable): a venue can rename "Tour Scheduled" to "Site Visit Booked," reorder within reason, merge tour-scheduled/tour-completed into one visible stage if they don't need the distinction, or add a sub-stage — but every venue-facing stage maps to exactly one canonical stage underneath. A venue building a corporate-events-only journey with no tour step simply skips the tour canonical stage in their own labeling; the canonical stage still exists for any lead that does happen to have one (a `tour_appointments` row is a fact about the lead regardless of what the venue calls their pipeline).

This is the identical pattern already recommended for Playbook milestones (configurable labels, fixed underlying model) — reused here rather than invented a second time, directly serving System of Record and "reuse before creating."

## 3. Automations per stage

None of this should be a new automation engine. Every stage transition below is a producer into infrastructure this program has already designed:

| Stage entered | Correspondence | Tasks | Calendar | Notifications |
|---|---|---|---|---|
| **Inquiry** | Conversation auto-provisions (already automatic per Program 2) | — | — | Business Critical: new inquiry (already real) |
| **Tour Scheduled** | Confirmation message (Conversation) | — | Tour appears on Calendar (already real, Phase 1a) | Planning Progress |
| **Tour Completed** | — | Follow-up task suggested (Luv-proposed, not automatic) | — | — |
| **Proposal Sent** | Contract delivery (already designed — `docs/contract-lifecycle-design.md`) | Reminder task if no response in N days | — | Business Critical, escalating if unanswered (reuses the escalation model already designed) |
| **Decision Pending** | — | — | — | The escalation *is* this stage's whole job — an inquiry sitting in Decision Pending past a threshold is exactly the "unanswered and time-sensitive" example already named in the notification redesign |
| **Booked** | Welcome message (Conversation) | Full task set below | Event confirmed on Calendar | Team Activity: new booking |

Every cell above already has a home in a document written earlier this program. Nothing here is a new pipe — it's new *senders* using existing pipes.

## 4. The Booked → Client transition

**System proposes. Human confirms** applies most directly right here — this is the highest-stakes automatic action in the whole journey, and it should never feel like the software did something behind the venue's back.

Proposed sequence, on marking a lead Booked:

1. **Client record created** — already automatic today, unchanged.
2. **Event created** — already automatic today when a date exists, unchanged.
3. **Couple portal invitation sent** — already automatic today, unchanged.
4. **Planning Playbook applied** — the system **proposes** the best-matching playbook (per `docs/planning-playbooks-design.md`'s dynamic assignment) and shows which one and why; the coordinator confirms or picks another from the same small card list used at first-run. Never silently applied without being shown.
5. **Payment schedule proposed, not created** — the one genuinely new capability needed here: a **payment schedule template** (the same shape as a Playbook template — a reusable, venue-defined default: deposit + N installments + final balance, as percentages or fixed amounts, with relative due dates). The system proposes the venue's default template against this event's actual contract total; the coordinator reviews and confirms before it becomes real payment records. This is new infrastructure, named plainly as such rather than implied to already exist.
6. **Contract state check** — if a contract wasn't already sent/signed before reaching Booked (some venues book verbally first, formalize after), the system flags this as the first task in the applied playbook rather than silently assuming one exists.

All five of steps 4–6 appear as **one confirmation screen** at the moment of booking — "Here's what we're about to set up for Emma & James" — not five separate prompts. One human decision, covering several proposed actions, is the right size for this moment; five tiny confirmations would themselves violate Reduce Cognitive Load.

## 5. The Client lifecycle, redesigned — and unified with Planning Playbooks

The current `planning / confirmed / complete / cancelled` statuses are generic in exactly the way the request names. The redesign:

**The Client's lifecycle phase and the applied Planning Playbook's current milestone should be the same fact, not two.** This is the single most important recommendation in this document. Today, if built naively, a Client would have its own `status` field *and* a Playbook milestone tracking progress — two state machines that can silently disagree, the exact shape Engineering Standard #9 and System of Record both exist to prevent. Instead:

- A Client's lifecycle phase **is** whichever milestone its applied Playbook is currently in — Booking, Planning, Vendor Selection, Final Planning, Wedding Week, Event Day, Post-Event (the same milestones already designed, reused verbatim, not paralleled).
- Advancing happens the same way task completion already drives Luv's readiness scoring — when a milestone's required tasks are done, the Client's visible phase advances. This is a computed/projected fact, not a separately-set field, matching the same "Calendar projects, doesn't own" discipline already established for Calendar Entry and Conversation status.
- "Complete" and "Cancelled" remain genuinely terminal states outside the milestone sequence, not milestones themselves — an event either finished its playbook and happened, or the relationship ended before that, and those are different kinds of endings worth keeping distinct.

This single decision is what makes "Booking Journey" and "Client Lifecycle" actually one continuous journey instead of two adjacent systems that happen to hand off at one point — a lead becomes a client, and the client's own status is thereafter just wherever their playbook says they are. One phase, one source of truth, visible identically to the coordinator's dashboard, the couple's portal, and Luv's own reasoning.

---

## What's genuinely new here, stated plainly

Everything else in this document is reorganization and unification of things already designed. Two things are not:

1. **Decision Pending** as a real, distinct stage with its own escalation behavior — new, but it's a direct application of the already-designed escalation model, not a new mechanism.
2. **Payment schedule templates** — genuinely new infrastructure, the payments-side equivalent of what Playbook templates already are for tasks. Recommend building it as the same shape (a reusable template + apply-to-event action + review-before-commit), not a bespoke design.

No code has been written. This is the Phase 1 deliverable requested — Booking Journey and Client Lifecycle together, ready for review before implementation begins.
