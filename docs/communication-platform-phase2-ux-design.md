# Communication Platform — Phase 2: UX & Workflow Design

**Status:** Design only, no code. Builds directly on `docs/communication-platform-phase1-architecture-review.md` (domain model, existing-capability inventory) and `docs/conversation-experience-cutover.md` (the Conversation UX already designed and partially shipped). Phase 3 (implementation) waits on this being reviewed.
**Checked against:** `docs/product-strategy-charter.md`, Engineering Standard #11 (Definition vs. Execution), the reuse-first direction confirmed in the Phase 1 review.

---

## Foundational clarification, confirmed rather than newly decided

Conversation ("what have we communicated") and Activity ("what has happened") are separate timelines, both living inside the Relationship Workspace. This isn't a new decision — `docs/conversation-experience-cutover.md` §4 already drew this exact line before Activity Timeline existed as a concept anyone had asked for: *"Conversation is where a coordinator talks to a relationship... Activity Timeline... is where a coordinator understands a relationship — a read-only, composed feed interleaving Conversation messages with Lead/Contract/Payment/Event milestones."* Nothing here changes that shape. What changes is that Activity Timeline moves from "referenced for later" to in-scope for this phase, because Journey Execution History (below) needs a home, and Activity is that home.

Two tabs, one Relationship Workspace — as already sketched:

```
┌─ Emma & James ──────────────────────────────────────┐
│  [ Conversation ]   Activity                          │
│  ─────────────────                                    │
│   (chat view — this is where you type and send)       │
└────────────────────────────────────────────────────┘

┌─ Emma & James ──────────────────────────────────────┐
│   Conversation   [ Activity ]                          │
│                  ─────────                            │
│   🔁 Enrolled in "New Inquiry Follow-up" — Step 2 of 4 │
│      waiting: 3 days since last reply        Active    │
│   🎉 Wedding day — Jun 14, 2027                        │
│   💰 Deposit received — $2,500             2 days ago  │
│   ✉ "Thanks for reaching out!"             3 days ago  │
│   📝 Contract signed                       1 week ago  │
└────────────────────────────────────────────────────┘
```

Journey Execution History entries appear on Activity as compact log lines, same visual language as Contract/Payment milestones — not a third timeline, not a special widget bolted on. This keeps Conversation's job narrow (talk) and gives Activity a genuinely new, useful kind of entry (what the system is doing on this relationship's behalf) without inventing a third surface.

---

## 1. Journey Execution History — the explainability layer

This is the one genuinely new UX concept this phase introduces, and it's the mechanism that makes every other automation trustworthy rather than mysterious.

**Every enrolled Relationship exposes, at all times:**

| Field | Answers |
|---|---|
| Current Journey | Which sequence is running |
| Progress | Step 2 of 4 |
| Current Step | What's queued next, and what it will send |
| Waiting Condition | Why nothing has happened yet — "waiting 3 more days since last reply" |
| Completion Reason | Why it finished successfully — "Tour Scheduled" |
| Exit Reason | Why it stopped early — "Opted out," "Manually exited by [coordinator]," "Lead Lost" |

**Where it lives:** a single, always-visible line at the top of the Activity tab when a Relationship is currently enrolled in anything — not a separate page, not a settings screen. A coordinator opening Emma & James shouldn't have to go looking for whether Wevenu is doing something on her behalf; it should be the first thing they see if it's relevant, and simply absent if it isn't (progressive disclosure — no enrollment, no line).

```
🔁 New Inquiry Follow-up · Step 2 of 4
   Next: "Tour Check-In" email, sends in 2 days (unless she replies first)
   [ View journey ]  [ Exit this journey ]
```

Clicking **View journey** expands to the full history for this enrollment — every step taken, when, and why — the same "compact log line, click to expand" interaction Activity already uses for everything else. Clicking **Exit this journey** is a manual exit, logged with a reason ("Manually exited by [coordinator]"), never silent.

**This directly answers your four transparency questions** ("why was this sent, which journey, which trigger, why did it stop") without needing a separate "automation log" screen — the answer to all four is always sitting on the one relationship it happened to, which is more useful than a global log a coordinator would have to search.

---

## 2. Composer — Blank / Template / Ask Luv, inside the existing Conversation compose box

No new compose surface. The existing Conversation compose box (already designed in the cutover doc: channel selector defaulting to Portal, subject field appears only for Email) gains one control: a small **"+"** or **"Insert"** affordance that opens a three-option picker —

```
┌─────────────────────────────────────┐
│  Start from Blank                    │
│  Insert Template            ▸        │
│  Ask Luv to Draft                    │
└─────────────────────────────────────┘
```

- **Insert Template** opens the same card-picker pattern already proven twice this program (Timeline templates, Playbook starters) — search/browse by purpose, personalization tokens already resolved against this Relationship's real data, dropped into the compose box **fully editable, not locked**.
- **Ask Luv to Draft** is the existing `LuvDraftPanel` pattern, generalized beyond Lead/Client follow-ups to run inside any Relationship's compose box, for any of the four entity types. Luv may **suggest** a specific template ("this looks like a tour follow-up — want to start from your Tour Check-In template?") rather than always generating free text — reusing the template library instead of writing from scratch whenever a good match exists. Coordinator reviews, edits, sends. Luv never sends — unchanged from today.

## 3. Template Library UX

