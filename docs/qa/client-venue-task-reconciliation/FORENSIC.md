# Client/Venue Task Reconciliation — Forensic

**Event (screenshot match):** Meadowbrook Valley Venue  
- Venue `05f16a15-1752-4855-8a3b-aad5c593d8d9`  
- Client `0f554bb0-9766-4dd2-a4c1-fdd2bcd1e001` (Bindi Lulu)  
- Event `4ed4d7fb-a301-42eb-8dc6-6b76a872f8e8`  
- Insurance task `f5778f89-60ee-43dd-8755-f9f200df8b43`  
- Couple insurance doc `fa395859-7f7c-4898-a86c-bb27b12e6a0f`  
- Payment schedule `bace9bbd-a462-4982-9562-b445faaf00bc`

## Insurance

| Layer | Finding |
| --- | --- |
| Upload + storage | Persisted in `client-media`; couple_documents row `source_type=insurance`, `share_with_venue=true` |
| Celebration | `luv_celebrations.insurance_uploaded` fired; confetti was truthful for completion |
| Task completion | `event_tasks.status=complete` at same timestamp as upload — trigger worked |
| Venue Upcoming | DB already complete; UI mismatch was Documents visibility / stale reading, not incomplete task |
| All Documents | **DEFECT** — `get_venue_documents` only unions `documents` (etc.), not shared `couple_documents` |

**Root cause (documents):** Share persisted only in `couple_documents`. Venue workspace never registered a `documents` row, so All Documents stayed empty for insurance.

**Correction:** On insurance share commit, idempotently insert event-scoped `documents` (category insurance) pointing at the same file. Heal on venue Documents load for orphans. No re-upload; no second completion trigger.

## Payments

| Observation | Classification |
| --- | --- |
| Client sees Planning Payment 1/2 + Final as ledger lines | **Expected** — `payment_line_items` via portal unified tasks |
| Venue checklist shows Final payment task only | **Expected** — seed playbook task `final_payment_obligation_paid`; not one task per installment |
| Initial Payment paid cash Oct 22, QB pending | **Expected** — paid line omitted from outstanding; QB sync ≠ payment status |
| No Planning Payment 1/2 event_tasks | **Expected** — do not duplicate ledger as checklist |

QuickBooks `pending` did not mark unpaid lines paid.
