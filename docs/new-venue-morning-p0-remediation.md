# New Venue Morning — P0 Remediation Report

**Date:** 2026-08-13  
**Source audit:** `docs/new-venue-morning-ux-audit.md`  
**Scope:** Exactly three approved P0 items. No Library IA, navigation, Pipeline architecture, Automation editor/exit logic, Luv, Dashboard, or adjacent cleanup.

---

## What changed

| # | Item | Change |
|---|---|---|
| 1 | Pipeline Templates copy | Replaced false “Not connected to Leads yet” header description with truthful venue-facing copy |
| 2 | Pipeline → Automation trust | Pre-commit confirmation when a stage move **would** create a new Automation enrollment; Cancel = no move / no enroll |
| 3 | Help Getting Started | Published one new article under Getting Started via existing `success_library_articles` pipeline |

---

## 1. Pipeline Templates copy

**File:** `app/(app)/library/pipeline-templates/page.tsx`

**Before:**  
`Reusable, stage-by-stage pipelines you can build and customize. Not connected to Leads yet — this is just the editor.`

**After:**  
`Customize the stages on your Leads Pipeline. Names and order here are what you see on the board.`

No renames, no schema/stage/mapping/behavior changes.

---

## 2. Pipeline → Automation safety behavior

### When confirmation appears

Only when `wouldEnrollOnPipelineStageMove(leadId, stageId)` is true — the same decision as live enrollment:

1. Map destination Pipeline stage → `LeadStatus` via existing `CANONICAL_STAGE_TO_LEAD_STATUS`
2. Load active Automations with `trigger_type = lead_stage_changed` and `trigger_stage =` that status (`getActiveSequencesForTrigger`)
3. Skip any sequence where the relationship already has an active enrollment (`hasActiveEnrollment`)
4. If any remaining sequence would enroll → confirm; otherwise commit immediately

Implemented as `wouldEnrollOnStageChange` in `lib/message-sequences/service.ts` (mirrors `triggerSequencesForRelationship` without inserts) and `wouldEnrollOnPipelineStageMove` in `lib/leads/service.ts`.

### UI

- Shared dialog: `components/leads/pipeline-automation-confirm.tsx`
- Wired on Pipeline board drag (`components/leads/pipeline-board.tsx`) and lead detail “Change stage” (`components/leads/lead-detail.tsx`)
- Copy: *“This stage has an active Automation. Moving this lead here will enroll them and may send the messages you've configured.”*
- Actions: **Cancel** (auto-focused / Escape / backdrop) vs **Continue**
- Confirm runs **before** `updateLeadPipelineStage` — no optimistic move on Case B until Continue

### Cancel

Lead stays put; no enrollment; no send; no success toast for the move.

### Confirm

Existing `updateLeadPipelineStage` → `updateLeadStatus` → `triggerSequencesForRelationship` path runs unchanged.

### Lost / Cancelled / Booked

- **Lost / Cancelled exit-before-enroll** in `updateLeadStatus` — untouched
- **Booked (`won`) booking exit** on client convert — untouched
- Confirmation still appears for Lost/Cancelled/Booked **only if** an active Automation would newly enroll for that destination status

---

## 3. Help Getting Started article

**Migration:** `supabase/migrations/20261285000000_help_getting_started_first_morning.sql`  
**Applied locally** to seed published content.

| Field | Value |
|---|---|
| Slug | `getting-started-your-first-morning` |
| Title | Getting Started: Your First Morning |
| Category | Getting Started |
| Question / answer (Why this matters) | “I just logged in — what do I do first?” → “Check your Dashboard, then your Leads — everything else can wait.” |
| Nav/UI truth used | Overview → Dashboard; Morning Briefing; Today's Attention; Sales → Leads; Pipeline from Leads; Help & Guides |

Other five published articles left unchanged.

---

## Tests

| Suite | Result |
|---|---|
| `npx tsc --noEmit` | Pass |
| `npm test` (full) | 498 pass / 0 fail |
| `lib/message-sequences/pipeline-automation-confirm.test.ts` | Pass — ordinary / cancel / continue / Lost / Cancelled / Booked enrollment-decision + gate |
| Existing `automation-p0.test.ts` | Pass — exit-before-enroll ordering preserved |

---

## Browser validation

Evidence: `docs/qa/new-venue-morning-p0-evidence/` (`results.json`, `results-followup.json`, screenshots).

| Check | Result |
|---|---|
| Pipeline Templates — stale copy gone, truthful copy present | Pass |
| Leads Pipeline still shows template stages | Pass |
| Help — Getting Started listed; article opens; category; answer; Dashboard/Leads labels; back to `/help` | Pass |
| Other Help articles still listed | Pass |
| Ordinary stage change (no matching Automation) — no confirm, commits | Pass |
| Lost with active Automation — confirm; Cancel keeps status; Continue commits + enrolls | Pass |
| Cancelled with active Automation — confirm; Cancel keeps lead | Pass |
| Booked with no Booked Automation — no confirm | Pass |
| Proposal Issued (maps to `proposal_sent`) with active Automation — confirm | Pass |

**Note:** HTML5 drag across the horizontally scrolled board was flaky in Playwright; confirm behavior was verified on the same pre-commit path via lead detail “Change stage,” plus board code uses the identical preview action + dialog. Ordinary board drag (Tour) was also observed to commit without confirm earlier in the session.

---

## Issues / gaps

1. Local `service_role` lacks `GRANT` on some tables (`success_library_articles` insert, `pipeline_stages` select); article seed and stage lookup for QA used `psql` in the local Postgres container. Migration file remains the canonical deploy path.
2. Board DnD across overflow columns is awkward for automated drag tests; product path is covered via shared preview + dialog.

---

## Explicitly NOT changed

- Library IA / Library home / navigation
- Pipeline schema, canonical stages, LeadStatus, drag architecture, Automation trigger semantics
- Lost/Cancelled exit-before-enroll; Booked exit-on-convert
- Automation editor, starters, Luv, Dashboard layout/widgets
- Help search / related / contextual redesign
- Other Help articles; P1/P2/P3 audit items
- No commit / no push

---

## Files changed

- `app/(app)/library/pipeline-templates/page.tsx`
- `app/(app)/leads/[id]/actions.ts`
- `components/leads/pipeline-board.tsx`
- `components/leads/lead-detail.tsx`
- `components/leads/pipeline-automation-confirm.tsx` *(new)*
- `lib/leads/service.ts`
- `lib/message-sequences/service.ts`
- `lib/message-sequences/would-enroll.ts` *(new)*
- `lib/message-sequences/pipeline-automation-confirm.test.ts` *(new)*
- `supabase/migrations/20261285000000_help_getting_started_first_morning.sql` *(new)*
- `docs/qa/_new-venue-morning-p0-browser-check.mjs` *(QA helper)*
- `docs/new-venue-morning-p0-remediation.md` *(this file)*
