# Planning Playbooks — Two-Workflow Domain Model & Relative Scheduling

**Status:** Design only, no code — this revises a feature that was just cleared for commit, so I'd rather get the model right on paper first than implement against a misread. **Recommendation: hold the commit until this is reviewed.** The current implementation is correct for the model it was built against; it's the model itself that's changing.
**Relationship to prior docs:** Revises `docs/planning-playbooks-design.md` and the Phase 2 implementation's "one task model filtered by audience" decision. Everything about milestones-as-chapters, the Builder's reused Timeline interaction pattern, and reuse of the Notification Engine stays — what changes is what a "playbook" fundamentally is.

---

## The core shift

The current model: one task list per event, `ownerType`/`visibility` filtering who sees what. The revised model: **two separate planning experiences that happen to share underlying infrastructure** — Client Planning and Venue Operations aren't views over one list, they're different things a venue builds, applies, and works inside independently.

**One assumption I'm making, stated plainly so it can be corrected:** your message names exactly two workflows, not the three (Client / Venue / Vendor Coordination) named in the original Planning Playbooks vision. I'm reading Vendor Coordination as **folded into Venue Operations** — a vendor-visible task is still "owned by the venue, tracked with dependencies and escalation," it just happens to be completed by a vendor rather than a coordinator. Concretely: Venue Operations tasks keep an `owner` that can be Coordinator, Team, or **Vendor**, all inside the one Venue Operations playbook — not a third top-level playbook type. If that's wrong, the fix is small (a third `kind` value), but it changes the Application UI (two selectors vs. three), so worth confirming before I build either way.

---

## 1. Domain model: `kind` becomes the primary split, not `ownerType`/`visibility`

`playbook_templates` gains `kind: 'client' | 'venue'`. This is the Definition-side categorization everything else follows:

- **Client Planning Playbook** (`kind = 'client'`) — every task's `ownerType` is fixed to `couple` (not a per-task choice; the Client Builder never asks). No coordinator assignment, no department, no dependencies, no escalation — the fields don't exist in this Builder's form, not just hidden.
- **Venue Operations Playbook** (`kind = 'venue'`) — every task's `ownerType` is Coordinator, Team, or Vendor, with full dependency/escalation support.

This is not a new concept for `ownerType`/`visibility` — those fields stay exactly as they are in the schema. What changes is that **the Builder UI and the Application flow are now keyed on `kind` first**, and a single playbook's tasks never mix `couple`-owned and `coordinator`/`team`/`vendor`-owned tasks together. Two Builders (or one Builder with a `kind`-driven field set — same component, different form fields shown, matching how the existing `fieldset disabled` pattern already conditionally hides fields elsewhere in this codebase), not two task systems underneath.

**A concrete migration question this creates:** the real "Standard Wedding" playbook in the database today has 20 coordinator tasks and 4 couple tasks in one list — exactly the "shared checklist with different visibility" this change moves away from. Under the new model, that one playbook becomes two: a "Standard Wedding — Client Planning" (the 4 couple tasks) and "Standard Wedding — Venue Operations" (the 20 coordinator tasks). This is a real, one-time data migration decision, not just a schema change — worth deciding whether to auto-split existing playbooks this way or have venues rebuild them, before implementation starts.

## 2. Relative due dates — natural language in, structured rule stored, extensible by design

**What a venue sees and sets:** a direction (before / on / after), a number, and (for V1) a fixed reference point, "the event" — assembled into a sentence: *"30 days before the event," "On the event day," "3 days after the event."* Never a raw offset integer anywhere in the UI.

**What's stored — extensible without a future redesign:**

```
due_date_rule_kind   text   default 'relative_to_event'   -- future: 'relative_to_task' | 'relative_to_trigger'
days_offset          integer                              -- unchanged, still the source of truth for the math
reference_task_id    uuid   nullable                       -- future: which task this is relative to
```

`days_offset` stays exactly as it is today (negative = before, positive = after, zero = on the day) — it already does the job correctly and every existing reminder/apply calculation already works off it; there's no reason to replace working math. What's new is `due_date_rule_kind`, defaulting to `'relative_to_event'` for every task today and for the foreseeable V1 future. The natural-language composer and its formatter (`formatDueDateRule(rule): string`) are the only new pieces of logic — a pure display/input layer over the same number. Adding "relative to another task" later means adding a second formatter branch and populating `reference_task_id`; it does not mean migrating existing data or redesigning the task model, which is exactly the extensibility you asked for.

