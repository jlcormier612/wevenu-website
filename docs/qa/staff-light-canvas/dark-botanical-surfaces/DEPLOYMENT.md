# Staff dark botanical surfaces — Sandbox deployment

## Tip queued

**Code:** `ef78cdadb0dae3e3753304a84eba3f2dd072ded0` — Staff dark canvas/cards use botanical #446B56 (not army forest/heritage sage).  
**Prior serving tip:** `fc053531` (Events ops eucalyptus KPI strips)  
**Deploy branch:** `sandbox-deploy/htc-dark-botanical-ef78cdad`  
**Actions:** https://github.com/jlcormier612/wevenu-website/actions/runs/41794186464

### This tip adds

- `.dark .htc-staff` `--background` → `var(--htc-botanical)`
- Cards / muted / secondary → botanical + white lift
- Sidebar ink / primary accents → botanical
- Regression asserts in dark remap + staff canvas tests

### Excluded

- Global `.dark` portal forest/heritage palette
- Unrelated dirty tree (`leads/[id]/actions.ts`, `tour-panel.tsx`) / Production

## Safety

- Production: untouched
- Unrelated dirty tree preserved on `feat/spaces-booking-e1-smart-fields`
