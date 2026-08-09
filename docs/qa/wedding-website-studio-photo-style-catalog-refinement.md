# Wedding Website Studio — Photo Style Catalog Refinement

**Date:** 2026-08-09  
**Status:** Complete (local QA + catalog applied)  
**Closed prior work preserved:** `16b58ec` Studio preview architecture (preview-only content, taller cards, ≥3 photos, Collection held constant, real `GalleryGrid` / no second miniature renderer).

---

## 1. Process followed

1. Inspected `photo_styles` tokens (Phase 4B migration + type surface) and `GalleryGrid` vocabulary (`arrangement` / `scalePattern` / `frameStyle` / `rotation` / `shadow` / `spacing` / `photoRadius` / `photoFilter` / `imageScale`).
2. Assessed whether **Gallery Wall** (“curated, layered & collected”) could be expressed with existing tokens without looking like Scrapbook / Magazine / Wildflower.
3. Found one **missing primitive behavior** (not a new arrangement type): collage ambient `±1.5°` tilt was hardcoded and ignored `rotation: "none"`. Without gating that, a framed collage Gallery Wall could not be axis-aligned vs Magazine.
4. Made that smallest `GalleryGrid` change + a narrow border-mat legibility tweak, then authored catalog + Studio-facing copy/tokens.

---

## 2. Exact files changed

| File | Change |
|---|---|
| `components/wedding-website/wedding-website.tsx` | (1) Collage ambient tilt now applies only when `rotation !== "none"`. (2) `frameStyle: "border"` adds a 1px mat edge so white mats remain visible on light Studio thumbnails. |
| `supabase/migrations/20261232000000_wedding_website_photo_style_catalog_refinement.sql` | Data: retune 9 styles’ copy + targeted token refinements; insert **Gallery Wall**. |
| `docs/qa/wedding-website-studio-photo-styles/capture.mjs` | Playwright QA harness for Theme Studio + wizard + mobile. |
| `docs/qa/wedding-website-studio-photo-styles/*.png` | Desktop/mobile screenshots. |
| `docs/qa/wedding-website-studio-photo-style-catalog-refinement.md` | This deliverable. |

**Not touched (confirmed):** Collection identities / `layout_config`, Live Preview architecture (`buildPreviewSite` / `PhotoStylePreview` shell), RSVP, Couple Home, Tasks, payment/portal (beyond Studio catalog consumption), GalleryGrid arrangement math (collage patterns / scrapbook / uniform span math unchanged).

Studio UI grids (`website-studio.tsx` / `website-editor.tsx`) already map `catalog.photoStyles` in `grid-cols-2` — with 10 rows they remain an even 2×5 grid; **no Studio renderer changes**.

---

## 3. Catalog / style changes (SoT = `photo_styles`)

| # | Key | Name | Description (photo behavior) | Tokens (identity) |
|---|---|---|---|---|
| 0 | `editorial` | Editorial | Asymmetrical dominant frame with supporting crops | `uniform` + `hero-emphasis` + `large` + **no frame** + `spacing:normal` + `photoFilter:none` |
| 1 | `magazine` | Magazine | Layered collage with editorial gloss | `collage` + `rotation:subtle` + soft (unchanged spatial) |
| 2 | `film` | Film | Contact-sheet borders with warm soft grain | `uniform` + equal cells + **border** + warmer sepia |
| 3 | `minimal` | Minimal | Quiet circular frames with calm space | unchanged circular spatial (copy only) |
| 4 | `modern` | Modern | Perfect equal grid, crisp and even | `uniform` equal cells + **no frame / no filter** |
| 5 | `luxury` | Luxury | Fewer larger frames with generous air | `hero-emphasis` + `large` + **border** + `spacing:generous` + soft shadow |
| 6 | `scrapbook` | Scrapbook | Overlapping polaroids with soft scatter | unchanged polaroid scrapbook path (copy only) |
| 7 | `wildflower` | Wildflower | Organic uneven crops with soft tilt | unchanged alternating + scattered (copy only) |
| 8 | `midnight` | Midnight | Moody cinematic contrast | unchanged (not removed) |
| 9 | `gallery_wall` | **Gallery Wall** | **Curated, layered & collected** | `collage` + **border** + `rotation:none` + `shadow:lifted` + square radius 0 |

---

## 4. Was a renderer primitive required?

**Yes — minimal, disclosed.**

| Primitive | Why existing tokens were insufficient | Change |
|---|---|---|
| Collage ambient tilt gate | Collage always forced `±1.5°` even when tokens said `rotation: "none"`, so Gallery Wall could not be upright framed layering distinct from Magazine | Ambient tilt applied only if `tc.rotation !== "none"` |
| Border mat hairline | Pure `6px solid #fff` mats disappeared against light Studio / pale Color Story backgrounds, collapsing Film / Luxury / Gallery Wall identity in cards | Compose `0 0 0 1px rgba(0,0,0,0.12)` under the white mat |

**No new arrangement type.** Gallery Wall reuses Magazines `collage` path + existing `frameStyle:border` + `rotation:none` + `shadow:lifted`.

---

## 5. Did published rendering change?

