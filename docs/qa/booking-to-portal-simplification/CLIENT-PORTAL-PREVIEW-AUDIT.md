# Client Portal Preview — Forensic Audit

**Date:** 2026-10-22  
**Branch:** `feat/spaces-booking-e1-smart-fields`  
**HEAD at audit:** `5ab68086` · Serving: `2262f82c`

## Summary

Venue staff preview (`/clients/[id]/portal-preview`) is a **parallel, simplified UI** (`ClientPortalPreview` + `loadClientPortalPreview`). It does **not** mount the couple portal sections. Data often differs from portal RPCs (live draft EO/inventory, unshared operational floor plan, thin vendor rows, couple tasks without due-date presentation).

## Tab comparison

| Tab | Couple route / component | Preview route / component | Reuses portal UI? | Data / fidelity gap | Smallest safe fix |
| --- | --- | --- | --- | --- | --- |
| Event Order | PortalShell → `EventOrderPortalSection` → `GET /api/portal/event-order` → `get_event_order_for_portal` (**last shared snapshot only**) | `ClientPortalPreview` custom list via `getEventOrder` (**live draft**) | No | Shows unreleased lines; missing shared badge, notes, delivery subtotal, “Not shared yet” empty | Extract portal presentation; load shared snapshot (or empty); draft only under explicit staff draft label |
| Floor Plans | `FloorPlanSection` → shared_with_couple plans + offers | Custom SVG of **operational/working** plan even when not shared | Partial (duplicated SVG) | Couple never sees unshared working layout | Load only `shared_with_couple` (+ offers); same empty/choose chrome; disable select in preview |
| Planning | `UnifiedTasksSection` (due dates, complete/undo, venue+vendor bands) | Flat title+status list from `event_tasks` owner=couple | No | No due dates / completion affordances; looks like venue checklist | Portal-shaped couple tasks + read-only unified presentation |
| Inventory | `InventoryPortalSection` → shared/finalized only; Included vs Additional + prices | Flat included list from live inventory | No | Wrong empty state; no Included/Additional split | Extract inventory portal view; enforce shared/finalized for client view |
| Vendors | `VendorSection` rich cards (`get_event_vendor_recommendations`) | Thin name/category; `not_included` when empty | No | “Not included” may be wrong when recommendations exist but loader only maps thin rows; empty copy differs | Staff load of recommendation browse shape; portal empty/browse chrome; no pick/submit |

## Visibility rules (source of truth)

- **EO:** `shared_at` + share snapshot (not open draft).
- **Inventory:** status `shared` \| `finalized` via RPC.
- **Floor plans:** `shared_with_couple = true` (offers separate).
- **Planning:** couple-facing tasks via portal task RPCs — never venue `owner_type=venue` notes.
- **Vendors:** event recommendations + directory; couple pick/submit are mutations — preview must not call them.

## Screenshot vs couple

Screenshots (lists, operational layout, “Not included” vendors, pending-only planning) match the **preview mockup**, not `EventOrderPortalSection` / `InventoryPortalSection` / `FloorPlanSection` / `UnifiedTasksSection` / `VendorSection`.

## Implementation approach

1. Extract shared presentation views from portal sections (or add `previewData` / `previewMode` props).
2. Rewrite `loadClientPortalPreview` to portal-faithful client-visible payloads; staff draft overlay only when clearly labeled and not presented as released.
3. Mount those views in `ClientPortalPreview`; keep banner, back link, read-only (no release/invite/share/pick/complete).
