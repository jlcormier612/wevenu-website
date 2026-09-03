# Booking → Prepare Event Experience → Release — Current-State Audit

**Date:** 2026-09-02  
**Status:** Audit and implementation design only. Nothing in this document authorizes implementation.  
**Branch inspected:** `main` (plus uncommitted Event Experience / Luv work that does not change this lifecycle).  
**Method:** traced runtime code, migrations, RPCs, cron routes, and tests. Older design docs were read and treated as **stale where they contradict current code**.

**Authoritative product direction being evaluated (not current behavior):**

Lead → Book This Lead → Client + Event → venue prepares the Event Experience → Release Client Workspace → client enters a prepared workspace.

**Intended operating model (not current behavior):**

Templates define the venue’s operating model. Tasks execute it. Reminders keep people moving. Automations handle communications that genuinely need messaging. The venue handles exceptions.

---

## How to read this document

Classification used throughout:

- 🟢 **AUTOMATIC + VERIFIED** — code path exists, is invoked, and has an end-to-end execution mechanism (not merely stored fields).
- 🟡 **EXISTS BUT REQUIRES VENUE ACTION** — capability is real; a human must do it.
- 🟠 **EXISTS BUT IS DISCONNECTED/INCOMPLETE** — pieces exist but do not form the intended journey, silently do the wrong thing, or are only partially executed.
- 🔴 **MISSING** — not present in current implementation.
- ⚠️ **AMBIGUOUS / NEEDS PRODUCT DECISION** — architecture or copy cannot choose without Jennifer.

Distinguish:

- **CURRENT STATE** = what the running product does today.
- **TARGET STATE** = the Prepare → Release direction above. Not built.

Three different meanings of “booking” already coexist. Do not collapse them:

| Meaning | What it actually is | Where |
|---|---|---|
| **Sales Booked** | Lead converted to Client via Book This Lead | `leads.sales_stage = 'booked'` |
| **Event Confirmed** | Operational event status change | `events.status = 'confirmed'` → Platform Event `Booking.Confirmed` |
| **Canonical Booking (reporting)** | Signed contract **and** first payment-schedule line paid | view `canonical_bookings` |

None of these is currently a “prepared Event Experience released to the client.”

---

## A. CURRENT STATE — end-to-end trace

Concrete path: Lead exists → (optional contract/payment on the Lead) → Book This Lead → Client / Event → Automations → Planning → portal.

### A.1 Lead exists

- Created via `createLead` / public inquiry / import (`lib/leads/service.ts`).
- Relationship assigned; Conversation can exist.
- Default Automation **SEQ-01 “New Inquiry Welcome”** may enroll on `lead_created` (`lib/message-sequences/starters.ts`, provisioned by `seedStarterAutomations`).
- Stage moves may enroll `lead_stage_changed` Automations after a confirm dialog (`wouldEnrollOnPipelineStageMove` → `updateLeadSalesStage`).

### A.2 Contract signed / initial payment (before Book This Lead)

**CURRENT STATE:** neither is required, checked, or recorded as a conversion prerequisite.

Book This Lead UI (`components/leads/lead-detail.tsx` `handleConvert`) calls `convertLeadToClientAction` with **no** contract or payment inspection.

`convertLeadToClient` (`lib/clients/service.ts`) hard-blocks only:

1. Calendar blocked on the event date (`calendar_blocks`).
2. Duplicate Client for the same `lead_id` (`clients_lead_id_unique`).

It does **not** read `contracts`, invoices, `payment_schedules`, or `payment_line_items`.

A venue *may* have sent/signed a contract or taken a deposit **as a Lead document / separate Payments work**, but conversion does not know.

### A.3 Book This Lead

**UI:** `components/leads/lead-detail.tsx` — button “Book This Lead” (hidden if already `linkedClientId` or stage `lost`). Pipeline board cannot drag into Booked (`lib/leads/service.ts` `updateLeadSalesStage` rejects `booked` unless `allowBooked: true`).

**Server:** `app/(app)/clients/actions.ts` `convertLeadToClientAction` → `convertLeadToClient`.

**Mutations (verified in `convertLeadToClient`):**

