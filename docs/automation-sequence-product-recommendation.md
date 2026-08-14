# Automation & Sequences — Product & Architecture Recommendation

**Type:** Product/architecture discovery only. No code, schema, routes, navigation, or UI were modified to produce this document.
**Method:** Every claim below traces to code read in full or a live database query — `lib/message-sequences/*`, `lib/scheduled-messages/*`, `lib/leads/service.ts`, `lib/lead-intake/pipeline.ts`, `lib/activity-timeline/*`, the `get_relationship_activity_timeline` RPC (read via `\sf`), `lib/luv/observations.ts`, and the live `/communication/series` pages and components. `docs/pipeline-architecture-product-recommendation.md` was treated as the Pipeline baseline and independently re-confirmed, not re-litigated. No screenshots were attached to this request; the CRM reference is used only as the capability checklist the brief itself extracted from it (reusable sequences, visible enrollment, pause/resume/exit, run history) — nothing about its specific screens or IA was assumed.

---

## Executive Recommendation

**Hello to Cheers has already built almost exactly the right system, and mostly under the right name.** This is the single most important finding in this document: the venue-facing screen at `/communication/series` is titled **"Automations"** throughout — the page header, the empty state, the "+ New Automation" button. "Sequence" and "Series" are used only internally, in code and comments (`lib/message-sequences/*`, `SequenceEnrollment`, etc.) — a venue never sees either word. The product has *already* made the exact decision this document was asked to evaluate: **Automation and Sequence are one venue-facing concept, not two.** This document confirms that decision was correct and should not be reopened.

What genuinely needs work is narrower and more concrete than "design a new automation system": **two safety gaps** (a lost/cancelled lead doesn't stop an active sequence; a finished sequence never marks itself complete), **one visibility gap** (an enrollment shows only a name and a status badge, not "step 2 of 3, next Thursday"), **one history gap** (sequence lifecycle events don't appear in the relationship's unified activity timeline, though everything else already does), and **one vocabulary gap carried over from the Pipeline document** (the trigger-stage picker still shows four hardcoded labels instead of the venue's real stages). None of these require new infrastructure — every fix reuses a pattern that already exists somewhere else in this exact codebase.

**The conceptual model to keep going forward:**

```
Pipeline  →  Automation (trigger + steps, one object)  →  Enrollment  →  History
```

Four venue-facing concepts, not five. "Sequence" stays exactly what it already is — an internal engineering term, never surfaced.

---

## Simple Venue-Facing Mental Model

- **Pipeline** — *where is this relationship in our process?* (Already documented in `docs/pipeline-architecture-product-recommendation.md`; unchanged here.)
- **Automation** — *when something happens, do this, over time.* One object, one screen: a trigger (or "manual only") plus an ordered list of steps with relative timing.
- **Enrollment** — *who is currently going through this, and what's next.*
- **History** — *what has Hello to Cheers actually done with this person.*

No separate venue-facing "Workflow," "Trigger," or "Sequence" screen. No engine terminology anywhere a venue can see it.

---

## Automation vs. Sequence vs. Workflow — Decision

**"Workflow" is not a real, competing concept anywhere in the current Hello to Cheers codebase.** A repo-wide search for the word turns up only generic English usage (a Playbook's "task workflow," a lucide icon literally named `Workflow` used for the Leads nav icon) and one unrelated internal HQ file (`lib/hq/crm-service.ts`, Hello to Cheers's own internal company CRM tooling — not venue-facing product). There is no second automation builder to retire, no duplicate concept to reconcile. The brief's suspicion ("we do not want venues managing two confusing automation builders") is correct as a design principle, and the product already satisfies it — the CRM screenshots' Workflow/Sequence split is a feature of that other system, not a latent problem here. **Recommendation: never introduce "Workflow" as a second venue-facing word.** If a genuinely distinct future capability needs its own internal term, it should stay implementation-only, exactly like "Sequence" already does.

