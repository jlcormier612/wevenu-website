# HTC dark surface remap — Sandbox deployment

## Tip queued

**Code:** `5fb40f8db42a3d008ef4f7f999b22d68e60de025` — Remap HTC light surfaces for staff dark mode
**Prior tip:** `7f15ad7b` (Wave G4)
**Deploy branch:** `sandbox-deploy/htc-dark-remap-259c4e61`  
**Actions:** https://github.com/jlcormier612/wevenu-website/actions/runs/41762203508

### This tip adds

- Dark remap of `--htc-*` hospitality surface tokens under `.dark .htc-staff`
- Dark companions for hardcoded white utilities (`.htc-working-card`, toolbox/settings tiles, merge chips, tabs-list, etc.)
- Regression tests proving light-mode selectors stay unchanged

### Excluded

- Light-mode class definitions / Wave F–G recipes
- Tour slot-conflict / Event Inventory RLS / unrelated dirty tree
- Portal / print / PDF

## Safety

- Production: untouched
- Unrelated dirty tree preserved on `feat/spaces-booking-e1-smart-fields`
