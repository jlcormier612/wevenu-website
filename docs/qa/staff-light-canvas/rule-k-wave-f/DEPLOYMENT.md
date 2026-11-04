# Rule K + Wave F — Sandbox deployment

## Serving (verified)

**Tip:** `3be58e1b09b5ffe9c0f16b3148eaa51055bb8519`  
**Deploy branch:** `sandbox-deploy/htc-rule-k-wave-f-3be58e1b`  
**Actions:** https://github.com/jlcormier612/wevenu-website/actions/runs/41747328511 — **success**  
**Serving:** `data-dpl-id=3be58e1b…` verified via SSR `/login`  
**Smoke:** `verify-sandbox.mts` — Saved Reports, Public Forms, Timeline Templates, Automations edit — **all PASS**  
**Evidence:** `docs/qa/staff-light-canvas/rule-k-wave-f/evidence/` + Desktop `htc-rule-k-review/`

### Included

- **A** `cf4a82b3` — Rule K + library + Saved Reports  
- **B** `548b08b4` — Wave F working-card chrome  
- **Polish** `6d966121` — Public Forms white cards; Saved Reports guidance above white-on-beige cards; Timeline/Floor Plan venue-facing copy  

### Prior tip

**`27e9ae41`** — https://github.com/jlcormier612/wevenu-website/actions/runs/41746567259 — success (superseded by polish tip)

### Excluded from this tip

- Tour slot-conflict / coordinator excludeAppointmentId behavior  
- Event Inventory RLS zero-row status guards  
- Unrelated `docs/qa/**` evidence trees  

## Safety

- Production: untouched  
- Unrelated dirty tree preserved on `feat/spaces-booking-e1-smart-fields`
