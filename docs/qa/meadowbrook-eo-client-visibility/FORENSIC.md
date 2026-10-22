# Forensic — Meadowbrook Bindi & Jake Event Order vs client portal

**Date:** 2026-10-22 (Sandbox only)

## Identifiers (safe)

| Record | ID |
| --- | --- |
| Venue | Meadowbrook Valley Venue `05f16a15-1752-4855-8a3b-aad5c593d8d9` |
| Client | Bindi Lulu / Jake Paws `0f554bb0-9766-4dd2-a4c1-fdd2bcd1e001` |
| Event | `4ed4d7fb-a301-42eb-8dc6-6b76a872f8e8` (2027-10-24, 50 guests) |
| Event Order | `f0fa9108-c6b8-4ea6-a071-5fd43db61a51` |
| Invoice | `INV-2026-08500C` / `08500c0c-13c0-4d13-ae73-0b870a8e4770` |
| Couple portal session | `fffbc617-85f9-41ae-8e0f-aa2b346b8873` (access_level=couple) |

## Linkage

- Invoice.`event_id` → Event ✓  
- Invoice.`event_order_id` → Event Order ✓  
- Event.`client_id` → Client ✓  
- Event Order.`event_id` → Event ✓  
- Event Order.`client_id` is null (normal for event-scoped orders; portal joins via `events.client_id`) ✓  

## Venue editor source of truth

Canonical `event_orders` + `event_order_lines` (not the invoice).

| Line | Amount | Provenance |
| --- | --- | --- |
| Plated Dinner | $85 | custom |
| Day-of Coordination | $1,200 | custom |
| Beer & Wine | $28 | custom |
| Chiavari Chair | $8 | custom |
| Ceremony Coordination | $500 | custom |
| Arbor | $350 | custom |
| Buffet Dinner | $72 | custom |
| **Delivery subtotal** | **$2,243** | sum of EO lines |

Invoice draft stores `subtotal=0` / live-projects EO charges (Phase 3a). Stored ad-hoc lines: Discount $250, Tax 6.25% amount $0 (separate tax-base defect on EO drafts — fixed in `a11547be`). No payment schedule row yet for this invoice.

## Sharing state (before lifecycle proof)

- `event_orders.status` = `open`  
- `shared_at` = **null**  
- `finalized_at` = **null**  
- `event_order_share_snapshots` = **none**  

## Why the client sees “Not shared yet”

Portal RPC `get_event_order_for_portal` requires `eo.shared_at is not null` and then reads the latest share snapshot. With `shared_at` null it returns zero rows → UI empty state.

This is the **intended privacy gate**, not a wrong-event or wrong-order association.

## Product share path

1. Venue must **Finalize** (`status=finalized`) — UI shows Finalize while `open`.  
2. Then **Share with Client** — `shareBlockedWhenNotFinalized` refuses share until finalized.  
3. Share writes PDF/document, inserts `event_order_share_snapshots`, sets `shared_at`, emails portal deep-link `#event-order`.

## Conclusion (forensic)

Venue and client reference the **same** event and canonical Event Order. The client page is empty because the order was **never finalized/shared**, not because records are mislinked.

## Lifecycle proof run

Serving `a11547be457ce5323e4d32fb2fda2d6ff7df0d53` — passed=18 failed=0.

- portal empty before share ✓  
- Finalize persisted (`status=finalized`, `shared_at` still null) ✓  
- Share persisted `shared_at` + snapshot revision 5 with 7 lines ✓  
- portal RPC returned 7 rows ✓  
- client Order UI: “What you're receiving / Shared” with CATERING / SERVICES / BAR / RENTALS lines ✓  
- invoice still `event_order_id=f0fa9108-…` ✓  
- template line count unchanged (7) ✓  
- foreign couple token: 0 rows; bogus token: 0 rows ✓  
