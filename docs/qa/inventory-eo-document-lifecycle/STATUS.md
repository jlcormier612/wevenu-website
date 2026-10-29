# Inventory & Event Order — Unified Document Lifecycle

**Verdict: OPEN / NOT ACCEPTED**  
**Date:** 2026-10-28  
**Production:** untouched  
**Unrelated dirty/untracked work:** preserved

Implementation map: [`IMPLEMENTATION-MAP.md`](./IMPLEMENTATION-MAP.md).

---

## Implemented (code — not yet Sandbox browser-closed)

| Requirement | Change |
|---|---|
| Remove Inv/EO from Portal Setup toggles | Removed from `PLANNING_CAPABILITY_OPTIONS`; portal sections always enabled |
| Finalize → client email + portal notification (Inventory) | `lib/event-inventory/finalize-notify.ts` called after persist |
| Finalize → client email + portal notification (EO selections) | `lib/client-choices/finalize-notify.ts` called after persist |
| Couple Documents — Inventory Agreement | `mergeFinalizedInventoryIntoCoupleDocuments` + Documents UI card |
| Venue Documents — finalized Inventory | Migration `20261425800000_inventory_agreement_venue_documents.sql` |
| Notify failure must not unlock | Notify in try/catch after status persist |

Existing (reused, not rewritten): template→instance, share email deep-links (`?view=inventory`, Choices, `#event-order`), client respond, venue review/finalize lock, EO Documents on share, Setup Profiles already exclude Inv/EO commercial steps.

---

## Focused tests (local)

```text
npx tsx --test \
  lib/event-inventory/finalize-notify.test.ts \
  lib/client-choices/finalize-notify.test.ts \
  lib/portal/couple-documents-inventory.test.ts \
  lib/portal/inventory-event-order-discoverability.test.ts \
  lib/playbooks/planning-capabilities-batch.test.ts \
  lib/event-setup/venue-settings-sot.test.ts
→ 34 pass / 0 fail
```

---

## Remaining for GREEN (required)

1. Deploy product commit + apply migration `202614258` to Sandbox.
2. Confirm exact serving SHA.
3. Real browser scenarios 1–4 from the task brief (pre-booking Inv, pre-booking EO, booked portal path, finalization/failure/isolation).
4. Evidence of Documents open for both parties, finalization email + portal notification, Portal Setup no longer listing Inv/EO.

Until those pass on the serving commit: **OPEN / NOT ACCEPTED**.

Production untouched.
