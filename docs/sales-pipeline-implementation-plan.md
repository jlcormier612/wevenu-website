# Sales Pipeline + Event Types — Implementation Plan (Locked Decisions)

**Branch:** `feature/sales-pipeline-seven-stages`  
**Worktree:** `/tmp/htc-sales-pipeline` (isolated from dirty inquiry tree)  
**Base:** `origin/main` @ `5b246b4`  
**Updated:** 2026-08-26

## Execution constraints

- Do **not** touch the unrelated dirty working tree / inquiry branch.
- Do **not** merge into main, push, or deploy.
- Migration files may be written; **do not apply** (no `apply-sandbox-migrations.sh`, no DB-writing migrate).
- **Sales Pipeline track only** in this pass.
- **Event Type schema/migration blocked** until live inventory is reviewed.

---

## 1. Custom Pipeline Templates vs live Sales Pipeline (locked)

Preserve all existing custom pipeline/template records. They no longer control the live Lead List or Board.

Live Sales Pipeline always uses these seven fixed stages:

1. New Inquiry (`new_inquiry`)
2. Outreach Sent (`outreach_sent`)
3. Enrolled in Sequence/Workflow (`enrolled_in_sequence`)
4. Tour Scheduled (`tour_scheduled`)
5. Proposal Sent (`proposal_sent`)
6. Booked (`booked`)
7. Lost (`lost`)

Do **not** rename, overwrite, or remap existing customer-created templates into these seven stages.

Pipeline Templates remain a library of reusable process/workflow templates. Applying, editing, activating, duplicating, or deleting one must **never** change a real lead’s authoritative `sales_stage`.

Remove the concept of an “active Pipeline Template” as the driver of the live Board. Board/List/detail use the fixed seven stages only.

Starter library record name: **Standard Sales Pipeline** (idempotent provision for empty venues only).

Authoritative field: `leads.sales_stage`. `leads.status` is retired (no indefinite dual-write).

---

## 2. Cancelled migration / sequence exits (locked)

- Historical cancelled leads → **Lost**.
- Historical sequence exit rows may retain `exited_cancelled`.
- After cutover: **no new** `exited_cancelled` behavior.
- Entering **Lost** exits active sequences as `exited_lost`.
- Entering **Booked** (via Book This Lead / conversion) exits as `exited_booking`.

---

## 3. Scoring (locked — preserve existing numeric intent)

Do **not** invent a new commitment/momentum model. Map stages → existing score keys:

| Sales stage | Legacy score key |
|---|---|
| New Inquiry | `new` |
| Outreach Sent | `contacted` |
| Enrolled in Sequence/Workflow | `contacted` |
| Tour Scheduled | `qualified` |
| Proposal Sent | `proposal_sent` |
| Booked | `won` |
| Lost | `lost` / cancelled terminal behavior |

Update scoring, momentum, dashboard, analytics, and metric definitions accordingly.

---

## 4. Sequence enrollment stage movement (locked)

Config flag: **“Move this lead to Enrolled in Sequence/Workflow when enrolled”**  
(`message_sequences.update_pipeline_on_enroll`)

- Default: **OFF**
- Existing sequences backfill to `false`
- New sequences default `false`
- When enabled: successful enrollment may move lead to `enrolled_in_sequence` subject to forward-only + loop protections (`hasActiveEnrollment`, no backward move)

---

## 5. Pipeline Templates after cutover (locked)

Reusable process/workflow templates only — not the authoritative lead lifecycle. Keep Preview/Edit/Duplicate/Delete and other library behavior where useful. Completely remove Board/List/lead-stage dependency on templates or their stages.

---

## 6. Event Types — architecture approved; migration blocked

Do **not** begin Event Type schema migration or backfill yet.

First: read-only inventory of distinct Event Type values by venue for:

- `leads.event_type`
- `events.event_type`
- `tour_appointments.event_type`
- any other clearly identified same-domain storage

Do not assume every column named `event_type` is the same domain. Report actual results and near-duplicates. Do **not** auto-collapse values.

---

## 7. Event Type implementation scope (when later approved)

Core domain first: Leads, public inquiry form, tour appointments (where applicable), booked events (where applicable), manual lead create/edit, Event Type filtering/reporting.

Other consumers (playbooks, timeline templates, floor-plan templates, vendor task packs, etc.) require inventory proof of the same venue-owned Event Type domain before catalog migration.

---

## 8. Sales Pipeline implementation checklist

- [x] `lib/leads/sales-stages.ts` + unit tests
- [x] Migration `20261309000000_authoritative_sales_pipeline.sql` (written, not applied)
- [x] Migration `20261309100000_sales_pipeline_reporting_remap.sql` (written, not applied)
- [x] Board / List / Detail on fixed seven stages
- [x] Book This Lead → `booked` only via conversion
- [x] Tour create → forward-only `tour_scheduled` (app + SQL trigger for public RPC)
- [x] Sequences: `update_pipeline_on_enroll`, trigger stages, exits
- [x] Scoring / momentum / dashboard remapping
- [x] Reporting RPCs remapped in migration file (not applied)
- [ ] Event Type read-only inventory (blocked: no DB credentials in this worktree)

---

## Migration verification approach (required later)

1. Apply migration on sandbox (explicit approval).
2. Verify `sales_stage` backfill counts vs legacy `status`.
3. Verify sequence `trigger_stage` remaps; `update_pipeline_on_enroll = false` for all existing.
4. E2E: board columns, stage moves, tour advance, enroll flag ON/OFF, Book This Lead, Lost → `exited_lost`.
5. Confirm no new `exited_cancelled` rows after cutover.

**Real sandbox migration + end-to-end verification remain required before declaring production-ready.**
