# Venue Lifecycle Automation — End-to-End Completion Pass

**Date:** 2026-08-04
**Status:** IN PROGRESS — see Final Status at the end. Do not treat any phase below as complete until its own evidence is shown.

This report traces the real, current implementation — not the aspirational one described in `docs/platform-orchestration-architecture.md` and `docs/platform-event-adoption-plan.md`. Both documents are read and cited throughout, but **where current code has moved ahead of what those documents describe, this report says so explicitly** — several gaps those documents identified have already been closed since they were written, and this report is the first place that's been confirmed against live code rather than assumed from the docs.

---

## Phase 1 — The Actual Lifecycle, Traced From Code

### 1a. The canonical path, in plain language

```
Inquiry (leads insert)
  → Pipeline entry (lead created, relationship_id assigned)
  → Sales stage changes (leads.status)
  → Won → convertLeadToClient() [lib/clients/service.ts]
       → clients row inserted
       → if lead had an event date: events row auto-created, status defaults to 'draft'
       → sequence enrollments for this relationship exited ("stop on booking")
  → (separate, later, manual step) staff confirms the booking:
       events.status: 'draft' → 'confirmed'  [components/events/event-detail.tsx → updateEventStatus_]
       → THIS is "Booking" for automation purposes — not lead.status='won', not client creation
  → Planning / Onboarding: a playbook template applied to the event (today: manual only — see 1c)
       → event_tasks + task_reminders generated, due dates offset from event_date
  → Event Preparation: tasks become due, reminders fire, escalations fire if overdue
  → Event Day: no special mechanism — the event's own event_date
  → events.status → 'complete' (manual, staff-driven)
  → Post-Event: Event.Completed → (if an Automation Rule is configured) review/referral message
```

