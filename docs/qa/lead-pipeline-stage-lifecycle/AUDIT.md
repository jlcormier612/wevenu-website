# Lead Pipeline / Sales Stage — Forensic Audit

**Date:** 2026-09-28  
**Status:** AUDIT ONLY — no implementation  
**Trigger:** Brand-new lead “Betty Rubble & Barney Rubble” shows **PIPELINE STAGE → In Workflow** instead of **New Inquiry**.

---

## 1. CURRENT STAGE MODEL

The product currently runs **two overlapping models**:

### A. Authoritative lifecycle keys (`leads.sales_stage`)

Defined in `lib/leads/sales-stages.ts`:

| Key | Fixed label (`salesStageLabel`) | Order |
| --- | --- | --- |
| `new_inquiry` | New Inquiry | 0 |
| `outreach_sent` | Outreach Sent | 1 |
| `enrolled_in_sequence` | In Follow-Up | 2 |
| `tour_scheduled` | Tour Scheduled | 3 |
| `proposal_sent` | Proposal Sent | 4 |
| `booked` | Booked | 5 |
| `lost` | Lost | 6 |

Also (not a board column): `cancelled` — cancelled booked relationship (`CANCELLED_RELATIONSHIP_STAGE`).

DB: `leads.sales_stage` NOT NULL, default `'new_inquiry'`  
(migration `20261310000000_authoritative_sales_pipeline.sql`).

### B. Venue-facing pipeline columns (`pipeline_stages` via active template)

Standard product baseline (`lib/pipeline-templates/standard.ts` + migrations `202614034` / `202614036`):

| sort | Venue-facing name | `canonical_stage` | Maps to `sales_stage` via bridge |
| --- | --- | --- | --- |
| 0 | **New Inquiry** | `inquiry` | `new_inquiry` |
| 1 | **In Workflow** | `inquiry` | `new_inquiry` |
| 2 | Tour Scheduled | `tour` | `tour_scheduled` |
| 3 | Custom Proposal | `proposal` | `proposal_sent` |
| 4 | Contract Sent | `proposal` | `proposal_sent` |
| 5 | Follow-Up | `decision` | `enrolled_in_sequence` |
| 6 | Booked | `booked` | `booked` |
| 7 | Lost | `lost` | `lost` |

Bridge: `lib/pipeline-templates/sales-stage-bridge.ts`  
(`salesStageForCanonical` / `canonicalForSalesStage`).

**“In Workflow” is a real persisted venue pipeline stage name** (row in `pipeline_stages`), not a fallback label and not a `sales_stage` enum value. It shares canonical `inquiry` with New Inquiry — both collapse to `sales_stage = new_inquiry` when moved onto.

### What the lead detail UI shows

`components/leads/lead-detail.tsx` (“Pipeline stage”):

1. If an active template has stages → display **`pipeline_stages.name`** for the resolved stage id  
2. Else → `LeadStatusBadge` → `salesStageLabel(sales_stage)`

Resolution: `resolveVenuePipelineStageId` in `lib/pipeline-templates/resolve-lead-stage.ts`:

1. Prefer `leads.pipeline_stage_id` if it belongs to the active template (except Booked/Lost override)  
2. Else first stage whose `canonical_stage` matches `canonicalForSalesStage(sales_stage)`  
3. Else first stage

**Critical:** With Standard’s two `inquiry` columns, a lead with `sales_stage = new_inquiry` and `pipeline_stage_id = <In Workflow uuid>` displays **In Workflow** while the lifecycle key is still New Inquiry.

Proven locally:

- `pipeline_stage_id = null` + `new_inquiry` → New Inquiry  
- `pipeline_stage_id = In Workflow` + `new_inquiry` → In Workflow  

---

## 2. AUTHORITATIVE SOURCE OF TRUTH

| Concept | Authoritative field | Notes |
| --- | --- | --- |
| Sales lifecycle / reporting / scoring / automations trigger keys | `leads.sales_stage` | Locked in Aug 2026 plan as SoT |
| Venue-facing board column / detail “Pipeline stage” label | `leads.pipeline_stage_id` → `pipeline_stages.name` | Re-activated as live UI driver by Standard baseline (Sep 20) |
| Tour operational state | `tour_appointments.status` | scheduled / confirmed / completed / cancelled / no_show |
| Commercial booking (venue considers them booked) | `bookClient` / `book_relationship` + `events.booked_at` | Not proposal accept, not payment alone |
| Booking file / workspace (not Booked) | `convertLeadToClient` / Start booking file | Explicitly does **not** set `sales_stage = booked` |

