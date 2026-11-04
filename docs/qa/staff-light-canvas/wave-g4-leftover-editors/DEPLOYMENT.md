# Wave G4 — leftover editors — Sandbox deployment

## Tip queued

**Code:** `ff080824b777f10a12a60e6a3bc66c5ccdac86ad` — Wave G4 leftover editors CollectionBackLink + working cards
**Prior serving tip:** `481874de` (Wave G3)
**Deploy branch:** `sandbox-deploy/htc-wave-g4-ff080824`

### This tip adds

- CollectionBackLink + `.htc-working-card` on Pipeline/Inventory/Packages new+edit
- Contract/Message template new + Automations new back links
- Lead/Client/Vendor new+edit and Event edit CollectionBackLink
- Brochure detail: CollectionBackLink above BusinessAssetHeader + working cards

### Excluded

- Tour slot-conflict / Event Inventory RLS / unrelated `docs/qa` trees
- Offerings sheet editors (no standalone page chrome)

## Safety

- Production: untouched
- Unrelated dirty tree preserved on `feat/spaces-booking-e1-smart-fields`