| Step | Automatic? | What happens |
|---|---|---|
| Insert `clients` from Lead fields | 🟢 | `repo.insertClient(..., lead.id)` |
| Client activity “Converted from lead inquiry” | 🟢 | `insertClientActivity` |
| Active `date_holds` → `converted` | 🟢 | `convertLeadHolds` |
| Exit active sales Automations | 🟢 | `exitEnrollmentsForBooking` → `exited_booking` |
| Create `events` if `eventDate` set | 🟢 if date exists; 🟡 if not | `autoCreateEvent` → `insertEvent`; **status defaults to `draft`** (`supabase/migrations/20260626240000_events_foundation.sql`) |
| Re-tag Lead `documents` onto Event or Client | 🟢 | `documents` update (one-entity constraint) |
| Set `leads.sales_stage = 'booked'` | 🟢 | `updateLeadSalesStage(..., { allowBooked: true })` |
| Portal invitation email | 🟢 if Lead has email | `inviteClient` — **after** conversion returns |
| Playbook apply | 🔴 at this moment | not called |
| Contract / payment plan | 🔴 at this moment | not called |
| `Booking.Confirmed` Platform Event | 🔴 at this moment | only fires when `events.status` later becomes `confirmed` |
| Hosted website | 🔴 | not created; celebration checklist still claims it |

Direct Client create (`createClient_` / Add Client) runs the same `createClientCore`: calendar block, QBO enqueue, sequence exit, auto-event, **same immediate `inviteClient`**. Historical import skips the invite.

### A.4 After conversion — venue-facing UI

Redirect: `/clients/{id}/booked?eventId=&invited=1`  
`app/(app)/clients/[id]/booked/page.tsx` → `BookingCelebration`.

**CURRENT STATE vs truth:**

- Copy: “Their workspace is ready.”
- Checklist marks “Wedding website ready” **true whenever invited** (`components/clients/booking-celebration.tsx`). No website row is created at conversion.
- “Planning tools ready” is true whenever an Event exists, even with zero playbooks.
- CTAs: Open Event / Continue to Client / Dashboard. There is **no** Prepare wizard.

### A.5 What the client can do next

1. Invitation email is already sent (`lib/client-auth/service.ts` `inviteClient` → `client_invitations` + Resend).
2. Client accepts at `/client/accept` → RPC `accept_client_invitation` **creates `client_portal_sessions` immediately** and returns `accessToken`.
3. Client lands on `/p/{token}` — the Event Experience — **with no workspace-release gate**.

Client Planning tasks are hidden until `event_playbook_applications.released_at` is set (`get_portal_tasks` in `supabase/migrations/20260731000000_planning_draft_release.sql`). **Other portal surfaces are not gated** (Home, Journey, website editor, guests, documents, payments, messages, RSVP setup).

**CURRENT STATE:** a client can enter a half-configured workspace as soon as they accept the invite. Release exists only for **Client Planning tasks**, not for the workspace.

---

## B. BOOKING PREREQUISITES

### B.1 Contract

| Question | CURRENT STATE |
|---|---|
| Required before Book This Lead? | **No.** |
| Verified at conversion? | **No.** |
| Can exist on a Lead as a document? | Yes — Documents tab; conversion re-tags files. |
| Contract product itself? | 🟡 Full lifecycle: templates, send, sign-by-token (`lib/contracts/service.ts`). Independent of conversion. |
| Reporting “booking”? | `canonical_bookings` requires `contracts.status = 'signed'`. **Reporting only.** Does not block Book This Lead. |

### B.2 Initial payment / deposit

| Question | CURRENT STATE |
|---|---|
| Required before Book This Lead? | **No.** |
| Verified at conversion? | **No.** |
| Retainer shortcut after Client exists? | 🟡 `createRetainerInvoiceAndSchedule` (`lib/payments/service.ts`) — invoice + one deposit line + schedule. Manual, post-booking. |
| Mark paid? | 🟡 Venue or Stripe webhook. Not part of Book This Lead. |
| Reporting deposit? | `canonical_bookings` requires the **lowest-sort-order** `payment_line_items` row `status = 'paid'`. |

### B.3 Payment plan

**Classification: C — already available but disconnected from booking.**

- Not created at conversion.
- Created later at `/payments/new` via `createPaymentSchedule`.
- **Presets exist** (`SCHEDULE_PRESETS` in `lib/payments/constants.ts`) — structures (deposit / installments / final) with offsets from Event Date. These are **code fixtures**, not venue-authored reusable templates like Playbooks.
- Line due dates can derive from Event Date when a preset has `offsetDaysFromEvent`.
- Payment reminders are scheduled onto `task_reminders` (`lib/notifications/obligations.ts`) when line items have due dates.
- Regenerating a schedule from a preset exists (`regeneratePaymentSchedule`).

