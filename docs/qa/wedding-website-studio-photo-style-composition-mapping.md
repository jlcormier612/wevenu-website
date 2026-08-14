# Wedding Website Studio — Photo Style Composition Mapping

**Status:** DESIGN RESET · Phase A inspection only  
**Date:** 2026-08-09  
**Spec:** `Hello_to_Cheers_Wedding_Studio_Final_Photo_Style_Design_Spec.md`  
**Constraint:** No implementation in this artifact. Map first; STOP before coding.

---

## Architecture truth path (unchanged contract)

```
photo_styles catalog (tokens)
  → resolveTheme photoOverride
  → GalleryGrid({ photos, tc })
  → PhotoStylePreview (ScaledThumbnail wrapper)
  → Studio / Live Preview / published website
```

Do **not** introduce a Studio-only fake renderer. Card-shell fixes are presentation wrappers only; composition identity lives in `GalleryGrid`.

### Surfaces that mount Photo Style cards

| Surface | File | Specimen box | PhotoStylePreview size |
|---|---|---|---|
| Theme Studio picker | `components/portal/website-editor.tsx` | `h-[150px]` | `width={170} height={180}` |
| Wizard photostyle step | `components/portal/website-studio.tsx` | `h-[156px]` | `width={226} height={188}` |

Both use: `button.overflow-hidden` → specimen div (fixed height) → `PhotoStylePreview` → label sibling (`name` + `description`).

---

## 1. What each of the 10 styles renders today

Catalog tokens after `20261233000000` + `20261235000000` (final visual). Silhouette selection is **token-gated** inside `GalleryGrid` — not by `photo_styles.key`.

### 01 — Editorial (`editorial`)

| Axis | Value |
|---|---|
| Tokens | `uniform` + `hero-emphasis` + `large` + `frame:none` + `spacing:tight` + `shadow:none` + no dark filter |
| Branch | `editorialEssay` |
| Arrangement | Relative column; lead image **78% width**, centered, aspect **4/5** |
| Support | Absolute secondary **38% width**, `right:2%`, `bottom:-4%`, aspect **3/4**, forced grayscale overlay, hard shadow |
| Scale / frame / rotation | No mats; no tilt; hang spacer `1.75rem` under composition |
| Spacing | Tight conceptually; visual air comes from 78% width only |

### 02 — Magazine (`magazine`)

| Axis | Value |
|---|---|
| Tokens | `arrangement:collage` + `rotation:subtle` + `shadow:soft` + `frame:none` + `spacing:tight` |
| Branch | `collage` |
| Arrangement | 6-column CSS grid; hardcoded span patterns (1–4 photos); cells overlap via shared row/column ranges |
| Scale | Mixed slot sizes; z-index hierarchy in pattern |
| Frame / rotation | Unframed; ambient tilt **±1.5°** when `rotation !== "none"` |
| Spacing | Column gap `0.75rem`, row gap `1.5cqw` |

### 03 — Film (`film`)

| Axis | Value |
|---|---|
| Tokens | `uniform` + `scale:uniform` + `frame:border` + `spacing:tight` + warm sepia filter |
| Branch | `contactSheet` wrap around equal `grid` |
| Arrangement | Equal cells (2-col at Studio width; 3-col when container ≥768px in real gallery) |
| Scale | Uniform squares `1/1` |
| Frame | White mats **8px**, gap fused to `0` so mats abut |
| Film cues | Dark sprocket rails L/R; warm paper tray gradient behind sheet |
| Rotation / shadow | None |

### 04 — Modern (`modern`)

| Axis | Value |
|---|---|
| Tokens | `uniform` + equal + `frame:none` + `spacing:normal` + `photoFilter:none` + `photoRadius:0` |
| Branch | Default uniform `grid` |
| Arrangement | Flush equal 2×2 (Studio) / responsive 3-col published |
| Scale / frame / rotation | Squares; no mats; no tilt; no filter |
| Spacing | `0.75rem` gutters |

### 05 — Minimal (`minimal`)

