# Overview report header alignment — Sandbox deployment

## Tip queued

**Code:** `10fdaccc95d3a836d2cd19bb49d1875083763c94` — Overview guidance box matches Sales/etc.  
**Prior serving tip:** `c9c83351` (Reports tab guidance boxes)  
**Deploy branch:** `sandbox-deploy/htc-overview-hdr-10fdaccc`  
**Actions:** https://github.com/jlcormier612/wevenu-website/actions/runs/41790189066

### This tip adds

- Blue box above date bar: **Overview** / “How the business moved during the selected period.”
- Below date bar: “What happened during … those dates.” only (no duplicate heading)

### Excluded

- Unrelated dirty tree (`leads/[id]/actions.ts`, `tour-panel.tsx`) / Production

## Safety

- Production: untouched
- Unrelated dirty tree preserved on `feat/spaces-booking-e1-smart-fields`
