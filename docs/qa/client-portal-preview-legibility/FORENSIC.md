# Client Portal Preview — legibility & fidelity forensic

**HEAD at fix:** pending commit on `feat/spaces-booking-e1-smart-fields`  
**Serving at audit:** `d2ea67d5`

## Source map

| Tab | Preview | Couple portal | Shared presentation? |
| --- | --- | --- | --- |
| Event Order | `ClientPortalPreview` → `EventOrderPortalView` | `EventOrderPortalSection` → same view | Yes |
| Floor Plans | `FloorPlanPortalView` | `FloorPlanSection` → same view | Yes (choose inert in preview) |
| Planning | `PlanningTasksPortalView` | Unified tasks couple band | Yes (read-only) |
| Inventory | `InventoryPortalView` | `InventoryPortalSection` → same | Yes |
| Vendors | `VendorsPortalPreviewView` | Full `VendorSection` | Partial — recommendations read-only by design |

Loader: `lib/client-portal-preview/load-preview.ts`  
Route: `/clients/[id]/portal-preview?event=`

## Visibility defect (root cause)

Preview painted `bg-[#F7F5F1]` **without** re-pinning light CSS variables. Staff dark theme leaves `--heading` / `--muted-foreground` / `--card` on dark-theme values (near-white ink). White/near-white on cream ≈ **illegible** (contrast ≪ 4.5:1).

Same class of defect as public forms; fix pattern already exists: `PUBLIC_FORM_LIGHT_VARS` + `data-theme-lock="light"`.

## Fidelity notes (post prior GREEN)

Presentation already shared for EO/Inventory/Floor/Planning. Remaining intentional gaps: Vendors preview omits mutating Pick/Submit; staff draft overlays labeled when unshared.

## Fix

`components/events/client-portal-preview.tsx`: apply `PUBLIC_FORM_LIGHT_VARS`, cream via `--natural-cream`, `data-theme-lock="light"`.