**Answer to the audit question:** payment-plan setup is **C — manually configured after booking**, with **disconnected presets** available. It is not missing, and it is not part of Book This Lead.

### B.4 Venue flexibility

CURRENT STATE already preserves flexibility: venues can book with no contract and no deposit. That is a **system rule of absence**, not a UI convention.

TARGET STATE (evaluate, do not implement): venue **reviews/confirms** booking conditions rather than a silent universal rule. That confirmation screen does not exist. The closest UI is the celebration page, which confirms nothing financial.

⚠️ Whether Book This Lead should remain unconstrained is a Jennifer decision (see K).

---

## C. PLANNING / TASK SYSTEM

### C.1 Template vs instantiated tasks vs client visibility

Do **not** collapse these. They are already three facts:

| Concept | Table / field | When it exists |
|---|---|---|
| **TEMPLATE** | `playbook_templates` + `playbook_tasks` + `playbook_milestones` | Venue Library. `kind` = `client` \| `venue`. Optional `event_type`, `is_default`. |
| **INSTANTIATED EVENT TASKS** | `event_tasks` + `event_playbook_applications` | After `applyPlaybookToEvent`. Copied fields; later Library edits do **not** mutate in-flight events (apply-time snapshot of milestone name/kind). |
| **CLIENT VISIBILITY** | `event_playbook_applications.released_at` for `kind='client'` | Explicit `releasePlaybookApplication`. Venue Planning sets `released_at` at apply (immediately active). |

RPCs `get_portal_tasks` / `complete_portal_task` refuse Client Planning tasks until `kind='client' AND released_at IS NOT NULL`.

### C.2 Are planning templates applied at Lead conversion?

**No.** `convertLeadToClient` never calls `applyPlaybookToEvent`.

### C.3 Where the venue applies them (manual)

1. **New Event form** — optional “Starting checklists” pickers, no preselection, **not filtered by event type** (`components/events/event-form.tsx`). Apply happens after `createEventAction` if the venue selected templates.
2. **Event → Planning tab** — apply / draft / **Release to {Client}** (`components/playbooks/event-task-list.tsx`).
3. **Silent later path** — when `events.status` becomes `confirmed`, cron `/api/automation/process` (every 15 min) runs `applyDefaultPlaybooksForConfirmedBookings` (`lib/automation/system-guarantees.ts`): applies each `is_default` template matching `event_type`. Client-kind still starts **Draft**. Venue-kind is immediately live with reminders.

Book This Lead creates the Event as **`draft`**, so this silent apply does **not** run at conversion. It runs only after a venue (or something else) confirms the Event.

### C.4 Recommendations

- `is_default` + `event_type` is used by the **system guarantee**, not by Book This Lead or the Event form picker.
- Event form lists all templates of that kind. No package / guest-count / location matching. 🔴
- Standard Wedding seed tasks exist in `lib/playbooks/constants.ts` (`STANDARD_CLIENT_PLANNING_*`, `STANDARD_VENUE_WORKFLOW_*`) when a venue creates those templates — not auto-applied at booking.

### C.5 Reminder pipeline (traced)

**Template fields** (`playbook_tasks` / `PlaybookTask`):

- `reminder_before_days` integer[] (e.g. `[7,3,1]`)
- `escalation_after_days`
- `notify_on_assign` / `notify_on_complete`
- `days_offset` + `due_date_rule_kind` (typically `relative_to_event`)
- Seed tasks set `reminderBeforeDays: null`; apply-time then uses **DEFAULT `[7, 3, 1]`** (`lib/playbooks/repository.ts`).

**When dates are calculated:** at apply, `due_date = eventDate + daysOffset` (`offsetDate`). Reminders scheduled at 08:00 UTC on those days.

**Materialized?** Yes, into `task_reminders` (`pending`).

| Kind | Reminders at apply | Reminders at Client Planning release |
|---|---|---|
| Venue Planning | 🟢 created immediately | n/a (already released) |
| Client Planning | deferred | 🟢 `releasePlaybookApplication` creates reminders for `ownerType === 'couple'` |

**Who receives:**

- Couple-owned → `notify_role = couple` (client email)
- Coordinator/team → venue email
- Vendor-owned → `vendor` role (email path for vendor in task engine is weak: couple/coordinator emails are the implemented recipients in `processReminders`)
- Overdue escalation → always coordinator
- Couple overdue chase → recurring per `venue_reminder_cadence.taskAfterDueCadence` (default every 3 days)

