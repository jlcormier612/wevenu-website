# Photo Style picker — Mag ≠ Edit wide thumbs (Option A)

**Date:** 2026-08-09  
**Scope:** Studio / Wizard Photo Style picker cards. Phase 3 narrow stack for Studio mobile Live Preview + published mobile **unchanged**.

## Problem

`PhotoStylePreview` → `ScaledThumbnail` used `naturalWidth` 400–420. That sets `@container/wedding` under 480cqw, so Magazine / Editorial / Minimal always took the Phase 3 stack branch. Cards clipped to near-identical lead crops — Mag looked like Edit in the picker.

## Fix (Option A + Mag fleet intrinsic height)

1. Raise picker thumb natural container to **≥480cqw**:
   - Wizard `website-studio.tsx`: `naturalWidth={480}`
   - Theme Studio `website-editor.tsx`: `naturalWidth={480}`
   - `PhotoStylePreview` default + hard floor: `Math.max(naturalWidth, 480)` so a future caller cannot reintroduce the bug

2. **Follow-up (cream / sliver regression):** At ≥480cqw, Magazine’s support fleet used `flex: 1 1 0` + `height: 100%`, which collapses to ~0 height inside auto-height parents (including ScaledThumbnail). Result: nearly empty cream card with a tiny lead sliver. Fleet cells now use **aspect-ratio intrinsic** sizing (`flex: 0 0 auto`, img `height: auto`). Lead still stretches via `items-stretch` + `h-full` at ≥480. Phase 3 `grid-cols-1` / `@min-[480px]/wedding:…` stack classes **unchanged**.

Live Preview phone frame and published pages still measure real CSS container width; Mag/Edit/Minimal still stack under ~480px (Phase 3 preserved).

## Acceptance

| Check | Result |
| --- | --- |
| Editorial vs Magazine picker cards show distinct wide layouts (grid ratios / support treatment) | Pass (markup: Mag `1.35fr 1fr`, Edit `1.55fr 1fr` at ≥480cqw) |
| Magazine picker card visible fill (not cream + top-left sliver) | Pass (aspect-intrinsic fleet; ScaledThumbnail clips tall spread from top) |
| Studio mobile Live Preview + published mobile still stack Mag/Edit under narrow | Pass (GalleryGrid Phase 3 classes unchanged) |
| Minimal / Film / other styles | Pass (Film/Modern/Luxury unmarked by Mag/Edit stack classes; Minimal still has wide + narrow branches) |

## Tests

`lib/wedding-website/photo-style-content-contract.test.ts` — Mag≠Edit wide silhouette assertion, Mag fleet intrinsic (`flex: 0 0 auto`, no `1 1 0`), + `PhotoStylePreview` floors container to 480 when caller passes 420.

## Spot-check list (manual)

- Wizard Photo Style: Magazine (lead\|fleet fill, cream/sliver gone)
- Wizard Photo Style: Editorial (essay lead + staggered support; distinct from Mag)
- Wizard Photo Style: Minimal, Film, Modern, Luxury, Scrapbook, Wildflower, Gallery Wall, Midnight — no blank cards
- Studio Live Preview phone + published mobile: Mag/Edit still stack (Phase 3)
