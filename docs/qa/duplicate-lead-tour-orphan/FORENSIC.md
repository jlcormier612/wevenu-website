# Duplicate lead delete → orphaned tour / blocked availability / broken confirmation

**Investigation:** 2026-10-15 (read-only first)  
**Serving at investigation:** tip `8f097f19` deploy in flight; ECS still `6e143b61` / `:767` until deploy completes.

## Records observed (Fancy Sandbox)

Future phantom capacity blockers (archived + scheduled + `lead_id` null):

| Tour id | Slot (UTC) | Email | Confirm token |
|---|---|---|---|
| `61063e85-…` | 2027-04-14 14:23 | `global-delete-qa-proof@example.test` | `9290b790-…` |
| `fa5148a2-…` | 2027-11-03 15:30 | `brand-rt-59a9e6af@hellotocheers.test` | `696358c2-…` |

No surviving sibling leads for those emails. Three historical archived phantoms also exist with past slots.

`jyagnesak@yahoo.com` has multiple live/completed tours on several leads — not the phantom-capacity pattern (tours still have `lead_id`).

## Root causes

### 1. Blocked availability

`applyLeadRecordDeletion` soft-archived tours (`is_archived=true`) then hard-deleted the lead (`tour_appointments.lead_id` → SET NULL). Tour **status stayed `scheduled`/`confirmed`**.

Occupancy (`_tour_slot_is_blocked` / two-clock schema) counts:

```sql
ta.status in ('scheduled', 'confirmed')
```

and does **not** exclude `is_archived`. Archive is documented as list hygiene only (`202614077`).

### 2. Failed confirmation association

`confirm_tour_by_token` keys only on `confirm_token` + status=`scheduled`. It does **not** check `is_archived` or live `lead_id`. After lead delete, the prospect link still confirms the **orphaned** row; `lead_activities` insert is skipped when `lead_id` is null — so the surviving inquiry lead never shows confirmation.

## Intended product behavior (fix)

- Lead delete cancels occupying scheduled/confirmed tours (releases capacity), cancels pending tour reminders, then archives.
- No silent email-based transfer to another lead.
- Confirm RPC rejects archived tours; public get-token presents archived-scheduled as non-confirmable.
- One-shot heal: cancel existing archived + null-lead occupying rows.

## Merge/reconcile framework?

Not required for the defect. Venue should schedule on the surviving lead explicitly if they still want the appointment. Building transfer-on-delete would be a separate product decision.
