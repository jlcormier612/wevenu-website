# Client portal Inventory terminology

**Status: IN PROGRESS**

## Product decision

- Tab label: **Inventory** (not Included)
- Inventory = all shared event inventory (package-included + paid add-ons)
- Item labels: “Included — no extra charge” only when `isIncluded`; otherwise “Additional fee …”
- Empty / not-shared stays distinct from shared
- Not Event Order / invoice / payment plan

## Audit summary

| Surface | Before | After |
| --- | --- | --- |
| Mobile nav `shortLabel` | `Included` | `Inventory` |
| Home card blurb | “including for your event” | package items and add-ons |
| Empty state | “what your venue is including…” | not shared yet + neutral future copy |
| Shared heading | “What’s included in your event” | `Inventory` + neutral intro |
| Item labels | “Included in your package…” | “Included — no extra charge” / “Additional fee — …” |
| Task CTA / share notice | “what’s included” | “Review inventory” / “event inventory” |
| Staff preview | shared `InventoryPortalView` | unchanged wiring; copy follows |

Venue can already share mixed included + paid lists (`is_included` per item); no pricing/EO logic changed.

## Tests

```bash
npx tsx --test lib/portal/inventory-terminology.test.ts \
  lib/portal/inventory-event-order-discoverability.test.ts \
  lib/event-inventory/client-selection.test.ts \
  lib/client-portal-preview/portal-preview-fidelity.test.ts
```

Browser: `EXPECTED_SHA=<sha> npx tsx docs/qa/inventory-terminology/verify-browser.mts`
