# Events ops KPI eucalyptus strips — Sandbox deployment

## Tip queued

**Code:** `fc053531f3743a64f48978c0f33aa2a16def1ef9` — Events / Average Guest Count KPI label strips eucalyptus (not calm blue).  
**Prior serving tip:** `4fdd6fce` (Reports title + botanical logo)  
**Deploy branch:** `sandbox-deploy/htc-events-ops-green-fc053531`  
**Actions:** https://github.com/jlcormier612/wevenu-website/actions/runs/41793489532

### This tip adds

- `tone="ops"` report KPI label bars → `--htc-eucalyptus-surface`
- Matching ops metric-tile fill
- Regression assert in `phase11b-reports-tones.test.ts`

### Excluded

- Unrelated dirty tree (`leads/[id]/actions.ts`, `tour-panel.tsx`) / Production

## Safety

- Production: untouched
- Unrelated dirty tree preserved on `feat/spaces-booking-e1-smart-fields`
