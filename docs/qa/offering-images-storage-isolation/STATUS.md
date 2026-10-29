# Offering images + inventory storage isolation

| Field | Value |
| --- | --- |
| **Status** | IN PROGRESS |
| **Commit** | `2acd44412036e1682b70d95d960e15181053c8e1` |
| **Branch** | `feat/spaces-booking-e1-smart-fields` |
| **Migration** | `20261425900000_offering_images_inventory_storage_isolation.sql` |
| **Baseline serving (pre-deploy)** | `f07b838f9f0a6dc51d5fe47c85f687eafe1420c8` |
| **Production** | Untouched |

## Scope

- Optional Offering catalog photos (independent of Inventory; rental-link image fallback).
- Snapshot through EO template options → frozen Client Choices → couple portal.
- Path-scoped `inventory` bucket insert/update/delete by `current_user_venue_id()`.
- Public SELECT retained for legitimate catalog/portal display.

## Commands (after deploy)

```bash
EXPECTED_SHA=2acd44412036e1682b70d95d960e15181053c8e1 \
  npx tsx docs/qa/offering-images-storage-isolation/verify-browser.mts

EXPECTED_SHA=2acd44412036e1682b70d95d960e15181053c8e1 \
  npx tsx docs/qa/event-order-template-builder-ux/verify-browser.mts

EXPECTED_SHA=2acd44412036e1682b70d95d960e15181053c8e1 \
  npx tsx docs/qa/event-order-template-builder-ux/verify-portal-finalize.mts

EXPECTED_SHA=2acd44412036e1682b70d95d960e15181053c8e1 \
  npx tsx docs/qa/inventory-eo-document-lifecycle/verify-lifecycle-full.mts
```