**Channel:** email via Resend (`lib/notifications/engine.ts`). SMS / in-app / push: skipped (“not yet implemented”). **Not** written to Conversation (`conversation_messages`). Logged in `notification_log`.

**Cron:** `GET /api/notifications/process` every 30 minutes (`vercel.json`). Also processes payment/contract obligation reminders (`obligation-engine.ts`).

**Overdue:** computed status on read; reminder types `overdue` / `escalation`; `processEscalations()` consumes `escalation_after_days`.

**Event Date change:** `updateEvent` → `recalculateEventTaskDueDates` (`lib/events/service.ts`). Unlocked `relative_to_event` open tasks get new due dates; pending reminders cancelled and recreated. Locked/overridden tasks skipped. `event_end_date` ignored.

**Edit after apply:** venue can change `days_offset` or lock an absolute due date (`updateEventTaskDaysOffset` / `updateEventTaskDueDate`); reminders rebuilt.

**Template edited later:** does **not** update already-instantiated `event_tasks`.

**End-to-end?** 🟢 Storage + cron + Resend path is real. 🟠 Not live-E2E certified in this audit (depends on deployed cron + `RESEND_API_KEY` + venue email). 🟠 Couple reminders can fire only after Client Planning **release**. 🟠 Booking celebration can invite the client **before** any of this exists.

### C.6 Standard Client Planning vs commercial booking

Seed Client Planning includes **“Sign your contract”** as a couple task with `autoCompleteTrigger: "contract_signed"` (`lib/playbooks/constants.ts`). That assumes contract signing is **planning work after booking**, not a conversion gate.

That is CURRENT STATE of the seed, not a decision that Book This Lead enforces a contract.

---

## D. AUTOMATION / SEQUENCE SYSTEM

Two **separate** automation families. Do not treat them as one.

### D.1 Message Sequences (“Automations” in Communication)

**Triggers (only):** `lead_created`, `lead_stage_changed`, `tour_completed` (`lib/message-sequences/constants.ts`).

**Default provisioned:** SEQ-01 New Inquiry Welcome (`lead_created`, two emails using MSG-01). **No default Booked Automation.**

**On Book This Lead:**

1. `exitEnrollmentsForBooking` → active enrollments `exited_booking`.
2. `updateLeadSalesStage('booked')` **exits again** (duplicate, same status) then `triggerSequencesForRelationship(..., 'lead_stage_changed', 'booked')`.

If the venue created a **Booked-stage** Automation, it **can enroll after sales sequences stop**. There is no product default that does this.

**Lost:** `updateLeadSalesStage('lost')` → `exited_lost`. (Older docs that said Lost did not exit are **stale**.)

**If no Automation is configured:** nothing extra sends. SEQ-01 already exited.

**Messages:** `sequence_enrollments` → `scheduled_messages` materialized at enroll (`materializeEnrollmentSteps`). Processor `/api/communication/scheduled/process` every 5 minutes. **On send, writes `conversation_messages`** (`lib/scheduled-messages/processor.ts`). Channel: email and/or SMS per step. Templates are venue copies of Message Templates; editable; Automation can be paused/disabled.

**Book This Lead confirm dialog:** stage-move enroll confirm exists for **manual stage changes**, not for Book This Lead (conversion does not preview a Booked-stage Automation).

### D.2 Platform Events + Automation Rules + system guarantees

**`Booking.Confirmed`** is **not** Lead conversion. DB trigger `log_event_status_changed` emits it when `events.status` changes to `confirmed` (`supabase/migrations/20260901000000_platform_event_framework_phase1.sql`).

Downstream:

- Unconditional venue in-app notification (`booking_confirmed`).
- Enabled `automation_rules` matching `Booking.Confirmed` (`lib/automation/engine.ts`): `apply_planning_template`, `send_notification`, `schedule_relationship_message`.
- **System guarantee:** auto-apply default playbooks for that `event_type` (`applyDefaultPlaybooksForConfirmedBookings`). This **is** a silent process choice when a default exists.

**CURRENT STATE:** post-booking operational setup is **not** primarily Sequences. Sequences are sales-follow-up. Post-booking work is mostly **manual Playbooks + Payments + Contracts**, with a **silent default-playbook apply after Event Confirmed**.

Much of what a Booked-stage email sequence might do (welcome, “sign this”, “pay this”) is already representable as **Client Planning tasks + reminders** in the seed — but those tasks are not applied or released at Book This Lead.

---

## E. CLIENT WORKSPACE / EVENT EXPERIENCE / RELEASE