| Axis | Value |
|---|---|
| Tokens | `uniform` + `photoRadius:50%` + `spacing:generous` + soft saturate |
| Branch | `minimalAsym` (gated on `photoRadius === "50%"`) |
| Arrangement | 3-column asymmetric grid: tall portrait | **stacked circles** | supporting vertical |
| Scale | Lead `3/4`; circles `1/1` at 88%/72% width; right `4/5` |
| Frame / rotation | No mat; no tilt; circular crop is the differentiator |

### 06 — Luxury (`luxury`)

| Axis | Value |
|---|---|
| Tokens | `uniform` + `hero-emphasis` + `large` + `frame:border` + `spacing:generous` + `shadow:soft` |
| Branch | `luxuryImmersive` |
| Arrangement | Centered max-width; one matted **4/5** hero; optional **3-up square strip** below when ≥2 photos |
| Scale / frame | White mat via `frame()`; generous outer padding |
| Rotation | None |

### 07 — Scrapbook (`scrapbook`)

| Axis | Value |
|---|---|
| Tokens | `arrangement:scrapbook` + `frame:polaroid` + `rotation:scattered` + `shadow:soft` |
| Branch | `scrapbook` |
| Arrangement | Flex-wrap centered; each card **42%** width; negative left margin overlap; staggered `marginTop` |
| Scale | Square images inside polaroid padding (`10px 10px 28px`) |
| Rotation | Per-index seed tilt up to ~±5° |
| Spacing | `rowGap: 2rem`, horizontal inset `1.5rem` |

### 08 — Wildflower (`wildflower`)

| Axis | Value |
|---|---|
| Tokens | `uniform` + `scalePattern:alternating` + `rotation:scattered` + soft radius `0.85rem` + soft shadow |
| Branch | `wildflowerOrganic` |
| Arrangement | Flex-wrap free widths `58%/36%/44%/50%`; uneven top/left margins |
| Scale | Mixed aspects `4/5`, `1/1`, `16/10`, `5/6` |
| Frame / rotation | Unframed soft corners; scattered tilt |
| Spacing | Compact cluster gaps |

### 09 — Midnight (`midnight`)

| Axis | Value |
|---|---|
| Tokens | same hero skeleton as Editorial/Luxury gates + **dark** `photoFilter` (`brightness(0.68)…`) |
| Branch | `midnightBand` (hero-emphasis + tight + no frame + `darkCinematic`) |
| Arrangement | Black tray; wide lead **21/9**; row of **3** `1/1` squares |
| Scale / frame / rotation | No mats; no tilt; dark field + grade |
| Spacing | Tight tray padding / gap `0.45rem` |

### 10 — Gallery Wall (`gallery_wall`)

| Axis | Value |
|---|---|
| Tokens | `arrangement:collage` + `frame:border` + `rotation:none` + `shadow:lifted` |
| Branch | Same `collage` geometry as Magazine |
| Arrangement | Identical overlap slot pattern as Magazine |
| Scale | Same mixed spans |
| Frame | White mat + darker salon outer edge when collage+lifted+no tilt |
| Rotation | Axis-aligned (no ambient ±1.5°) |

---

## 2. Shared GalleryGrid primitives

### Token vocabulary (catalog → ThemeConfig)

| Token | Values used |
|---|---|
| `arrangement` | `uniform` \| `collage` \| `scrapbook` |
| `scalePattern` | `uniform` \| `alternating` \| `hero-emphasis` |
| `rotation` | `none` \| `subtle` \| `scattered` |
| `shadow` | `none` \| `soft` \| `lifted` |
| `frameStyle` | `none` \| `border` \| `polaroid` |
| `photoSpacing` / catalog `spacing` | `tight` \| `normal` \| `generous` |
| `photoRadius` | CSS length or `50%` |
| `photoFilter` | CSS filter string |
| `imageScale` | `normal` \| `large` |
| Collection `galleryLayout` | `grid` \| `masonry` \| `film-strip` (Preview forces `grid`) |

### Shared helpers

