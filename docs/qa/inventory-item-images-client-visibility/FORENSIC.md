# Inventory item images — client visibility forensic

**Verdict: images are venue-catalog only today — not shown to clients.**  
**Product change to expose images on the portal: not implemented (decision gate).**  
**Sandbox tip verified with Parts 1–2 UI fixes; see STATUS.md.**

## Question

When a venue uploads an image for an inventory item (e.g. 72-inch round table), where does that image appear to the client, if anywhere?

## Trace (verified in code)

### 1. Upload and storage

| Step | Location |
|---|---|
| Upload UI | `components/inventory/inventory-item-form.tsx` — optional **Photo** file input |
| Storage | Supabase Storage bucket `inventory`, path `{venueId}/{itemId}/image.{ext}` |
| Public URL | `supabase.storage.from("inventory").getPublicUrl(path)` |
| Persistence | `inventory_items.image_url` via `updateItemImage` / `updateItemImageAction` |

Venue catalog cards render the thumbnail (`components/inventory/inventory-library-section.tsx`).

### 2. Template / event application — image is not carried

Event Inventory is a **snapshot domain** (`lib/event-inventory/types.ts`):

- `EventInventoryItem` fields: name, category, quantity, unitPrice, isIncluded, notes, selection fields — **no `imageUrl`**.
- `InventoryTemplateItem` likewise has **no image field**.
- Applying a template / ensuring event inventory copies catalog provenance as `inventoryItemId` plus text fields only — not the catalog photo.

### 3. Client portal data layer — no image column

Portal API `GET /api/portal/inventory` maps RPC rows to:

`id, name, category, quantity, unitPrice, isIncluded, notes, clientSelectable, maxQuantity, draft/submitted quantities`

RPC `get_event_inventory_for_portal` (migration `20261422400000_…`) returns the same shape — **no `item_image` / `image_url`**.

UI `PortalInventoryItemView` (`components/portal/inventory-view.tsx`) has **no image property** and renders name/qty/price only.

### 4. Where images *do* appear

- **Venue Library → Inventory** item form and catalog cards (staff).
- Not on client portal Inventory.
- Floor-plan object rendering uses shape/dimensions from the catalog, not the photo field (separate from this portal path).

### 5. Intentional vs gap

This reads as an **intentional domain boundary** (master catalog presentation asset vs event inventory line items), not a dropped URL mid-pipeline: the event/portal models never defined an image field.

**Smallest option to expose photos later (requires product approval):**

1. Add optional `image_url` snapshot on `event_inventory_items` (and/or resolve live from `inventory_item_id` when shared).
2. Extend `get_event_inventory_for_portal` + portal API + `PortalInventoryItemView` to pass and render a thumbnail when present.
3. Confirm Storage RLS / public URL policy is acceptable for couples with a portal token.
4. Only show after inventory is shared (`shared`+ statuses), never on unshared drafts.

## Runtime evidence

See `probe-visibility.mts` / `probe-results.json` (catalog rows with `image_url` vs portal view model / RPC shape without image).
