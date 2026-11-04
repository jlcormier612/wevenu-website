# Booked lead date protection — Sandbox deployment

## Tip queued

**Code:** `5a8ccc01201d919b32398471f0f81926287b66a7` — Booked leads show Protected by booking (not Not protected)  
**Prior serving tip:** `a069d441` (Documents/Planning polish)  
**Deploy branch:** `sandbox-deploy/htc-booked-hold-5a8ccc01`  
**Actions:** https://github.com/jlcormier612/wevenu-website/actions/runs/41782900396

### This tip adds

- Booked (`linkedEventId`) → eucalyptus **Protected by booking** + booking occupancy copy
- Hide Place hold / Reactivate when booked
- Open-pipeline **Not protected** + Place hold unchanged

### Excluded

- Unrelated dirty tree (`leads/[id]/actions.ts`, `tour-panel.tsx`) / Production

## Safety

- Production: untouched
- Unrelated dirty tree preserved on `feat/spaces-booking-e1-smart-fields`
