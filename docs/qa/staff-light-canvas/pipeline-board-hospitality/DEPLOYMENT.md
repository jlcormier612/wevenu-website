# Lead Pipeline board hospitality — Sandbox deployment

## Tip queued

**Code:** `ba000dc02758fc36411b27873d6ce07cea660460` — Eucalyptus stage headers, linen lanes, active count chips, blush lead-card hover.  
**Prior serving tip:** `ef78cdad` (staff dark botanical surfaces)  
**Deploy branch:** `sandbox-deploy/htc-pipeline-board-ba000dc0`  
**Actions:** https://github.com/jlcormier612/wevenu-website/actions/runs/41891208287

### This tip adds

- `.htc-pipeline-column-header` eucalyptus bands
- Linen column lanes + white lead cards
- `.htc-badge-active` counts; `.htc-record-link` names + blush hover
- Regression: `pipeline-board-hospitality.test.ts`

### Excluded

- Stage semantic color fills / drag-drop behavior changes
- Unrelated dirty tree (`leads/[id]/actions.ts`, `tour-panel.tsx`) / Production

## Safety

- Production: untouched
- Unrelated dirty tree preserved on `feat/spaces-booking-e1-smart-fields`
