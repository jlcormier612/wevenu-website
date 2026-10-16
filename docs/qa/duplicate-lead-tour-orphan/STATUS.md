# Duplicate lead delete — orphaned tour / availability / confirmation

**Status:** Fix implemented locally (`applyLeadRecordDeletion` + migration `202614189`). Sandbox orphan heal applied. Deploy/migration for code+RPC pending after current inquiry-email deploy finishes.

## Root causes

1. **Blocked availability:** Lead delete archived tours but left `status` as `scheduled`/`confirmed`. Occupancy counts those statuses and ignores `is_archived`.
2. **Confirmation association:** `confirm_tour_by_token` only required `status=scheduled`. After delete, `lead_id` was NULL; confirm still succeeded on the orphan; surviving lead never received `tour_confirmed` activity.

## Fix

| Change | Purpose |
|---|---|
| `lib/records/delete-record.ts` | Cancel occupying tours + pending reminders, then archive |
| `20261418900000_lead_delete_tour_capacity_and_confirm.sql` | Heal orphans; confirm/get-token reject archived |

No silent tour transfer by email. No merge framework.

## Sandbox heal (2026-10-15)

Cancelled 6 archived null-lead occupying tours (no emails), including:

- `bd020bf3-…` `jlcormier612@gmail.com` 2026-10-18 14:30Z
- `fa5148a2-…` / `61063e85-…` future QA phantoms
- 3 historical QA fixtures

Evidence: `heal-plan.json`, `heal-result.json`. Remaining phantoms with scheduled/confirmed + archived + null lead: **0**.

## Tests

- `lib/records/lead-delete-tour-reconcile.test.ts` — **10/10 PASS**
- Targeted delete-record contract tests including cancel-before-archive — **PASS**

## Remaining for GREEN

1. Wait for inquiry-email deploy `38830511793` to finish (do not overlap).
2. Commit/push this fix; apply migration `202614189…`; deploy Sandbox.
3. Prove end-to-end on serving tip: inquiry+tour → duplicate → delete tour lead → slot free → confirm link shows unavailable (or works only on live tour attached to surviving lead).
