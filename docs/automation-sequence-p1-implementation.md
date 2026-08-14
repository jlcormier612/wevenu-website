# Automation / Sequences — P1 Implementation

**Date:** 2026-08-13  
**Repo:** `wevenu-website`  
**Source of truth:** `docs/automation-sequence-p1-product-recommendation.md`  
**Scope:** Exactly three approved changes. No commit/push.

---

## 1. Exact files changed

### Schema
- `supabase/migrations/20261287000000_automation_p1.sql`

### Core / domain
- `lib/message-sequences/types.ts`
- `lib/message-sequences/constants.ts`
- `lib/message-sequences/repository.ts`
- `lib/message-sequences/service.ts`
- `lib/message-sequences/starters.ts` (comment only — Tour Follow-Up starter still deferred)
- `lib/message-sequences/tour-completed-trigger.ts` *(new)*
- `lib/message-sequences/enrollment-pause.ts` *(new)*
- `lib/message-sequences/confirm-preview.ts` *(new)*
- `lib/tours/service.ts` (hook into canonical `updateTourStatus`)
- `lib/leads/service.ts` (first-step preview load for confirm check)
- `lib/scheduled-messages/processor.ts` *(unchanged call site; skip helper extended in repository)*

### UI / actions
- `components/communication/series-enrollments.tsx`
- `components/leads/pipeline-automation-confirm.tsx`
- `components/leads/pipeline-board.tsx`
- `components/leads/lead-detail.tsx`
- `app/(app)/communication/series/actions.ts`
- `app/(app)/leads/[id]/actions.ts`

### Tests
- `lib/message-sequences/tour-completed-trigger.test.ts` *(new)*
- `lib/message-sequences/enrollment-pause.test.ts` *(new)*
- `lib/message-sequences/pipeline-automation-confirm.test.ts` *(extended)*

### QA (not product)
- `docs/qa/_automation-p1-browser-check.mjs`
- `docs/qa/_automation-p1-probe.mjs`
- `docs/qa/automation-p1-browser-evidence/*`

### This document
- `docs/automation-sequence-p1-implementation.md`

---

## 2. Exact behavior implemented

### 1) Tour Completed trigger
- New trigger type `tour_completed` on Automations (`message_sequences.trigger_type`).
- Venue-facing picker label: **“A tour is completed.”**
- Fires only when `updateTourStatus` transitions an appointment **to** `completed` (not on no-op re-writes; not on confirmed/cancelled/no_show).
- Uses existing `tour_appointments.lead_id` → `leads.relationship_id` association, then existing `triggerSequencesForRelationship`.
- Reuses active-enrollment uniqueness (`hasActiveEnrollment` + `sequence_enrollments_active_unique`).
- Does **not** change `lead_created`, `lead_stage_changed`, Pipeline, exits, or completion.

### 2) Per-enrollment Pause / Resume
- Column `sequence_enrollments.paused_at` (nullable). Enrollment stays `status = 'active'` while paused.
- Column `sequence_enrollments.resumed_at` (nullable) so the existing Activity timeline RPC can emit **Automation resumed** after `paused_at` is cleared (same union architecture as P0 automation events).
- Scheduled Sends: `isEnrollmentSequencePaused` also returns true when `paused_at IS NOT NULL`; scheduled rows are left `scheduled` (not deleted).
- Resume clears `paused_at`, sets `resumed_at`; does not rewrite `scheduled_for`.
- Terminal exits still select `status = 'active'` enrollments (paused included). Exit-before-enroll ordering unchanged.
- UI: Pause/Resume on enrollment rows (`aria-label` “Pause/Resume for this person” so it does not collide with Automation-wide Pause); badge shows **Paused**; no DB terms exposed.
- Manual cancel of a paused enrollment still uses existing `cancelled` path.

### 3) Resolved message preview (existing confirm dialog only)
- When `wouldEnrollOnPipelineStageMove` is true, loads the first matching Automation’s first step and resolves subject/body via `resolveForCustomerSend` + `getMergeContextForRelationship` (same path as Scheduled Sends).
- Preview is informational only; Cancel/Continue and confirm-gate logic unchanged.
- If merge cannot resolve: truthful fallback **“Message preview unavailable.”** — dialog still opens.

---

## 3. Schema changes

Migration: `20261287000000_automation_p1.sql`