| Surface | Changed? | Notes |
|---|---|---|
| Sites on Magazine / Scrapbook / Wildflower / Minimal / Midnight (token-unchanged paths) | **Magazine tilt:** unchanged (`rotation:subtle` still gets ambient tilt). Scrapbook / Wildflower / Minimal / Midnight spatial paths untouched. | Copy-only for several; Midnight kept. |
| Sites on Editorial / Film / Modern / Luxury | **Yes (intentional token retunes)** | Crisp/no-filter Editorial & Modern; warmer Film; Luxury framing + generous air; mat hairline on all bordered styles. |
| Sites selecting new Gallery Wall | **Yes (new catalog option)** | Layered framed collage, axis-aligned. |
| Live Preview architecture / preview-only content | **No** | Still `PhotoStylePreview` → `GalleryGrid`; preview gallery force-grid shell from `16b58ec` preserved. |
| Unrelated Collections / RSVP / Couple Home | **No** | |

---

## 6. Tests

```text
npx tsx --test lib/wedding-website/preview-site.test.ts lib/wedding-website/studio-preview-content.test.ts
→ 12 pass / 0 fail
```

Catalog API after migration apply:

```text
GET /api/portal/website/catalog → photoStyles length 10
keys: editorial … midnight, gallery_wall
```

Local DB migration applied via `supabase_db_wevenu-website` + recorded `20261232000000` in `supabase_migrations.schema_migrations`.

---

## 7. Desktop / mobile QA

| Check | Result |
|---|---|
| Wizard Photo Style shows **10** options | **PASS** (`wizard_style_names_found 10 / 10`) |
| Even 2-column grid | **PASS** |
| All cards have real `GalleryGrid` previews (no blanks) | **PASS** |
| Gallery Wall selectable + selected ring | **PASS** (wizard + Theme Studio) |
| Persist / reload (Design updated → mobile summary shows Gallery Wall) | **PASS** |
| Live Preview still present beside Theme Studio | **PASS** |
| Theme Studio desktop/mobile Photo Style browse | **PASS** |
| Preview-only content never written as SoT | **PASS** (architecture unchanged from `16b58ec`) |

---

## 8. Blind-ID pairs

| Pair | Verdict | Distinguisher |
|---|---|---|
| Editorial vs Luxury | **PASS** | Editorial: unframed dominant+support grid. Luxury: white-mat frame + generous air / quieter hero. |
| Film vs Modern | **PASS** | Same equal geometry; Film = contact-sheet mats + warm sepia; Modern = crisp borderless. |
| Scrapbook vs Gallery Wall | **PASS** | Scrapbook = polaroid bottom margin + scatter. Gallery Wall = upright mat frames on collage slots. |
| Wildflower vs Gallery Wall | **PASS** | Wildflower = alternating spans + soft tilt on uniform path. Gallery Wall = layered collage + mats, no tilt. |
| Magazine vs Gallery Wall | **PASS** | Shared collage pattern; Magazine unframed + subtle tilt; Gallery Wall framed + axis-aligned + lifted. |
| Midnight vs lighter | **PASS** | Midnight remains uniquely dark/cinematic. |

Adjacent labeled styles do not share treatment + label confusion.

---

## 9. Screenshots

Directory: `docs/qa/wedding-website-studio-photo-styles/`

| File | Content |
|---|---|
| `01-studio-desktop.png` | Studio desktop |
| `02-theme-studio-photo-styles-top.png` | Theme Studio Photo Style top |
| `02b-theme-studio-film-modern-luxury.png` | Film / Modern / Luxury / Editorial / Magazine |
| `03-theme-studio-photo-styles-bottom.png` | Scrapbook / Wildflower / Midnight / Gallery Wall |
| `04-gallery-wall-selected.png` | Gallery Wall selected + Live Preview |
| `05-live-preview-after-gallery-wall.png` | After selection |
| `06-wizard-photo-styles-top.png` | Wizard Photo Style (10 options) |
| `07-wizard-photo-styles-bottom.png` | Wizard bottom incl. Gallery Wall selected |
| `08-studio-mobile.png` | Mobile studio |
| `09-mobile-photo-styles-top.png` | Mobile Photo Style open |
| `10-mobile-photo-styles-bottom.png` | Mobile summary showing Gallery Wall persisted |

---

## 10. Remaining limitations

- Minimal still cannot express “one photo at ~30% width” at multi-photo counts (known Phase 4B ceiling); circular framing remains its differentiator.
- Gallery Wall shares Magazines collage *slot pattern* (intentional reuse); differentiation is frame / rotation / shadow, not a second collage geometry.
- `captionStyle: handwritten` remains dormant (no caption content field) — Scrapbook identity is polaroid+scatter, not rendered handwriting.
- Mat hairline slightly alters published bordered styles for legibility; not Studio-only faking.

---

## 11. No-touch confirmations

- Collection catalog identities / Collection architecture: **untouched**
- `16b58ec` Live Preview / PhotoStylePreview approach: **preserved**
- RSVP / publishing-versioning model: **untouched**
- Couple Home / Tasks / payment portal: **untouched**
- No second Studio-only Photo Style renderer / screenshots-as-previews: **confirmed**
- Midnight: **retained**
