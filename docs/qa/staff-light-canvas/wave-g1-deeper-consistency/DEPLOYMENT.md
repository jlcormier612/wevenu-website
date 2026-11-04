# Wave G1 — deeper-page consistency — Sandbox deployment

## Tip queued

**Tip:** `e3f6087bac125c8b71143a63f5d06efd2b127e11`  
**Prior serving tip:** `457efda4` (Timeline/Floor Plan copy)  
**Deploy branch:** `sandbox-deploy/htc-wave-g1-e3f6087b`

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
