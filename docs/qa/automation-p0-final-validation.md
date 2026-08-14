# Automation P0 — Final Validation & Release Certification

**Date:** 2026-08-12 (local validation run 2026-08-13 UTC)  
**Repo:** `wevenu-website`  
**Governing docs:** `docs/automation-sequence-product-recommendation.md` + completed Automation P0 implementation  
**Scope:** Final validation and certification only. No new product functionality. No P1. No commit/push.  
**Environment:** Local Next app `http://localhost:3000`, local Supabase DB `supabase_db_wevenu-website`, venue **Sweet Daisy Barn & Farm**, login `owner@example.com`.

---

## Final verdict

**READY WITH NAMED CAVEATS**

No Automation P0 regressions requiring code remediation were found. Migrations timestamps are **safe to leave as-is**. `source_master_key` is **correct and required** for SEQ-01 starter provisioning (do not remove).

---

## Named caveats

1. **Local migration apply path:** Files `20261283000000` / `20261284000000` were present but **not yet applied** to the local DB at validation start. `npx supabase migration up --local` failed due to **pre-existing** out-of-order / legacy migration gaps (`LegacyMigrationMissingRemoteError`, many older files needing `--include-all`). For this certification, the two P0 SQL files were applied directly to local Postgres and recorded in `schema_migrations`. **Timestamps themselves need no rename.** Deployers must ensure these two migrations land on each environment; broader migration-history debt is pre-existing and out of P0 scope.
2. **Terminal Lost/Cancelled/ordinary tests** exercised DB operations that mirror `exitActiveEnrollmentsForRelationship` + stage-trigger enroll (same effects as `updateLeadStatus`), plus unit tests for exit-before-enroll ordering. They were **not** a Playwright Pipeline-board drag-to-Lost/Cancelled click path.
3. **Live outbound send** (Resend/Twilio) for completion and merge-field freshness was **not** run end-to-end in this session. Completion + merge-at-send wiring is confirmed in code (`maybeCompleteEnrollmentAfterSend` in processor; `resolveForCustomerSend` fresh at send) and completion semantics were validated with controlled scheduled_message status transitions.
4. **Tour Follow-Up starter** is intentionally **not** implemented (per validation §9 and `lib/message-sequences/starters.ts`). Original product doc listed two starters; P0 ships **New Inquiry Welcome (SEQ-01) only**.
5. **Venue stage label for Proposal Sent** on Sweet Daisy shows plain `Proposal Sent` because the active pipeline template has **no** `proposal` canonical stage (only `decision`). Fallbacks are correct; unit tests prove `Proposal Sent · Let's Talk Numbers` when a matching venue stage exists.

---

## 1. Implementation status (8 P0s)

| # | P0 item | Status | Evidence |
|---|---------|--------|----------|
| 1 | Trigger picker = all 7 LeadStatus values | **DONE** | Browser: New / Contacted / Qualified / Proposal Sent / Won / Lost / Cancelled present |
| 2 | Venue stage labels at render (LeadStatus stored) | **DONE** | Browser: `New · New Lead`, `Contacted · Tour Scheduled`, `Won · Booked`; unit tests for Let’s Talk Numbers pattern |
| 3 | Enrollment `completed` when last step sends | **DONE** | `maybeCompleteEnrollmentAfterSend` + SQL completion path PASS |
| 4 | Lost/Cancelled auto-exit (`exited_lost` / `exited_cancelled`), exit-before-enroll | **DONE** | `lib/leads/service.ts` + SQL matrix all PASS |
| 5 | Enrollment progress `Step X of Y · Next [date/time]` | **DONE** | Browser: `Step 1 of 2 · Next Aug 12, 11:28 PM` |
| 6 | Activity timeline Automation lifecycle branch | **DONE** | Migration applied; browser Activity shows enrolled + stopped (lost) |
| 7 | Starter Automations | **DONE (Welcome only)** | SEQ-01 provisioned; Tour Follow-Up not implemented (intentional) |
| 8 | Edit note: changes apply to new enrollments only | **DONE** | Visible on new + edit forms |

---

## 2. Migration verification

### Files

- `supabase/migrations/20261283000000_automation_p0_enrollment_exits.sql`
- `supabase/migrations/20261284000000_activity_timeline_automation.sql`

### Naming convention

Recent migrations use sequential `202612*` version prefixes (continuing through `20261282000000_help_guides_phase1_taxonomy.sql`). This is an **intentional project convention**, not an accidental typo unique to P0. Calendar “future” relative to Aug 2026 is consistent with dozens of already-landed neighbors.

### Collisions / ordering

- No duplicate version IDs for `20261283000000` or `20261284000000`.
- Ordered immediately after `20261282000000`; no interleaving conflict with other P0 files.
- `npx supabase migration list --local` (via `npx supabase`) lists both files; CLI binary `supabase` not on PATH without npx.

### Safety conclusion

| Question | Answer |
|----------|--------|
| Timestamps safe? | **YES** |
| Ordering problems from these two names? | **NO** |
| Conflict with existing migration history versions? | **NO** (unique versions) |
| Action required on filenames? | **NONE — leave exactly as-is** |

