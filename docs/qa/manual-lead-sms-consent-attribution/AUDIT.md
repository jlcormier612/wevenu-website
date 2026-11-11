# Manual Lead SMS Consent Regression — Forensic Audit

**Date:** 2026-09-28  
**STATUS:** Root cause proven — implementing authoritative fix (not UI hide)

## Observed (Betty Rubble)

Contact Information showed:
- Preferred: Not specified ✓ (`preferred_communication_channels = []`)
- Text messaging: **Allowed**
- “Text permission provided through website inquiry · September 25, 2026”

Lead was manual (`source = referral`, created 2026-09-28).

## Authoritative DB proof

| Fact | Value |
| --- | --- |
| Betty lead id | `0d9f39b1-05a8-4996-9c73-ec151aad5628` |
| Betty phone | `5089896064` |
| Betty relationship | `86d00d7a-32fa-431f-9e34-6a01f641a720` |
| Betty preferred channels | `[]` |
| SMS permission row | `communication_permissions` venue+channel+`address_key=15089896064` |
| Permission status/source | `opted_in` / `inquiry_form` |
| Permission `updated_at` | `2026-09-26T03:13:16Z` (= **Sep 25 evening America/New_York**) |
| Evidence `leadId` | `a7d75c3e-…` (**Rebecca Sunshine**, website inquiry) |
| Evidence relationship | `f280a044-…` (Rebecca’s — **not** Betty’s) |

Manual create does **not** write `communication_permissions`. Confirmed by creating lead `SmsAudit UniquePhone` with unique phone `5085558416` via `create_lead_atomic`: **zero** permission rows.

## Mechanism

1. Public inquiry (Rebecca, website) checked SMS box → `applyInquiryCommunicationCapture` upserted phone-keyed consent (`source=inquiry_form`).
2. Betty reused the same Sandbox test phone `5089896064`.
3. Lead detail calls `getSmsPermissionEvidenceForContact({ venueId, phone })` — **phone only**, ignores lead/relationship.
4. UI renders Allowed + website inquiry provenance for a lead that never consented.

Outbound SMS correctly remains phone-scoped (TCPA number permission). The defect is **attributing another lead’s form consent to this lead’s Contact card**.

## Relation to “In Workflow”

**Independent mechanisms, same create path can surface both.**

| Defect | Cause |
| --- | --- |
| SMS Allowed + website provenance | Phone-keyed permission lookup without lead attribution |
| In Workflow | Jen Fancy SEQ-01 `New Inquiry Welcome` has `update_pipeline_on_enroll = true` → advances New Inquiry → In Workflow on `lead_created` |

Betty: enrolled in SEQ-01 at create; `pipeline_stage_id` = In Workflow. Unique-phone RPC create (bypassing TS automation) stayed `new_inquiry` / null stage id.

## First causal change (SMS display)

Not a new write on manual create. Display of phone-scoped `communication_permissions` on Lead Contact (`relationship-communication-summary` / `getSmsPermissionEvidenceForContact`, A2P workstream `e93863a0` et al.) without filtering form evidence to the current lead/relationship. Shared test phones make the false attribution visible.

## Fix plan

1. Lead Contact SMS evidence: hard blocks (opted_out / provider_blocked) always shown; `opted_in` from form/tour only when evidence matches this lead or relationship; keyword/email opt-ins remain number-level.
2. Do not delete Rebecca’s valid consent row.
3. Guard: `lead_created` automations must not advance pipeline (or Sandbox SEQ-01 flag off + code guard).
4. Tests + Sandbox proof with unique phone and shared phone.