**Automation vs. Sequence, precisely, confirming and refining the brief's own hypothesis:** *Automation = WHEN, Sequence = WHAT HAPPENS OVER TIME* is correct as a **conceptual** distinction and should stay the mental-model language used in documentation, onboarding copy, and Luv's voice. But at the **data-model layer**, the product has already fused them: `trigger_type`/`trigger_stage` are columns directly on `message_sequences` (renamed "Automation" in every venue-facing string), not a separate linked "Automation" table pointing at a reusable "Sequence." This is a deliberate simplification worth keeping, with one named, accepted tradeoff: **a venue cannot attach one reusable step-plan to two different triggers today** — a "gentle check-in" plan used for both "Proposal Sent" and "Decision Pending" would have to be built twice. No evidence in the current product (only one venue has ever used this system at all) suggests this limitation is costing anyone anything yet. **Recommendation: keep the fused 1:1 model. Do not split Automation and Sequence into two linked objects unless real venue usage demonstrates the need to reuse one step-plan across multiple triggers.**

---

## Pipeline Integration

Confirmed directly against `lib/message-sequences/repository.ts::getActiveSequencesForTrigger`: `trigger_stage` already stores a `leads.status`-shaped value — the stable, canonical layer, not a venue's custom stage name. This is exactly correct and needs no schema change.

**What needs to change is the picker a venue sees when building an Automation**, and it's the same fix already named in the Pipeline document, restated here for completeness: `SEQUENCE_TRIGGER_STAGES` (`lib/message-sequences/constants.ts`) is a hand-maintained, four-value list (`new`, `contacted`, `qualified`, `proposal_sent`) that **omits `won`, `lost`, and `cancelled` entirely** — a venue cannot today build "when a lead is lost, send a graceful goodbye" or "when a lead is booked, send a welcome," because the trigger picker doesn't offer those stages as options, even though the underlying mechanism (`updateLeadStatus` → `triggerSequencesForRelationship`) already fires for every status value without exception.