Locked Aug 2026 plan (`docs/sales-pipeline-implementation-plan.md`):

> Live Sales Pipeline always uses these seven fixed stages…  
> Remove the concept of an “active Pipeline Template” as the driver of the live Board.

**That lock was later reversed in product code** by Standard pipeline work (see §10).

---

## 3. CURRENT NEW-LEAD DEFAULT

### Persistence path

1. Manual New Lead → `createLead` → `createLeadCore` → `ingestLead` (TS) → `create_lead_atomic` → `ingest_lead` (SQL)  
2. SQL insert sets **`sales_stage = 'new_inquiry'`** only  
3. **`pipeline_stage_id` is not set** (null)  
4. After create, Lead Intake may enroll Automations:  
   `triggerSequencesForRelationship(..., "lead_created")`  
   (`lib/lead-intake/pipeline.ts`)

Starter Automation SEQ-01 “New Inquiry Welcome” fires on `lead_created` (active by default).  
If that sequence (or any `lead_created` sequence) has **`update_pipeline_on_enroll = true`**, enrollment calls `maybeAdvanceLeadOnSequenceEnroll` → advances **one active Pipeline column** and **writes `pipeline_stage_id`**:

```
New Inquiry (sort 0) → In Workflow (sort 1)
sales_stage stays new_inquiry (both are canonical inquiry)
pipeline_stage_id becomes In Workflow’s UUID
UI shows: In Workflow
```

Flag UI copy (`components/communication/series-form.tsx`):  
“Also move their sales stage forward when they enter this automation” — **off by default in code**, but **venue-togglable**. Starter provision does not set the flag (DB default false).

### Expected without automation advance

| Layer | Expected |
| --- | --- |
| `sales_stage` | `new_inquiry` |
| `pipeline_stage_id` | `null` |
| Detail “Pipeline stage” | **New Inquiry** (resolved via first `inquiry` column) |
| List badge (when not using venue columns) | New Inquiry |

---

## 4. EXPECTED NEW-LEAD DEFAULT

**Human-facing: New Inquiry**

A brand-new inquiry must not present as “In Workflow” merely because:

- they are “active,”  
- a welcome automation enrolled, or  
- an internal second inquiry column exists.

“In Workflow” may remain a **deliberate later column** if product keeps the Standard template — but it must not be the silent landing place for brand-new leads.

---

## 5. COMPLETE STAGE TRANSITION TABLE

| From (human) | User / system action | Persisted `sales_stage` | Persisted `pipeline_stage_id` | Human label shown | Why |
| --- | --- | --- | --- | --- | --- |
| — | Create lead | `new_inquiry` | null | New Inquiry (unless auto-advanced) | `ingest_lead` |
| New Inquiry | Drag/Change to In Workflow | `new_inquiry` | In Workflow id | In Workflow | Both canonical `inquiry` → bridge returns `new_inquiry` |
| New Inquiry | Drag to Tour Scheduled | `tour_scheduled` | Tour Scheduled id | Tour Scheduled | Manual / board |
| Any early open | Tour appointment INSERT `scheduled` | `tour_scheduled` (if still early) | unchanged unless UI also sets | Tour Scheduled if resolved by sales_stage | SQL trigger `_advance_lead_on_tour_scheduled` |
| Any | Automation enroll with `update_pipeline_on_enroll` | next open via bridge | **next column id** | Next Standard name | `maybeAdvanceLeadOnSequenceEnroll` |
| Open | Drag to Custom Proposal / Contract Sent | `proposal_sent` | that stage id | Custom Proposal / Contract Sent | Manual |
| Open | Drag to Follow-Up | `enrolled_in_sequence` | Follow-Up id | Follow-Up | Manual |
| Open | Confirm Booked move | `booked` via `bookClient` | Booked stage id | Booked | `confirmPipelineBookedMove` |
| Open | Mark Lost + reason | `lost` | Lost stage id | Lost | `markLeadLost` |
| Booked | Move back to Sales Pipeline | `new_inquiry` | null | New Inquiry | `moveLeadBackToSalesPipeline` (refuses if client still commercially booked) |
| Booked | Cancel relationship | `cancelled` | null | Cancelled (not a column) | Cancelled relationship path |

