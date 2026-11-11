# Inventory included price display / persistence

**Status: IN PROGRESS**

See `FORENSIC.md`.

## Fix

- List shows configured `unitPrice` even when Included (with “no extra charge” hint).
- `ItemSheet` calls `router.refresh()` after save.
- Billing still excludes included items (`isInventoryItemBillableForInvoice`).

## Tests

```bash
npx tsx --test lib/event-inventory/list-display.test.ts lib/event-inventory/handoff.test.ts
```

Browser: `EXPECTED_SHA=<sha> npx tsx docs/qa/inventory-included-price-display/verify-browser.mts`
