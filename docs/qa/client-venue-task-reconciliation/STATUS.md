# Client/Venue Task Reconciliation — Payments & Event Insurance

**Status: VERIFIED (GREEN)** — with payment list mismatch classified as expected behavior.  
**Sandbox only. Production untouched.**  
**Product SHA (serving):** `1061b7da46cbd2e8bbac31fb3d805f38e61eafd8`  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/39828709487  

## Fixture

| ID | Value |
| --- | --- |
| Venue | Meadowbrook `05f16a15-…` |
| Client | Bindi Lulu `0f554bb0-…` |
| Event | `4ed4d7fb-…` |
| Insurance task | `f5778f89-…` **complete** |
| Couple insurance doc | `fa395859-…` (file in client-media) |
| Venue documents row | `404fd5eb-…` (category insurance) |
| Payment schedule | `bace9bbd-…` ($15,000 / 4×$3,750) |

## Verdicts by workstream

| Workstream | Verdict |
| --- | --- |
| Insurance task completion (client vs venue) | **VERIFIED** — already complete in DB; venue Planning Completed; not in Upcoming |
| Insurance document persistence + All Documents | **VERIFIED** — file preserved; registered into `documents`; visible on booking Documents |
| Payment task list differences | **VERIFIED (expected)** — ledger installments vs Final payment checklist |
| QuickBooks sync vs paid status | **VERIFIED** — Initial Payment paid; QB pending does not change status |

## Browser

`EXPECTED_SHA=1061b7da… npx tsx docs/qa/client-venue-task-reconciliation/verify-browser.mts` → **11 / 11 PASS**

## Unit tests

```text
npx tsx --test lib/portal/couple-insurance-*.test.ts lib/portal/payment-task-list-consistency.test.ts
→ 21 / 21 pass
```

## Commits

- `a1be3603` Register shared couple insurance proofs in venue Documents  
- `1061b7da` Fix documents_one_entity constraint (event_id only)  
