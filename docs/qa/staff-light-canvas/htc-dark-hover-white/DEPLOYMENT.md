# HTC dark hover white + nav accent — Sandbox deployment

## Tip queued

**Code:** `46ba7d690f49fea722236a8a7e01f5fc210de7b3` — White dark nav accent and remaining hover lifts
**Prior tip:** `63f3836f` (dark hover split)
**Deploy branch:** `sandbox-deploy/htc-dark-white-01ab6c52`

### This tip adds

- Dark `--sidebar-accent` → pure white (removes gray-green active nav)
- Dark `--selected` → hover-lift; inbox rows use `--htc-hover-lift`
- Calendar day hover + Month/Week/Day active chip → white / hover-lift

### Excluded

- Light-mode recipes (hover-lift aliases soft-blush in light)
- Unrelated dirty tree / Production

## Safety

- Production: untouched
