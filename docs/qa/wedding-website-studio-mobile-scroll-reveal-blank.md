# Studio mobile blank before gallery — scroll-reveal vs phone frame

**Date:** 2026-08-09  
**Symptom:** Collection **Wildflower** (classic) Studio / setup-wizard **phone** preview scrolled through solid cream emptiness; desktop Live Preview looked fine.

## Root cause

Wildflower/classic sets `animationStyle: "fade"`. Sections wrap `ScrollReveal` (`opacity: 0` until IntersectionObserver fires).

Two gaps in the first attempted fix (`f14359e`):

1. **Wizard phone** mounts `WeddingWebsite` with `editMode={false}` — so gating on `editMode` alone never applied to setup-guide mobile.
2. Observer used **viewport** as root — scrolling inside `.ww-phone-frame-scroll` often never intersects, so sections stay invisible while still taking layout space (cream voids).

## Fix (second pass)

1. `disableScrollReveal` prop — Studio + wizard phone (and wizard desktop preview) pass it so preview surfaces always show content.
2. `IntersectionObserver` uses `closestScrollRoot` (phone scrollport when nested) for published / non-preview paths that still animate.

Published `/w/...` keeps Collection fade/rise with document scroll.

## Spot-check

1. Setup wizard → Wildflower → **mobile** phone: story / gallery visible (hard refresh once).
2. Full Website Studio → Wildflower → mobile phone: same.
3. Desktop Live Preview still fine.
4. Published guest site still fades for fade/rise Collections.
