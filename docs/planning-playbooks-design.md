# Planning Playbooks — Design (Phase 1)

**Status:** Approved. Phase 2 (implementation) is complete — see `playbook_milestones` (migration `20260722000000_planning_playbook_milestones.sql`), `components/playbooks/playbook-builder.tsx`, and `components/playbooks/playbook-starter-picker.tsx`. One correction made during implementation is noted inline below where it appears.
**Checked against:** `docs/product-strategy-charter.md` in full. Every major decision below is traceable to a specific principle, named inline rather than assumed.
**Reuses, rather than duplicates:** `docs/notification-system-redesign.md` (reminders/escalation/channels), `docs/vendor-onboarding-and-assets-design.md` (documents as Assets), the existing Contact/portal_role model (for "Planner" as an owner), and the existing Conversation model (for any task-triggered messaging). This document does not re-litigate any of those — it plugs into them.

---

## The most important finding before any redesign: this isn't a checklist today, underneath

Before proposing anything, I read the actual current schema (`lib/playbooks/types.ts`, `constants.ts`, `service.ts`), not just the UI. What's actually there already:

- **`PlaybookTask` already has**: `ownerType` (coordinator/couple/vendor/team), `visibility` (coordinator_only/client_visible/client_owned/vendor_visible/vendor_owned), `category`, `phase`, `daysOffset` (relative to event date), `dependsOnTaskId`, `autoCompleteTrigger`, `isRequired`.
- **A real reminder/escalation engine already exists**: `reminderBeforeDays` (an array — e.g. `[7, 3, 1]`), `escalationAfterDays`, `notifyOnAssign`, `notifyOnComplete`, backed by a genuinely working `task_reminders` table and delivery engine (the same "Notification Engine" reviewed last turn — real Resend sends, cron-driven, not scaffolding).
- **Applying a playbook to an event already copies tasks**, not references them — meaning editing a playbook template today already can't silently alter existing events. That specific trust requirement is already satisfied by construction, not something this redesign needs to build.
- **Luv already computes event-readiness from task completion** (`lib/luv/event-readiness.ts`), surfaced in `components/luv/luv-client-panel.tsx` — Luv observing planning progress is not a new integration, it's an existing one to extend.

So the honest framing is: **the data model already assumed most of this vision five sprints ago.**

**Correction, made during Phase 2 implementation:** this document originally claimed here that the `visibility` values were "read by nothing" in either portal, based on a grep that only covered `app`/`components`/`lib` TypeScript files. That grep missed two real, working delivery surfaces implemented as Postgres RPCs: `get_portal_tasks` (`supabase/migrations/20260704000000_sprint80_phase_in_portal.sql`), consumed by `components/portal/portal-shell.tsx` via `lib/portal/service.ts`, and the authenticated vendor-event workspace query in `lib/vendor-events/service.ts`. Both already filter on `client_visible`/`client_owned` and `vendor_visible`/`vendor_owned` respectively, and both already let the couple/vendor complete their own `*_owned` tasks. The claim was wrong, and is corrected here rather than left standing now that it's been found — per this project's own verified-not-assumed discipline. The actual, smaller gap was that the Builder itself never exposed `reminderBeforeDays`/`escalationAfterDays` in its form, so reminders/escalation existed in the schema and the Notification Engine but a venue had no way to set them per task — that gap is what Phase 2 closed.

The redesign is still primarily an information-architecture and builder-UX rework of the coordinator side — milestones as a real entity, one task model filtered by audience, progressive disclosure for reminders/escalation — reusing the two delivery surfaces and the Notification Engine as-is, per the Charter's **reuse before creating**.

A second, smaller finding worth fixing regardless of anything else: **`app/(app)/settings/playbooks/[id]/page.tsx` and `app/(app)/library/playbooks/[id]/page.tsx` are near-identical duplicate routes** to the same editor, reached from two different nav entry points. Consolidate to one canonical route before or alongside this redesign — a direct, concrete instance of **remove before adding**.

---

## Naming

**Task Playbooks → Planning Playbooks.** "Task" describes the output; "Planning" describes the goal. The rename should propagate through user-facing copy and route naming (`/library/playbooks` → keep the URL, change the words on the page) but does **not** require renaming the underlying `playbook_templates` database table — that's an internal identifier a venue owner never sees, and renaming it costs a migration for zero user-facing benefit. Flagging this explicitly as a place to *not* spend effort, per the Charter's own "ask whether this increases confidence" test — a table rename doesn't.

A **Playbook** is the complete operational blueprint. A **Milestone** is a phase within it. A **Task** is one action within a milestone. This is the vocabulary used throughout the rest of this document.

---

## Information architecture

Matching the hierarchy requested exactly:

```
Planning Playbook
 └─ Milestones (ordered, named, editable — not a fixed enum)
     └─ Tasks (rich metadata, see below)
         ├─ Reminder Schedule
         ├─ Escalation Rule
         └─ Automation (dependency / auto-complete trigger)
```