**Automatic transitions identified**

| Trigger | Effect on stage |
| --- | --- |
| Tour appointment created (`scheduled`) | Forward-only → `tour_scheduled` if still `new_inquiry` / `outreach_sent` / `enrolled_in_sequence` |
| Automation enroll + `update_pipeline_on_enroll` | +1 active pipeline column; sets `pipeline_stage_id` |
| Proposal send (`commercial-proposals`) | Activity `proposal_sent` only — **does not** currently advance `sales_stage` (gap vs expected “Proposal Sent”) |
| Tour completed / no_show / cancelled | Tasks/signals/activity only — **does not** change `sales_stage` |
| Proposal accepted | Does **not** execute contract; does **not** call `bookClient` |
| Payment | Does **not** set Booked |
| Start booking file / `convertLeadToClient` | Creates workspace; **does not** set `sales_stage = booked` |
| `bookClient` | Sole commercial Booked transition |

---

## 6. TOUR LIFECYCLE

| Event | Tour persistence | Sales stage | UI pipeline label |
| --- | --- | --- | --- |
| Schedule | `tour_appointments.status = scheduled` | Auto → `tour_scheduled` (SQL + app paths) | Should resolve to **Tour Scheduled** column (canonical `tour`) if `pipeline_stage_id` null or remapped |
| Complete | `completed` | Unchanged | Stays prior stage; tasks created (`lib/tours/post-tour.ts`) |
| No Show | `no_show` | Unchanged | Activity/signal only — **not** a sales stage |
| Cancelled | `cancelled` | Unchanged | Activity only — **not** a sales stage |
| Follow-up | Tasks | Not a stage | Operational |

**Product distinction:** Tour Scheduled is a sales stage. Tour completed / no-show / cancelled are **operational outcomes**, not pipeline stages. “In Workflow” must not silently replace Tour Scheduled.

If a lead was auto-advanced to In Workflow before tour scheduling, the SQL trigger still sets `sales_stage = tour_scheduled`, and resolution prefers non-terminal `pipeline_stage_id` **first** — so a leftover In Workflow id could **keep showing In Workflow** even after `sales_stage` became `tour_scheduled` until the stage id is updated. That is a coherence defect in `resolveVenuePipelineStageId` preference rules.

---

## 7. PROPOSAL LIFECYCLE

| Event | Persisted | Stage effect today |
| --- | --- | --- |
| Send proposal | Proposal record + activity | **No** `sales_stage` → `proposal_sent` in `lib/commercial-proposals/service.ts` |
| Couple accepts | Proposal acceptance | Does **not** execute contract; does **not** Book |
| Contract Sent (pipeline column) | Venue-facing only | Maps to same `proposal_sent` sales key as Custom Proposal |

Expected human stage “Proposal Sent” / Standard “Custom Proposal” depends on manual move or a missing automatic advance on send.

---

## 8. BOOKING LIFECYCLE

Locked semantics (still reflected in code/tests):

| Action | Result |
| --- | --- |
| Start booking file | Workspace / client prep — **not** Booked |
| Proposal accepted | Not Booked |
| Contract executed | Separate from Booked |
| Payment | Not Booked by itself |
| Venue Booked (`bookClient` / Confirm Booked) | `sales_stage = booked` + commercial booked event |

`sales_stage = booked` is the pipeline Booked outcome of the venue’s commercial booking transition — do not invent “Booking Started” as a separate advertised stage without reconciling labels. Current `SALES_STAGE_META` label for `booked` is simply **Booked**.

---

## 9. LOST / CLOSED LIFECYCLE

| Outcome | Mechanism |
| --- | --- |
| Lost | `markLeadLost` + required reason; `sales_stage = lost` |
| Cancelled booked relationship | `sales_stage = cancelled`; cleared `pipeline_stage_id`; not an active column |
| Tour no-show / cancel | Not Lost automatically |

---

## 10. RECENT REGRESSION SOURCE

### Primary product regression (architecture)

