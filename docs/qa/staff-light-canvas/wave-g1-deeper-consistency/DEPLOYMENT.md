# Wave G1 — deeper-page consistency — Sandbox deployment

## Tip queued

**Tip:** `e1beadf3992c0a4475ed66effc1bbd73ecc544e7`  
**Prior serving tip:** `457efda4` (Timeline/Floor Plan copy)  
**Deploy branch:** `sandbox-deploy/htc-wave-g1-e1beadf3`

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
