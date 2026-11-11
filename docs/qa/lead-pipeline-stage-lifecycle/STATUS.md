# Lead pipeline lifecycle — Option A STATUS

**Decision:** Restore the locked August 2026 seven-stage live UI.  
**Commit (this change):** pending  
**Prior automation guard:** `39fc3aff` + migration `202614079` (SEQ-01 `update_pipeline_on_enroll = false`; `lead_created` never advances)

## Betty Rubble — forensic (Sandbox, 2026-09-28)

| Field | Value |
| --- | --- |
| `leads.id` | `0d9f39b1-05a8-4996-9c73-ec151aad5628` |
| Created | `2026-09-28T02:02:35.463Z` |
| Current `sales_stage` | `proposal_sent` |
| Current `pipeline_stage_id` | Custom Proposal (`1bdab3e5-8918-41d5-96e1-590109aecf0c`) |
| SEQ-01 enrollment | Yes — `ef948978-…` at `2026-09-28T02:02:36.506Z` (`lead_created`) |
| SEQ-01 `update_pipeline_on_enroll` **now** | `false` (repaired) |

Activity (no In Workflow sales_stage write):

- `02:02:35` `lead_created` — Inquiry received  
- `02:11:13` `sales_stage_changed` → Tour Scheduled (tour scheduled)  
- `02:24:51` `sales_stage_changed` → Proposal Sent  
- `02:26:12` `proposal_accepted` — **did not** set Booked  

Create-time inference: Betty was created **before** `39fc3aff` (02:18 UTC). SEQ-01 then had `update_pipeline_on_enroll = true`. Enrollment used a raw `leads` update (no `sales_stage_changed` activity) to set `pipeline_stage_id` to **In Workflow** while `sales_stage` stayed `new_inquiry`. That is the dual-model UI bug.

Still-live proof on Fancy (untouched by later Betty journey):

- **Goldi Locks** — `sales_stage=new_inquiry`, `pipeline_stage_id` = In Workflow  
- **Jasmine Jabar** — `sales_stage=tour_scheduled`, leftover In Workflow column  

## Locked customer-facing labels (August 2026 + `SALES_STAGE_META`)

New Inquiry · Outreach Sent · In Follow-Up · Tour Scheduled · Proposal Sent · Booked · Lost  

Tour Completed and Proposal Accepted are **operational events**, not sales_stage keys (matches tests 6 and 8).

## What changed

Live List / Board / Detail primary lifecycle label and chips/columns now derive from `leads.sales_stage` only. `pipeline_stage_id` and Standard names (In Workflow, Custom Proposal, …) no longer override the customer-facing lifecycle.

## SMS consent (separate)

Betty phone `5089896064` has venue SMS `opted_in` from Rebecca Sunshine `inquiry_form` (`evidence.leadId=a7d75c3e-…`). Attribution fix is in `39fc3aff` (`smsPermissionAttributedToLead`). Manual phone ≠ consent. Not caused by this pipeline change.
