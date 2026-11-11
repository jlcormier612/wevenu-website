# Inventory & Event Order — Unified Document Lifecycle

**Verdict: ACCEPTED / GREEN**  
**Date:** 2026-10-29  
**Production:** untouched  
**Unrelated dirty/untracked work:** preserved

Implementation map: [`IMPLEMENTATION-MAP.md`](./IMPLEMENTATION-MAP.md).

---

## Serving / deploy

| Item | Value |
|---|---|
| **Exact serving SHA** | `f07b838f9f0a6dc51d5fe47c85f687eafe1420c8` |
| ECS | `htc-sandbox-venue-app:f07b838f9f0a6dc51d5fe47c85f687eafe1420c8` |
| Lifecycle product tip included | `2b97ed8805fde90079fdb69ea6a7e3990ec7d14b` (finalize notify + Documents) |
| Deploy of tip | [40802899491](https://github.com/jlcormier612/wevenu-website/actions/runs/40802899491) (tip) · prior lifecycle ship [40800596173](https://github.com/jlcormier612/wevenu-website/actions/runs/40800596173) |
| Migration | `20261425800000_inventory_agreement_venue_documents.sql` via [40800628547](https://github.com/jlcormier612/wevenu-website/actions/runs/40800628547) |

---

## Implemented (verified on serving tip)

| Requirement | Evidence |
|---|---|
| Inv/EO removed from Portal Setup toggles | Browser Settings + Setup Profiles |
| Portal sections not gated by those toggles | `isPortalSectionEnabledByCapabilities` + Scenario C |
| Inventory finalize → email + portal notify | Resend `provider_id` on `conversation_messages` + `couple_notifications` |
| Client Choices finalize → email + portal notify | Same pattern after UI finalize |
| Couple Documents — Inventory Agreement | Portal Docs card “Inventory Agreement / Finalized” |
| Venue Documents — finalized Inventory | Venue UI Documents + finalized row |
| Pre-booking Inventory full lifecycle | Scenario A harness |
| Pre-booking Event Order / Choices lifecycle | Scenario B harness |
| Booked portal initiation parity | Scenario C harness |
| Idempotency / isolation / template stability | Scenario D checks in harness |

---

## Focused tests

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

## Browser acceptance (full lifecycle)

```bash
EXPECTED_SHA=f07b838f9f0a6dc51d5fe47c85f687eafe1420c8 \
  npx tsx docs/qa/inventory-eo-document-lifecycle/verify-lifecycle-full.mts
→ GREEN — 38 pass / 0 fail
```

Evidence: `lifecycle-full-results.json`, `lifecycle-full-run.log`, `lifecycle-full-persisted.json`, shots `A-*`, `B-*`, `C-*`, `lifecycle-settings-*`.

### Scenario A — Pre-booking Inventory
PASS: planning client / unbooked event → Select → Share for selection → Resend email with Inventory link → clean couple context opens Inventory (not invoice) → submit → venue Confirm → Finalize → finalize email (`provider_id`) + portal notification → venue + couple Documents show Inventory Agreement → duplicate finalize idempotent → template edit does not mutate finalized items → invalid token blocked.

### Scenario B — Pre-booking Event Order (Choices)
PASS: choices seeded `sent` → couple portal Choices UI select Plated + entrée → Submit → staff `#event-order-choices` Create Event Order finalize → status `finalized` + EO lines → finalize email + portal notification → Documents/EO row present.

### Scenario C — Booked portal parity
PASS: booked client portal Inventory + Choices submit → venue finalize both → no Portal Setup capability dependency.

### Scenario D — Idempotency / isolation / immutability
PASS: duplicate finalize keeps single finalized row; finalize email accepted with provider id (not false-delivered); invalid token blocked; finalized inventory stable after template item insert.

---

## Harness note

`get_venue_documents` is `security definer` on `current_user_venue_id()` — service-role probes return empty. Venue Documents acceptance uses staff UI + finalized table rows. Couple Documents accepted via portal UI.

Production untouched.