**Key finding stated up front:** "Booking" is not one thing in this codebase. There are two, sequential, independently-triggerable events, and conflating them was the root of the gap this pass exists to close:
1. **Lead won / client created** (`convertLeadToClient`) — a sales-pipeline fact.
2. **`events.status → 'confirmed'`** (`Booking.Confirmed`) — an operational fact, set later, by hand, once (per this codebase's own comments) a contract/deposit or other real commitment exists.

Only #2 is wired to Platform Events / Automation today. #1 has its own, separate hooks (sequence exit, hold conversion) that have nothing to do with #2.

### 1b. Full event matrix

Columns: **Source of truth** = the table/column that actually changes. **Platform event?** = does `platform_events` get a row (confirmed via migration + live query, not doc-trust). **Sequence trigger?** = does Message Sequences react. **Automation trigger?** = can an `automation_rules` row match it. **Tasks/playbook action** = what happens to `event_tasks`. **Message action** = what happens to `scheduled_messages`. **Notification action** = what happens to `venue_notifications`.

| Lifecycle event | Source of truth | Platform event? | Sequence trigger? | Automation trigger? | Tasks/playbook action | Message action | Notification action | Current behavior | Required behavior | Gap |
|---|---|---|---|---|---|---|---|---|---|---|
| New inquiry created | `leads` INSERT | No | **Yes** — `triggerSequencesForRelationship(..., "lead_created")` via `lib/lead-intake/pipeline.ts` | No | None | Enrolls matching active sequences → writes `scheduled_messages` | `notify_new_lead` trigger → `venue_notifications` | Working, confirmed live (see Phase 4) | — | None found |
| Relationship enters pipeline | Same as above — pipeline entry *is* lead creation in this schema | No | Same as above | No | — | — | — | Same event as "new inquiry" | — | Not a separate event in this schema — documented, not inferred |
| Sales stage changes | `leads.status` UPDATE | No | **Yes** — `triggerSequencesForRelationship(..., "lead_stage_changed", status)` in `lib/leads/service.ts` | No | None | Enrolls matching sequences for that specific stage | None specific to stage change | Working, confirmed live | — | Stage change has no Platform Event and no notification — acceptable per architecture (§0(b) is a separate, older mechanism by design, not yet wrapped per adoption plan §4 item 3) |
| Inquiry becomes qualified | Not a modeled state distinct from a `leads.status` value the venue defines | — | Same as stage change | — | — | — | — | Whatever "qualified" maps to is venue-configured `leads.status`, not a platform concept | — | Not inferred beyond stage-change handling above |
| Proposal sent | Not represented as its own entity/status in this schema | — | — | — | — | — | — | Not modeled | — | Confirmed absent — not a gap to fix here, a scope note |
| **Booking occurs** | `events.status: 'draft' → 'confirmed'` | **Yes** — `Booking.Confirmed`, DB trigger `log_event_status_changed()` | No (sequences don't listen for this) | **Yes** — `automation_rules.trigger_event_type = 'Booking.Confirmed'` | **Manual only today** — `applyPlaybookToEvent` requires a staff click or an enabled Automation Rule | Only if an Automation Rule with `schedule_relationship_message` is configured for this trigger (none is today) | `_trigger_notification_from_platform_event` → `booking_confirmed` type, fires unconditionally | Platform event fires correctly; nothing downstream fires unless manually configured | Playbook should apply automatically when a default exists | **Confirmed real gap — fixed in Phase 3** |
| Contract/agreement status changes | `contracts.status` (has a `'signed'` value, `signed_at` column) | **No** | No | No | No | No | No | Contract signing is invisible to every downstream system | Per adoption plan §4 item 5, this is a "new trigger, no existing mechanism" item, explicitly not yet scheduled | Confirmed gap, **out of scope for this pass** — flagged, not fixed (see Remaining Blockers) |
| Deposit/payment milestones | `payment_line_items.status` (pending/processing/overdue/paid/cancelled/partially_refunded/refunded) | **No** | No | No | No | No | No | `mark_overdue_payments()` flips status lazily, only when a payment-schedule read happens to run it | Per adoption plan §1(c)/§4 item 4, the hardest, last-ordered wrap — not yet done | Confirmed gap, **out of scope for this pass** — see Phase 6 and Remaining Blockers |
| Event enters onboarding/planning | Same moment as `applyPlaybookToEvent` succeeding | Not separately — it's a consequence of Booking.Confirmed once Phase 3 applies | — | — | `event_tasks` + `playbook_milestones`-derived rows inserted, `event_playbook_applications` row marks it done | Deferred for client-kind until release; venue-kind reminders created immediately | None specific | Was entirely manual; now automatic where a default exists (Phase 3) | — | Closed by Phase 3, conditional on a default template existing (see Phase 10) |
| Planning milestones/tasks become due | `event_tasks.due_date <= today`, `status` still open | No | No | No | `task_reminders` (created at apply-time from `reminder_before_days`) processed by `processReminders()` | No | Email via `buildReminderEmail`/Resend, per role | Working, cron-driven in prod (`/api/notifications/process`, */30 min) | — | Confirmed working — see Phase 5 |
| Task completion | `event_tasks.status → 'complete'` | No | No | No | — | — | `notify_task_completed` trigger — **only fires for `completed_by IN ('couple','vendor')`, a coordinator completing their own task emits nothing** | Confirmed still true, doc-stated and re-verified live | Intentional per the trigger's own name/comment, not obviously a bug | Documented behavior, not silently broken — flagged for product judgment, not fixed here |
| Overdue tasks | `event_tasks.due_date < today`, still open | No | No | No | — | — | Reminder sweep still fires per schedule; **`escalation_after_days` now genuinely consumed** by `processEscalations()` (confirmed live — this closes a gap the architecture doc itself said was still open) | Working | — | **Positive finding**: doc said this field was unused; it is now used. Doc is stale here, not code. |
| Client/couple task completion | Same `event_tasks.status → 'complete'`, `completed_by = 'couple'` | No | No | No | — | — | `notify_task_completed` fires (see above) | Working | — | None found |
| Payment due/overdue | `payment_line_items.status` | No | No | No | No | No | No | Same gap as "deposit/payment milestones" above | — | Same confirmed gap |
| Final guest count / insurance / vendor deadlines | `event_tasks` rows with `category`/`due_date` set by a playbook template (e.g. the seeded "Vendor COIs in file" task) | No | No | No | Reminder + escalation machinery applies identically to any task, regardless of category | Same as any task | Same as any task | Working, no category-specific special-casing needed or found | — | None found — these are ordinary tasks, not a separate mechanism |
| Event approaching | `events.event_date` read directly, `daysUntil` computed at render time in Luv/portal observation code | N/A by design | N/A | N/A | N/A | N/A | N/A | Correct per architecture §0(e) — computed fresh, never stored/triggered | — | See Phase 7 — confirmed single canonical field (`events.event_date`), computed in multiple small local functions, not one shared function — acceptable, see Phase 7 |
| Event day | Same field, `daysUntil === 0` | N/A | N/A | N/A | N/A | N/A | N/A | Same as above | — | None found |
| Event completed | `events.status → 'complete'` | **Yes** — `Event.Completed` | No | **Yes** | No automatic action configured beyond the one enabled rule (see below) | **Yes, when the one enabled rule fires** — `schedule_relationship_message` (review/referral, `offsetDays: 3`) | `_trigger_notification_from_platform_event` → `event_completed` type, fires unconditionally | Confirmed live: 2 real `automation_executions` rows exist from prior real firings | — | Re-verified in Phase 7 |
| Post-event review/referral | Consequence of `Event.Completed` + the one enabled Automation Rule | — | — | — | — | Writes to `scheduled_messages`, processed by `/api/communication/scheduled/process` | — | Working, confirmed live in Phase 7 | — | None found, correctly venue-configurable (Phase 2) |
| Cancellation/lost relationship | `leads.status = 'lost'` or `events.status = 'cancelled'` | **No** | Sequences do NOT exit on loss/cancellation the way they do on booking (`exitEnrollmentsForBooking` is booking-specific; no equivalent `exitEnrollmentsForLoss` found) | No | No | No | No | A lost/cancelled relationship can keep receiving scheduled sequence messages | Sequences should stop on loss the same way they stop on booking | **Confirmed real gap — flagged, not fixed this pass** (see Remaining Blockers; fixing it correctly requires the same "stop on X" pattern already established, low risk, but out of the phase budget spent verifying the booking gap) |

### 1c. Corrections to the existing architecture documents

Both `docs/platform-orchestration-architecture.md` and `docs/platform-event-adoption-plan.md` are treated by this codebase as authoritative, but current code has moved past them in specific, verifiable ways:

1. **The orchestration doc's §0(a) table lists 9 old triggers; live count is 11**, and two of them close gaps the doc explicitly flagged as open: `notify_conversation_message` (the doc said the newer `conversation_messages` table had "no notification fires at all" — false today) and `notify_tour_scheduled` (the doc said "Tour booked... Not emitted" — false today).
2. **A new, event-driven notification trigger already exists and is live**: `_trigger_notification_from_platform_event`, firing on `platform_events` INSERT for exactly `Booking.Confirmed`, `Event.Completed`, and all 5 `Request.*` events. This is the adoption plan's §5-described "new Notifications consumer" — already built, already live, **not in shadow mode**, and confirmed to have **zero event-type overlap** with the 11 old triggers (verified by diffing both trigger sets' event coverage directly). No double-firing exists today.
3. **`escalation_after_days` is consumed** (`lib/notifications/engine.ts`'s `processEscalations()`, wired into the `/api/notifications/process` cron) — the orchestration doc's §4 called this field real-but-unused; it is now used, idempotently (`escalated_at` guard).
4. **`Booking.Confirmed`/`Event.Completed` are emitted as Platform Events** — the orchestration doc's §1 table says "Logged, not emitted" for both; the adoption plan's own §4 item 1 wrap has since been executed (`supabase/migrations/20260901000000_platform_event_framework_phase1.sql`).

None of the above required a code change in this pass — they are corrections to what the documentation claims about current state, established by reading migrations and live trigger definitions directly rather than trusting either document's own age.

---

## Phase 2 — System-Required vs. Venue-Configurable, the Actual Boundary

**A. System-required (must never depend on an Automation Rule existing or being enabled):**

| Behavior | Why it's system-required | Where it's enforced |
|---|---|---|
| Default playbook applies on Booking.Confirmed, when a default exists for that venue+event_type | A venue owner should never need to discover Automation Rules to get their own already-configured default template applied | **Fixed in Phase 3** — a new, unconditional pass in the automation engine, independent of any `automation_rules` row |
| Sequence enrollment on lead creation / stage change | Already system-required in practice — called directly from `lib/leads/service.ts`/`lib/lead-intake/pipeline.ts`, never gated by an Automation Rule | Already correct, no change needed |
| Sequence exit on booking | Same — `exitEnrollmentsForBooking` called directly from `convertLeadToClient`, unconditional | Already correct |
| Task reminders / escalations for any task that has `reminder_before_days`/`escalation_after_days` set | A playbook template author set these fields expecting them to fire; they must not depend on a separate opt-in | Already correct — `processReminders`/`processEscalations` run for every qualifying task, no rule required |
| The 11 old DB-trigger notifications + the new platform-event notification trigger | Domain-integrity-adjacent facts (a new lead, an RSVP, a booking) — a venue should never have to configure these to exist | Already correct, DB-trigger-level, unconditional |

**B. Venue-configurable (Automation Rules / Message Sequences, opt-in by design):**

- Which specific message sequence a lead enters, and its content/timing.
- Whether a post-event review/referral message is sent at all, and its wording/offset (the one currently-enabled rule).
- Any *additional* playbook applied via a rule beyond the venue's own default (e.g., "also apply a VIP checklist when guest count > 200" — a real, legitimate use of a configured rule, distinct from the baseline default).
- Optional internal notifications beyond what the DB triggers already cover.
- Any future rule using `send_notification` for `Booking.Confirmed`/`Event.Completed` — **flagged risk**: since the DB trigger already fires a notification unconditionally for these two event types, a venue configuring a redundant `send_notification` rule for the same trigger would produce two in-app notifications for one event. Not fixed in this pass (no rule currently does this), but documented so it isn't discovered the hard way later.

**The line, stated once:** if a coordinator could reasonably expect the platform to "just do the right thing" without ever opening Settings, it's system-required. If it's a matter of *how* or *whether to customize* something the platform already guarantees happens correctly by default, it's an Automation Rule.

---

## Phase 3 — Booking → Onboarding → Planning Fix

**Status: IMPLEMENTED, see code + verification below.**
