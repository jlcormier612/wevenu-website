# Planning Playbook — End-to-End Experience Design

**Status:** Approved and implemented — see `components/playbooks/playbook-builder.tsx` (milestones as chapters, punch-list tasks, progressive-disclosure reminders/escalation) and `components/playbooks/playbook-starter-picker.tsx` (starter-picker pattern reused from the Day-of Timeline). Follows `docs/planning-playbooks-design.md` (information architecture, data model, gap analysis) — that document established *what exists and what's missing*; this one designs *what it feels like to use*, per explicit request to focus on the venue owner's mental model rather than the database model.
**Checked against:** `docs/product-strategy-charter.md`, specifically Hospitality over Software, Progressive Disclosure, and Reduce Cognitive Load.
**Constraint honored throughout:** every recommendation below maps to a field that already exists in the schema (per the prior document's audit), with exactly one deliberate exception, named explicitly where it appears rather than left implicit.

---

## The mental model, stated once, applied everywhere below

A venue owner does not think "I am configuring records with owner/visibility/category/phase attributes." They think: **"Here's how we run a wedding, start to finish — who does what, and when."** Every answer below is a way of hiding the record model behind that sentence.

Two things already live in this exact product that already prove this mental model works, and both should be reused directly rather than invented from scratch:

- **The Day-of Timeline builder** (`components/events/timeline/timeline-view.tsx`) already presents a chronological sequence of entries, each taggable by audience (`internal`/`couple`/`vendor`/...), reorderable, editable in place. A coordinator already knows how to use this. The Planning Playbook Builder should feel like *the same tool, applied to the whole planning arc instead of one day* — not a new interaction to learn.
- **The Timeline Template Picker** (`components/events/timeline/template-picker.tsx`) already solves "start from something, not nothing" — a slide-in panel of named templates, each previewable, one click to apply, everything editable after. This is the exact shape the first-playbook experience below reuses.

Reusing both is itself an answer to the Charter's "reuse before creating" — a venue owner who has ever built a day-of timeline already knows how to build a Planning Playbook, without being told anything new.

---

## 1. Creating a first Planning Playbook with minimal effort

**The wrong default: a blank builder.** Nothing kills "minimal effort" faster than an empty page asking someone to invent milestones from nothing.

**The right default: the Template Picker pattern, applied one level up.** A new venue's first visit to Playbooks shows a small set of named starting points — Standard Wedding, Micro Wedding, Corporate Event — not a blank canvas:

```
┌─ Planning Playbooks ────────────────────────────────────────┐
│                                                                │
│   Start with a proven playbook. Every task is yours to        │
│   change once it's in place.                                  │
│                                                                │
│   ┌──────────────────┐  ┌──────────────────┐                │
│   │ 💍 Standard       │  │ 🌿 Micro Wedding  │   ...          │
│   │    Wedding        │  │                    │                │
│   │ 7 milestones       │  │ 4 milestones       │                │
│   │ 24 tasks           │  │ 12 tasks           │                │
│   │ [ Use this ]       │  │ [ Use this ]       │                │
│   └──────────────────┘  └──────────────────┘                │
│                                                                │
│                              [ Start from scratch instead ]    │
└────────────────────────────────────────────────────────────┘
```

Selecting one **applies it immediately** — the venue lands inside a fully populated playbook (milestones already named, tasks already sequenced with real relative due dates), in edit mode, with a single line of orientation: *"This is a starting point — rename, reorder, add, or remove anything."* This reuses `seedDefaultWeddingTemplate()` and `DEFAULT_WEDDING_TASKS`, which already exist — the "Standard Wedding" starter is not new data to invent, it's the existing seed content, now offered as a visible, chosen starting point instead of a silent first-login default.

"Start from scratch" stays available, deliberately de-emphasized (smaller, secondary link) — matching the prior document's naming of manual/blank-start as the exception, not the default, everywhere else this pattern already applies (vendor onboarding).

## 2. Organizing milestones, phases, and tasks so it feels like planning, not editing records

**Milestones are chapters, not a filter dropdown.** The builder's primary layout is a vertical sequence of named milestones — Booking, Planning, Vendor Selection, Final Planning, Wedding Week, Event Day, Post-Event — each one a visually distinct section a venue can rename, reorder, add, or collapse. This requires **the one new, deliberately-named table**: `playbook_milestones` (id, playbook_id, name, sort_order). Justified against the "avoid new entities" constraint directly: without it, milestones stay the current fixed 4-value enum, which cannot be renamed or reordered — and "feels like planning an event" specifically requires a venue to be able to call their own milestone "Vendor Selection" if that's how they actually think about their process. This is the only new entity recommended anywhere in this document.

**Tasks live inside their milestone, shown as a simple sequence, not a table.** Within a milestone, tasks read like a punch list — a name, who it's for (one small badge), and when — not a row of seven visible columns:

```
┌─ Vendor Selection ────────────────────────────────── 5 tasks ─┐
│                                                                  │
│   ○ Photographer selected                    🏠 Venue   -90d    │
│   ○ Florist confirmed                        🏠 Venue   -75d    │
│   ○ Catering menu tasting scheduled          👰 Client   -60d    │
│   ○ Insurance certificate received           🤝 Vendor   -45d    │
│   ○ Final vendor list shared with couple     🏠 Venue   -45d    │
│                                                                  │
│   + Add a task                                                  │
└──────────────────────────────────────────────────────────────┘
```

Clicking a task expands it in place — it does not navigate to a separate edit screen. This keeps the whole playbook feeling like one continuous document a venue is building, the same way the day-of timeline already works, rather than a series of disconnected forms.

## 3. Surfacing reminders, notifications, and escalation without overwhelming

These fields already exist (`reminderBeforeDays`, `escalationAfterDays`, `notifyOnAssign`, `notifyOnComplete`) and are exactly the kind of thing that turns a task row into an intimidating wall of fields if all shown at once. Progressive disclosure applies directly:

- **Collapsed by default.** A task, expanded, shows Name / Who / Category / Due date first. Reminders and escalation live behind a single secondary line: *"Remind me · Escalate if overdue"* — plain language, not a settings sub-panel, until clicked.
- **Smart defaults by category, not blank fields.** A Financial task defaults to a reminder 3 days before due, because that's almost always right; a venue never has to think about it unless they want something different. This turns "configure a reminder schedule" into "accept a sensible default or adjust it" — the same profile-based default-then-override shape already designed for notification preferences generally.
- **Escalation only surfaces as an option at all for required tasks.** An optional task escalating if ignored doesn't match how a venue thinks about it — required-ness gates whether escalation is even offered, not just whether it defaults on.
- **All of this reuses the notification system already designed** (`docs/notification-system-redesign.md`) — a task's reminder is a Planning Progress category notification; an escalation is that same system's attention-management layer. Nothing here is a second notification mechanism a venue has to separately learn.

## 4. One planning workflow, three audiences, each seeing only their own

**The coordinator's own view shows everything, audience-tagged — not everything, audience-hidden.** Reusing the exact `TimelineAudience` chip pattern already in this product: every task carries a small colored badge (👰 Client · 🏠 Venue · 🤝 Vendor), visible inline in the coordinator's builder, with a filter row above the milestone list to narrow to one audience at a time:

```
   [ All ]  [ 👰 Client ]  [ 🏠 Venue ]  [ 🤝 Vendor ]
```

This lets a coordinator see the whole operational picture, or answer "what does the couple actually see" by filtering to one chip — without ever leaving the builder or opening a different screen. The couple portal and vendor portal are simply this same filtered view, permanently locked to their own audience, rendered where each of them already lives (the "Plans" section in the couple portal, the task section in the vendor's event workspace) — one data set, three lenses, exactly the "one Documents section regardless of who uploaded" principle already established for Assets, applied here to tasks instead of files.

## 5. Where progressive disclosure further simplifies

- **Adding a task defaults to three fields**: name, who it's for, when. Category, dependencies, auto-complete triggers, attachments, and approval requirements sit behind an "Advanced" expansion a venue only opens when a task actually needs it — most tasks won't.
- **The playbook-level "Sync changes to existing events" action** (from the prior design document) should never be a persistent, always-visible control — it appears only after an edit is actually made to an already-in-use playbook, as a contextual prompt at the moment it's relevant, not a standing menu item someone has to understand in advance.
- **Dynamic playbook assignment at booking time is a single suggested choice, not a filter form.** The system proposes the one best-matching playbook based on the new event's details and shows why ("Corporate Event — matches your event type"); the coordinator confirms or picks a different one from the same small card list used at first-run. The guest-count/package/property filtering underneath stays invisible machinery, never a form the coordinator has to fill out themselves.
- **Luv's task-related nudges** (already designed) are the natural release valve for anything that would otherwise require a venue to remember to check on planning progress themselves — "Insurance hasn't been uploaded, want me to draft a reminder?" replaces a venue needing to scan the whole playbook looking for gaps.

---

## A short walkthrough, to confirm the mental model holds end to end

A new venue signs up. On first visiting Playbooks, they see three template cards, pick "Standard Wedding," and land inside a populated playbook organized into seven named milestones, each with a handful of tasks already sequenced with sensible due dates — not a blank builder. They rename "Vendor Selection" to "Booking Our Team" because that's how they talk about it internally; nothing prevented that.

They book their first couple. At event creation, the system proposes the Standard Wedding playbook (it matches the event type), they confirm, and every task — client, venue, and vendor — is generated with real dates against this specific wedding. The couple logs into their portal and sees exactly the handful of tasks tagged for them, in the same milestone language the venue chose, with no visibility into internal tasks like "order linens." The florist, once assigned, sees only "Florist confirmed" and whatever's tagged for vendors, in their own event workspace.

Two weeks before the wedding, a required task's reminder fires quietly at the interval the venue accepted as a default and never had to configure. Nothing escalates, because someone completed it. Luv notices the couple hasn't uploaded insurance and asks, once, whether to draft a reminder — the venue says yes, reviews it, sends it. Nothing happened automatically that the venue didn't see and approve first.

At no point did the venue "edit a record." They built a plan, once, and it ran itself — which is the entire point.

No code has been written. This is the experience design requested, ready for review before implementation begins.