- `rotationFor(style, i)` — deterministic seed tilt
- `shadowFor(style)` — soft / lifted CSS
- `frame(i, extraRotation?)` — polaroid pad, white mat/border, salon edge special-case
- `imgStyle` / `imgStyleFill` — `object-fit: cover` + `PORTRAIT_FACE_FOCAL`
- `SPACING_GAP` map

### Silhouette branches (combo-gated)

| Gate | Styles |
|---|---|
| `editorialEssay` | Editorial |
| `luxuryImmersive` | Luxury |
| `midnightBand` | Midnight |
| `minimalAsym` | Minimal (`photoRadius:50%`) |
| `wildflowerOrganic` | Wildflower (`alternating` + `scattered`) |
| `arrangement === "collage"` | Magazine, Gallery Wall |
| `arrangement === "scrapbook"` | Scrapbook |
| `contactSheet` | Film (`border` + `tight` + uniform) |
| default grid/masonry/film-strip | Modern (+ defensive fallbacks) |

### Preview wrapper (not composition identity)

`PhotoStylePreview` → `ScaledThumbnail` + page `tc.bg` (or `#0a0a0c` for dark filter) + `GalleryGrid` with ≤4 photos.

---

## 3. Why compositions collapse into similar designs

1. **Same four-photo box, different cosmetics.** Most styles answer “arrange these four cover crops in a thumbnail,” not “distinct photographic art direction.”
2. **Editorial / Luxury / Midnight share one conceptual axis** (`hero-emphasis`). Differentiation became overlap-vs-mat-vs-dark-filter, not calm singular vs editorial hierarchy vs cinema.
3. **Magazine and Gallery Wall share one `collage` pattern.** Only frame/tilt/shadow diverge → both read as “overlapping rectangle collage.”
4. **Film vs Modern** are genuinely adjacent equal grids; Film survives only via tray/sprockets/mats — correct structurally, but still “four squares.”
5. **Wildflower vs Scrapbook** differentiate via scatter tilt + polaroid vs soft radius — gimmick axis the new spec rejects.
6. **Minimal’s identity is circular crops** — decorative differentiator, not quiet luxury whitespace (spec explicitly forbids this).
7. **Prior acceptance optimized blind-ID**, which rewarded arbitrary silhouettes (circles, tilts, sprockets, grayscale support) over beauty.

---

## 4. Why card labels are clipped (exact cause)

This is a **card-shell geometry bug**, not GalleryGrid clipping text.

### Primary cause — specimen height ≠ preview height

Theme Studio (`website-editor.tsx`):

```text
specimen shell:  h-[150px]
PhotoStylePreview height prop: 180
→ 30px of ScaledThumbnail paints below the shell into the label zone
```

Wizard (`website-studio.tsx`):

```text
specimen shell:  h-[156px]
PhotoStylePreview height prop: 188
→ 32px overflow into the label zone
```

Label markup is a **sibling after** the fixed-height specimen shell. Overflow from the taller `ScaledThumbnail` (default `overflow: visible` on the shell) paints **on top of** name/description.

### Amplifiers

1. Card `button` uses `overflow-hidden` — anything that tallens the card still clips at the rounded card edge; overflowing specimen covering the label is the visible failure.
2. Specimens that intentionally hang below their composition (`editorialEssay` support `bottom: -4%` + spacer; scrapbook/wildflower tall tilt envelopes) intensify paint-into-label even when heights are closer.
3. Description text itself has **no** `line-clamp`; the failure is occlusion/overflow, not CSS truncation of the string.

### Required card contract (Phase B — not implemented here)

```
┌ specimen (overflow:hidden, explicit height) ┐
│ GalleryGrid thumbnail                        │
├──────────────────────────────────────────────┤
│ name                                         │
│ description (reserved footer; never covered) │
└──────────────────────────────────────────────┘
```

Preview `height` prop **must equal** specimen shell height. Label zone is flex-fixed / min-height, never overlapped.

---

## 5. Reusable renderer primitives actually needed

### Already sufficient (LEAVE or retune inside existing branch)