### Apply status (local)

| Check | Before validation | After narrow apply |
|-------|-------------------|--------------------|
| `source_master_key` on `message_sequences` | missing | present |
| `exited_lost` / `exited_cancelled` in status check | missing (old 5-value check) | present |
| Activity RPC automation branch | absent | present |

**Pre-existing (document only):** Local DB migration history is incomplete for many earlier `202612*` / `202611*` files; `migration up` requires `--include-all` and is unsafe to run wholesale during this certification.

---

## 3. `source_master_key` explanation

### What it is

Nullable text column on `message_sequences` with unique partial index `(venue_id, source_master_key) WHERE source_master_key IS NOT NULL`. Added in `20261283000000` with comment mirroring `message_templates.source_master_key`.

### What reads / writes it

| Path | Behavior |
|------|----------|
| `lib/message-sequences/provision.ts` | Inserts starter with `source_master_key: master.key` (`SEQ-01`) |
| Same | Skip re-provision when key already exists (idempotent) |
| `listMissingStarterSequenceKeysForCurrentVenue` | Detects missing masters by key |
| Venue-created Automations (`createSequence` / UI) | Leave `NULL` |

### Starter / SEQ-01 requirement

**Necessary.** Without it, re-opening Automations / venue seed cannot tell whether “New Inquiry Welcome” was already provisioned vs a coincidentally named venue Automation. Same master-protection model as Message Templates (`MSG-01`), contracts, floor plans, packages, etc.

### Effect on existing venue Automations

Existing rows (e.g. Sweet Daisy **New Inquiry Follow-up**) keep `source_master_key = NULL`. Validated. No forced rewrite. Re-provision still creates **SEQ-01** as a separate **New Inquiry Welcome** row (observed in UI + DB).

### Re-provisioning

1. If `source_master_key = SEQ-01` exists → skip.  
2. Else if same **name** exists → skip (preserve customization).  
3. Else insert tagged copy (requires MSG-01 template).  

Venue edits never write back to `starters.ts` masters.

### Verdict on column

**Correct and required. Do not remove or redesign.** Not a regression.

---

## 4. Automated tests (exact results)

### `npx tsc --noEmit`

```
TSC_EXIT:0
(no diagnostics)
```

### `npx tsx --test lib/message-sequences/automation-p0.test.ts`

```
tests 9
pass 9
fail 0
suites: SEQUENCE_TRIGGER_STAGES (P0-1), venue stage labels (P0-2),
        terminal-stage exit-before-enroll ordering (P0-4)
UNIT_EXIT:0
```

### `npm test`

```
tests 484
pass 484
fail 0
NPM_TEST_EXIT:0
duration_ms ~1783
```

No P0-related failures. No unrelated pre-existing failures in this run.

---

## 5. Browser validation (exact results)

Evidence: `docs/qa/automation-p0-browser-evidence/` (`results.json`, `results-followup.json`, screenshots `01`–`09`).

### Trigger picker (all 7 LeadStatus)

**PASS.** Observed labels include:

- `New · New Lead`
- `Contacted · Tour Scheduled`
- `Qualified · Tour Scheduled`
- `Proposal Sent` (no venue `proposal` stage — see caveat 5)
- `Won · Booked`
- `Lost`
- `Cancelled`

(Lost/Cancelled omit `·` when venue stage name equals the LeadStatus label — intended in `triggerStageDisplayLabel`.)

### Venue stage labels while LeadStatus stored

**PASS** (with caveat 5 for proposal on this venue). Unit test proves `proposal_sent` → `Proposal Sent · Let's Talk Numbers`.

### Enrollment progress

**PASS.** Follow-up browser: `Step 1 of 2 · Next Aug 12, 11:28 PM` (P0Prog enrollment with real `scheduled_messages`). Earlier active enrollments without scheduled rows correctly showed `Step 1 of 1` without Next.

### Completion

**PASS (controlled path).** Mid-run remains `active`; after last scheduled → sent and no remaining `scheduled`, status → `completed`. Processor calls `maybeCompleteEnrollmentAfterSend` after successful send (code). Live send not run (caveat 3).

### Enrollment UI vocabulary

**PASS.** Shows Automation name, status badges (`Active`, `Stopped — booked`, etc.), progress. **Does not** expose: sequence enrollment, materialized step, scheduler, cron, execution engine, canonical stage.

Minor note (document only, no redesign): route path remains `/communication/series` (engineering URL); venue-facing chrome says **Automations**.

### Editing note

**PASS.** Exact meaning present:

> Editing an Automation applies to new enrollments only. People already enrolled keep the steps that were set when they joined.

Also reinforced by surrounding copy on edit (“Changes to steps only affect enrollments made after you save”).

---

## 6. Terminal-stage matrix

Method: SQL validation script `docs/qa/_automation-p0-db-check.sql` mirroring repository exit + enroll; unit tests for call order; code inspection of `updateLeadStatus`.

