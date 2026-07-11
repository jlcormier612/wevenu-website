# Communication Platform — Phase 1: Architecture Review & Domain Model

**Status:** Design only, per explicit instruction — no code in this document. Phase 2 (UX/workflow design) and Phase 3 (implementation) both wait on this being reviewed.
**Checked against:** `docs/product-strategy-charter.md`, `docs/engineering-standards.md` (Standards #9, #10, #11, #12 all apply directly here), `docs/architectural-debt-review-checklist.md`.
**Method:** every claim below is traced to the actual code, not inferred — including one item I could not verify as requested, named plainly rather than guessed at (see "QuickCloud," below).

---

## QuickCloud — flagging before anything else, rather than guessing

I searched this machine for "QuickCloud" to review the CRM implementation you referenced. I found one project by that name (`~/website/quickcloud-nextjs`), and it's a marketing website for a mainframe-modernization/migration consultancy — AS400 migration, COBOL, RACF, app replatforming. It has no CRM functionality at all: no leads, no clients, no messaging, no templates, no sequences. I don't believe this is what you meant, and I'd rather say so than fabricate "reusable patterns" from a codebase that doesn't actually have the capability you're asking about. If you're thinking of a different project or a product you've used elsewhere, point me at it and I'll fold a real review into this document; everything else below stands on its own without it.

---

## 1. Current architecture, verified

**There are two entirely separate messaging systems live in the product right now, and which one a venue experiences today is decided by a feature flag that defaults off.**

### 1a. The legacy system — what almost every real venue experiences today

`lib/messaging/*` + `components/messaging/messages-section.tsx` — the Lead/Client detail page's "Messages" tab. This is a genuine email composer: subject line, body, send button. `lib/messaging/service.ts` calls `sendEmail()` (Resend) directly. **Every send creates a new `message_threads` row** — there is no concept of an ongoing thread, just a pile of one-off sends. This is exactly what you described: the product currently *is* an email composer here, because that's literally what this screen does.

### 1b. The new system — built, partially shipped, gated behind `venue.conversationExperienceEnabled`

Program 2 already designed and substantially built what you're calling the Communication Timeline, under the name **Conversation**. This is not a proposal — it's real, running code, verified:

- `conversations` + `conversation_messages`, anchored to `relationship_id` (not to Lead or Client — a returning couple's second inquiry lands in the *same* conversation as their first wedding).
- One thread per relationship, channel-tagged per message (`email | sms | portal | internal_note | phone_log | voicemail | push`), unified unread counts, real-time-ready.
- Already wired into a real UI (`app/(app)/messaging/conversation-inbox.tsx`, gated by the flag) — `docs/conversation-experience-cutover.md` is a complete, previously-approved UX design for exactly this, with a staged, reversible rollout plan (dogfood → opt-in beta → default-on → retirement of the legacy tables) that **has not yet progressed past its early stages** for real venues.

**The critical gap, verified by reading the actual RPC (`send_conversation_message`):** choosing a channel today only *labels* the stored message — it does not *deliver* through that channel. Send a portal message and the couple sees it (real, live). Tag a message `email` or `sms` and it is only ever written to `conversation_messages`; no email is sent, no text is sent. Only `portal` is actually a live delivery channel today. This is the single most important finding in this review, and it reframes your whole ask: **the "Communication Timeline" you're describing already exists as a real, designed system** — what's actually missing is delivery fan-out (making non-portal channels really send), templates, sequences, and automation on top of it. Rebuilding the timeline itself would be exactly the "duplicate experience" this program's own checklist exists to catch.

### 1c. Everything else already built and directly relevant

| Capability | Where | Reuse for |
|---|---|---|
| Generic, working email send (Resend, reply-to threading, **open/click tracking already wired to a webhook** producing `lead_signal_events`) | `lib/email/send.ts`, `app/api/messaging/webhook` | The one send primitive every channel and every analytics "open rate" number should run through |
| Notification Engine — cron-driven, `task_reminders`, already the sanctioned single scheduler (ADR-0003) | `lib/notifications/engine.ts` | Automation's wait-conditions and scheduled sends — **do not build a second scheduler**, per your own instruction and per standing architecture |
| `determineChannel()` — a **named, already-anticipated stub**: "Sprint 44 implementation: all channels are email... Future: coordinator → in_app for low-priority, email for high-priority; couple → email, sms for day-of/urgent; vendor → email, sms when SMS built" | `lib/notifications/types.ts` | This is your "Communication Preferences → influences automation" ask, already sketched in a comment, waiting for SMS to exist and for real preference data to route through it |
| Luv drafting — **already real, already spans Lead and Client stages**: `follow_up_email`, `follow_up_text` (SMS drafting is already anticipated in the type, even though SMS can't be sent yet), `next_steps`, `timeline` for Leads; `welcome_email`, `planning_kickoff`, `payment_reminder`, `final_details` for Clients. Coordinator reviews, edits, sends manually — Luv never sends. | `lib/luv/drafts.ts`, `lib/luv/client-drafts.ts`, `components/luv/luv-draft-panel.tsx` | This *is* "Ask Luv to Draft" and half of "Luv suggests templates" already, proven across two relationship stages — extend it, don't reinvent it |
| Cross-entity search (`search_global`, the ⌘K palette) already designed to extend to messages, resolving to Relationships rather than competing message rows | `components/shell/command-palette.tsx`, `docs/conversation-experience-cutover.md` §8 | Searching Communication Timeline content |
| `vendor_notification_preferences` already has unused `channel_email`/`channel_sms`/`channel_push` columns | confirmed in the notification redesign work | The schema shape for per-relationship channel/preference already exists on the vendor side; the same shape generalizes to Leads/Clients |
| Milestone-as-chapter + template-picker interaction pattern, twice-proven (Day-of Timeline, Planning Playbook Builder) | `components/events/timeline/*`, `components/playbooks/playbook-builder.tsx` | The natural UI shape for a Sequence/Journey builder — steps as chapters, a starter-template picker, inline editing — not a new interaction model |

### What genuinely does not exist anywhere today

- **A template library.** `lib/notifications/templates.ts` builds system-notification bodies (not venue-authored, not editable). The vendor invite email is a hardcoded HTML string. Nothing lets a venue author, name, categorize, or reuse a message template.
- **Sequences/Journeys** — enrollment, triggers, wait conditions, branching, exit conditions. Zero existing code, zero schema. This is genuinely new.
- **A general automation event bus.** Individual signal tables exist (`lead_signal_events`, `engagement_events`) that *could* become trigger sources, but nothing wires "Contract Signed" or "Tour Scheduled" to a generalized action dispatcher today. What exists is bespoke per-feature (e.g., `triggerAutoComplete` for Playbook tasks).
- **SMS**, as an actual channel. No provider (no Twilio, nothing) is configured anywhere.
- **Communication analytics as a surface.** The raw signals exist in places (email open/click → `lead_signal_events`, `engagement_events`), but there's no aggregated reporting anywhere — no reply-rate, no template performance, no journey-completion view.

---

## 2. Architectural Debt Review pass (per `docs/architectural-debt-review-checklist.md`)

Running the standing four-pattern check against Communication specifically, since a system this size deserves it before any new design is layered on:

- **Duplicate Truth**: not yet, but the seam is exactly where one would form. If Sequences/Automation get built against the *legacy* `message_threads` system instead of `conversations`, you'd immediately recreate the two-systems problem one layer up. **The domain model below assumes Communication Platform is built entirely on `conversations`/Relationship, and the legacy system is left to finish its already-approved retirement (`docs/conversation-experience-cutover.md`) rather than gaining new capability.**
- **Collected But Not Used**: two live instances already found above — the channel tag that doesn't deliver, and `LuvDraft.draftType: "follow_up_text"` anticipating SMS that doesn't exist. Building SMS delivery is exactly what would finally spend both.
- **Duplicate Experience**: the legacy Messages tab vs. Conversation is the textbook case, already named and already has an approved retirement plan — not a new finding, but worth restating so Communication Platform work doesn't accidentally invest further in the system that's meant to go away.
- **Silent Failure**: real and current — a coordinator on the new Conversation experience choosing "Email" as the channel today gets no error, no warning, and no email. It looks like it worked. This should be treated as a bug to close (either hide non-functional channels from the selector until delivery is real, or implement delivery) independent of any Phase 2/3 timeline, since it's a live trust risk the moment more venues are on the new flag.

---

## 3. Recommended long-term domain model

Applying Standard #11 (Definition vs. Execution) throughout, since it's the exact shape this whole platform needs and this project already has a proven vocabulary for it:

### Communication Timeline = Conversation, extended — not rebuilt

**Recommendation: there is no new entity here.** `conversations`/`conversation_messages`, anchored to `relationship_id`, already is the Communication Timeline. The work is: (a) finish what `docs/conversation-experience-cutover.md` already designed and approved, and (b) make every channel actually deliver, not just label. Internal notes, attachments, and "scheduled/automated message" all become rows in the same `conversation_messages` table with a `sender_type`/`channel` that already accommodates them (`internal_note` already exists as a channel value; a scheduled/automated message is simply a message whose `sender_type` is `system` and which was inserted by a Journey or Automation rather than a person, typed the same as anything else). This is the direct application of "canonical objects own truth" (Standard #10) — Communication Timeline doesn't get its own storage, it *is* the storage everything else writes into.

### Template Library — new Definition-side entity, global to the venue

A `communication_templates` table: `venue_id`, `name`, `purpose` (the categories you listed — Lead Response, Tour Scheduling, etc., as a fixed-but-extensible set, same shape as `TASK_CATEGORIES`), `channel_hint` (which channel it's meant for, not a hard restriction), `subject` (nullable, email-only), `body` (with personalization tokens resolved against Relationship/Lead/Client/Event/Vendor data at send time), `is_active`. This is **Definition**; a template inserted into a compose box and then edited before sending is not a live reference to the template (same rule as Playbook tasks copying into `event_tasks`) — once inserted, it's just message content the coordinator is editing, not a synced instance.

### Sequences/Journeys — new Definition + Execution pair, anchored to Relationship

- **Definition**: `communication_journeys` (name, description, is_active) + `journey_steps` (ordered, each referencing a Template, a wait condition, and optional branch/exit conditions) — the exact same "milestones as ordered chapters" shape as Planning Playbooks, reused rather than invented.
- **Execution**: `journey_enrollments`, one row per Relationship enrolled in a Journey, tracking current step and enrollment/exit reason. **This is where the Notification Engine gets reused, not replaced**: a wait condition becomes a `task_reminders`-shaped scheduled entry (or a direct extension of that same table/engine) that, when due, advances the enrollment and sends the next step's message via the Timeline. Exit conditions (Tour Scheduled, Reply Received, Booked, Lost, Opt Out, Manual Exit) are evaluated the same way Playbook auto-complete triggers already work — a named trigger checked against real state, not a parallel polling system.
- Anchoring Enrollment to **Relationship**, not Lead: a Journey needs to span pre-conversion (Lead/Opportunity) through post-event (Client/Event) exactly the way Conversation already does, for the identical reason (Standard #1 — the enduring identity is Relationship, Lead is an Opportunity within it). This avoids a Journey silently resetting or duplicating when a Lead converts to a Client, mirroring the decision already made for Conversation.

### Automation — an event bus that calls the same three things, never a fourth scheduler

Automations are a mapping: `trigger_event → (Template | Journey enrollment | Notification)`, evaluated by listening to the same signal tables already producing `lead_signal_events`/`engagement_events` (extended with any missing trigger names from your list — Contract Signed, Payment Received, etc. mostly already exist as domain events somewhere, they just don't fan out to a generalized listener yet). **Automation should have zero scheduling logic of its own** — every "send this now" or "wait N days" resolves to the Notification Engine, per your own explicit instruction and per ADR-0003.

### Communication Preferences — extends the vendor-side pattern already in schema

`channel_email`/`channel_sms`/`channel_push` already exist, unused, on `vendor_notification_preferences`. The same three-column shape, plus `preferred_channel` and `best_time_to_contact`, belongs on the Relationship (or a per-relationship preferences row) so one mechanism covers Leads, Clients, and Vendors rather than three bespoke ones — directly the same "don't recreate what already exists in a sibling table" instinct that shaped the vendor pricing/notes decision.

### Analytics — projections, not a new source of truth

Every number you listed (open rate, reply rate, response time, conversion rate, journey completion, template performance) is a *computed view* over Conversation + Journey Enrollment + the existing email tracking webhook — never its own stored ledger. This is Standard #10 applied directly: a "Template Performance" screen holds no writable field of its own; it aggregates `conversation_messages` sent from that template, joined to reply latency and outcome, computed at read time.

### Luv Insights (the communication-coach idea) — real, and cheaper than it looks

Everything Luv would need already has a home once the above exists: "usually replies by text within 2 hours" is a read over `conversation_messages` grouped by channel and relationship; "hasn't been contacted in 9 days" is `last_message_at` off the Conversation itself; "Proposal Follow-up template has a 62% response rate" is the Template Performance projection above, filtered to one template; "recommend sending Tour Check-In today" is Luv's existing draft-suggestion pattern (`lib/luv/drafts.ts`) pointed at a Template instead of generating free text. This should be built *after* the four systems above exist, not alongside them — it's a consumer of their data, and building it first would mean inventing the same data twice.

---

## 4. Open questions to resolve before Phase 2 (naming rather than assuming)

1. **Activity Timeline vs. Communication Timeline.** `docs/conversation-experience-cutover.md` already drew this line deliberately: Conversation is where you *talk* (messages only); Activity Timeline (not yet built) is where you *understand* (messages interleaved with Contract/Payment/Event milestones). Your Phase 1 request's "Communication Timeline" matches Conversation exactly, not Activity Timeline. Worth confirming that's still the right split before Phase 2 UX work, since "everything related to that relationship in one place" (your own phrasing) could be read as wanting the merged view instead.
2. **Where does Conversation-cutover rollout stand relative to this new work?** Building Templates/Journeys/Automation on top of a system still in early dogfood rollout is fine architecturally (it's the right foundation), but it does mean Communication Platform's real-venue availability is gated on that rollout continuing, not just on new Phase 3 work landing.
3. **Should the "channel doesn't deliver" gap be fixed now, independent of this program?** Recommended yes, per the Silent Failure finding above — it's a live trust risk today, not a Phase 3 nice-to-have.

No code has been written. This is the review and domain-model recommendation requested for Phase 1.
