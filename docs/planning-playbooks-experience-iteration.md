# Planning Playbooks — The Planning Experience (Design Iteration)

**Status:** Design only, no code. Confirms and deepens `docs/planning-playbooks-two-workflow-model.md`'s domain model (two workflows, relative-only dates, `kind`-split Builder) — nothing here contradicts that document. This one exists to answer a different question: not *what fields exist*, but *what does it feel like to plan a wedding here*.
**Starting point, deliberately:** this document begins inside a real, applied event — the couple's portal, the venue's workspace — and only reaches the Builder at the end, because that's the actual order of importance. A venue doesn't wake up wanting to build a task template; they wake up wanting Nicole & Colby's wedding to go well. The Builder exists to serve that, not the other way around.
**Revised 2026-07-08, per Planning Experience Review:** Progress, Celebration, and Contact Information below were confirmed as-designed. Task Context is refined from "tasks display Conversation messages" to a broader **Related Context** concept (Conversation, Internal Notes, Documents, Timeline Items — references, never duplicated copies). A new **Internal Notes (venue) vs. Helpful Information (client)** distinction is threaded through both sides. A milestone-progression view is added alongside the couple's percentage. Terminology also updated throughout to the canonical **Venue Workflow** (was "Venue Operations" when this document was first drafted, before that naming was finalized in Product Decisions — see `docs/planning-playbooks-two-workflow-model.md`).
**Approved 2026-07-08, Planning Experience Design Approval — ready for implementation.** Two ideas were explicitly named as non-blocking, ongoing influences rather than requirements of this pass: (1) a task should surface *everything* needed to finish it in one place — Related Context, Helpful Information, Attachments, Links, Documents, embedded tools, and completion, all inline, so a person rarely has to leave the task; the Related Context model below is a direct step toward this, not the finished shape of it. (2) Planning should progressively surface **"What's next?"** for both audiences — a guided next action rather than a full checklist, reducing cognitive load as the model matures. Neither is built in this pass; both should keep shaping later Planning iterations.

---

## A. The Couple's Planning Experience

Nicole & Colby log into their portal three weeks after booking. They land on **Our Planning**, not a settings screen, not a task list labeled with database language.

```
┌─ Our Planning ───────────────────────────────────────────┐
│                                                              │
│   Nicole & Colby's Wedding · September 4, 2027 · 187 days   │
│                                                              │
│   Booking ✓ ──── Planning ✓ ──── ● Final Details ──── After │
│                                                              │
│   ▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░  3 of 9 complete            │
│                                                              │
│   ✅ Sign your contract                                     │
│   ✅ Complete your questionnaire                             │
│   ✅ Choose your package                                     │
│                                                              │
│   ○ Purchase event insurance                    Due Jun 6   │
│   ○ Submit your guest count                     Due Aug 5   │
│                                                              │
│   🔒 Final payment                          Due Aug 5·later │
│   🔒 Leave a review                        after your day   │
│                                                              │
└──────────────────────────────────────────────────────────┘
```

Complete tasks collapse to a single satisfying line — the couple doesn't need to keep re-reading what they already did. Not-yet-relevant tasks (final payment before the guest count that determines it, a review before the wedding happens) show a lock, not a due date competing for attention — this is the dependency model already in the domain, surfaced as reassurance ("you don't need to think about this yet") rather than as a gray checkbox indistinguishable from one that's actually due.

**The milestone stepper sits above the percentage, not instead of it** (Planning Experience Review). A percentage answers "how much is left"; the stepper answers "where am I in this journey" — and for a couple who has never done this before, "you're in Final Details now" carries more felt meaning than "33% complete" does. The stepper reuses the same milestone names already defined in the applied Client Planning playbook — no second source of truth, just a second way of rendering the one the domain already has. The venue's side doesn't need this addition: the milestone chapter headers in Section B ("▾ Final Details (Aug 5 – Aug 25) · 2 of 5") already give a coordinator that same sense of place, in a register suited to someone managing a dozen weddings rather than living one.

**Opening "Submit your guest count" is where the task stops being a checkbox and becomes the place the work happens** — this is the direct answer to your four questions, rendered:

```
┌─ Submit your guest count ─────────────────────────────────┐
│                                                              │
│   We need your final headcount to plan seating, catering,   │
│   and rentals. Please have this ready by August 5th.        │
│                                                              │
│   ┌────────────────────────────────────────┐               │
│   │  📋  Open the Guest List Tool            │               │
│   └────────────────────────────────────────┘               │
│                                                              │
│   Helpful Information                                        │
│   📄 Guest Count Policy (PDF)                                │
│                                                              │
│   Due August 5, 2027 · we'll remind you 7 and 2 days before │
│                                                              │
│   Questions? Reach out to Sarah at Wildflower Estate         │
│   ✉ sarah@wildflowerestate.com                               │
│                                                              │
│   [ ✓  Mark as complete ]                                    │
└──────────────────────────────────────────────────────────┘
```

*What needs to happen* is the instructions. *When* is the due date, in the couple's own event's real date, never a raw offset. *What they need to complete it* is the tool link and whatever's filed under **Helpful Information** — the couple-facing shape of Related Context (Section B introduces the full concept). There is deliberately no "who" here — per the domain model, Client tasks never expose an owner, because the couple *is* the owner; asking would be answering a question that was never in doubt.

**Helpful Information is never the venue's Internal Notes shown through a filter** (Planning Experience Review) — it's a distinct, deliberately-chosen thing. A coordinator's internal note might read "confirm w/ catering before locking count, they're tight on the outdoor tent capacity" — useful to Sarah, meaningless and slightly alarming to Nicole & Colby. The Guest Count Policy PDF above is Helpful Information: written *for* the couple, in the couple's register. Section B makes the full contrast explicit.