| Primitive | Serves |
|---|---|
| Equal `grid` + spacing/frame | Modern; Film base cells |
| `contactSheet` tray + sprockets + fused mats | Film photographic artifact |
| `editorialEssay` (retune) | Editorial hierarchy + whitespace |
| `luxuryImmersive` (retune toward singular/mat) | Luxury fine-art mount |
| `midnightBand` (retune support count) | Midnight cinematic band |
| `scrapbook` + polaroid frame (retune elegance) | Scrapbook tactile objects |
| `collage` (retune patterns; Magazine identity) | Magazine spread hierarchy |

### Must add or materially redefine (truthful shared primitives)

| Missing / broken primitive | Why |
|---|---|
| **Sparse / few-image layout** | Minimal target = 1–2 rectangles + large empty field. Current grid always densifies photos; circle branch is a fake substitute (documented in host certification). |
| **Salon-wall framed collection (non-overlap)** | Gallery Wall target = framed mats with deliberate spacing. Current `collage` is overlap-slot geometry shared with Magazine. |
| **Organic editorial rhythm without tilt-as-identity** | Wildflower needs controlled unequal windows / flow; current path leans on `scattered` rotation. |
| *(optional)* **Secondary support max-count control** | Luxury/Midnight/Editorial want 0–2 supports, not hard-coded 3-up strips. Can be parameterized inside existing branches without new arrangement enum. |

### Explicitly do **not** invent as differentiators

Circles-as-style, random rotation ranges, arbitrary borders/shadows/filters alone, crop-zoom manufacturing, Studio-only fake layouts.

---

## 6. Per-style map: current → target → primitives → change

| Style | Current composition | Target (spec) | Existing primitive(s) | Required change |
|---|---|---|---|---|
| **Editorial** | 78% lead + grayscale overlap support hanging past bottom | Sparse asymmetrical multi-scale + quiet support + whitespace; restrained overlap | `editorialEssay` | **MUST** retune essay: more air, quieter support (drop gray-as-identity), no label hang. Card shell Phase B. |
| **Magazine** | Overlapping collage slots + subtle tilt | Magazine **spread** / designed page; cover + subordinate grid; richer than Editorial | `collage` | **MUST** redesign collage pattern toward page hierarchy; suppress tilt as identity. Differs from Gallery Wall via unframed editorial page vs framed salon. |
| **Film** | Contact sheet + fused mats + sprocket rails + warm tray | Contact-sheet / film-strip vocabulary; consistent windows | `contactSheet` + equal grid + sprockets | **LEAVE** structural path. Minor polish only (warmth/grain secondary). |
| **Modern** | Flush equal unframed grid | Precise quiet architectural grid | default uniform `grid` | **LEAVE**. Optional gutter/aspect polish only — no decoration. |
| **Minimal** | Asymmetric **circles** + generous gaps | 1–2 rectangles + extreme whitespace; **no circles** | `minimalAsym` gated on `50%` radius (**wrong identity**) | **STOP** → need sparse few-image rectangular primitive. Circles must be removed, not retuned as Minimal. |
| **Luxury** | Matted hero + optional 3 square strip | Singular centered fine-art mount; optional **one** small secondary; calm | `luxuryImmersive` | **MUST** reduce strip busy-ness (0–1 secondary); strengthen centered mat/margins. |
| **Scrapbook** | Polaroid scatter + strong overlaps/tilts | Elegant coherent memory-page; tactile layers; restrained imperfect | `scrapbook` + `polaroid` | **MUST** retune for elegance (less chaotic scatter). Keep polaroid/paper language. |
| **Wildflower** | Free-width cluster + soft radius + scatter tilt | Organic editorial flow; unequal windows; not polaroid; not salon frames | `wildflowerOrganic` | **MUST** rebuild rhythm without tilt-as-ID. If “botanical framing” means decorative flora chrome → **STOP** (no such primitive). Soft radius/aspect flow is OK. |
| **Midnight** | 21/9 band + 3 squares on black + dark filter | Cinematic horizontal band + dark field; 1–2 supports; composition ≠ filter alone | `midnightBand` | **MUST** prefer 1–2 supports; keep dark tray as composition backbone. |
| **Gallery Wall** | Same collage slots as Magazine + mats + lifted + no tilt | Curated **framed salon wall** with deliberate spacing / varied scale | `collage` + salon frame edge | **STOP** if truthful non-overlap salon cannot be expressed without a new spaced-frame primitive. Do not fake with Magazine overlaps + thicker borders. |