| When | Commit | What changed |
| --- | --- | --- |
| 2026-09-20 | `1d536890` Establish Standard pipeline as the new-venue product baseline | Replaced seven fixed live stages as sole Board driver with **active Standard template** including **In Workflow** |
| 2026-09-20 | `afa29b4c` Lock Standard pipeline colors/probabilities | Locked Sandbox Standard (New Inquiry + In Workflow + …) |
| 2026-09-20 | `44ba8966` Expand prior-seed fingerprints | Further Standard reset/upgrade safety |

Migrations:  
`20261403400000_standard_pipeline_baseline.sql`  
`20261403600000_standard_pipeline_locked_defaults.sql`  
`20261403700000_standard_pipeline_prior_seed_fingerprints.sql`

These **contradict** the Aug 2026 locked plan that Board/List must use fixed seven `sales_stage` labels only and must not be driven by active templates.

### Why Betty can show In Workflow without a manual stage change

Most likely (needs Sandbox row proof — see acceptance matrix):

1. Lead created: `sales_stage = new_inquiry`, `pipeline_stage_id = null`  
2. SEQ-01 (or other `lead_created` automation) enrolls  
3. Venue has **`update_pipeline_on_enroll = true`** on that automation  
4. Advance: New Inquiry → In Workflow; `pipeline_stage_id` set; `sales_stage` remains `new_inquiry`  
5. Detail UI shows **In Workflow**

Secondary possibilities (verify in DB):

- Explicit `pipeline_stage_id` set by another write  
- Active template customized so first `inquiry` column is named In Workflow / New Inquiry missing  

**Not** explained by: changing the SQL default from `new_inquiry` to something else (default is still `new_inquiry`). A one-line default swap would **not** fix UI if `pipeline_stage_id` points at In Workflow.

---

## 11. FILES / FUNCTIONS / COMMITS INVOLVED

| Area | Files |
| --- | --- |
| Sales keys | `lib/leads/sales-stages.ts` |
| Bridge | `lib/pipeline-templates/sales-stage-bridge.ts` |
| Resolve UI column | `lib/pipeline-templates/resolve-lead-stage.ts` |
| Standard catalog | `lib/pipeline-templates/standard.ts` |
| Create | `lib/leads/service.ts` `createLeadCore`, `lib/leads/repository.ts` `insertLead`, SQL `ingest_lead` |
| Automations advance | `lib/message-sequences/service.ts` `maybeAdvanceLeadOnSequenceEnroll`, `lib/message-sequences/advance-pipeline-on-enroll.ts` |
| Detail UI | `components/leads/lead-detail.tsx` |
| Board | `components/leads/pipeline-board.tsx`, `app/(app)/leads/pipeline/page.tsx` |
| Tour auto-stage | SQL `_advance_lead_on_tour_scheduled` |
| Booked | `lib/booking-journey/book-client.ts`, `confirmPipelineBookedMove` |
| Locked plan (superseded in code) | `docs/sales-pipeline-implementation-plan.md` |

---

## 12. EXACT CUSTOMER-FACING LABELS (STANDARD)

**Active Standard columns:**  
New Inquiry · In Workflow · Tour Scheduled · Custom Proposal · Contract Sent · Follow-Up · Booked · Lost  

**Fixed `sales_stage` labels (when no template / badge fallback):**  
New Inquiry · Outreach Sent · In Follow-Up · Tour Scheduled · Proposal Sent · Booked · Lost  

Mismatch is intentional in the Standard redesign but **confusing**: Outreach Sent / In Follow-Up disappear as names; In Workflow / Custom Proposal / Contract Sent appear instead.

---

## 13. AUTOMATED TEST GAPS

Missing / insufficient today:

1. New lead create → human-facing stage must be **New Inquiry** (assert both `sales_stage` and resolved venue stage name).  
2. `lead_created` automation with `update_pipeline_on_enroll` must **not** silently move brand-new inquiries off New Inquiry **or** product must document that as intentional (current Betty defect suggests it is not).  
3. `resolveVenuePipelineStageId` must not prefer a stale open `pipeline_stage_id` when `sales_stage` has moved to a different canonical family (e.g. leftover In Workflow after `tour_scheduled`).  
4. Proposal send → expected stage advance (or explicit non-advance product rule + UI).  
5. Tour complete / no-show / cancel do not invent sales stages.  
6. Dual-model drift tests: Standard names vs `SALES_STAGE_META` labels.  
7. Acceptance that picker/board columns and detail “Pipeline stage” stay coherent after Standard seed.