### E.1 What exists today called “release”

**Client Planning Draft → Release** is real:

- Apply → `released_at` null for `kind=client`.
- Venue UI: Draft badge, Edit Draft, “Release to {Client}” (`event-task-list.tsx`).
- Release creates couple reminders and ensures a `client_portal_sessions` row exists (`lib/playbooks/service.ts` `releasePlaybookApplication`).

This is **not** “Release Client Workspace.” It only unhides playbook tasks in the portal.

### E.2 Portal access today

| Mechanism | When created | Effect |
|---|---|---|
| `client_invitations` + email | Immediately at Client create/convert if email present | Client can accept and enter |
| `client_portal_sessions` | At invitation **accept** (or later at Planning release if none) | `/p/{token}` Event Experience |
| Experience profile | `resolvePortalContext` | Wedding / COL / Anniversary / Corporate / General Event presentation seam (uncommitted bounded activation) |

**No** unpublished/draft workspace flag on the Client or Event.

### E.3 First client login / first task / venue follow-up

- First login: accept invite → `/p/{token}`.
- First **playbook** task: only after venue applies **and** releases Client Planning. Until then the portal task list is empty.
- Couple **personal todos**, website, guests, etc. can still appear independently.
- Venue first follow-up: Dashboard “Your Next Steps” (`lib/dashboard/venue-next-steps.ts`) — portal unopened, unsigned contracts, overdue payments, open venue/couple tasks. **Not** a booking-setup checklist.

### E.4 Hosted website / RSVP

Not created at booking. Website rows are created when the couple/venue uses Studio RPCs. RSVP is guest-invitation based, later.

---

## F. GAP ANALYSIS

### F.1 Missing relative to TARGET STATE

| Target step | CURRENT | Class |
|---|---|---|
| Confirm contract / deposit / payment plan at booking | Not in conversion; celebration ignores them | 🔴 as a flow; 🟡 as separate products |
| Recommend Client Planning template | Defaults used only after Event Confirmed; Event form has no recommend | 🟠 |
| Review/edit before client sees tasks | Draft/Release **exists** | 🟡 (manual, easy to skip because invite already went out) |
| Recommend Venue Planning | Same as client; silent apply after confirm | 🟠 |
| Review welcome communication | No booking-setup comms step; SEQ-01 is sales | 🟠 / 🔴 |
| Review Event Experience (type/profile/features) | Profile resolver exists; no booking review UI | 🟠 |
| Final readiness check | Celebration checklist is **false-ready** | 🟠 |
| Release Client Workspace | Only Client Planning task visibility | 🔴 as a workspace concept |
| Hold invite until release | Invite is automatic at convert | 🟠 (opposite of target) |

### F.2 Duplication / competing truths

1. **Three “booking” definitions** (sales / event confirmed / reporting).
2. **Two automation stacks** (Sequences vs Platform Event rules + system guarantees).
3. **Two portal session creators** (accept-invitation vs Planning release).
4. **Stale design docs** (`docs/booking-journey-design.md`, `docs/booking-workspace-design.md`) still describe `won`, auto portal session at convert, and “isDefault unused.” **This audit supersedes those grounding sections.**
5. Booking celebration claims website/planning readiness that conversion does not create.

### F.3 Over-dependence on Automations

Post-booking operational work is **not** currently carried by Sequences. Risk is the opposite: a venue **could** add a Booked-stage Sequence to paper over missing Prepare/Release, producing emails instead of a prepared workspace.

### F.4 What is already solid (reuse)

- Conversion itself (idempotent `lead_id`, calendar block, hold conversion, document re-tag, stage lock).
- Sequence stop-on-booking / stop-on-lost.
- Playbook apply + snapshot + Draft/Release for Client Planning.
- Reminder materialization + date-change recalc + cron email engine.
- Payment presets + retainer shortcut + obligation reminders.
- Contract send/sign lifecycle.
- Message Templates + Conversation logging for Sequence/scheduled sends.
- Event Experience profile resolver (presentation family).

---

## G. TARGET ARCHITECTURE (proposal only — do not implement)

Grounded in **existing** objects. No new CRM entity. No Zapier engine. No multi-event/client. No mass rename.

```
stored event_type
  → resolveExperienceProfile()
  → PortalContext.experienceProfile
  → customer-facing presentation

Lead (sales)
  → Book This Lead / Add Client   [keep as conversion]
  → Client + Event (draft)
  → PREPARE EVENT EXPERIENCE      [new venue flow, composed of existing actions]
  → RELEASE CLIENT WORKSPACE      [new gate; reuse Draft/Release + invite timing]
  → client accepts invite into a prepared /p/{token}
```

