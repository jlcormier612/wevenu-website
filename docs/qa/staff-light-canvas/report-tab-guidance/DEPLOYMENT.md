# Reports tab guidance boxes — Sandbox deployment

## Tip queued

**Code:** `c9c83351045d95f81354b01e4f4aaa2458b1abfe` — calm-blue ReportHeader on every Reports tab  
**Prior serving tip:** `7bd6cd75` (template actions / Saved Reports title)  
**Deploy branch:** `sandbox-deploy/htc-report-guide-c9c83351`  
**Actions:** https://github.com/jlcormier612/wevenu-website/actions/runs/41789109632

### This tip adds

- Shared `ReportHeader` → `htc-surface-guidance` (Overview through Events)
- Overview “How the business moved” moved out of the funnel card into that guidance box
- Saved tab guidance title → **Saved** (same heading font)

### Excluded

- Unrelated dirty tree (`leads/[id]/actions.ts`, `tour-panel.tsx`) / Production

## Safety

- Production: untouched
- Unrelated dirty tree preserved on `feat/spaces-booking-e1-smart-fields`
