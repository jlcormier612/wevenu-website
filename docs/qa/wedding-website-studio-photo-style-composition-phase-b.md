# Wedding Website Studio — Photo Style Composition Phase B

**Date:** 2026-08-09  
**Source of truth:** `docs/qa/wedding-website-studio-photo-style-composition-mapping.md` (Phase A APPROVED)  
**Screenshots:** `docs/qa/wedding-website-studio-photo-style-phase-b/`  
**Migration:** `supabase/migrations/20261237000000_wedding_website_photo_style_composition_phase_b.sql`

---

## Verdict

Phase B ships **ten photographic art-direction compositions** through the shared GalleryGrid path — not blind-ID decoration. New reusable arrangements: **`sparse`** (Minimal) and **`gallery-wall`** (salon framed non-overlap). Card shell specimen/label geometry fixed so names and descriptions are never painted over.

Beauty gate passed for primary cards: no circles-as-identity, no Magazine→Gallery Wall CSS fake, no Studio-only parallel renderer. Wildflower uses organic unequal windows (no botanical chrome invent) — **STOP-3 not triggered**.

---

## Architecture (unchanged)

```
photo_styles catalog (tokens)
  → resolveTheme photoOverride
  → GalleryGrid({ photos, tc })
  → PhotoStylePreview (ScaledThumbnail wrapper)
  → Studio / Live Preview / published website
```

No second Photo Style renderer. Collections / Couple Home / Tasks / Payments / RSVP / vendor / publishing untouched.

---

## New reusable primitives

| Primitive | Where | Role |
|---|---|---|
| `arrangement: "sparse"` | GalleryGrid `sparseQuiet` | 1–2 rectangles + extreme whitespace (Minimal quiet luxury) |
| `arrangement: "gallery-wall"` | GalleryGrid `galleryWall` | Non-overlap framed salon wall with mats + deliberate spacing |
| Card specimen/label contract | Theme Studio + Wizard shells | Specimen height === preview height; `overflow:hidden` on specimen; reserved label footer |

---

## Photo Style → composition map

| Style | Composition DNA (Phase B) | Status |
|---|---|---|
| **Editorial** | Fashion-spread essay: asymmetric dominant + quiet support + air (no gray-as-ID, no label hang) | CHANGED |
| **Magazine** | Designed page hierarchy: cover column + subordinate grid (≠ scrapbook; no tilt identity) | CHANGED |
| **Film** | Contact sheet + fused mats + sprockets + warm tray | **LEAVE** |
| **Minimal** | `sparse` 1–2 rectangles + extreme whitespace; circles removed | CHANGED (new primitive) |
| **Modern** | Flush equal unframed grid | **LEAVE** |
| **Luxury** | Singular centered fine-art mat ±1 small secondary | CHANGED |
| **Scrapbook** | Elegant polaroid page; restrained overlap + mild imperfect | CHANGED |
| **Wildflower** | Organic unequal soft-radius windows; no tilt-as-identity | CHANGED |
| **Midnight** | Cinematic wide band + dark field + 1–2 supports | CHANGED |
| **Gallery Wall** | `gallery-wall` matted salon, non-overlap, upright | CHANGED (new primitive) |

---

## Required pair differentiation

| Pair | Distinguisher | Result |
|---|---|---|
| Editorial ↔ Luxury | Asymmetric unframed essay vs centered matted singular | **PASS** |
| Editorial ↔ Magazine | Sparse essay overlap vs designed page grid | **PASS** |
| Film ↔ Modern | Contact-sheet artifact vs flush equal grid | **PASS** (LEAVE) |
| Magazine ↔ Gallery Wall | Unframed page collage vs framed salon spacing | **PASS** |
| Scrapbook ↔ Gallery Wall | Polaroid tactile imperfect vs upright salon mats | **PASS** |
| Scrapbook ↔ Wildflower | Polaroid layers vs soft organic windows | **PASS** |
| Wildflower ↔ Gallery Wall | Soft unframed flow vs framed salon | **PASS** |
| Midnight ↔ Film | Dark cinematic band vs warm contact sheet | **PASS** |
| Midnight ↔ Luxury | Dark band field vs light centered mat | **PASS** |
| Minimal ↔ Luxury | Sparse airy rectangles vs centered fine-art mat | **PASS** |

---

## B1 — Card shell

| Surface | Specimen | Preview height | Label |
|---|---|---|---|
| Theme Studio | `h-[180px] overflow-hidden shrink-0` | `180` | reserved footer, `line-clamp` |
| Wizard | `h-[188px] overflow-hidden shrink-0` | `188` | reserved footer, `line-clamp` |

QA clip check: specimenH=180, gap to label=0, overflowHidden=true, descriptions fully readable.

---

## Tests

```
npx tsx --test lib/wedding-website/photo-style-composition.test.ts
# 7/7 pass — Phase B DNA + Minimal sparse + Gallery Wall ≠ Magazine

npx tsx --test lib/wedding-website/collection-composition.test.ts lib/wedding-website/preview-site.test.ts
# 17/17 pass — Collections Phase B + preview-site still green
```

---

## Screenshots

Under `docs/qa/wedding-website-studio-photo-style-phase-b/`:

- `01-photo-styles-grid-top.png` / `02-photo-styles-grid-bottom.png` — full 10-style picker
- `03-photo-styles-blind-grid-top.png` / `03b-…-bottom.png` — grayscale blind grid
- `card-*.png` — per-style cards
- `pair-*.png` — required differentiation pairs
- `04-gallery-wall-selected.png` / `05-live-preview-gallery-wall.png` — select + Live Preview summary
- `06-minimal-selected.png` / `07-live-preview-minimal.png` / `08-minimal-persisted-reopen.png`
- `capture.mjs` / `qa-results.json`

---

## Live Preview / persistence

- Theme Studio select Gallery Wall → Close → summary shows **Gallery Wall**; Live Preview panel present.
- Minimal select/persist reopen exercised.
- Same `photo_styles` tokens → same `resolveTheme` → same `GalleryGrid` on Studio preview cards and published path.

---

## Untouched

Collections / Collection Phase B / Couple Home / Tasks / Payments / RSVP / vendor app / publishing semantics / unrelated wedding-website surfaces.

---

## STOP / limitations

| Item | Status |
|---|---|
| STOP-1 sparse primitive | **Resolved** via `arrangement: "sparse"` |
| STOP-2 salon non-overlap | **Resolved** via `arrangement: "gallery-wall"` |
| STOP-3 botanical frame chrome | **Not required** — Wildflower uses soft-radius uneven windows only |
| Studio redesign for card shell | **Not needed** — height alignment + overflow contract sufficient |
| Studio ≠ Live/published | **No divergence** introduced |
| Thumbnail density | Sparse / Midnight intentionally use empty field; full published galleries use the same geometry at page width |

---

## Acceptance

Ten beautiful art directions couples would want — compositional identity through shared GalleryGrid primitives, not ten CSS filters.
