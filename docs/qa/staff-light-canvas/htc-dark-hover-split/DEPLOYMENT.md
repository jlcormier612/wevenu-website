# HTC dark hover split — Sandbox deployment

## Tip queued

**Code:** `7ea32948111756033d2de7dfd7c2b06ab1dbeebb` — Split dark hover lift from attention blush
**Prior tip:** `259c4e61` (HTC dark surface remap)
**Deploy branch:** `sandbox-deploy/htc-dark-hover-63f3836f`

### This tip adds

- `--htc-hover-lift` (true-white 10% into card) for generic row/tile/tours hovers
- Dark blush/calm remapped into neutral dark bases (not green card) for attention-only surfaces
- Outstanding / badge-attention / overdue keep soft-blush

### Excluded

- Light-mode class definitions
- Tour slot-conflict / Event Inventory RLS / unrelated dirty tree

## Safety

- Production: untouched
- Unrelated dirty tree preserved on `feat/spaces-booking-e1-smart-fields`