1. Extend `message_sequences.trigger_type` check to include `tour_completed`.
2. Add `sequence_enrollments.paused_at timestamptz` (nullable).
3. Add `sequence_enrollments.resumed_at timestamptz` (nullable) — required for resume history in the existing timeline union after pause clears.
4. Replace `get_relationship_activity_timeline` to emit:
   - `automation_paused` when `paused_at IS NOT NULL`
   - `automation_resumed` when `resumed_at IS NOT NULL`
5. **Does not** alter `sequence_enrollments_active_unique` or enrollment status values.

Applied to local DB for validation (`supabase_db_wevenu-website`).

---

## 4. Tests added

| File | Coverage |
|------|----------|
| `tour-completed-trigger.test.ts` | completed fires; non-completed does not; no concurrent duplicate actives; lead_created/stage remain; Lost/Cancelled/Booking exits unchanged |
| `enrollment-pause.test.ts` | All 15 brief items (+ exit-before-enroll preserved) |
| `pipeline-automation-confirm.test.ts` | Existing gate tests + P1 preview resolve/fallback; Cancel/Continue; no mutation; Lost/Cancelled/Booked semantics |

---

## 5. Test results

- `npx tsc --noEmit` — **pass**
- `npm test` — **538 pass / 0 fail**
- Focused P1 suites — **pass**

---

## 6. Browser validation results

Evidence: `docs/qa/automation-p1-browser-evidence/results.json` (31/31 PASS)

| Flow | Result |
|------|--------|
| Tour Completed trigger in picker | PASS — “A tour is completed” present; lead_created + stage kept |
| Real tour → complete → enrollment | PASS — Priya tour completed via `/api/tours/status` → active enrollment on `P1 Tour Completed QA` |
| Repeat complete → no duplicate active | PASS |
| Pause → `paused_at` set, status stays active, scheduled kept | PASS |
| Resume → clears pause, sets `resumed_at`, dates unchanged | PASS |
| Confirm dialog before move + resolved first message | PASS — subject/body preview shown |
| Cancel → no status change | PASS |
| Continue → move/enroll | PASS |

Login: `owner@example.com` / `devpassword123` on `http://localhost:3000`.

---

## 7. Issues encountered

1. **Resume timeline timestamp:** Brief schema named only `paused_at`. Emitting **Automation resumed** after clearing `paused_at` via the existing enrollment-column timeline union required additive `resumed_at`. No second history system.
2. **Local service_role cannot INSERT `message_sequences`** (pre-existing grant gap). QA seeded the Tour Completed Automation via Postgres docker, not service_role inserts.
3. **QA selector collision:** Enrollment Pause initially matched Automation-wide “Pause” header button. Fixed with distinct enrollment `aria-label`s (“Pause/Resume for this person”); venue-facing `title` remains “Pause”/“Resume”.
4. **Async enrollment race:** Tour complete trigger is fire-and-forget; browser QA polls briefly for enrollment (same pattern as live side effects).

---

## 8. Confirmation — DO-NOT-TOUCH areas unchanged

Unchanged by this pass:

- Pipeline architecture / stage model / colors / drag-drop architecture  
- LeadStatus vocabulary  
- Confirmation **decision** gate (`resolveStageMoveConfirmGate` / would-enroll rule)  
- Lost / Cancelled / Booking / Reply exits and P0 exit-before-enroll ordering  
- Enrollment completion + progress display semantics  
- `sequence_enrollments_active_unique`  
- Sequence-wide pause behavior (still skips sends when sequence status is paused)  
- Activity timeline architecture (same RPC union; only additive pause/resume branches)  
- Library IA, left nav, Help, Luv, branding, Contracts, Invoices, Payments, Clients, Vendors, Tasks, Requests  
- Message Template architecture; Scheduled Sends engine architecture (single skip extension)  
- Tours UI beyond the minimum `updateTourStatus` hook  

---

## 9. Explicit deferred confirmation

**No P2/deferred features were implemented**, including:

- Tour Follow-Up starter provisioning  
- Contract signed / payment triggers  
- Conditions/branching, Create Task / Notify Team actions, auto Pipeline advance  
- Draft/Archived, activation preview, trigger-conflict notes  
- Business-day / quiet-hours timing  
- New history system, new Help articles, new Luv behavior  

---

**STOP.** No commit. No push. No next workstream.