Existing coverage is strong for Booked/Lost confirmation and bridge mapping, weak for **new-lead human label** and **automation + Standard two-inquiry-column** interaction.

---

## 14. PROPOSED FIX (DO NOT IMPLEMENT YET — OPTIONS)

Do **not** only change a default string.

Reconcile the dual model first (product decision required):

### Option A — Restore locked seven-stage live pipeline (align with Aug 2026 plan)

- Board/List/Detail labels from `sales_stage` / `SALES_STAGE_META` only  
- Pipeline Templates remain library, not live driver  
- Remove or demote “In Workflow” from customer-facing live board  

### Option B — Keep Standard venue columns, but fix entry + coherence

1. New leads always pin `pipeline_stage_id` to the **New Inquiry** stage id (sort 0 / first `inquiry` named New Inquiry) on create.  
2. Forbid `update_pipeline_on_enroll` from advancing off New Inquiry on `lead_created` **or** default SEQ-01 must never enable that flag; add regression test.  
3. Fix `resolveVenuePipelineStageId` so when `sales_stage` canonical family ≠ current stage’s canonical, **re-resolve** (don’t keep stale inquiry id after tour/proposal).  
4. Explicit product map: which Standard columns are sales stages vs process labels; ensure Tour Scheduled / Proposal / Booked / Lost remain distinct.  
5. Decide whether proposal send auto-advances to Custom Proposal / `proposal_sent`.  

### Option C — Rename / collapse Standard

- Merge “In Workflow” out of Standard if it has no distinct SoT beyond “working inquiry”  
- Or rename and document it as the post-contact working stage with an **explicit** transition (not silent)

**Recommended investigation before choosing:** inspect Betty’s Sandbox row:

```sql
select id, sales_stage, pipeline_stage_id, created_at
from leads where first_name ilike 'Betty' and last_name ilike 'Rubble';

select id, name, sort_order, canonical_stage
from pipeline_stages where id = <pipeline_stage_id>;

select s.name, s.update_pipeline_on_enroll, s.trigger_type, s.status
from message_sequences s
where venue_id = <jen> and trigger_type = 'lead_created';
```

That proves whether Betty is automation-advanced vs template-resolution-only.

---

## 15. REGRESSION TEST PLAN (POST-IMPLEMENTATION)

| Case | Venue sees | Persisted |
| --- | --- | --- |
| A. Brand-new inquiry | New Inquiry | `sales_stage=new_inquiry`; pipeline pin = New Inquiry (or null resolving to it) |
| B. Schedule tour | Tour Scheduled | `tour_scheduled` + Tour Scheduled stage id |
| C. Tour completed / no-show / cancelled | Prior sales stage unchanged (unless product says otherwise) | Tour status only; no false In Workflow |
| D. Send proposal | Proposal / Custom Proposal per decision | `proposal_sent` if auto-advance chosen |
| E. Proposal accepted | Not Booked; not contract executed | Acceptance state only |
| F. Start booking file | Not Booked | Client workspace; sales stage unchanged |
| G. Venue Booked | Booked | `bookClient` + `sales_stage=booked` |
| H. Lost | Lost + reason | `lost` |
| I. SEQ-01 enroll | Still New Inquiry (unless explicit product wants advance) | No silent `pipeline_stage_id` → In Workflow |
| J. Two-signer / adjacent | Unchanged | Contracts/proposals branding untouched |

Release gate after implementation: automated tests → Sandbox deploy → exact image → PRIMARY → health → full human journey → persistence → then Jennifer acceptance.

---

## Verdict

| Question | Answer |
| --- | --- |
| Is In Workflow a real stage? | **Yes** — Standard `pipeline_stages` row, canonical `inquiry` |
| Is new-lead SQL default wrong? | **No** — still `new_inquiry` |
| Why can UI say In Workflow? | Detail UI shows **venue stage name**; `pipeline_stage_id` or resolution can land on In Workflow while `sales_stage` stays `new_inquiry` |
| Regression source | Sep 20 Standard pipeline baseline reintroducing active-template-driven labels + dual inquiry columns; compounded by automation “advance one stage on enroll” |
| Safe one-line default patch? | **No** — would not fix `pipeline_stage_id` / dual-model coherence |

**STATUS: AUDIT COMPLETE — NOT READY TO IMPLEMENT until product chooses Option A/B/C and Betty’s Sandbox row is confirmed.**