A new Library section (`Library → Message Templates`, alongside the existing Playbooks/Contracts/Packages entries — same nav pattern, not a new top-level area). List view exactly like `PlaybooksSection`: name, purpose badge, last-used indicator, Duplicate/Delete actions. Opening one is a two-pane editor — subject/body on the left (with a personalization-token inserter, "Insert: Couple's first name / Event date / Venue name…"), a live preview on the right resolved against a sample relationship. No milestones, no builder complexity here — a template is a single message, not a sequence; keeping it that simple is deliberate, since Journeys (below) are where multi-step complexity belongs.

## 4. Communication Journeys UX — the Playbook Builder pattern, applied to communication

This is the highest-leverage reuse in this whole phase: **a Journey builder should feel like the Planning Playbook Builder**, because the underlying shape is identical (Standard #11 — ordered Definition-side steps, each an Execution-side fact once a Relationship is enrolled).

```
┌─ New Inquiry Follow-up ─────────────────────────────────┐
│  Enroll: every new Wedding Inquiry                        │
│  Exit when: Tour Scheduled · Reply Received · Lead Lost · │
│             Booked · Cancelled · Opt Out · Manual Exit     │
├──────────────────────────────────────────────────────────┤
│  Step 1 — Send immediately                                 │
│    Template: "Thanks for reaching out"                     │
│                                                             │
│  Step 2 — Wait 2 days, then send (skip if replied)         │
│    Template: "Tour Check-In"                                │
│                                                             │
│  Step 3 — Wait 3 more days, then send (skip if replied)    │
│    Template: "Still thinking it over?"                      │
│                                                             │
│  + Add step                                                │
└──────────────────────────────────────────────────────────┘
```

Steps are chapters, exactly like Playbook milestones — reorder, edit, insert, delete in place, no separate "flow diagram" tool to learn (a visual branching canvas is tempting but is a new interaction model this program has deliberately avoided everywhere else; a linear step list with named exit conditions covers everything in your examples without it). Branching, where it's genuinely needed, is expressed as a step-level condition ("if no reply, continue to step 3; if replied, exit") rather than a canvas — consistent with "reduce cognitive load" over building the more powerful but heavier tool nobody asked for yet.

**Enrollment (Execution side)** happens automatically when the enrollment rule's trigger fires (a new Lead created, matching the rule's criteria) — a coordinator never manually enrolls someone for the common case. A manual "Enroll in a Journey" action from the Relationship Workspace covers the exception.

## 5. Automation / Event Bus UX

A venue-facing settings list, `Settings → Automations`, structurally identical to a Journey's enrollment rule but for single actions rather than a sequence: *When [Contract Signed] → send [Booking Confirmation] template* / *When [Payment Due in 3 days] → send [Payment Reminder]*. Each row: trigger, action, on/off toggle. This is intentionally the least visually complex screen in the whole platform — it's a mapping table, not a builder — because per your own instruction, all the scheduling weight sits in the Notification Engine, not here.

## 6. Scheduled Sends UX

One control on the compose box, not a separate screen: **Send Now** (default) vs. **Schedule ▸**, which reveals four options matching your list — Date/Time, Relative to Event ("1 week before the wedding"), Relative to Due Date ("2 days after proposal sent"), After Another Event ("morning of the tour, 3 days after no reply"). Each relative option is a thin UI over the same Notification Engine scheduling primitive Playbook reminders already use (`reminderBeforeDays`-style offset math) — no new date-math engine.

## 7. Delivery Channels & Preferences

Channel-independence surfaces as: the compose box's channel selector (already designed) picks from whichever channels are both globally enabled for the venue and not opted out for this specific Relationship. A **Communication Preferences** section on the Relationship Workspace (small, collapsed by default — progressive disclosure) exposes preferred channel, best time to contact, and opt-out, using the same three-column shape already sitting unused on `vendor_notification_preferences` (Phase 1 finding) generalized to Leads/Clients. Automations and Journeys read these same preferences before sending — a Journey step never overrides an explicit opt-out.

## 8. Analytics UX

Lives under the existing **Insights** nav section, not a new top-level area. Three scoped views rather than one dense dashboard (progressive disclosure again): **Template Performance** (send count, reply rate, per template), **Journey Performance** (enrollment count, completion rate, most common exit reason — directly reusing Journey Execution History's own data), and **Response Times** (by channel, by relationship type). Every number here is a computed projection over Conversation + Journey Enrollment + the existing email-tracking webhook, per the Phase 1 domain model — this screen owns no data of its own.

## 9. Luv Insights — the communication coach

A card on the Relationship Workspace, near the top, same visual register as Journey Execution History (both are "what Wevenu already knows about this relationship, surfaced without being asked"):

```
💗 Luv Insights
   · Nicole usually replies by text within 2 hours.
   · Your "Proposal Follow-up" template has a 62% response rate.
   · This client hasn't been contacted in 9 days.
   · I recommend sending "Tour Check-In" today.        [ Draft it ]
```

`[ Draft it ]` routes straight into the existing Ask-Luv-to-Draft flow, pre-loaded with the suggested template — Luv proposes, the coordinator still confirms and sends. Built after Templates/Journeys/Analytics exist, per the Phase 1 recommendation, since every bullet here is a read over data those systems produce — building this card first would mean faking the data it needs.

---

## Cognitive load summary

Nothing in this phase adds a new screen a coordinator has to check separately: Journey Execution History lives on Activity (already visited for context), Luv Insights lives on the Relationship Workspace (already the front door), Templates and Automations live under existing Library/Settings nav patterns, Analytics lives under the existing Insights section. The only genuinely new *interaction* a coordinator learns is the Journey Builder — and it's the Playbook Builder they already know, pointed at messages instead of tasks.

No code has been written. Ready for review before Phase 3 implementation begins.