**Milestones become a first-class, configurable concept — not the current fixed 4-value `phase` enum.** Today, `TaskPhase` is `planning | final_details | wedding_day | post_wedding`, hardcoded for every playbook. The redesign needs a `playbook_milestones` table (`id`, `playbook_id`, `name`, `description`, `sort_order`) so a venue can define their own sequence — the requested example (Booking / Planning / Vendor Selection / Final Planning / Wedding Week / Event Day / Post Event) becomes the **default seed**, not a hardcoded ceiling. Existing `phase` values migrate cleanly into this as the default playbook's first milestone set — no data loss, additive change.

---

## Three planning audiences — already half-built, needs the other half

The `visibility` field already encodes exactly the three-audience split requested:

| Audience | Existing field values | What's missing |
|---|---|---|
| **Client Planning** | `client_visible`, `client_owned` | A real "Plans" section in the couple portal reading these — doesn't exist yet |
| **Venue Operations** | `coordinator_only` | Already fully working (this is the entire current UI) |
| **Vendor Coordination** | `vendor_visible`, `vendor_owned` | A real task section in the vendor's event workspace reading these — doesn't exist yet |

**Recommendation:** don't add a fourth visibility value or restructure this field — build the two missing consumption surfaces against the field that's already there. This is the single largest genuine build in this whole redesign, and it's also the one that makes the biggest difference to what the venue owner actually feels: today, "assign this to the couple" is a lie the software tells the coordinator, because nothing shows the couple anything. Fixing that is more valuable than any of the builder-UI polish below.

One naming nuance worth deciding deliberately: the request separates "Vendor Coordination" tasks as sometimes "vendor-facing or internal." The existing `vendor_visible` (vendor can see, coordinator completes) vs. `vendor_owned` (vendor must complete) split already captures this distinction cleanly — no new field needed, just confirmed as correct.

---

## Task model

Extending the existing fields, not replacing them:

| Field | Status | Notes |
|---|---|---|
| Name, Description/Instructions | exists | — |
| Owner | exists (`ownerType`) | Add **Planner** by *reusing the existing Contact model* (a planner is a Contact with elevated `portal_role`), not a new owner-type dimension — a direct instance of reuse-before-creating. "Team Member" already covered by `team` + `assignedToStaffId`. |
| Category | exists, narrower than requested | Extend the enum: add Timeline, Logistics, Decor, Food, Music, Legal alongside the existing Communication/Financial/Planning/Document/Meeting/Internal. Additive, low-risk. |
| Due Date (relative) | exists (`daysOffset`) | Already exactly this. |
| Visibility | exists | See above — the field is right, the delivery surface is missing. |
| Completion Type (manual/automatic/triggered) | exists (`autoCompleteTrigger`) | **Known, already-documented gap, worth fixing in this pass, not ignoring:** the architecture audit already found `AUTO_COMPLETE_TRIGGERS` lists more trigger types than the codebase actually fires (`payment_received`, `document_uploaded_insurance`, `floor_plan_created` are selectable but structurally dead). A playbook that silently never auto-completes a task it was configured to is a **Trust First** violation on its own — fix the dead triggers as part of this redesign, don't let a newly-renamed feature ship with a pre-existing lie in it. |
| Dependencies | exists (`dependsOnTaskId`) | Currently single-dependency. Fine as-is for v1 — multi-dependency ("cannot start until A *and* B") is a real future extension, not needed to satisfy the request's given example. |
| Reminder Schedule | exists (`reminderBeforeDays`) | Already an array of day-offsets — already matches the request directly. |
| Escalation Rules | exists, narrower than requested | Currently a single `escalationAfterDays` → one implicit target (coordinator). Extend to a target list (Client / Venue / Planner / Owner) — **this should be built as an application of `docs/notification-system-redesign.md`'s categories and escalation model, not a separate mechanism.** A task escalation *is* a Business-Critical-category notification with an escalation rule attached — same infrastructure, one more producer of events into it. |
| Attachments | partially exists via Documents | Should be **Assets**, per `docs/vendor-onboarding-and-assets-design.md` — a task requiring "insurance COI" links to the same Documents/Assets system already used for vendor and event documents, not a new file field on the task row. |
| Notes / instructions / reference links / templates / videos | mostly exists (`description`) | `description` already supports this; a template/video *link* is just a URL field, no new subsystem needed. |
| **Approval checkpoints** | doesn't exist | Recommend modeling as a task attribute (`requiresApproval: boolean`, `approvedBy`, `approvedAt`) rather than a separate entity type — an approval checkpoint is structurally a task with a stricter completion rule (a specific person must confirm, not just "mark done"), not a different kind of object. Keeps one Task concept instead of two. |

---

## Dynamic playbook assignment