### G.1 Keep conversion as conversion

Do **not** turn `convertLeadToClient` into a silent super-apply. It should keep creating Client + Event + exiting sales Automations.

Move “prepare and release” to an explicit venue flow that **starts** at the existing `/clients/[id]/booked` handoff (or Client workspace), replacing the false “workspace is ready” celebration.

### G.2 Prepare Event Experience — compose existing verbs

One coherent venue screen (or stepped checklist) that **calls existing actions**, does not reimplement them:

1. **Confirm booking/financial readiness** — read-only status of latest contract, retainer/deposit line, payment schedule; links to existing Contract/Payments UIs; venue confirms “ready enough for us.” No universal hard block unless Jennifer later decides optional gates.
2. **Choose Client Planning** — list `playbook_templates` kind=client; **recommend** `is_default` + matching `event_type`, never auto-apply from this screen without review; `applyPlaybookToEvent` (already Draft); venue edits `event_tasks` in place (already possible).
3. **Choose Venue Planning** — same for kind=venue. Note: apply today **immediately** creates staff reminders. Prepare flow should say that plainly, or delay venue-kind reminders until a later “activate venue plan” if Jennifer wants symmetry (that would be a behavior change).
4. **Review client communications** — show: (a) portal invite not yet sent / already sent; (b) any Booked-stage Automation that would enroll; (c) reusable Message Templates. Default: **do not** invent a new Sequence. Prefer a **single welcome message** (scheduled send or send-now) and/or the existing invite email. Venue can disable auto-send.
5. **Review Event Experience** — show resolved profile + event type/date/guest count; do not flatten Wedding.
6. **Readiness check** — honest booleans: Event exists, Client Planning applied + edited, Venue Planning applied, payment plan present or explicitly skipped, contract present or explicitly skipped, invite **not** sent, Experience profile resolved.
7. **Release Client Workspace** — single venue action that, in order: releases Client Planning (`releasePlaybookApplication`), then sends `inviteClient` (if not sent), and records a release timestamp.

### G.3 What Release should mean (proposed; needs Jennifer)

Minimum coherent definition using existing machinery:

- Client Planning `released_at` set (tasks + couple reminders start).
- Invitation email sent **now**, not at convert.
- Client can open `/p/{token}` and see the prepared task list.

Out of scope unless later directed: gating website, RSVP, documents, or payments behind the same flag (those already have their own publish/share semantics).

### G.4 Tasks over unnecessary sequences

Prefer Client/Venue Planning tasks + `task_reminders` for operational nudges (sign, pay, questionnaire, insurance, guest count). Use Automations only for genuine **messaging campaigns** the venue authors (sales nurture, post-event review already on `Event.Completed`).

Do not expose “sequence” on the Prepare screen; the product already says “Automations.”

### G.5 Silent decisions to stop

- Stop treating invite-at-convert as “workspace ready.”
- Stop claiming website/planning tools ready without rows.
- Revisit silent `applyDefaultPlaybooksForConfirmedBookings` vs Recommend → Review (⚠️). It currently auto-applies after Event Confirmed, which can surprise a venue that thought Book This Lead was the only booking moment.

### G.6 Event Date remains the temporal backbone

Keep `days_offset` / `relative_to_event` / recalc on date change. Payment preset offsets already follow Event Date. Do not introduce a second calendar spine.

### G.7 Direct Add Client

Same Prepare → Release after `createClient_`. Do not build a second booking product.

---

## H. IMPLEMENTATION PHASES

Small, independently verifiable. Each phase must preserve Wedding depth and not flatten Event Experience.

### Phase 1 — Honest booking handoff (recommended FIRST)

**Goal:** stop lying; give the venue a real next-step list without changing client access yet.

- Replace `BookingCelebration` checklist with **actual** state: Event created?, invite sent?, Client Planning applied?, Client Planning released?, Venue Planning applied?, contract signed?, payment schedule exists?.
- Deep links to Event Planning, Contracts, Payments, portal invite widget — existing routes only.
- Do **not** yet delay `inviteClient`.
- Tests: celebration props/state helpers; no RPC/schema change.

**Why first:** zero client-facing access change; unblocks product review of the real gaps; reuses `/clients/[id]/booked`.

### Phase 2 — Recommend, don’t silently apply, on the handoff