**No preset milestone list.** The composer is a free direction+number input, not a dropdown of "120/90/60/30/14/7" — a venue that collects final payment 45 days out isn't choosing from a list of days someone else decided mattered. This is the direct implementation of "don't lock venues into your idea of a planning timeline" — the flexibility already exists in the data (any integer works today), this only changes how it's *presented*.

**Recalculating on event-date change — a real, currently-missing piece.** Today, `applyPlaybookToEvent` computes `due_date = event_date + days_offset` once, at apply time, and stores it statically on `event_tasks`. If the event's date changes afterward, nothing recalculates — this is a genuine gap, not a defect in what shipped (it was never asked for until now). Recommended: when an event's date changes, recompute `due_date` for every one of its `event_tasks` where `due_date_rule_kind = 'relative_to_event'`, the same `event_date + days_offset` math already used at apply time, run as a follow-up step on the event-date-edit action (not a database trigger, so a coordinator sees it happen as part of the save, not as invisible magic). Future rule kinds recompute using their own logic when they're added — the per-kind design means this doesn't need to be solved for kinds that don't exist yet.

## 3. Task Details — the full field set, split by kind

| Field | Client Planning | Venue Operations |
|---|---|---|
| Title, Description, Notes | ✓ | ✓ |
| Attachments | ✓ | ✓ |
| Links | ✓ | ✓ |
| Relative due date | ✓ | ✓ |
| Reminder schedule | ✓ | ✓ |
| Auto-complete rule | ✓ (where applicable) | ✓ |
| Owner (Coordinator/Team/Vendor) | — | ✓ |
| Department/Role | — | ✓ |
| Dependencies | — | ✓ |
| Escalation | — | ✓ |

Two genuinely new fields for every task, regardless of kind: **Notes** (distinct from Description — Description is the instruction the task carries, Notes is free-form commentary added over time, same distinction already drawn elsewhere in this codebase between a vendor's `description` and a venue's own `notes` about that vendor) and **Attachments/Links**. Recommend reusing the existing Documents/Assets system for Attachments (`entityType`-scoped, same pattern already used for Vendor and Event documents) rather than a parallel file store — Links are lighter-weight (a small `{label, url}[]` stored directly on the task, no separate table needed for something this simple).

## 4. Application — two independent decisions, not one

A venue applies **a Client Planning Playbook and a Venue Operations Playbook separately**, each optional, each from its own selector. An event could reasonably have only a Venue Operations playbook applied (internal ops tracked, no formal client-facing checklist yet) or only Client Planning (rare, but not the software's call to prevent).

**This directly revises the duplicate-application guard shipped last turn.** `event_playbook_applications` was built with a primary key on `event_id` alone — correct for "one playbook per event," now wrong for "one Client playbook *and* one Venue playbook per event." The fix is small and doesn't touch the underlying trust logic: the primary key moves to `(event_id, kind)`. Flagging this now rather than letting it sit incorrectly — this needs to be part of the same implementation pass as the rest of this revision, not a separate follow-up, since committing the current single-key version first would just mean immediately migrating it again.

## 5. Experience polish — noted, not urgent architecture

Progress updates, notification firing, reminder adjustment, and completion celebration are real and worth doing, but they're UX-layer work on top of the domain model above, not something that changes the schema. Recommend sequencing them after the two-workflow split and relative-date model land, same reasoning as deferring Luv Insights until Templates/Journeys existed in the Communication Platform work — building the celebration animation before the underlying model is settled would mean re-doing it once the model changes.

---

## Open questions before implementation

1. **Vendor Coordination fold-in** — confirmed as Venue Operations with a Vendor owner-type, or a genuine third `kind`? (Assumption stated above; please correct if wrong.)
2. **Existing playbook migration** — auto-split "Standard Wedding" (and any other mixed playbook) into a Client/Venue pair by `ownerType`, or leave existing playbooks as-is and have venues rebuild under the new model? Auto-split is mechanical and lossless (every task's `ownerType` already tells you which side it belongs to) — recommended, but naming it as a decision rather than assuming.
3. **Holding the commit** — recommending yes, since the currently-implemented single-playbook-per-event model (including last turn's duplicate-application guard) would need reworking almost immediately otherwise.

No code has been written. Ready for your review before implementation begins.