**Recommended durable reference, and why:** store the **canonical stage** (already what happens today via the `leads.status`-shaped `trigger_stage` column) — never a stage ID, a stage name, or a pipeline+stage combination. Canonical stage is the one value that survives a stage rename, a stage deletion, and a venue switching which Pipeline Template is active. **Recommended display fix:** when rendering the picker (and when showing an existing Automation's trigger back to the venue), resolve the canonical stage against the venue's *currently active* Pipeline Template and show their real stage name — e.g. *"When a lead reaches Proposal Sent (your stage: **Let's Talk Numbers**)"* — a read-only join at render time, no schema change, no risk to the stable underlying reference.

---

## Trigger Model

### What already exists, confirmed by tracing the actual call sites

| Trigger | Fires from | Status |
|---|---|---|
| `lead_created` | `lib/lead-intake/pipeline.ts`, on every new inquiry — deliberately **withheld** for low-confidence email-parsed leads until a coordinator confirms the extracted details (a real, already-built safety precedent worth preserving as a model for future triggers) | Real, live |
| `lead_stage_changed` | `lib/leads/service.ts::updateLeadStatus`, on every status write, including from the Pipeline board's drag-and-drop | Real, live, but only 4 of 7 stages exposed in the picker (see above) |

### Recommended trigger set for the next release

| Trigger | Rank | Reasoning |
|---|---|---|
| New inquiry | **P0** | Already built |
| Lead enters pipeline stage (all seven canonical stages, not four) | **P0** | Already built end to end; this is a picker fix, not new infrastructure |
| Contract signed | **P1** | `contracts.signed_at` already exists as a real, populated timestamp (confirmed — it already feeds the relationship activity timeline); wiring it as a trigger is a small, well-scoped addition |
| Tour scheduled / Tour completed | **P1** | `tour_appointments` already exists as a real, tracked table with a status field; a genuinely useful, frequently-relevant moment for a venue |
| Payment overdue | **P1**, but shaped differently | Every trigger above fires *on write* (something just happened). "Overdue" requires a *scan* (a due date has silently passed) — a different, daily-cron shape, not an instant event. Real and valuable, but should be scoped as its own small piece of work, not assumed free |
| Payment received | **Later** | Real but lower urgency than overdue; build once overdue is proven useful |
| Task becomes due | **Later** | No generic, cross-domain "task" concept exists yet to hang this off (see Action Model, below) |
| Planning milestone reached | **Later** | Explicitly depends on the Client Lifecycle / Playbook-milestone unification named as not-yet-built in the Pipeline document; do not build a parallel mechanism ahead of it |
| Final details approaching | **Later** | Same dependency as above |

---

## Action Model

### What already exists

**Send a message** (via an Automation's steps) is the only action that exists today, and it is well-built: `materializeEnrollmentSteps` pre-computes every step's send time at enrollment, the existing Scheduled Sends cron (already running every 5 minutes, already production infrastructure) delivers them, merge fields resolve **fresh at send time** (not stale at enrollment time — confirmed directly in `processor.ts`, so a rescheduled tour or an edited price is never sent wrong), and a successful send is logged into the same unified Conversation a human message would use — a scheduled message isn't a second kind of thing once it's gone out.

**"Start a sequence"** is not a separate action to design — enrollment *is* the mechanism, already real (`enrollRelationshipManually` for manual, `triggerSequencesForRelationship` for rule-based).

**"Wait / delay"** does not need to be a separate action — it's already built into the step model as `offsetDays`, correctly, and should stay that way rather than becoming its own configurable node.

### Recommended smallest strong set for what a venue owner would call genuinely useful

| Action | Rank | Reasoning |
|---|---|---|
| Send a message (steps) | **P0** | Already built |
| Enroll in an Automation (trigger-based or manual) | **P0** | Already built |
| Create a task | **P1** | The thing most likely to make a venue say "that saves me work" — but requires closing a real gap first: no generic, relationship-scoped task-creation primitive exists today. Tasks currently live either inside an applied Playbook (event-scoped) or as a lead-specific ad-hoc add (`lib/leads/service.ts`'s task insert, Leads-only). Building this action means unifying that primitive first, not just wiring a new trigger to an existing one |
| Notify a team member | **P1** | The product already has a real, working internal notifications system (`/api/notifications/process`); this is a reuse job, not new infrastructure |
| Stop/exit a sequence | **P0** (as a *rule*, not a venue-configured action) | Already built for reply and booking; extend to lost/cancelled — see Safety Rules below. This should remain a system-applied safety rule, not something a venue manually wires as an "action," per "no silent state changes" applied in reverse: exits should be predictable and automatic for the cases that are always correct (reply, booking, loss), not a general-purpose thing a venue configures per automation |

**Explicitly rejected, stated as a permanent non-goal:** a generic "change/record something" action. This is precisely the Zapier-shaped, field-mutation-as-an-action capability that turns a simple, trustworthy system into one a venue can accidentally misconfigure into silently altering business state. Nothing in the current product needs it, and building it would directly violate "no silent state changes."

---

## Sequence Model

The brief's own suspicion is confirmed exactly: **ordered steps + relative timing + simple send actions is already what's built, and it should stay the whole of P0.**

| Element | Status |
|---|---|
| Ordered steps | Built (`sort_order`) |
| Relative timing (`offsetDays`, cumulative from enrollment or the previous step) | Built, and correctly the *only* timing mode — no absolute dates exist, which is the right call: relative timing is safer (a step scheduled "3 days after enrollment" is meaningful regardless of when a venue builds or edits the automation; an absolute date silently goes stale) |
| Email / SMS steps | Built — the only two channel types |
| Task step | **P1** — depends on the same generic task primitive named in Action Model |
| Internal notification step | **Later** |
| Conditional branching | **Explicitly not recommended, ever, absent strong evidence.** This is the single clearest place the brief's "don't turn this into Zapier" principle applies. A linear list of steps is legible to a venue owner without training; a branching tree is not |
| Absolute-date steps | **Not recommended** — relative timing already correctly covers the real use case and avoids a whole category of staleness bugs |

**One real, confirmed behavior worth naming plainly (not a bug, a design property):** editing an Automation's steps replaces them wholesale for *future* enrollments only — anyone already enrolled keeps running against the steps that existed when they enrolled (`materializeEnrollmentSteps` computes everything once, at enrollment time). This means fixing a typo in step 2 doesn't retroactively fix it for someone already mid-sequence. This is a defensible, safe default (the rules someone enrolled under stay stable, rather than shifting under them mid-flight) and this document recommends keeping it, but it should be **stated to the venue** somewhere in the edit UI ("changes apply to new enrollments only") so it's never a surprise.

---

## Enrollment Model

### What already exists, confirmed directly in `components/communication/series-enrollments.tsx`

- A per-Automation screen (not a separate top-level destination) showing everyone currently or previously enrolled, with a status badge.
- Manual search-and-enroll, right there on the same screen.
- Per-enrollment cancel (an "X" button), for **active** enrollments only.
- Automatic exit on a reply to any message (any channel), confirmed called directly from the inbound email/SMS webhooks.
- Automatic exit on booking (a lead becoming a client), confirmed called from the conversion flow.
- A `SequenceEnrollmentStatus` enum already anticipating exactly the states a venue would want to see: `active | completed | exited_reply | exited_booking | cancelled`, with venue-facing labels already written (*"Stopped — replied," "Stopped — booked"*) — this is strong, deliberate, forward-looking design, not an accident.

### What's genuinely missing

| Gap | Confirmed how | Recommendation |
|---|---|---|
| `completed` is never actually set | Grepped every write path; the enum value exists, nothing ever writes it | **P0.** Cheap: when the last materialized step for an enrollment is marked sent, flip the enrollment to `completed`. The UI already has the label ready |
| No "step X of Y, next on [date]" display | `SeriesEnrollments` renders only name + status badge | **P0.** A read against `scheduled_messages` filtered to that enrollment (`status = 'scheduled'`, ordered by `scheduled_for`) already has everything needed — no new data, just a query and a line of UI |
| No per-enrollment pause, only per-sequence pause and per-enrollment cancel | `setSequenceStatus_`/`isEnrollmentSequencePaused` are sequence-wide; only `cancelEnrollment_` is per-enrollment, and it's a terminal exit, not a resumable pause | **P1.** A real gap relative to the brief's own example ("pause this person"), but narrower in practice than it first appears — a venue can already pause everyone or stop one person permanently; "pause just this one person, resumably" is a genuinely smaller, later need |
| Lost/cancelled doesn't exit active enrollments | Traced `updateLeadStatus` in full; only `won` has a special branch (the tour-converted signal), and enrollment exit only listens for reply/booking | **P0 — the most important safety gap in this document.** See below |

### Answering the brief's specific scenario questions, traced rather than assumed

- **If a lead replies, does a follow-up sequence stop?** Yes, already, for every active sequence that relationship is in, across all channels. Correct, keep as-is.
- **If a lead moves from Proposal to Booked, does a Proposal Follow-Up continue?** No — booking exits every active enrollment. Correct, keep as-is.
- **If a lead is marked Lost, does an active sequence continue?** **Yes, today — and it shouldn't.** This is a real, confirmed gap, not a hypothetical. Recommend extending `exitEnrollmentsForBooking`'s pattern (rename generically or add a sibling call) so `updateLeadStatus` also exits active enrollments when the new status is `lost` or `cancelled`, using the same `exitEnrollments` helper already built, just with a new reason value (`exited_lost`, matching the existing naming convention).
- **Should every stage change exit active enrollments?** **No — recommend against this.** Exiting on every stage move would make Automations fragile and unpredictable (a lead skipping from Tour straight to Proposal shouldn't retroactively cancel a Tour Follow-Up mid-flight for no clear reason to the venue). The two outcomes that should always exit are the two genuinely terminal, contradictory ones already partly built: booked (done) and lost/cancelled (over) — not every ordinary forward movement.

---

## Safety / Stop Rules

Stated as the plain rule set this document recommends the product commit to, each traced against what's real today:

1. **Never enroll on unverified or low-confidence data.** Already real (email-parsed, low-confidence leads withhold automation until a human confirms). Extend this instinct as a general principle for any future trigger, not just this one.
2. **A reply always stops every active Automation for that relationship.** Already real.
3. **Booking always stops every active Automation for that relationship.** Already real.
4. **Losing/cancelling a relationship should always stop every active Automation for it.** **Not real today — build this. P0.**
5. **Pausing an Automation stops sends immediately, including already-materialized future steps — not just new enrollments.** Already real, confirmed in the Scheduled Sends processor's own pause check.
6. **No duplicate active enrollment in the same Automation.** Already real (`hasActiveEnrollment` guard).
7. **Message content resolves fresh at send time, never stale at enrollment time.** Already real — the single strongest piece of evidence in this entire trace that the system was built carefully.
8. **A finished Automation should say so, not linger as "active" indefinitely.** Not real today — build this. **P0.**

**The governing principle, stated once for reuse elsewhere in the product:** *Automation should reduce work, never create cleanup work.* Every rule above exists to make that true; the two gaps (Lost/cancelled exit, completed status) are the two places today where it currently isn't.

---

## History Model

**The good news is almost everything needed already exists, in exactly the shape this document would have recommended building.** `get_relationship_activity_timeline` (confirmed via `\sf`, read in full) already unions lead, client, event, payment, request, contract, invoice, timeline, guest-count, vendor, and conversation activity into one ordered, relationship-scoped story — precisely the "trustworthy operational story" the brief describes, and precisely aligned with the already-established Relationship Workspace philosophy (this RPC is the concrete implementation of it).

**What's missing is narrow and precise:** there is no `sequence`/`automation` branch in that union at all. An Automation starting, pausing (sequence-wide), completing, or exiting for any reason currently leaves no trace in the one place a venue would look for "what has Hello to Cheers done with this person." Individual **messages** already appear correctly (they land in the unified Conversation the moment they send) — it's the *lifecycle events around* those messages that are invisible.

**Recommendation, sized to match the rest of this document:** add one more `union all` branch to the existing RPC, reading from `sequence_enrollments` — `enrolled_at` as an "Automation started: [name]" event, `exited_at` (with its `status` reason mapped to a plain-language title: "Automation completed," "Automation stopped — they replied," "Automation stopped — booked," "Automation stopped — lost," "Automation cancelled") as the corresponding end event. This is the exact same pattern every other domain in that function already uses — not a new history system, one more branch in the one that already exists.

**Should these be separate technical records presented as one story?** Yes, exactly as already true for every other domain here — `lead_activities`, `client_activities`, `payment_activities`, `contracts.signed_at`, etc. are all separate tables, unified only at read time by this one RPC. Sequence history should follow the identical pattern, not invent a parallel one.

---

## Luv's Role

**Confirmed: zero current integration.** Luv's own service files (`observations.ts`, `insights-service.ts`, `trends-service.ts`, `memory-service.ts`) contain no reference to sequences, enrollments, or pipeline stages today. This is genuine greenfield, not a fix to an existing miswiring.

**Recommendation — three specific, bounded moments, matching the brief's own examples and reusing the existing `getLuvObservations` mechanism rather than a new one:**

1. On noticing unenrolled, un-followed-up new inquiries — *"You have 3 new inquiries that haven't had a follow-up sent. Want me to help you set one up?"*
2. Right after a venue's first Pipeline Template is created — *"Want to add a simple follow-up after a tour?"*
3. On noticing a lead stuck in one stage past a reasonable window — **explicitly blocked on the minimal stage-history table this document's companion Pipeline recommendation already scoped as P0 there; do not build a parallel "time in stage" tracker here.**

**Firm boundary, restated because it's the one the brief cares most about:** Luv **suggests and deep-links**; she never becomes a second place where an Automation's trigger, steps, or timing are actually configured. Every suggestion above should land the venue on the real Automation editor to confirm and adjust — never a Luv-native mini-builder. This is the identical discipline already established for Luv and Help & Guides (concierge pointing at canonical infrastructure, never a second copy of it) applied to Automations instead of content.

---

## Recommended Navigation / UX

**No navigation change is recommended.** The current structure already matches the model this document arrives at independently:

- One destination, already correctly named **"Automations"** (`/communication/series`), already living in Communication per the separately-delivered navigation recommendation — confirmed still correct here, nothing about this deeper trace changes that placement.
- A list of Automations, each showing its trigger (or "Manual only") and active/paused status.
- Click into one → see its steps **and** its current enrollments **on the same screen** (`SeriesEnrollments`, already rendered inside the edit page) — this already is the "defining a process vs. seeing who's running through it" distinction the brief asks for, just expressed as one screen with two sections rather than two separate top-level destinations. That is the simpler, more venue-appropriate version of the CRM capability, not a lesser one.

**The only UX additions recommended, all inside the existing screen, none requiring new navigation:**
- Per-enrollment "step X of Y, next on [date]" line (P0, per Enrollment Model above).
- A small note that edits apply to new enrollments only (P0, cheap, prevents a real future confusion).
- The pipeline-stage picker showing the venue's real stage names (P0, per Pipeline Integration above).

---

## Starter Automations

No sequence/Automation starters exist today (confirmed — no `starters.ts` in `lib/message-sequences/`), while Message Templates already have real starter content (`lib/message-templates/starters.ts`) to build on top of. Given real usage is currently one venue, total, this document recommends a genuinely small starter set — validated against what P0 already supports (a trigger the picker actually exposes, plain email/SMS steps):

1. **New Inquiry Welcome** — trigger: new inquiry. Steps: immediate welcome, gentle follow-up a few days later.
2. **Tour Follow-Up** — trigger: lead enters the Tour Completed canonical stage (once exposed in the picker, per the P0 fix above). Steps: thank-you the next day, a follow-up a few days after.

**That's the recommended starting set — two, not six.** Proposal Follow-Up, Booking Welcome, Contract Reminder, and Payment Reminder are all reasonable *future* starters, but each depends on a trigger this document ranks P1 or later (contract signed, payment overdue) or on the picker fix landing first. Shipping starters for triggers that don't yet work well would undermine trust in the very moment meant to build it — better to ship two that work perfectly than six where four quietly under-deliver.

---

## Concept Map — Explicitly Resolving Every Boundary

| Concept | Purpose | Boundary notes |
|---|---|---|
| Message Template | Reusable message *content* | Correct, unchanged — an Automation step references a template, never duplicates its content |
| Automation | The rule (trigger) *and* the ordered steps that follow it — one venue-facing object | Confirmed as already fused at both the UI and data layer; "Sequence" is its internal name only |
| Enrollment | One relationship's current run through one Automation | Already a real, well-modeled concept; needs the visibility and completion fixes above |
| Pipeline | The venue's sales process and a lead's current position in it | Unchanged from the companion Pipeline document; the one thing an Automation trigger can key off of today |
| Playbook | The venue's *event planning* process, post-booking | Correctly separate from Pipeline and Automation — different lifecycle phase, different mechanism, per the companion document's recommendation not to build a second pipeline type |
| Task | One unit of work | Currently split between Playbook-scoped (event) and Lead-scoped (ad hoc) — **this boundary is the one genuinely unresolved seam in the whole concept map**, and it's the blocker for "create a task" ever becoming a real Automation action |
| Luv | Guidance that points at the real system, never a second copy of it | Confirmed correct in principle, currently unbuilt for this domain |

**"Sequence" deliberately does not appear as its own row** — it is not a venue-facing concept, and this document recommends it never becomes one.

---

## Minimum Complete Implementation

**P0 — build now, all small, all reusing existing infrastructure:**

1. Extend the pipeline-stage trigger picker to all seven canonical stages (not four).
2. Show the venue's real, active-template stage name next to the canonical stage in the trigger picker and on an existing Automation's summary.
3. Set `sequence_enrollments.status = 'completed'` when an enrollment's last step sends successfully.
4. Exit active enrollments automatically when a lead is marked Lost or Cancelled (mirroring the existing booking-exit pattern).
5. Show "step X of Y, next on [date]" per active enrollment.
6. Add a `sequence`/`automation` branch to the existing relationship activity timeline RPC.
7. Two starter Automations (New Inquiry Welcome, Tour Follow-Up).
8. A short, in-UI note that editing an Automation's steps affects new enrollments only.

**P1 — next:**

9. Contract-signed and Tour-scheduled/completed triggers.
10. A generic, relationship-scoped task-creation primitive, unblocking "create a task" as a real Automation action.
11. Team-member notification as an Automation action (reusing the existing notifications system).
12. Per-enrollment pause (distinct from today's per-sequence pause and per-enrollment cancel).
13. Payment-overdue trigger (scoped separately — it's a daily scan, not an instant event, and shouldn't be estimated as if it were free).

**Later — explicitly don't build yet:**

- Multiple pipeline types feeding Automations (depends entirely on the companion Pipeline document's own deferred Client Lifecycle work).
- Conditional branching inside an Automation.
- Absolute-date steps.
- A generic "change/record something" action.
- Task-becomes-due and planning-milestone triggers (both depend on infrastructure this document explicitly does not scope).
- A parallel Luv-native "time in stage" tracker (depends on the Pipeline document's own P0 history table; do not duplicate it here).

---

## Existing Infrastructure to Reuse (do not rebuild any of this)

- **Scheduled Sends cron** (`/api/communication/scheduled/process`, already running every 5 minutes in production) — the entire delivery engine for every Automation step. No new execution engine of any kind is needed.
- **`triggerSequencesForRelationship`** — the one, already-shared enrollment entry point, already called from both lead creation and stage change; any new trigger (contract signed, tour scheduled) should call this same function, not a parallel one.
- **`exitEnrollments`/`exitActiveEnrollmentsForRelationship`** — the existing exit mechanism; the Lost/Cancelled fix is a new caller of this same function, not new logic.
- **`get_relationship_activity_timeline`** — the existing, comprehensive history RPC; add a branch, don't build a second history system.
- **Notifications infrastructure** (`/api/notifications/process`) — the reuse target for "notify a team member," once built.
- **`getLuvObservations`** — the reuse target for Luv's automation-related suggestions.
- **Existing Message Template starters** (`lib/message-templates/starters.ts`) — the content to build the two recommended Automation starters on top of, not new copy written from scratch.

---

## Explicit Non-Goals

- A second automation engine, builder, or execution model of any kind.
- "Workflow" as a venue-facing concept, ever, absent strong future evidence.
- Conditional branching, absolute-date scheduling, or any Zapier-shaped generic action.
- Multiple Pipeline types feeding this system (out of scope per the companion Pipeline document).
- Luv authoring, editing, or owning any Automation configuration.
- Rebuilding Pipeline architecture that is already correct — this document changes nothing about `pipeline_templates`/`pipeline_stages`.
- Exiting an enrollment on every ordinary pipeline stage change (only booking and loss/cancellation should ever auto-exit).

---

## Final Recommended Product Model

```
Pipeline (unchanged from the companion document)
  ↓ canonical stage change
Automation  (trigger + ordered steps — one venue-facing object; "Sequence" internal only)
  ↓ enrolls
Enrollment  (per relationship; status: active → completed | exited_reply | exited_booking | exited_lost | cancelled)
  ↓ materializes at enrollment time into
Scheduled Sends  (existing cron, existing infrastructure — no new engine)
  ↓ on send
Conversation  (existing unified message timeline — already correct)
  ↓ lifecycle events (started / paused / completed / exited)
Relationship Activity Timeline  (existing RPC — add one branch, don't build a new one)
  ↑
Luv  (suggests moments to build/use an Automation; never configures one)
```

This is the same shape the brief proposed, with one deliberate simplification confirmed against the real product: **Automation absorbs "the rule" directly rather than sitting as a separate object pointing at a reusable Sequence**, because that's what's already built, already correctly named for venues, and not yet evidenced to need to change.

---

## Important Constraints — Confirmed Honored

No code, schema, routes, navigation, or UI was written or modified. No second automation engine was proposed. Workflows were not assumed to need venue-facing status — the opposite was found and stated. No second Pipeline type was proposed. Pipeline architecture itself was not touched or redesigned. Luv was not made the automation engine. Every recommendation above was checked against "does existing infrastructure already do this" before being sized, and in every case but one (the task-creation primitive) the answer was yes.

This document ends here.