- On the booked page (or a thin “Prepare” panel on the Event), show recommended Client/Venue templates (`is_default` + `event_type`) with Preview (existing `PlaybookApplyPreviewSheet`) and explicit Apply.
- Do **not** remove the Event Confirmed system guarantee in this phase without Jennifer’s decision (K.4). If left in place, the UI must disclose “this will also auto-apply if you later mark the Event Confirmed.”

### Phase 3 — Invite timing (requires K.1)

If Jennifer chooses invite-at-release:

- Stop calling `inviteClient` from `convertLeadToClient` / `createClientCore` (keep historical-import skip).
- Call `inviteClient` from a new `releaseClientWorkspace` that wraps `releasePlaybookApplication` + invite.
- Dashboard “Invite your couple” remains the escape hatch.
- Tests: conversion does not insert `client_invitations`; release does.

If Jennifer keeps invite-at-convert: skip this phase; Phase 1 honesty is the product.

### Phase 4 — Financial confirmation strip (not a hard gate unless K.2)

- Read contract + first payment line + schedule on the Prepare screen.
- Venue can mark “confirmed for our process” as an **acknowledgement**, stored as a simple timestamp/flag **only if needed**. Prefer not adding schema if the UI can live without it.
- Wire retainer/preset schedule creation as **actions from this screen** calling existing `createRetainerInvoiceAndSchedule` / `createPaymentSchedule`.

### Phase 5 — Communications review

- Show whether a Booked-stage Automation would enroll; do not auto-enroll from conversion without the same confirm dialog used for pipeline moves.
- Optional: one welcome Scheduled Send using an existing Message Template (Conversation-logged). Not a new engine.

### Phase 6 — Event Experience review

- Display `resolveExperienceProfile(event.eventType)` on Prepare.
- No new profiles. No portal redesign. Wedding wording stays.

### Phase 7 — Live E2E certification

- Sandbox: Book This Lead → Prepare → (optional) Release → client accept → first task visible → reminder cron → Conversation/notification_log as applicable.
- Do not declare AUTOMATIC+VERIFIED for delivery until this runs.

**Out of scope for all phases unless later directed:** Zapier-like builder, reconciling all event-type vocabularies, flattening Wedding Party/journal/seasonal cards, multi-event per client, renaming `sequence_*` tables.

---

## I. DATA / MIGRATION IMPACT

**Phase 1–2:** none required.

**Phase 3 (invite-at-release):** none strictly required; `client_invitations` already models pending invites.

**Optional later, only if Release must be queryable independently of playbook apply:**

- `events.workspace_released_at` **or** reuse Client Planning `released_at` as the workspace gate. Prefer **reuse** (`released_at`) if Release always implies Client Planning. If a venue may release a workspace with **no** Client Planning template, a dedicated flag becomes necessary. That is a Jennifer decision (K.3).

**Do not** add a parallel task system, a second reminder table, or a “booking_setup” entity. Compose `event_playbook_applications`, `event_tasks`, `contracts`, `payment_schedules`, `client_invitations`.

Payment **venue-authored templates** (Playbook-shaped) are **not** required to start; presets already exist. A template table is only justified if Jennifer wants reusable named plans beyond code presets.

---

## J. TEST PLAN

### Unit (current gaps / phase tests)

- Conversion does **not** require contract/payment (characterization tests around `convertLeadToClient` preconditions — today: calendar block + unique lead_id only).
- `exitEnrollmentsForBooking` + `exited_lost` ordering vs `lead_stage_changed` / `booked` enroll.
- Playbook: client apply leaves `released_at` null; venue apply sets it; `get_portal_tasks` empty until release.
- Reminder create/cancel/recalc on event date change (repository-level).
- Celebration/Prepare readiness helpers: website not implied by invite; planning not implied by event row.
- `canonical_bookings` definition remains reporting-only (do not accidentally reuse as a conversion gate without a test that conversion still succeeds without it).

Existing tests to keep green: `lib/message-sequences/*`, `lib/playbooks/apply-preview.test.ts`, `lib/payments/starters.test.ts`, `lib/dashboard/venue-next-steps.test.ts`, `lib/auth/portal-home.test.ts`, Event Experience resolve/presentation tests.

**Note:** there is **no** focused unit test file for `convertLeadToClient` itself today.

### Integration

- Apply + release RPCs: portal task list empty → released → visible → complete_portal_task.
- `accept_client_invitation` creates session token.
- Automation process: `Booking.Confirmed` + default template → `event_playbook_applications` row (client still draft).

