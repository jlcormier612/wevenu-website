# Inventory & Event Orders — Portal Discoverability

**Verdict: IN PROGRESS** — discoverability implemented; awaiting Sandbox deploy + browser A–G.

Production untouched. Unrelated dirty tree preserved.

## Audit matrix

| Area | Finding | Disposition |
| --- | --- | --- |
| Canonical inventory for clients | Event Inventory (`event_inventory` status shared/finalized) via `get_event_inventory_for_portal` — not master `inventory_items` catalog | GREEN (model) |
| Canonical Event Order for clients | Latest share snapshot when `event_orders.shared_at IS NOT NULL` via `get_event_order_for_portal` | GREEN (model) |
| Client Inventory discoverability | Section/API existed; **missing from NAV_ITEMS and Home** | FIXED |
| Client Event Order discoverability | In nav but **hidden until shared** — clients could not find the empty/not-shared state | FIXED |
| Sharing boundary | Unshared returns empty; do not weaken | PRESERVED |
| Venue create/share | Panels + `shareEventInventory` / `shareEventOrderWithClient` exist | PARTIAL → verify browser |
| Template isolation | Event order edits do not mutate templates | Verify browser/DB |

## Product terminology (client)

- **Inventory** — what the venue included for *this* event (read-only once shared).
- **Event Order** — the event delivery list (read-only shared snapshot).

## Implementation

- Nav: add Inventory; keep Event Order visible whenever planning capability is on.
- Home: Working With Your Venue cards for both destinations.
- Empty states clarify not-yet-shared vs shared content.
- Sharing still server-enforced.

## Verification

```text
npx tsx --test lib/portal/inventory-event-order-discoverability.test.ts \
  lib/portal/mobile-nav-readiness.test.ts
→ 10/10 pass (local)

EXPECTED_SHA=<sha> npx tsx scripts/qa/inventory-event-order-portal-discoverability.mts
```