**The contact line is not a field the venue re-types on every task.** It's a default pulled from the venue's own profile or the assigned coordinator (already real data, Standard #12 — one fact, one owner), with a per-task override only when a specific task genuinely needs a different contact than usual (e.g., a florist-adjacent task pointing to that vendor's contact instead of the coordinator's). Most tasks, most of the time, need zero extra typing here. **Approved as-designed, Planning Experience Review.**

**Completing it feels like something happened.** A brief, warm animation — not garish, matching this brand's restrained hospitality register rather than a generic confetti burst — and the progress bar visibly advances. If this was the last task in a milestone ("Booking & Planning" complete), a slightly larger moment marks it: *"You're all set for now — next up: Final Details, starting in 60 days."* The couple should feel like they're being walked toward their wedding day, not managing a project for it. **Confirmed as-designed, Planning Experience Review — this audience-specific celebration stays as proposed.**

---

## B. The Venue's Workflow Experience

Sarah, the venue's coordinator, opens Nicole & Colby's event. **Planning** is a tab on the event, not a separate destination — she's already looking at this couple's record; the operational workspace lives right there.

```
┌─ Nicole & Colby's Wedding — Planning ─────────────────────┐
│  Overview  Guests  Vendors  [ Planning ]  Timeline  Docs    │
│                                                              │
│  Venue Workflow                 Client Planning              │
│  ▓▓▓▓▓▓░░░░░░  6 of 14           ▓▓▓▓▓▓▓▓▓░░░  3 of 9        │
│  ──────────────                                              │
│                                                              │
│  ▾ Final Details (Aug 5 – Aug 25)          2 of 5 · 3 open  │
│                                                              │
│    ○ Confirm rentals                    Owner: Sarah        │
│      Due Aug 21              🔔 reminds 7d, 2d before        │
│                                                              │
│    🔒 Create floor plan          Owner: Sarah · Dept: Ops    │
│      Waiting on: Submit guest count (couple)                │
│                                                              │
│    ○ Prepare venue                       Owner: Mike        │
│      Due Sep 3                                                │
│                                                              │
│  ▾ Wedding Day (Sep 4)                     0 of 3            │
│    ...                                                        │
└──────────────────────────────────────────────────────────┘
```

Two progress bars, side by side, never merged into one number — because "68% done" would quietly average together two things that mean different things: how ready the *couple* is, and how ready the *venue* is. A coordinator glancing at this instantly knows which side needs attention today. **Confirmed as-designed, Planning Experience Review — these stay independent.** The dependency from Section A is visible from this side too — "Create floor plan" is locked with a plain-language reason, not just a gray checkbox, so Sarah knows *why* it's stalled without having to guess.

**Opening "Create floor plan" is the venue-side answer to the same four questions**, with the fields the couple never sees:

```
┌─ Create floor plan ────────────────────────────────────────┐
│  Owner: Sarah        Department: Operations                  │
│  Depends on: Submit guest count (couple) — not yet complete  │
│                                                                │
│  Build the floor plan once the headcount is confirmed.       │
│                                                                │
│  ┌────────────────────────────────────────┐                 │
│  │  🗺  Open Floor Plan Studio               │                 │
│  └────────────────────────────────────────┘                 │
│                                                                │
│  Related Context                                              │
│  💬 2 messages in Conversation, incl. "dance floor request"   │
│  📝 1 Internal Note from Sarah                                 │
│  📎 Rental diagram — vendor.pdf                                │
│  🕒 Timeline: First Look, 4:30pm                                │
│                                                                │
│  Due August 21, 2027 · escalates to venue manager if 3 days   │
│  overdue                                                        │
│                                                                │
│  [ ✓  Mark as complete ]  [ Reassign ]                         │
└────────────────────────────────────────────────────────────┘
```

Owner, department, dependency, and escalation are exactly the fields Client Planning never shows — not hidden behind a toggle, structurally absent from that Builder's form, per the two-workflow model.

**Related Context, refined per Planning Experience Review:** the original version of this document rendered the couple's note directly inside the task ("Note from Nicole: 'We'd love the dance floor...'"), which — on reflection during review — is itself a small violation of One Fact, One Owner: it's a copy of the message's text, living a second life inside a task record, that will silently go stale the moment the real Conversation thread continues. Related Context replaces that with **pointers, not copies**, spanning four sources:

- **Conversation** — messages relevant to this task, e.g. Nicole mentioning the dance floor placement. Clicking opens Conversation, scrolled to that message — the message stays owned by Conversation, always.
- **Internal Notes** — a coordinator's own operational annotations (venue-only; never shown to the couple — see below).
- **Documents** — files relevant to the task, e.g. a vendor's rental diagram, owned by the Documents system.
- **Timeline Items** — day-of timeline entries relevant to the work, e.g. the First Look time affecting where the dance floor needs clear sightlines.

A task becomes **the place someone finds everything needed to do the work**, without becoming a second home for any of it — every item in Related Context is a live reference into the system that actually owns that fact, not a duplicate.

**Internal Notes (venue) vs. Helpful Information (client):** these are deliberately not the same concept wearing two labels. Internal Notes are Sarah's own shorthand, written for her team and never shown to a couple, regardless of visibility settings — an operational note about a tight tent capacity or a vendor's temperament has no couple-appropriate version; it simply doesn't cross to the other side. Helpful Information (Section A) is the reverse: content deliberately written or selected *for* the couple — guidance, not operations. A task never auto-translates one into the other; a venue that wants the couple to know something writes it as Helpful Information on purpose.

**Progress here reads differently than the couple's side, on purpose.** No confetti — a coordinator managing a dozen weddings doesn't want a celebration animation for the fortieth task this week. Instead: a quiet, confident signal — the milestone header's fraction ticking up, and a small "on track" / "3 tasks need attention" status instead of a percentage, because *staying ahead of operations* is the actual feeling being designed for, not *making progress toward a personal goal*. Same underlying mechanism (task completion), two different emotional registers, because a coordinator and a couple are not the same audience even though they're looking at data from the same applied playbook.

---

## C. How Playbooks Are Created

The Builder exists only because a venue needs to define this once and run it every time — it is explicitly in service of Sections A and B, not the main event. Two Builders, sharing the same milestone-as-chapter interaction (the proven Timeline/Playbook pattern), keyed by `kind`:

```
┌─ New Planning Playbook ──────────────────────────────────┐
│   What kind of playbook is this?                            │
│                                                                │
│   ┌─────────────────────┐   ┌─────────────────────┐        │
│   │  💍 Client Planning   │   │  🏛 Venue Workflow    │        │
│   │  Guides the couple    │   │  Runs your team's     │        │
│   │  through their to-dos │   │  internal workflow     │        │
│   └─────────────────────┘   └─────────────────────┘        │
└──────────────────────────────────────────────────────────┘
```

Choosing one determines every field the rest of the Builder offers — a Client Planning task's edit form never has an Owner field to leave blank; it isn't there. Inside either Builder, adding a task's due date is a plain-language composer, never a raw offset:

```
┌─ When is this due? ────────────────────────────────────────┐
│                                                                │
│   [ 30 ▾]  days   [ before ▾]   the event                    │
│                                                                │
│   → "30 days before the event"                                │
└──────────────────────────────────────────────────────────┘
```

`before` / `on` / `after`, any number a venue chooses — no preset list of "the days that matter," because those days are the venue's own decision, not this product's opinion. "On the event day" collapses the number away entirely once "on" is selected, so a venue never has to type "0."

The **"what does the person need"** section is the same authoring surface for both kinds, just gated to visible-to-the-right-audience: instructions (the description), a tool link, an attachment, and — only appearing once a reminder is configured — the reminder schedule, phrased the same plain-language way ("remind 7 and 2 days before"). What differs by kind is the label on that attachment/notes area — a Venue Workflow task authors it as **Internal Notes**, a Client Planning task authors it as **Helpful Information** — same mechanism at Definition time, deliberately different framing so a venue never has to remember which kind of content belongs where; the form asks for the right thing by construction.

## D. How Playbooks Are Applied

Two independent choices, on the event itself, not buried in settings:

```
┌─ Nicole & Colby's Wedding — Planning ─────────────────────┐
│                                                                │
│   No Client Planning Playbook applied yet.                    │
│   [ Apply a Client Planning Playbook ▾ ]                       │
│                                                                │
│   No Venue Workflow Playbook applied yet.                     │
│   [ Apply a Venue Workflow Playbook ▾ ]                        │
└──────────────────────────────────────────────────────────┘
```

Each opens the same starter-picker pattern already proven (card selection, live preview, applies immediately into an editable workspace). Applying one doesn't require the other — a venue can run its Workflow without a formal client checklist, or vice versa, without the software insisting both exist. The moment either is applied, its section of Sections A/B above comes alive with real dates, computed from this event's actual date.

## E. Reminders & Notifications — felt, not managed

No separate "notifications" screen for planning. A reminder is just a property of a task, already visible on the task card itself ("reminds 7 and 2 days before") — a venue sets it once, at Definition time, and never thinks about it again per-event. When one fires, it reaches the couple or the coordinator through the channel they already use (portal badge, digest email — the existing Notification Engine, unchanged) and, critically, **it always points back to the task itself**, never to a notification that has to be independently reconciled against what's actually happening. An escalation (Venue Workflow only) is the same mechanism aimed at a manager instead of the assignee when a required task goes overdue — visible on the task card as "escalates after 3 days," not a hidden rule a coordinator has to trust exists.

---

## Answering the four questions, as the actual authoring model

This is the frame the whole document has been building toward, made explicit:

| Question | Client Planning | Venue Workflow |
|---|---|---|
| What needs to happen? | Title + instructions | Title + instructions |
| Who needs to do it? | *(always the couple — not asked)* | Owner + Department |
| When does it need to happen? | Plain-language relative date | Plain-language relative date |
| What do they need to complete it? | Helpful Information (guidance, docs, links), contact (defaulted from the venue/coordinator) | Related Context (Conversation, Internal Notes, Documents, Timeline Items), dependency, escalation |

The fourth question is what the earlier task-manager framing was missing entirely — and it's the one that costs the least to build relative to how much it changes the feel, since Notes/Attachments/Links were already scoped in the prior domain-model document. This iteration's real contribution isn't new fields; it's putting those fields *at the moment the work happens* instead of leaving them scattered across emails, PDFs sent separately, and a coordinator's memory of who to call. Related Context and Helpful Information are the same underlying idea — everything the person needs, gathered at the task — expressed as pointers rather than copies, and framed for who's actually looking (Planning Experience Review).

---

No code has been written. Refined per Planning Experience Review, 2026-07-08 — ready for implementation once approved.
