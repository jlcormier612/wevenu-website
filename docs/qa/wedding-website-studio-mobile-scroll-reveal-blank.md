# Studio mobile blank before gallery — scroll-reveal vs phone frame

**Date:** 2026-08-09  
**Symptom:** Collection **Wildflower** (classic) Studio **phone** Live Preview scrolled through solid white emptiness before the photo section; full-width Live Preview looked fine.

## Root cause

Wildflower/classic catalog DNA sets `animationStyle: "fade"`. Every section wraps `ScrollReveal`, which starts at `opacity: 0` until `IntersectionObserver` (viewport root, threshold 0.15) fires.

Studio mobile mounts `WeddingWebsite` **inside** `PhonePreviewFrame` (`overflow-y-auto`). Sections take layout space while still invisible → page bg reads as a long white void. Desktop Live Preview scrolls the outer pane so viewport IO tends to fire; nested phone scroll often does not. Picker thumbs already force `animationStyle: "none"` via `disableAnimation` — Live Preview did not.

## Fix

When `editMode` is true (Studio / Wizard Live Preview), treat reveal as `"none"` and skip scroll-snap. Published `/w/...` keeps Collection fade/rise.

## Spot-check

1. Studio → Collection Wildflower → phone preview: story / event / gallery visible while scrolling (no white void).
2. Same Collection desktop Live Preview still fine.
3. Published guest site (non-edit) still fades in for fade/rise Collections.
4. Garden / Rustic / Velvet (also fade/rise) phone preview likewise visible.
