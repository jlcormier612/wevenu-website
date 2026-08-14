# Photo Style Content Contract Reset

**Date:** 2026-08-09  
**Commit:** (see git log)  
**Not pushed.**

## 1. Content contract found

| Layer | Finding |
| --- | --- |
| Product gallery | Unbounded `content.gallery.photos[]` — no hard max conflicting with Studio specimen |
| Studio specimen (old) | `resolveStudioPreviewPhotos` defaulted **min 3 / max 4**; `PhotoStylePreview` additionally **sliced to 4** |
| Style truncation (old) | Editorial/Luxury/Midnight/Minimal/Gallery Wall/Magazine hard-capped or only mapped 1–4 photos |

**Canonical Studio specimen:** `PHOTO_STYLE_CANONICAL_COUNT = 6`  
Live/published GalleryGrid still receives the couple’s full gallery array — styles now render **all photos passed in** (no style-side omit).

## 2. Hard-coded photo-count assumptions removed

- `resolveStudioPreviewPhotos` → default 6/6; 6 distinct fillers
- `PhotoStylePreview` → removed `photos.slice(0, 4)`
- GalleryGrid Editorial / Luxury / Midnight / Minimal / Gallery Wall / Magazine → no `slice(0, N)` / 1–2-only layouts

## 3. How each style handles all 6

| Style | Composition of the same 6 |
| --- | --- |
| Editorial | Large lead + vertical support fleet |
| Magazine | Cover column + all remaining in page hierarchy |
| Film | Contact-sheet grid of all 6 |
| Modern | Equal clean grid of all 6 |
| Minimal | Large oval + 5 smaller ovals with air |
| Luxury | Centered fine-art mat + secondary mat fleet |
| Scrapbook | Polaroid map of all 6 |
| Wildflower | Organic unequal windows for all 6 |
| Midnight | Cinematic wide lead + support strip of remaining |
| Gallery Wall | Salon framed hang for all 6 |

## 4. Minimal oval/round restored

- Catalog migration `20261240000000_…` → `photoRadius: "50%"`
- Sparse layout reauthored around oval containers (not 1–2 rectangles)

## 5. Automated tests

```bash
npx tsx --test \
  lib/wedding-website/photo-style-content-contract.test.ts \
  lib/wedding-website/photo-style-composition.test.ts \
  lib/wedding-website/studio-preview-content.test.ts
```

**Result:** all pass (incl. 10×6 img counts + Minimal `50%`).

## 6. Visual QA artifact

`docs/qa/wedding-website-studio-photo-style-content-contract/all-10-same-6-photos.html`  
Regenerate: `npx tsx docs/qa/wedding-website-studio-photo-style-content-contract/render-comparison.mts`

## Residuals

- Specimen fillers are illustrative SVG when Emma/Jordan photos are absent; real couple URLs prefer gallery → cover → engagement.
- Thumbnail cards may show dense 6-photo compositions; shell overflow should be reviewed live if card height is tight.
- Collections / Couple Home / Tasks untouched in this commit.
