# Product Backlog — Discoveries

**Status:** Started 2026-07-08. This is where legitimate future product opportunities go when implementation work uncovers them — as distinct from defects (which get fixed or logged against the feature they broke) and cleanup (which either gets finished in the same pass or explicitly named as accepted debt). The point is to preserve a valuable idea without letting it expand the scope of whatever surfaced it.

**When something belongs here vs. somewhere else:**
- A defect (something that's supposed to work today and doesn't) → fix it now, or if deferred, name it explicitly in the review it came from.
- Approved cleanup directly related to the current feature → finish it now, per the Debt Complete gate.
- A real capability nobody has asked to build yet, surfaced as a side effect of other work → here.

Each entry: **Feature**, **Problem**, **Opportunity**, **Suggested Direction**, **Dependencies** (if any), and where it was discovered.

---

## Vendor Check-In

**Discovered:** 2026-07-08, while removing the legacy `/v/[token]` vendor portal.

**Problem:** `event_vendor_assignments.checked_in_at` and `.setup_complete_at` are real columns, read in two places today (the coordinator's event-vendor assignment badges, and the vendor's own event detail page) — but as of the legacy portal's removal, **nothing anywhere writes to them.** The only writer was the legacy portal's token-based check-in route, which was confirmed dead and removed along with everything else in that system. This isn't a regression the cleanup caused — those fields had no *real* writer before either, since the legacy portal was already non-functional — but removing the dead code makes the gap unambiguous rather than theoretical.

**Opportunity:** A real, live check-in mechanism would make the "Arrived" / "Setup done" badges venues already see on event-vendor rows actually mean something, and would give vendors a concrete, low-friction action on event day.

**Suggested Direction:** Two candidate entry points, not mutually exclusive — a vendor-side "I've arrived" / "Setup complete" action inside the real, authenticated `/vendor/events/[id]` workspace (`lib/vendor-events/service.ts` already reads these fields, just needs a paired writer), and/or a coordinator-side manual toggle on the event's vendor assignment row for vendors who won't self-serve. Worth deciding which (or both) based on how venues actually run event-day operations today, not assumed.

**Dependencies:** None blocking — both fields and both read paths already exist; this is purely a missing writer.

---

## Planning Playbook Sync-to-Existing-Events

**Discovered:** 2026-07-08, documenting how Planning Playbooks evolve over time (`docs/planning-playbook-evolution.md`).

**Problem:** Editing a Planning Playbook template never propagates to events it was already applied to — by design, this protects existing events from being silently altered. But today there's *no* way at all, even manual, to bring an already-booked event's tasks up to date after a template improves. A venue that fixes something in "Standard Wedding" has no path to apply that fix to the three weddings already using it.

