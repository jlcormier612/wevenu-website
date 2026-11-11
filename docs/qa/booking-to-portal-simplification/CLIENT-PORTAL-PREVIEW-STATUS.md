# Client Portal Preview fidelity — STATUS

**Verdict: GREEN**

Production untouched. Unrelated dirty working tree preserved.

## Preflight → close

| Item | Value |
| --- | --- |
| Branch | `feat/spaces-booking-e1-smart-fields` |
| Product commits | `a72a6f6b` (shared portal views) → `afbd0dff` (vendor directory enrich + harness) |
| Intended serving SHA | `afbd0dff516dbda3057dc056475ea96b0c9adcc5` |
| Deploy | [39807309116](https://github.com/jlcormier612/wevenu-website/actions/runs/39807309116) **success** |
| Exact Sandbox `dpl=` | `afbd0dff516dbda3057dc056475ea96b0c9adcc5` (match) |
| Fixture | event `ebf74f77-2944-474a-b735-48762ecb6842` · client `b4e2764b-be33-4579-89e3-0c8e4a6dd5be` (Fancy) |
| Acceptance | `portal-preview-fidelity-results.json` → **GREEN** 37/37 |

## Forensic root cause (audit)

Full tab comparison: `CLIENT-PORTAL-PREVIEW-AUDIT.md`.

Staff preview was a **parallel mockup** (`ClientPortalPreview` custom lists) fed by live draft/operational data, not couple portal sections / visibility rules. Screenshots (flat lists, unshared operational floor, “Not included” vendors, pending-only planning) matched that mockup — not `EventOrderPortalSection` / `InventoryPortalSection` / `FloorPlanSection` / couple planning / `VendorSection` recommendation browse.

## Implementation (smallest safe change)

1. Extract shared presentation views used by both portal sections and staff preview:
   - `components/portal/event-order-view.tsx`
   - `components/portal/inventory-view.tsx`
   - `components/portal/floor-plan-view.tsx` (shared + offers only; choose is inert “preview only”)
   - `components/portal/planning-tasks-view.tsx` (couple-owned tasks + due labels; no notes; no complete mutation)
   - `components/portal/vendors-preview-view.tsx` (read-only recommendation cards; no pick/submit/ensure)
2. Rewrite `lib/client-portal-preview/load-preview.ts` for portal-faithful payloads (shared EO snapshot / draft overlay; inventory shared\|finalized vs staff draft; floor `shared_with_couple` + offers; couple tasks only; `getEventRecommendations` only — never `getOrEnsure`).
3. Rewrite `components/events/client-portal-preview.tsx` to mount those views with banner, visibility badges, back link, safety note.
4. Vendor cards enriched from `vendors` directory fields (description / logo / website) without seeding recommendations.

### Tab fidelity (runtime)

| Tab | Couple-facing | Preview now | Match notes |
| --- | --- | --- | --- |
| Event Order | `EventOrderPortalView` via section | Same view; client empty “Not shared yet” + labeled staff draft | EO unshared on fixture — honest |
| Floor Plans | Choose layout + SVG | Same chooser/SVG; button is **preview only** (no select mutation) | Side-by-side Barn-master-floorplan matches |
| Planning | Couple tasks + dues | Same “From your venue” band + dues; venue tasks never shown | Visible to client on fixture |
| Inventory | Empty until shared/finalized | Client empty + labeled staff draft of live items | Couple empty state matches |
| Vendors | Full `VendorSection` (required / pick / directory) | Read-only recommendation cards from same event recs | Names present (Flora’s, Harah’s, Sweet Dreams, …); Pick/submit suppressed by design |

**Vendors intentional gap:** preview does not mount the interactive `VendorSection` (Pick, required-team mutations, approved directory browse) because those paths mutate. Presentation is the shared read-only recommendation card view fed by the same `event_vendor_recommendations` rows the portal RPC uses.

## Tests

```text
npx tsx --test lib/client-portal-preview/portal-preview-fidelity.test.ts \
  lib/event-orders/event-order-completeness.test.ts
→ 16 pass / 0 fail
```

## Runtime acceptance

```text
EXPECTED_SHA=afbd0dff516dbda3057dc056475ea96b0c9adcc5 \
  npx tsx scripts/qa/client-portal-preview-fidelity-acceptance.mts
→ GREEN · 37 passed · 0 failed
```

Evidence:

- `portal-preview-fidelity-results.json`
- `portal-preview-fidelity-acceptance.log`
- Screenshots: `portal-preview-fidelity-shots/preview-{tab}-{1280,390}.png` + `couple-{domain}-1280.png`

### Screenshot inspection (agent)

- **EO 1280:** Client “Not shared yet” + staff draft Catering lines — not falsely released.
- **Floor 1280:** Offer chooser + layout SVG; “Choose this layout (preview only)”.
- **Planning 1280:** Couple tasks with due dates / Required; no venue checklist leak.
- **Inventory 1280:** Client empty chair state + staff draft Included list.
- **Vendors 1280 / 390:** Populated recommendation cards (fixes prior “Not included”).
- **Couple floor:** Same Barn-master-floorplan chooser as preview (mutating Choose on couple only).
- **Couple inventory empty:** Matches preview client-visible empty copy.

### Read-only before/after (fixture)

| Signal | Before | After |
| --- | --- | --- |
| invoices (Fancy) | 38 | 38 |
| client_invitations | 1 | 1 |
| notification_log | 3477 | 3477 |
| event_orders.shared_at / revision | null / 0 | null / 0 |
| event_inventory | null | null |
| event_vendor_recommendations | 5 | 5 |
| event_tasks | 18 | 18 |
| event_order_templates (active) | 2 | 2 |
| client_portal_sessions | +1 QA compare token only (deleted after run) | |

No invites, questionnaire sends, invoice/payment, Library, or recommendation-ensure mutations from preview.

## Files changed (this task)

Product: portal view extracts, section slim, `client-portal-preview.tsx`, `load-preview.ts`, fidelity + completeness seam tests, audit doc.

Evidence/harness (this close): STATUS, results JSON/log, shots, harness tweaks (back nav + legal welcome).

## Production

Untouched (no Production deploy; Sandbox-only workflow).

## Definition of GREEN checklist

- [x] Preview reuses couple-facing presentation components / shared views
- [x] Five tabs show correct client-visible / draft / empty states
- [x] No internal venue Planning leak
- [x] Floor respects shared/offers; no mutating choose in preview
- [x] Vendors show when configured; not fake “Not included”
- [x] Read-only DB proof
- [x] Automated + browser acceptance on matching `dpl=`
- [x] Screenshots inspected
- [x] Unrelated dirty tree preserved
- [x] Production untouched