| Test | Expected | Result |
|------|----------|--------|
| **A — Lost:** existing active enrollment | status exactly `exited_lost` | **PASS** |
| **A — Lost:** no future scheduled sends | scheduled count = 0 | **PASS** |
| **A — Lost:** Lost-trigger Automation may enroll | new enrollment created | **PASS** |
| **A — Lost:** new Lost enrollment not immediately exited | stays `active` | **PASS** |
| **B — Cancelled:** existing → `exited_cancelled` | | **PASS** |
| **B — Cancelled:** no future sends | | **PASS** |
| **B — Cancelled:** Cancelled Automation may enroll | | **PASS** |
| **B — Cancelled:** new enrollment stays active | | **PASS** |
| **C — Ordinary stage change** | existing active does **not** auto-exit | **PASS** |
| Exit-before-enroll ordering (unit) | exit then enroll; ordinary skips exit | **PASS** |

Application ordering in `lib/leads/service.ts`: for `lost`/`cancelled`, `await exitActiveEnrollmentsForRelationship(...)` **then** `triggerSequencesForRelationship(...)`.

---

## 7. Activity Timeline

**PASS.**

Browser on lead `P0Lost Validation` Activity tab:

- `Enrolled in automation: New Inquiry Follow-up`
- `Enrolled in automation: P0 Lost Goodbye`
- `Automation stopped (lost): New Inquiry Follow-up`

RPC `get_relationship_activity_timeline` includes automation branch only (no second history table). Lifecycle events only — **not** every Automation send duplicated into Activity (sends remain Conversation). UI source icon/color includes `automation`.

---

## 8. Starter

| Check | Result |
|-------|--------|
| New Inquiry Welcome exists | **PASS** (UI + DB) |
| `source_master_key = SEQ-01` | **PASS** |
| `trigger_type = lead_created` | **PASS** |
| Provision via Starter Library path (`ensureStarterAutomationsForCurrentVenue` on list page; `seedStarterAutomations` on venue create) | **PASS** (code + observed provision) |
| Steps resolve MSG-01 | **PASS** (provision depends on MSG-01; MSG-01 present) |
| Invented copy | **No** — uses existing MSG-01 template content |
| Tour Follow-Up | **NOT implemented** (confirmed) |

---

## 9. Safety regressions

| Rule | Result | How confirmed |
|------|--------|---------------|
| Reply → `exited_reply` | **PASS** | Constraint + SQL write accepted; existing webhook → `exitActiveEnrollmentsForRelationship(..., "exited_reply")` unchanged |
| Booking → `exited_booking` | **PASS** | SQL + prior UI badge `Stopped — booked` on Priya |
| Duplicate enrollment protection | **PASS** | `hasActiveEnrollment` guard still in `service.ts` |
| Fresh merge fields at send | **PASS (code)** | `processor.ts` resolves via `resolveForCustomerSend` at send time |
| Edit Automation → new enrollments only; existing keep materialized steps | **PASS** | UI note + `updateSequence` replaces `sequence_steps` only; enrollments already materialized into `scheduled_messages` are not rewritten |

Ordinary stage change does **not** exit (Test C) — **PASS**.

---

## 10. Scope / non-goals

Confirmed **not** implemented in this P0:

- Tour Completed trigger / Tour Follow-Up starter  
- Contract / payment triggers  
- Tasks / pause / branching / Luv automation suggestions / Workflows  

No scope expansion performed during certification. No product code changes.

---

## 11. Defects

| Finding | Classification | Action |
|---------|----------------|--------|
| None requiring P0 code fix | — | — |
| Local migration history gaps blocking `migration up` | Pre-existing | Document only |
| Sweet Daisy missing `proposal` canonical stage | Pre-existing venue template data | Document only |
| Product doc listed 2 starters; ship 1 | Intentional (validation §9) | Document only |

**No STOP for product/architecture decision** beyond recording intentional Tour Follow-Up deferral.

---

## 12. Evidence artifacts

| Artifact | Path |
|----------|------|
| Browser results | `docs/qa/automation-p0-browser-evidence/results.json` |
| Browser follow-up | `docs/qa/automation-p0-browser-evidence/results-followup.json` |
| Screenshots | `docs/qa/automation-p0-browser-evidence/*.png` |
| Helper scripts (local QA only) | `docs/qa/_automation-p0-browser-check.mjs`, `_automation-p0-browser-followup.mjs`, `_automation-p0-db-check.sql`, `_automation-p0-db-check.mjs` |
| Unit / full test logs | `/tmp/automation-p0-unit.txt`, `/tmp/automation-p0-npm-test.txt`, `/tmp/automation-p0-tsc.txt` |

---

## Certification signature

- Migrations: **SAFE — leave as-is**  
- `source_master_key`: **CORRECT — retain**  
- Automated: **tsc 0 / P0 tests 9/9 / npm test 484/484**  
- Browser + terminal matrix: **PASS** (with named caveats above)  
- **Verdict: READY WITH NAMED CAVEATS**