**Opportunity:** The original Planning Playbooks design (`docs/planning-playbooks-design.md`) named this directly — a future/upcoming/this-event confirmation choice when editing a playbook already in use, matching "System proposes. Human confirms." exactly. It just hasn't been built, and shouldn't be built speculatively (see that document's own recommendation) until there's a real, felt need for it.

**Suggested Direction:** Wait for signal that this is an actual want before designing the three-way (future/upcoming/this-event) prompt.

**Dependencies:** None remaining. The related defect this depended on — `applyPlaybookToEvent` having no guard against being called twice on the same event — was fixed 2026-07-08 (`event_playbook_applications`, per `docs/planning-playbook-evolution.md`). That fix deliberately blocks a second application outright rather than reconciling one; if this item is ever prioritized, the sync mechanism would still need its own reconciliation logic rather than reusing today's guard as-is.

---

## Client Model Has No Organization/Company Name

**Discovered:** 2026-07-08, building the personalized Client Planning title ("Nicole & Colby's Planning" / "Acme Annual Conference Planning" / "Spring Gala Planning" — Product Decisions, Planning Playbook Revision).

**Problem:** The `Client` type (`lib/clients/types.ts`) only carries `firstName`/`lastName`/`partnerFirstName`/`partnerLastName`/`eventType` — there is no company, organization, or group name field. Wevenu already supports non-couple event types (`corporate`, `gala`, and others in `EVENT_TYPES`), but nothing in the data model captures who the "client" actually is for those events beyond a person's own name.

**Opportunity:** True event-specific personalization for non-couple event types — the stated product direction — needs a real name to personalize with. Today the Client Planning title formatter (`formatClientPlanningTitle`, `lib/playbooks/constants.ts`) falls back to the event's own free-text name (e.g., "Acme Annual Conference Planning" only works if the venue happened to name the event that) rather than a structured organization name a venue enters once on the client record itself.

**Suggested Direction:** Add an optional `organizationName` (or similar) field to the Client model, used in place of person names when `eventType` isn't a couple-oriented type. Purely additive — doesn't change any existing couple-oriented behavior.

**Dependencies:** None blocking. `formatClientPlanningTitle`'s event-name fallback is a reasonable, honest interim behavior — not a broken state — while this is decided.

---

## Release Client Planning to the Couple as a Deliberate Action

**Discovered:** 2026-07-08, Product Decisions — Planning Playbook Revision (explicitly framed as a future exploration, not required now: "Eventually I'd like the Couple Planning experience to feel like something the venue intentionally releases to the couple, rather than simply applying a template behind the scenes. Please continue exploring that interaction model during implementation.")

**Reaffirmed:** 2026-07-08, Planning Implementation Review: "I continue to think Client Planning should eventually become something the venue intentionally releases to the client rather than automatically exposing immediately after application. I'd like to keep this as a future product enhancement until we design the complete planning onboarding experience." — explicitly not a blocker for this implementation.

**Problem:** Today, applying a Client Planning playbook to an event immediately makes it live — there's no venue-controlled moment of "this is ready, now show it to the couple." A venue mid-way through customizing a Client Planning playbook for a specific event has no way to keep that in a draft/private state before the couple sees it.

**Opportunity:** A distinct "release" action would let a venue apply and adjust a Client Planning playbook privately, then deliberately hand it to the couple when it's actually ready — reinforcing the trust philosophy ("System proposes. Human confirms.") at the couple-facing boundary as well as the venue-facing one.

**Suggested Direction:** Not yet designed. The user has now tied this explicitly to a broader "complete planning onboarding experience" design pass — this shouldn't be designed in isolation as a single release toggle, but as part of that larger onboarding flow whenever it's scoped.

**Dependencies:** None. Purely additive to the existing apply flow — wouldn't require changing how Venue Workflow applications behave.

---

## Planning Overview — "Are We Ready?"

**Discovered:** 2026-07-08, Planning Implementation Review (explicitly framed as a future enhancement, not required now): "As Planning continues to mature, I'd like the event to open into a Planning Overview rather than simply a task list. The primary question Planning should answer is: Are we ready? For both the client and the venue. I believe this will eventually become the natural home for progress, readiness, overdue work, upcoming milestones, and Luv guidance."

**Problem:** The event's Planning tab today opens directly into the task list (two apply rows, then Overdue/Blocked/Upcoming/Complete/Waived groups). That's an accurate record of individual tasks, but it doesn't answer the one question a coordinator or couple actually opens the tab to ask — "are we in good shape for this event or not" — without reading through the groups themselves.

**Opportunity:** A dedicated Planning Overview, sitting above the task list, would give both audiences a single answer to "are we ready?" — surfacing readiness/progress for Client Planning and Venue Workflow independently (never merged into one score, consistent with the two-workflow model — see `docs/planning-playbooks-experience-iteration.md`), overdue work, upcoming milestones, and Luv guidance, before either audience has to scan the raw list.

**Suggested Direction:** Not yet designed. Natural next step once there's real usage of the current task-list-first Planning tab to inform what "ready" should actually mean at a glance — likely builds on the milestone-progression and Related Context concepts already validated in `docs/planning-playbooks-experience-iteration.md`, plus the existing Luv drafting capability (`lib/luv/`).

**Dependencies:** None blocking. Builds on the current Planning tab (`components/playbooks/event-task-list.tsx`) and the readiness computation already in `lib/playbooks/repository.ts` (`computeEventReadinessFromPlaybook`) rather than requiring new data.

---

## Planning Health

**Discovered:** 2026-07-09, Planning Experience Implementation Review (explicitly framed as a future enhancement, not current-implementation work): "Eventually I'd like Planning to surface an overall health assessment of the event rather than focusing solely on task completion percentages."

**Problem:** Every readiness signal Planning has today — the two independent progress bars, "On track" / "N tasks need attention," the milestone stepper — is computed purely from task completion within Planning itself. That's an accurate picture of the checklist, but not necessarily an accurate picture of whether the event is actually in good shape: a Client Planning task can be marked complete while its related payment is still outstanding, or a Venue Workflow task can look "on track" while the vendor it depends on hasn't confirmed.

**Opportunity:** A real "health" signal needs inputs Planning doesn't own — payment status, vendor confirmation state, communication responsiveness, Luv's own read on the relationship. This is the natural next evolution named in the same review that closed out the venue-side Planning Experience work: "I do not want to continue expanding Planning in isolation. I believe the feature has reached the point where additional value will come primarily from tighter integration with Communication, Payments, Vendors, and Luv rather than adding more Planning capabilities." Planning Health is what that integration looks like once it's real, not a bigger Planning-only computation.

**Suggested Direction:** Not yet designed, and shouldn't be scoped as a Planning-only feature — depends on what "tighter integration with Communication, Payments, Vendors, and Luv" actually means once that direction is explored. Likely supersedes or subsumes the still-undesigned "Planning Overview" item above rather than sitting alongside it, once cross-system signals exist to surface.

**Dependencies:** Payments status, Vendor confirmation state, and Communication signals aren't currently exposed in a form Planning could consume — this is blocked on those integrations existing first, not on anything inside Planning itself.

---

## No Venue-Side Guest List View

**Discovered:** 2026-07-10, building Interactive Planning Tasks (Vendor Management — Next Iteration), specifically the "Complete guest list" → opens the Guest List example.

**Problem:** The real Guest List feature (adding guests, RSVPs, dietary needs, groupings — `components/portal/guest-section.tsx`, `/api/portal/guests`) only exists in the **couple portal**. The venue side of an event has no equivalent view — only a single read-only `guestCount` number on the Overview tab. A coordinator can't see or manage the actual guest list for an event from the venue app at all today.

**Opportunity:** A venue-side guest list view would let a coordinator see RSVP status, dietary needs, and groupings without asking the couple or opening a separate export — and would give the new "Complete guest list" Interactive Planning Task action a real destination instead of pointing at the Overview tab as an interim stand-in.

**Suggested Direction:** Not yet designed. The underlying data already exists (couple portal reads/writes real guest records) — this is a venue-side read (and likely edit) view on top of data that's already there, not a new data model.

**Dependencies:** None blocking — purely additive. `lib/playbooks/constants.ts`'s `TASK_ACTION_TYPES` maps `guest_list` to the Overview tab today; update that mapping once a real venue-side guest view exists.

---

## Recommendation Sets

**Discovered:** 2026-07-11, user feedback on the Vendor Management workflow (Import Data screenshot review) — explicitly flagged as a backlog capture, not to be implemented yet.

**Problem:** Today, recommending vendors to an event (`event_vendor_recommendations`, `components/events/vendors/event-vendor-recommendations-section.tsx`) means picking vendors from the Vendor Library one at a time, per event. A venue that always recommends the same florist, caterer, and DJ for every standard wedding has to re-select all three individually on every single event.

**Opportunity:** Named, reusable groups of preferred vendors (e.g. "Standard Wedding Vendors," "Budget-Friendly Package") that a coordinator builds once and applies to an event in a single action — directly serving the stated goal of "import once, recommend once, clients select with as few steps as possible."

**Suggested Direction:** Not yet designed. Likely a new `vendor_recommendation_sets` (or similar) table owned by the venue, each holding an ordered list of vendor references, with an "Apply Set" action on the event's Vendors tab that bulk-creates `event_vendor_recommendations` rows — but this needs its own design pass, not assumed here.

**Dependencies:** None blocking — purely additive on top of the existing Vendor Library and Event Recommendations mechanism (Vendor Management — Next Iteration, 2026-07-10).

---

## Planning Template Versioning

**Discovered:** 2026-07-11, user feedback on the "Bring Your Existing Checklist" refinement — explicitly flagged as a backlog capture, not to be implemented.

**Problem:** "Venues will refine templates over time, and future events should use the newest version without changing planning that's already underway" (user's own framing). Part of this already works today: `applyPlaybookToEvent` copies a template's tasks into `event_tasks` at apply-time — a snapshot, not a live reference — so editing a template never silently alters an event already in progress, and any new event applying the template afterward automatically gets the current version. What's genuinely missing is **explicit version tracking**: there's no record of *which* version of a template an already-applied event got, no way to see "this event is running on an older version of Standard Wedding" or to compare what changed since. Closely related to the already-logged "Planning Playbook Sync-to-Existing-Events" item above — that one is about *pushing* updates into existing events; this one is about *knowing* which version an event has, which would likely need to exist first before sync could offer an informed choice.

**Opportunity:** Version awareness would let a venue see, at a glance, which past/current events are running an outdated version of a template, and would give a future sync feature something concrete to diff against ("here's what changed between the version this event has and the current template").

**Suggested Direction:** Not yet designed. Likely a `version` integer (or timestamp) on `playbook_templates`, incremented on meaningful edits, with the version number copied onto `event_playbook_applications` at apply-time (cheap, additive — no new table required for the read side). Deciding what counts as a "meaningful edit" (reordering vs. renaming vs. adding/removing a task) is a real design question, not assumed here.

**Dependencies:** None blocking. Worth designing together with "Planning Playbook Sync-to-Existing-Events" rather than in isolation, since they solve two halves of the same underlying need.

---

## Message Template Library — Phase 1 Follow-ups

**Discovered:** 2026-07-14, user review of the Message Template Library (Communication Platform Phase 1) — explicitly flagged as future-iteration notes, not to be implemented now.

**Problem/Opportunity, five distinct items grouped as given:**
1. **Nav naming** — rename "Templates" → "Message Templates" in the Communication nav section for clarity as other template types (contracts, playbooks, packages) continue to exist alongside it platform-wide.
2. **Venue-editable categories** — the 8 categories (`lib/message-templates/constants.ts`) are a fixed enum today. Eventually a venue should be able to add their own categories beyond the defaults, the way `TaskCategory`/`DocumentCategory` might evolve — not scoped or designed here.
3. **Preview with sample data** — the template editor currently shows raw `{{merge_field}}` tokens in a click-to-copy reference panel (matches Contract Templates' existing pattern) rather than a live preview of what a resolved message actually looks like. A "Preview" mode substituting realistic sample data (a fake client name, a plausible event date) would let a coordinator see what they're actually sending before it's real.
4. **Search + category filtering on the template list** — `/communication/templates` today is a plain grid with no search or filter, fine at low volume but won't scale as a venue's library grows past a handful of templates.
5. **Template Usage visibility** — no way today to see where a given template is actually being used before editing or deleting it. Becomes a real need once templates are consumed by Sequences/Series (Phase 3) and any future Planning-task connection — editing or deleting a template that's actively referenced elsewhere should warn the coordinator first, not silently break something downstream.

**Suggested Direction:** Not designed for any of the five — each is a small, independent addition once picked up; #5 specifically depends on Phase 3 (Follow-Up Series) existing, since there's nothing to "use" a template today beyond the library itself.

**Dependencies:** #5 blocked on Phase 3 shipping (nothing references a template yet). The other four are unblocked, standalone polish on the existing Phase 1 implementation.

---

## Immediate Email Send in Conversations Isn't Real

**Status: Resolved 2026-07-14.** Discovered building Scheduled Sends (Phase 2), fixed before Phase 3 per explicit instruction rather than built around.

**Problem (as found):** The Conversations compose box (`components/conversations/conversation-thread.tsx`) had an "Email" option in its channel dropdown, sitting right next to "SMS" — which, as of this session, sends a real text via Twilio. Selecting "Email" and clicking Send did not call Resend or any real email provider; it only wrote a row to `conversation_messages`, exactly like the "portal" channel does. A coordinator had no way to tell the difference from the UI. `docs/communication-platform-next-phase.md` §5.1 previously stated email "already work[ed] end-to-end through Conversations" — that was inaccurate and was corrected in that document.

**Resolution:** `lib/conversations/service.ts`'s `sendConversationMessage` now calls `sendEmail()` for real when `channel === "email"`, resolving the recipient's address via a new `getConversationRecipientEmail` (`lib/conversations/repository.ts`, reading `venue_customer_relationships.email` directly — no lead/client join needed, unlike phone). The open question about a subject was resolved the same way Scheduled Sends already handles it: no new column on `conversation_messages` (still true for every channel, not just email) — the subject is required client-side, used for the real outbound send, and not persisted separately. The compose UI now shows a Subject field whenever Email is selected, and the Send button is disabled until it's filled in.

**Dependencies:** None — resolved standalone, nothing else needed to ship first.

---

## Scheduled Sends — Future UX Notes

**Discovered:** 2026-07-14, user review of Scheduled Sends (Communication Platform Phase 2) — explicitly flagged as future-iteration notes, not to be implemented now.

**Problem/Opportunity, two items:**
1. **Waiting-reason visibility** — the scheduled-message strip (`ScheduledRow` in `components/conversations/conversation-thread.tsx`) currently shows every pending item the same way, regardless of why it's waiting. Once Phase 3 (Automated Series) ships, a message could be waiting for either reason — a coordinator manually picked a date, or it's queued as a relative-offset step inside a Series — and those are different facts worth showing differently rather than one undifferentiated "Scheduled for…" label.
2. **"Schedule" as an explicit action** — today, scheduling is reached through a small clock-icon toggle next to Send, discoverable but not obvious. Worth considering an explicit "Schedule" button/action alongside "Send" instead, or in addition to the icon.

**Suggested Direction:** Not designed for either. #1 depends on Phase 3 existing (there's no "waiting for a relative date" case until Series ships) — worth designing together with however Series' own pending-step UI ends up looking, not in isolation. #2 is a standalone, unblocked UI polish pass on the existing Scheduled Sends compose flow.

**Dependencies:** #1 was blocked on Phase 3 — Phase 3 (Automated Series) shipped 2026-07-14, so a scheduled row can now genuinely be waiting for either reason (`sequence_enrollment_id` set vs. not). Unblocked, but still not implemented. #2 unblocked.

---

## Automated Series — Post-Booking Mode (Planning-Linked)

**Discovered:** 2026-07-14, scoping decision made during Phase 3 (Automated Series) implementation — not confirmed with the user ahead of time, flagged here for visibility.

**Problem:** `docs/communication-platform-next-phase.md` §3.0 ("Two modes, not one") describes Sequences as having two modes: pre-booking (freestanding, rule-based — "Sales Series", the primary capability) and post-booking (task-linked, "Communication supports Planning" per the Guiding Principle). Phase 3 as built only implements the pre-booking mode. Every sequence is freestanding: it enrolls off a lead-created or lead-stage-changed trigger, or manually, and exits on reply or on booking. There is no way to attach a series (or a single step) to a Planning task, and consequently no "stop on task completion" exit rule — there's no task to attach to.

**Opportunity:** Post-booking communication (payment reminders, planning-meeting nudges, vendor-coordination follow-ups) is exactly the case the Guiding Principle names — "Planning remains the primary operating system after booking" — and today those still require a coordinator to remember to send them manually, the thing the whole platform exists to avoid.

**Suggested Direction:** Not designed. Would need, at minimum: a way for a Planning task (template or instance) to reference a message template/series step, a decision about whether task-linked communication reuses `message_sequences`/`sequence_steps` (with a nullable `task_id`-style link) or is a distinct mechanism, and a `task_completed` exit-rule hook into wherever Planning tasks get marked done.

**Dependencies:** None blocking — freestanding Series (Phase 3) works today independent of this. This is additive, not a prerequisite.

---

## Automated Series — Tour No-Follow-Up Trigger

**Discovered:** 2026-07-14, considered and deliberately deferred during Phase 3 (Automated Series) trigger design.

**Problem:** Phase 3 ships two rule-based triggers — `lead_created` and `lead_stage_changed` — chosen specifically because they hook cleanly into existing discrete function calls (`createLead`, `updateLeadStatus` in `lib/leads/service.ts`). A third candidate, matching an existing Luv signal (`tour_no_followup` — a lead had a tour and nothing since), was considered but not built: unlike the other two, it isn't a discrete event with one call site to hook into. It's a *state* ("N days have passed with no follow-up since the tour") that only becomes true through the passage of time, which means it needs periodic re-checking (a scheduled scan), not a one-time hook.

**Opportunity:** "A tour happened and nothing followed" is a real, common gap this platform is well-positioned to close automatically — arguably a stronger fit for the Guiding Principle than either trigger currently shipped, since it's precisely the kind of thing a venue is most likely to forget.

**Suggested Direction:** Not designed. Likely needs its own periodic job (similar in shape to the Scheduled Sends processor, `lib/scheduled-messages/processor.ts`) that scans for leads matching the "tour happened, N days ago, no follow-up since" condition and calls the same `triggerSequencesForRelationship` entry point Phase 3 already built — the enrollment/materialization machinery doesn't need to change, only how it gets invoked.

**Dependencies:** None blocking. Additive to the trigger system Phase 3 already ships.

---

## How to use this

Add an entry whenever implementation surfaces a real opportunity that isn't part of the work at hand. Keep entries here until they're either scoped into an actual approved phase (move the detail into that phase's design doc, remove it from here) or explicitly declined (leave a one-line note why, don't delete the history).
