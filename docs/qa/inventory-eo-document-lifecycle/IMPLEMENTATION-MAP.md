# Inventory & Event Order — Unified Document Lifecycle

**Phase A map — before implementation**  
**Date:** 2026-10-28  
**Production:** untouched

---

## Existing runtime (reuse, do not fork)

| Concern | Where it lives today | Status vs required lifecycle |
|---|---|---|
| Inventory template → event instance | `ensureEventInventory` / Library Send | Exists |
| Inventory share + email deep-link | `shareEventInventory` → `inventoryReviewUrl(?view=inventory)` | Exists — opens Inventory, not invoice |
| Inventory client select/submit | Portal RPCs + `inventory-view` | Exists |
| Inventory venue confirm / finalize / lock | `confirmInventorySelections`, `finalizeEventInventory` | Exists — **no Documents write, no client finalize notify** |
| EO template → choices send | `sendClientChoices` + `couple-email` | Exists |
| EO client respond | Portal Choices UI | Exists |
| EO venue finalize selections → lines | `finalizeClientChoices` | Exists — **no client finalize email/portal notify** |
| EO share + Documents + PDF | `shareEventOrderWithClient` + `document-integration` | Exists for shared EO |
| Contract-style `/sign/{token}` pre-booking | Contracts only | Reference pattern; Inv/EO use portal token deep-links (same auth boundary as Choices) |
| Setup Profiles Inventory/EO steps | Filtered out via `isCommercialSetupStep` | Already removed from Setup experience |
| Planning capabilities Inventory/EO toggles | `PLANNING_CAPABILITY_OPTIONS` + portal gate | **Still present — Portal Setup gate to remove** |

---

## Gaps this task closes

1. **Portal Setup:** Remove Inventory and Event Order from planning-capability configuration UI; stop gating portal entry on those flags (entry points remain; content-driven visibility stays).
2. **Inventory Agreement Documents:** On successful finalize, publish/finalize a canonical Document (mirror EO `document-integration`) so venue + client Documents can open the locked snapshot.
3. **Finalize notifications (email + portal):** After Inventory finalize and Client Choices finalize, notify the client by email and `createCoupleNotification` (idempotent via activity/outbound source keys). Failure must not unlock or roll back finalize.
4. **Lifecycle parity:** Portal share and Library/email share already share service functions; keep that single path. No second email-vs-portal implementation.
5. **Pre-booking access:** Continue creating a couple portal session on send when missing (already done). Deep-link must open the document section (`?view=inventory` / Choices / `#event-order`), not invoice. Legal accept may still apply once; invitation/password setup must not be required to respond.

---

## Minimal file plan

| Area | Files |
|---|---|
| Portal Setup removal | `lib/playbooks/capabilities.ts`, `components/settings/planning-capabilities-section.tsx` consumers/tests |
| Inventory Documents | `lib/event-inventory/document-integration.ts` (new), `finalizeEventInventory` in `service.ts` |
| Finalize notify | `lib/event-inventory/finalize-notify.ts` (new), call from inventory finalize; `lib/client-choices/finalize-notify.ts` (new), call from `finalizeClientChoices` |
| Couple Documents inventory | `lib/portal/couple-documents-inventory.ts` (new) + documents GET merge (mirror EO) |
| Tests | focused unit/seam tests + browser harness under `docs/qa/inventory-eo-document-lifecycle/` |
| STATUS | this folder |

Domain rules (selectable vs included, EO offerings/deps, pricing) are **not** changed.

---

## Out of scope (explicit)

- General document framework rewrite  
- Proposal/contract product changes beyond reuse as reference  
- Invoice/payment/booking eligibility changes  
- Production deploy  