### Legend

- **LEAVE** — current path already matches art direction; no composition rewrite
- **MUST** — change inside an existing truthful GalleryGrid branch / card shell
- **STOP** — missing reusable primitive; do not paper over with gimmicks or a second renderer

---

## 7. STOP flags (exact missing primitives)

### STOP-1 — Minimal sparse rectangle layout

**Missing:** Reusable GalleryGrid ability to present **few images with intentional empty field** (e.g. one large or one+small rectangles at ≤~40–60% of field) without filling the column grid and without `photoRadius:50%`.

**Why existing paths fail:** Uniform grid densifies all photos; `hero-emphasis` default path was replaced by token-gated silhouettes that don’t express “quiet luxury emptiness.” Circles were a prior blind-ID workaround (`docs/hosted-experience-release-certification.md`).

**Do not:** Keep circles; fake Minimal with borders/filters.

### STOP-2 — Gallery Wall salon spacing (non-overlap framed collection)

**Missing:** Reusable composition for **multiple matted frames with salon-wall gaps and varied scale**, upright, non-scrapbook, not sharing Magazine’s overlap-slot collage.

**Why existing paths fail:** Magazine and Gallery Wall both execute the same `collage` span map; Gallery Wall only adds mat/lift/no-tilt. Spec differentiation matrix requires framed collection ≠ layered magazine page.

**Do not:** Thicker borders / more shadow on the same collage; polaroid; random offsets.

### Conditional STOP-3 — Wildflower botanical frame chrome

Only if Product insists on literal botanical/organic **frames** beyond soft radii and unequal photo windows. No botanical frame primitive exists. Prefer organic rhythm via controlled unequal rectangles; escalate only if art direction requires flora chrome.

---

## 8. Implementation phases (map only — do not execute yet)

Per spec §21:

| Phase | Work | Notes |
|---|---|---|
| **A** | This inspection map | Done |
| **B** | Fix card shell (specimen vs label) | Align preview height to shell; `overflow:hidden` on specimen only; reserved label footer. Both Theme Studio + wizard. |
| **C** | Ten compositions | Resolve STOP-1/2 primitives first; then retune MUST styles; LEAVE Film/Modern |
| **D** | Crop/framing | Face-safe `object-position`; no aggressive crop differentiation |
| **E** | Catalog copy | Names/descriptions only after visuals succeed |
| **F** | Persistence / Live / published | Same tokens → same GalleryGrid |

**Out of scope:** Collections, Tasks, Payments, RSVP, Couple Home, publishing semantics, fake Studio renderer.

---

## 9. Acceptance gate (plan quality check)

Plan succeeds only if it produces:

> Ten beautiful, premium photographic art directions — beauty over blind-ID.

Plan fails if it proposes: random rotation, circles, borders/shadows/filters alone, crop manufacturing, label clipping, or a Studio-only renderer.

---

## 10. Quick reference matrix

| Style | LEAVE / MUST / STOP |
|---|---|
| Editorial | MUST (retune `editorialEssay`) |
| Magazine | MUST (retune `collage` toward spread) |
| Film | LEAVE (+ minor polish) |
| Modern | LEAVE |
| Minimal | **STOP-1** sparse rectangle primitive |
| Luxury | MUST (singularize `luxuryImmersive`) |
| Scrapbook | MUST (elegance retune) |
| Wildflower | MUST (de-tilt organic rhythm); conditional STOP-3 |
| Midnight | MUST (band + fewer supports) |
| Gallery Wall | **STOP-2** salon spaced-frame primitive |
| Card labels | MUST Phase B shell fix (height mismatch 150≠180 / 156≠188) |
