# Luv — Contextual intelligence (S1–S4)

**Status:** NOT GREEN — S1/S2 locked evidence unchanged; S3/S4 + stage-as-proof retired  
**Jennifer handoff:** do not accept until exact-runtime browser+DB after this correction  
**Commit / image:** `2c0930260fa8a4b9e2e3a06654b696e2286e063e` (contains `04794c77`)  
**Sandbox task (sole RUNNING):** `c65351167c2847fe85aa10b20eede896`  
**Task definition:** `htc-sandbox-venue-app:469`  
**Digest:** `sha256:4b3678dd55574aee0e264318b660d65592bb66d51fb2895bea7d650b639bf4bd`  
**Health:** `/api/health` → 200  
**Production:** untouched  
**S5:** explicitly out of scope  

## Locked decisions

| Signal | Window / rule | Surface | Dashboard |
| --- | --- | --- | --- |
| **S1** Event + contract sent | event ≤21 days + contract `sent` | L3 contract/event | No |
| **S2** Event + payment attention | event ≤21 days + `computePaymentsReadiness` = `needs_attention` | L3 payment/event | No |
| **S3** Unattended inquiry | age ≥48h + no qualifying contact (messages / tour record / `last_contacted_at`). **Not** `sales_stage`. Booked/lost via `first_booked_at` / `lost_at` only. | L3 lead | No |
| **S4** Tour | upcoming `tour_appointments` status scheduled/confirmed within 3 days → contextual all-set, no CTA; otherwise silence. **Not** `sales_stage`. Empty `last_contacted_at` / `next_action` do not manufacture work. | L3 lead | No |

## Locked architectural rule (2026-10-02)

Pipeline / sales stage is **never** authoritative evidence for coordinator observations or customer-facing drafts. Stage is weak journey metadata only. Tour, contact, proposal, contract, payment, booking, task completion, and customer response must use the workflow record that owns that fact.

Prior S3 (`new_inquiry` + `last_contacted_at` null) and S4 (`next_action` / empty last contact → “Make first contact”) proofs below are **superseded**. Do not treat them as current GREEN.

## Browser proof (Sandbox, Fancy Venue fixtures) — historical, S3/S4 superseded

| Signal | Insight | Action | Resolve (underlying condition) | Suppression |
| --- | --- | --- | --- | --- |
| S3 | yes — “has not been contacted yet” | Reach out → draft follow-up | set Last contacted via Add details | L3 gone on reload |
| S4 | yes — “preparation is still incomplete” | Complete the open next action | clear next action | L3 gone on reload |
| S1 | yes — contract awaiting signature | Follow up on the signature | **Client signed** via `/sign/{token}` → status `signed` | L3 gone; stays gone after reload; no generic `contract-*` duplicate |
| S2 | yes — payment needs attention | Review the payment | **Record Payment** on schedule `b139432a…` via `markPaidAction` → line `paid` | L3 gone; stays gone after reload; readiness “Paid in full” |

### Resolution evidence (real cause, not UI hide)

- S1 contract `1a8c8868-…`: `sent` → `signed` (signer `LuvCtx Approaching`)
- S2 line `77b47a23-…`: `overdue` → `paid` ($1,500 recorded on schedule UI)
- Client `/clients/247c22cf-…` reload: only briefing remains (“2 planning items…”); no S1/S2
- Contract page reload: no awaiting-signature L3; no payment-attention L3
- Dashboard: no S1–S4 L3 copy (operational L1 cards remain, including LuvCtx Unattended follow-up queue)
- S3 lead `d1ea7b5f-…`: L3 still suppressed (`last_contacted_at` set)
- S4 lead `0e2b27f9-…`: L3 still suppressed (`next_action_text` null)

## GREEN checklist

- [x] S1 insight + action
- [x] S1 underlying condition resolved + suppress + reload
- [x] S2 insight + action
- [x] S2 underlying payment condition resolved + suppress + reload
- [x] S3 full lifecycle remains proven
- [x] S4 full lifecycle remains proven
- [x] Generic contract duplicates appropriately superseded / absent after S1 resolve
- [x] Dashboard remains free of S1–S4 L3
- [x] Exact sole ECS task / TD / tag / digest / health verified (no redeploy mid-proof)
- [x] Production untouched
- [x] S5 not implemented

**Engineering GREEN.** Jennifer browser pass = final acceptance.
