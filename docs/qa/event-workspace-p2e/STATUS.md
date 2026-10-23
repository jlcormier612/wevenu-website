# P2-E — Full Event Order + Client Choices end-to-end regression

**STATUS: GREEN / CLOSED** (Sandbox serving + browser + persisted state verified)  
**Date:** 2026-10-23  

| | |
| --- | --- |
| **Product SHA (serving)** | `1939228ef0bea24873ba8e01851549d3298f1018` (P2-D product; no P2-E product code change required) |
| **Deploy baseline** | https://github.com/jlcormier612/wevenu-website/actions/runs/40025380685 (P2-D; still serving) |
| **Serving image** | `htc-sandbox-venue-app:1939228ef0bea24873ba8e01851549d3298f1018` |
| **Digest** | `sha256:d5138c99f999abbe1990ac611eb9d26845ef1882a4848340530d64b28ebe1cc3` |
| **Evidence / test-align commit** | (this STATUS + harness + stale commercial-status test alignment) |
| **Production** | untouched |

## Scope

Final integration gate over P2-A → P2-D. Scenarios A–G exercised against the exact serving SHA. Safe Sandbox fixture only — no real customer email/SMS. No workflow redesign; no new financial model; booking semantics unchanged.

## Targeted fix (test-only)

`lib/event-orders/commercial-status.test.ts` — aligned with locked P2-A (Event Order is hash-addressable `TabsContent` via workspace card; no `TabsTrigger value="event-order"`). No application-runtime change.

## Units / regression

```text
npx tsx --test \
  lib/portal/couple-nav-visibility.test.ts \
  lib/portal/couple-documents-event-order.test.ts \
  lib/portal/inventory-event-order-discoverability.test.ts \
  lib/events/workspace-tab-nav-p2a.test.ts \
  lib/events/event-order-journey-stage0.test.ts \
  lib/events/event-commercial-workflow-p2b.test.ts \
  lib/client-choices/couple-email.test.ts \
  lib/client-choices/event-order-apply-cta.test.ts \
  lib/event-orders/commercial-status.test.ts \
  lib/portal/workspace-routing.test.ts \
  lib/portal/couple-document-status.test.ts
→ 88/88 pass
```

## Browser (`EXPECTED_SHA=1939228e…`)

```text
EXPECTED_SHA=1939228ef0bea24873ba8e01851549d3298f1018 \
  npx tsx docs/qa/event-workspace-p2e/verify-browser.mts
→ 46 pass / 0 fail
```

### Scenarios A–G

| Scenario | Result | Notes |
| --- | --- | --- |
| **A** Selectable + fixed/included; preview | **PASS** (7) | Preview open; activity/status unchanged; options present; included option retained |
| **B** Send selection request (P2-C) | **PASS** (6) | ShareDialog; `sent`; `email_submitted` truthful; `#choices` deep link; Choices nav while active |
| **C** Couple submit | **PASS** (4) | Status `submitted`→finalize path; Choices nav hidden after submit; invoices/schedules unchanged by submit alone |
| **D** Create/Update EO from selections | **PASS** (7) | Finalized; 1 applied line; fixed lines preserved; no duplicate choices lines; line-id idempotency |
| **E** Share + Documents | **PASS** (8) | Shared EO in Documents API + card; opens `#event-order`; no draft exposed; share≠acceptance |
| **F** Invoice / payment-plan handoff | **PASS** (5) | Invoice anchor; no duplicate on retry; submit alone did not create invoice (count stayed 1) |
| **G** Booking + Inventory invariants | **PASS** (5) | `confirmed` / `booked_at=2026-10-22` unchanged; inventory deep link; legacy `#event-order` |

## Persisted evidence (high level)

- **Choices:** `5df6f8f6-…` Wedding Reception → sent → submitted → **finalized**; `applied_line_ids` length **1**
- **Event Order:** `624eceef-…` **finalized**, `shared_at` set; **44** lines; applied choices line present
- **Documents:** `documentsEventOrderCount=1`; draft not exposed
- **Invoices:** before=1, afterSubmit=1, afterHandoff=1 (no premature / duplicate creation)
- **Booking:** status `confirmed`, `booked_at` `2026-10-22` unchanged

Artifacts: `browser-results.json`, `persisted-state.json`, `shots/*`

## Deferred / out of scope

- Production deploy
- Redesign of commercial workflow
- P2-E did not require a new product SHA; runtime remains P2-D `1939228e…`
