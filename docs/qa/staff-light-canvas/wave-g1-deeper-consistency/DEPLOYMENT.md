# Wave G1 — deeper-page consistency — Sandbox deployment

## Tip queued

**Tip:** `83d031b261816382ae8f6ccee621012feb1733f9`  
**Prior serving tip:** `457efda4` (Timeline/Floor Plan copy)  
**Deploy branch:** `sandbox-deploy/htc-wave-g1-83d031b2`

### This tip adds

- CollectionBackLink on contract / message / pipeline / inventory / playbook / floor / timeline / questionnaire editors
- Merge-field chips white + soft-blush hover (`.htc-merge-field-chip`)
- Booking summary space chips → white (`bg-card`)
- Client/event Vendors Required → `.htc-badge-attention`
- Floor Plans empty → calm-blue guidance
- Notification bell: white row cards on beige with blush hover

### Excluded

- Tour slot-conflict / Event Inventory RLS / unrelated `docs/qa` trees  
- Wave G2–G4 (not in this tip)

## Safety

- Production: untouched  
- Unrelated dirty tree preserved on `feat/spaces-booking-e1-smart-fields`