A venue already can maintain multiple playbooks (`PlaybookTemplate.eventType` + `isDefault` already support this) — what's missing is richer matching:

- Add filter dimensions to the playbook itself: guest count range, package, property/space, event type (already exists).
- At booking time, the system **proposes** the best-matching playbook based on the new event's actual guest count/package/property/type — and the coordinator confirms or overrides. This is a direct **System proposes. Human confirms.** application, not an automatic silent assignment — matching functionality would violate Trust First if it just applied a playbook without the coordinator seeing which one and why.

## Playbook library and change application

Today, applying a playbook copies tasks — already safe by construction, editing a playbook never silently touches an event that already has its own copied tasks. What doesn't exist yet is the requested *opt-in* update path:

- A "Sync changes" action on an edited playbook, which **proposes** — never silently applies — updating events currently using it. The choice presented is exactly as specified: apply to future events only (the new default going forward, no further action), apply to all upcoming events using this playbook (a real batch update, previewed as a diff before commit), or apply to one specific event only.
- This is worth being explicit about scope: the "diff preview before commit" is the actual trust-critical part. A checkbox that says "update existing events" without showing *what* changes is decorative, not real confirmation.

## Luv integration

Extends `lib/luv/event-readiness.ts`, does not replace it. Luv already knows which required tasks are incomplete and how close the event is. The new behavior is surfacing that proactively, in the exact propose-then-confirm shape already established for Luv drafts elsewhere in this app (Luv drafts a follow-up email; the coordinator reviews, edits, sends — never sent automatically):

- "Final guest count is due in 14 days." → "Would you like me to remind Sarah?" → drafts the reminder, coordinator sends it.
- "Insurance has not been uploaded." → "Would you like me to send a reminder?" → same shape.
- "Photographer has not been selected." → "Here are three preferred photographers." → surfaces vendor search results, coordinator picks and assigns; Luv never assigns a vendor on its own.

No new Luv engine — this is the existing computation plus a proposal-surface, matching the same discipline already used everywhere else Luv touches the product.

## Builder UI/UX

The current editor (`playbook-task-editor.tsx`) presents every field as a flat form row — name, phase, category, owner, visibility, auto-complete, depends-on, all at once. The redesign should be a genuine builder, organized to match the hierarchy, with **progressive disclosure** doing real work here:

- **Left rail:** the playbook's milestones, in order, reorderable. Selecting one shows its tasks.
- **Task list within a milestone:** compact rows (name, owner badge, due offset) — not the full field set visible at once.
- **Task detail panel** (opened per task, not always-open): fields grouped, not flat — *Basics* (name, description, category) → *Assignment & Visibility* (owner, visible-to) → *Timing* (due offset, reminders, escalation) → *Automation* (auto-complete trigger, dependency, approval requirement) → *Attachments*. A coordinator building a simple task never needs to open past *Basics*; a coordinator building a compliance-critical one can go all the way down. This is progressive disclosure applied to a single object, not just to a settings page.
- The overall page should read as "I am building the blueprint every [Standard Wedding] event will follow," not "I am editing rows in a table" — achieved by the milestone-first layout and hierarchy, not by decoration.

---

## What I'd push back on / simplify, per the explicit instruction to challenge assumptions

- **Don't build "Approval Checkpoint" as a separate object.** It's a task with a stricter completion rule. Two entities here would immediately create the same "two things answer the same question" shape Engineering Standard #9 exists to catch.
- **Don't add "Planner" as a new owner-type enum value.** Reuse the existing Contact/portal_role model. A planner is a person with a role on an existing relationship, not a new kind of actor in the system.
- **Don't rename the underlying database table.** The user-facing rename (Task Playbooks → Planning Playbooks) is a copy and information-architecture change; renaming `playbook_templates` buys nothing a venue owner will ever perceive.
- **Don't build a second reminder/escalation/notification pipeline.** Everything in "Reminder Schedule," "Escalation Rules," and "Notifications" should be additional producers into the already-designed `docs/notification-system-redesign.md` categories (Planning Progress, Vendor Activity, Business Critical), not a parallel system that will drift from it the way `message_threads`/`couple_threads` did.
- **The 7 example milestones are a strong default seed, not a fixed list.** Making Milestones genuinely configurable (not hardcoded) is more valuable than getting the default 7 exactly right, and costs the same to build.

## What this document deliberately leaves open

- Exact UI treatment of multi-target escalation (a list picker vs. checkboxes) — implementation-level, not architectural.
- Whether guest-count/package/property filtering on playbook assignment is AND or OR logic across multiple active filters — a product decision to make when this is actually built, not before.
- Whether "vendor coordination" tasks assigned to a *specific* vendor differ from ones visible to *whichever* vendor gets assigned later — worth a short follow-up conversation before Phase 2 starts on that specific piece.

No code has been written. This is the Phase 1 deliverable requested — ready for review before Phase 2 begins.
