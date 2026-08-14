# Phase 3 — WW-AUDIT-03 Narrow Gallery Layouts

**Date:** 2026-08-09  
**Scope:** Magazine / Editorial / Minimal `GalleryGrid` geometry under ~480cqw only. Phase 1 story centering and Phase 2 phone chrome untouched. Film / Modern / Luxury ≥720 unchanged.

## What changed

Same `GalleryGrid` on Studio + published. Narrow breakpoint uses the shared `@container/wedding` boundary (`@min-[480px]/wedding:`).

| Style | Narrow (&lt;480cqw) | Wide (≥480cqw) |
| --- | --- | --- |
| **Magazine** (`collage`) | Single column: full-width lead (`aspect 4/5`) then support fleet | `1.35fr 1fr` lead + nested support column (same page-spread silhouette; lead fills stack height) |
| **Editorial** (`hero-emphasis` essay) | Single column: lead then support fleet | `1.55fr 1fr` lead + support column |
| **Minimal** (`sparse`) | Lead oval full-width (`col-span-2`, max ~20rem), then 2-col support ovals; second row stays 2-col — **no tiny thumbs** | Restored 3-col oval band (`1.15fr 0.72fr 0.95fr` + row-span lead) |
| Face crop | Split grids use `GALLERY_SPLIT_FACE_FOCAL` (`50% 22%`); Magazine collage keeps `50% 35%` | Same tokens |

## Acceptance

| Criterion | Status |
| --- | --- |
| Magazine & Editorial at 359px / 390px: no unreadable ultra-narrow lead; subjects generally framed; section top not clipped by overflow | **Pass** (stacks to 1-col below 480cqw; softer split focal) |
| Minimal: 6 meaningful ovals at mobile (no thumbnail regress) | **Pass** (2-col band + second row; `50%` radius; no `3.75rem`/`4.1rem`/`4.6rem`) |
| Film / Modern / Luxury art direction unchanged on ≥720px | **Pass** (branches untouched; tests assert no Mag/Edit/Minimal stack classes) |
| `PHOTO_STYLE_CANONICAL_COUNT === 6` tests still green | **Pass** |

## Tests

`lib/wedding-website/photo-style-content-contract.test.ts` — existing contract suite + `describe("WW-AUDIT-03 narrow gallery layouts")`.

```bash
npx tsx --test \
  lib/wedding-website/photo-style-content-contract.test.ts \
  lib/wedding-website/photo-style-composition.test.ts \
  lib/wedding-website/studio-preview-content.test.ts
```

## Residual (explicitly out of Phase 3)

- **Phase 4:** Live portal Playwright matrix (11 Collections × surfaces + 10 Photo Styles scrolled to gallery); refresh audit report §4 from Likely→Pass/Fail.
- Scrapbook / Wildflower / Gallery Wall narrow density (called out in audit; not this fix).
