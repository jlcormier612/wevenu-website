# Reports title + botanical logo — Sandbox deployment

## Tip queued

**Code:** `4fdd6fce5ee09376502122ae605fbc8bcb8015e4` — Saved tab primary title "Reports"; wordmark lettering botanical #446B56 (pink kept).  
**Prior serving tip:** `10fdaccc` (Overview report header)  
**Deploy branch:** `sandbox-deploy/htc-reports-logo-4fdd6fce`  
**Actions:** https://github.com/jlcormier612/wevenu-website/actions/runs/41792499149

### This tip adds

- Reports shell primary title always **Reports** (Saved tab no longer "Saved Reports")
- Primary logo PNG lettering remapped to botanical green; pink hearts/accents unchanged
- Regression: wordmark pixel assert, saved-reports shell title, customer-facing brand shell asserts

### Excluded

- Unrelated dirty tree (`leads/[id]/actions.ts`, `tour-panel.tsx`) / Production

## Safety

- Production: untouched
- Unrelated dirty tree preserved on `feat/spaces-booking-e1-smart-fields`
