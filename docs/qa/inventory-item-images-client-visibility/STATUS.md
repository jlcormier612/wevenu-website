# Client-facing inventory photos — STATUS

**Approach:** Snapshot `event_inventory_items.image_url` from the venue catalog at add/apply time (matches Event Inventory’s snapshot domain). Portal RPC returns `coalesce(snapshot, catalog)` so legacy rows still resolve after backfill. Visibility unchanged: only shared+ inventory via portal token.

**Migration:** `20261425600000_event_inventory_item_image_url.sql`  
**UI:** `components/portal/inventory-view.tsx` (`data-testid="inventory-item-photo"`)  
**API:** `GET /api/portal/inventory` → `imageUrl`

**Production:** untouched.