### Live E2E (sandbox; not this audit)

1. Book This Lead with email, with date, without date.
2. Book with unsigned contract + unpaid deposit (must still succeed today).
3. Apply Client Planning, confirm portal tasks hidden, Release, confirm visible.
4. Confirm invite email (already PASS on Resend E2E generally; re-check this path).
5. Reminder cron: one due `task_reminders` row → Resend → `notification_log` (and that it does **not** appear in Conversation).
6. Sequence: SEQ-01 exits on booking; a custom Booked-stage Automation enrolls only if configured.
7. Event Confirmed: `platform_events` row; default playbook apply if `is_default` set.
8. Wedding profile still shows wedding copy on portal Home launch / RSVP / hero after this work.

---

## K. PRODUCT DECISIONS REQUIRED FROM JENNIFER

Only items that cannot be inferred from existing principles.

1. **Portal invite timing.** Keep sending at Book This Lead / Add Client, or delay until Release Client Workspace? This is the load-bearing access decision. Current code sends immediately.
2. **Conversion gates.** Remain unconstrained (current), or optional venue-confirmed checklist, or hard-require signed contract and/or deposit? Reporting already defines a two-sided canonical booking; conversion must not silently adopt that unless chosen.
3. **May a workspace be released with no Client Planning template?** If yes, `released_at` on playbook applications cannot be the only gate.
4. **Silent default playbook apply on Event Confirmed** (`applyDefaultPlaybooksForConfirmedBookings`). Keep as a system guarantee, disable, or replace with Recommend → Review on the Prepare screen?
5. **Venue Planning reminder start.** Keep “reminders fire the instant Venue Planning is applied,” or wait until workspace release / Event Confirmed?
6. **Booked-stage Automations.** Should conversion preview/confirm them like pipeline moves? Should Hello to Cheers ship a default Booked welcome Automation, or keep “none by default” and prefer tasks + one invite email?
7. **Event status at conversion.** Stay `draft` (current) vs auto-`confirmed`? Auto-confirm would fire `Booking.Confirmed` and the silent playbook guarantee immediately at Book This Lead.
8. **Financial “skip”.** On Prepare, may the venue explicitly skip contract and/or payment plan for venues that book verbally / invoice later?

Do **not** decide these in implementation.

---

## READY FOR IMPLEMENTATION (assessment)

**Already solid**

- Lead → Client conversion, Booked stage lock, calendar-block guard, hold conversion, document re-tag, unique `clients.lead_id`.
- Sales Automation exit on Booked and Lost.
- Client Planning **Draft vs instantiated tasks vs portal visibility**.
- Task reminder materialization, Event Date recalc, cron email engine.
- Payments presets, retainer shortcut, obligation reminders.
- Contracts as a standalone lifecycle.
- Conversation-logged scheduled/Automation sends.
- Event Experience profile seam (do not redesign portal).

**Must be fixed (product-completion, not a rewrite)**

- Booking celebration states a prepared workspace that conversion does not create.
- Invite-at-convert lets the client enter before Client Planning exists or is released.
- Three competing “booking” meanings with no venue-facing explanation.
- Silent default playbook apply is keyed off **Event Confirmed**, not Book This Lead — easy to miss or to be surprised by.

**Reuse**

- `convertLeadToClient` / `createClientCore` as conversion only.
- `applyPlaybookToEvent` + `releasePlaybookApplication` + Event Planning UI.
- `inviteClient` / `accept_client_invitation`.
- `createPaymentSchedule` / `createRetainerInvoiceAndSchedule` / `SCHEDULE_PRESETS`.
- Contract send/sign.
- Message Templates + scheduled sends.
- `/clients/[id]/booked` as the Prepare shell.
- `resolveExperienceProfile`.

**Needs new implementation**

- Honest Prepare checklist UI (Phase 1).
- Recommend/select templates at that handoff (Phase 2).
- Optional invite-at-release orchestration (Phase 3, after K.1).
- Financial/comms/Experience review strips that **call** existing services (Phases 4–6).
- Not: a new automation platform, new task engine, or workspace object competing with Client/Event.

**Recommended FIRST implementation phase**

**Phase 1 — Honest booking handoff.** Replace the false “Workspace Ready” celebration with a factual Prepare checklist and links into existing Event Planning, Contracts, Payments, and invite tools. Do not change invite timing, conversion rules, or silent Event Confirmed playbook apply until Jennifer answers K.1, K.2, and K.4.

No implementation, commit, or push was done for this audit.
