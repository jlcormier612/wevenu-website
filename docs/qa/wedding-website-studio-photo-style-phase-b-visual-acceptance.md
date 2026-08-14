# Wedding Website Studio — Photo Style Composition Phase B  
## Visual Acceptance (read-only)

**Date:** 2026-08-09  
**Commit:** `6f6fed5` (Phase B art-direction compositions)  
**Sources:**  
- `docs/qa/wedding-website-studio-photo-style-composition-phase-b.md`  
- `docs/qa/wedding-website-studio-photo-style-composition-mapping.md` (Phase A APPROVED)

**Artifacts:** `docs/qa/wedding-website-studio-photo-style-phase-b-visual-acceptance/`  
**Also referenced:** `docs/qa/wedding-website-studio-photo-style-phase-b/` Phase B card/pair baselines (`phase-b-*` copies)

**Scope discipline:** Visual / read audit only. **No** code, catalog, migration, renderer, design, Collections, Couple Home, Tasks, Payments, RSVP, vendor, publishing, Live Preview architecture, or second miniature renderer changes. **No retune. No new Photo Style implementation.**

**Surfaces exercised:** Wizard (`Choose your Photo Style`) + Theme Studio Photo Style picker via real `catalog → resolveTheme photoOverride → GalleryGrid → PhotoStylePreview` path. Live Preview after select for Gallery Wall / Minimal / Luxury (gallery section scrolled).

**Catalog (live localhost):** 10 Photo Styles; Minimal `arrangement=sparse`; Gallery Wall `arrangement=gallery-wall`.

---

## Verdict

**Critical pairs: 7/7 PASS** under structure-first beauty bar on Theme Studio + Wizard Studio cards (not raw GalleryGrid alone). Differences are compositional art directions — not color/filter/font/name alone.

**Photo Style DNA (WP):** Accepted on picker cards for all 10 styles — beauty + intentional hierarchy + photography as star. B1 shell contract holds (Theme Studio specimen **180**; Wizard specimen **188**; `overflow:hidden`; label gap **0**; names/descriptions readable — no paint-over).

**Preview honesty:** **PASS for identity.** Select → summary → Live Preview **Our Photos** shows the same compositional identity for Gallery Wall (matted non-overlap salon), Minimal (sparse 1–2 rectangles + air), and Luxury (singular centered mat ± small secondary). Hero chrome does **not** carry Photo Style composition (expected — GalleryGrid lives in gallery, not hero). Framing OK; no promise of hero composition.

**Recommendation:** **A — ACCEPT all 10.** **STOP.** Do **not** start another Photo Style implementation pass. Leave winners alone.

---

## 1. Screenshots — Wizard (all 10)

| Style / view | Artifact |
|---|---|
| Full grid top | `wizard-01-grid-top.png` |
| Full grid bottom | `wizard-02-grid-bottom.png` |
| Grayscale blind top | `wizard-03-grayscale-blind-top.png` |
| Editorial | `wizard-card-editorial.png` |
| Magazine | `wizard-card-magazine.png` |
| Film | `wizard-card-film.png` |
| Minimal | `wizard-card-minimal.png` |
| Modern | `wizard-card-modern.png` |
| Luxury | `wizard-card-luxury.png` |
| Scrapbook | `wizard-card-scrapbook.png` |
| Wildflower | `wizard-card-wildflower.png` |
| Midnight | `wizard-card-midnight.png` |
| Gallery Wall | `wizard-card-gallery-wall.png` |

Pairs (+ grayscale siblings): `wizard-pair-*`.

**Shell metrics (Wizard):** specimenH=**188**, gap=**0**, overflowHidden=**true** on all 10.

---

## 2. Screenshots — Theme Studio (all 10)

| Style / view | Artifact |
|---|---|
| Full grid top / bottom | `studio-01-grid-top.png`, `studio-02-grid-bottom.png` |
| Grayscale blind | `studio-03-grayscale-blind-top.png`, `studio-03b-grayscale-blind-bottom.png` |
| Editorial … Gallery Wall | `studio-card-{style}.png` (10 cards) |

Pairs (+ grayscale): `studio-pair-*`.  
Selected: `studio-selected-{gallery-wall,minimal,luxury}.png`.

**Shell metrics (Theme Studio):** specimenH=**180**, gap=**0**, overflowHidden=**true** on all 10.

---

## 3. Critical pairs — PASS/FAIL matrix (WP questions)

Structure-first; color/filter/font/tiny decoration/name alone do **not** count. Primary evidence: Wizard + Theme Studio pair composites under `wizard-pair-*` / `studio-pair-*` (+ grayscale).

| # | Pair | Distinct structurally? | Beautiful? | Photography readable? | Result |
|---|---|---|---|---|---|
| 1 | **Editorial ↔ Luxury** | Yes — asymmetric unframed fashion essay (dominant + quiet overlapping support) vs centered singular fine-art mat ±1 small secondary | Yes | Yes | **PASS** |
| 2 | **Film ↔ Modern** | Yes — contact-sheet artifact (sprocket rails + fused mats + warm tray around equal cells) vs flush equal unframed grid | Yes (both intentional LEAVE directions) | Yes | **PASS** |
| 3 | **Minimal ↔ Modern** | Yes — sparse 1–2 rectangles + extreme whitespace vs dense flush 2×2 equal grid | Yes | Yes | **PASS** |
| 4 | **Magazine ↔ Scrapbook** | Yes — unframed designed page / cover hierarchy collage vs polaroid tactile layered memory page | Yes | Yes | **PASS** |
| 5 | **Scrapbook ↔ Gallery Wall** | Yes — soft imperfect polaroid overlap/tilt vs upright non-overlap salon mats + deliberate spacing | Yes | Yes | **PASS** |
| 6 | **Editorial ↔ Wildflower** | Yes — fashion-spread essay hierarchy vs organic unequal soft-radius windows (no botanical chrome invent) | Yes | Yes | **PASS** |
| 7 | **Luxury ↔ Gallery Wall** | Yes — singular centered fine-art mount vs multi-frame curated salon wall | Yes | Yes | **PASS** |

**Fail rule check:** No pair rests mainly on color/filter/font/tiny decoration/name. Film’s sprocket/mat language is a **photographic contact-sheet composition** (Phase B LEAVE), not a tint-only twin of Modern.

---

## 4. Composition validation (Phase B DNA — WP lists)

| Style | Intended Phase B composition | Observed on Wizard + Theme Studio cards | Verdict |
|---|---|---|---|
| **Editorial** | Fashion-spread essay: asymmetric dominant + quiet support + air | Large lead + smaller overlapping support; unframed; labels clear | **PASS** |
| **Magazine** | Designed page hierarchy: cover column + subordinate grid (≠ scrapbook) | Asymmetric cover/support collage with intentional air; unframed | **PASS** |
| **Film** | Contact sheet + fused mats + sprockets + warm tray (**LEAVE**) | Equal cells in contact-sheet tray with sprocket rails + warm grade | **PASS** (LEAVE) |
| **Modern** | Flush equal unframed grid (**LEAVE**) | Crisp equal 2×2; no mat/tilt/sprocket | **PASS** (LEAVE) |
| **Minimal** | `sparse` 1–2 rectangles + extreme whitespace; circles removed | Two rectangles + large empty field; **no circles** | **PASS** |
| **Luxury** | Singular centered fine-art mat ±1 small secondary | Large centered matted hero + tiny centered secondary | **PASS** |
| **Scrapbook** | Elegant polaroid page; restrained overlap + mild imperfect | Polaroid mats, soft tilt/overlap, memory-page read | **PASS** |
| **Wildflower** | Organic unequal soft-radius windows; no tilt-as-identity; no botanical chrome | Unequal multi-window soft radius flow (STOP-3 not needed) | **PASS** |
| **Midnight** | Cinematic wide band + dark field + 1–2 supports | Wide lead band + supports on dark field | **PASS** |
| **Gallery Wall** | `gallery-wall` matted salon, non-overlap, upright | Varied framed mats with salon gaps; upright; ≠ Magazine overlap page | **PASS** |

---

## 5. Ten card-level records

| Style | Visual identity | Dominant composition | Strongest differentiator | Photos readable | Premium feel | Awkward/artificial? | PASS/FAIL |
|---|---|---|---|---|---|---|---|
| **Editorial** | Fashion essay | Asymmetric dominant + quiet support overlap | Unframed hierarchical essay air | Yes | Yes | No | **PASS** |
| **Magazine** | Editorial page | Cover column + subordinate cells | Designed page hierarchy (unframed collage) | Yes | Yes | No | **PASS** |
| **Film** | Analog contact sheet | Equal cells in film tray | Sprocket rails + fused mats (LEAVE artifact) | Yes | Yes | No | **PASS** |
| **Minimal** | Quiet luxury sparse | 1–2 rectangles + empty field | `sparse` whitespace (circles gone) | Yes | Yes | No | **PASS** |
| **Modern** | Architectural grid | Flush equal unframed squares | Exact equal grid, zero chrome | Yes | Yes | No | **PASS** |
| **Luxury** | Fine-art mount | Singular centered mat ±1 secondary | Centered matted singular calm | Yes | Yes | No | **PASS** |
| **Scrapbook** | Memory page | Polaroid soft layers | Polaroid imperfect overlap | Yes | Yes | No | **PASS** |
| **Wildflower** | Organic windows | Unequal soft-radius cluster | Soft organic flow w/o flora chrome | Yes | Yes | No | **PASS** |
| **Midnight** | Cinematic band | Wide band on dark field + supports | Dark-field cinema band (not filter alone) | Yes | Yes | No | **PASS** |
| **Gallery Wall** | Salon wall | Non-overlap matted frames | Framed salon spacing primitive | Yes | Yes | No | **PASS** |

---

## 6. Studio → select → Live Preview → renderer fidelity

| Style | Selected in Studio | Live Preview observation | Fidelity |
|---|---|---|---|
| **Gallery Wall** | Yes — summary shows Gallery Wall | Hero remains Collection hero (no Photo Style promise). **Our Photos** shows matted non-overlap salon frames matching card identity | **PASS** identity |
| **Minimal** | Yes | **Our Photos** shows sparse two-rectangle composition with breathing room | **PASS** identity |
| **Luxury** | Yes | **Our Photos** shows singular matted hero + small secondary (same DNA as card) | **PASS** identity |

Shared path unchanged: `photo_styles` tokens → `resolveTheme` → `GalleryGrid` on Studio cards, Live Preview gallery, and published website. No second Photo Style renderer observed.

**Framing note:** Preview cropping differs by viewport, but composition identity is present. Do not treat hero-as-fullbleed as a Photo Style failure.

---

## 7. Photo content (Emma & Jordan)

| Check | Result |
|---|---|
| Multi-image styles show ≥3 distinct photos | **Yes** — 4 distinct gallery URLs used across cards (`gallery-1785809184072` … `9214615.png`): ceremony aisle/arch, couple under lights, floral detail, reception table |
| Photography as star | **Yes** — compositions showcase photos, not decorative CSS cosplay |
| Faces / subjects | Readable on support images; Studio thumbnails crop intentionally via shared face-aware cover behavior |
| Placeholders / limitations | Cards intentionally use ≤4 specimen photos; sparse/Midnight leave empty field by design. Full published galleries use same geometry at page width. **Documented only — no renderer compensation.** |

---

## 8. Exact remaining gaps (not FAIL warrants)

1. **Hero does not express Photo Style** — expected; gallery section does.  
2. **Film ↔ Modern remain adjacent LEAVE twins** (same equal-cell substrate); distinction is contact-sheet photographic apparatus, not tint alone — accepted under Phase B LEAVE.  
3. **PhotoStylePreview inherits Collection paper/`tc.bg`** — Wizard specimens may read on darker Collection paper while Theme Studio cards often sit on lighter cream; composition DNA is unchanged.  
4. **Distant pair viewport shots** sometimes include neighboring cards; per-card crops + tight pair clips remain the primary evidence.

---

## 9. Classification of remaining issues

| Issue | Classification |
|---|---|
| Hero ≠ Photo Style composition | **genuinely acceptable** (domain of GalleryGrid / Our Photos) |
| Film/Modern adjacency | **genuinely acceptable LEAVE** — contact sheet vs flush grid |
| Collection paper color in specimen wrapper | **preview framing / dimension independence** — not composition failure |
| Pair viewport neighbors | **capture framing** only |
| Critical pairs + 10-style beauty | **genuinely accepted** — no further Photo Style composition impl required |

---

## 10. FINAL DECISION

# **A — ACCEPT all 10**

**STOP.** No further Photo Style implementation. Do not retune winners. Do not start another composition pass without a new Product composition decision (not warranted by this audit).

---

## Paste-ready report

### Critical pairs

| Pair | Distinct structurally? | Beautiful? | Photography readable? | PASS/FAIL |
|---|---|---|---|---|
| Editorial ↔ Luxury | Yes | Yes | Yes | **PASS** |
| Film ↔ Modern | Yes | Yes | Yes | **PASS** |
| Minimal ↔ Modern | Yes | Yes | Yes | **PASS** |
| Magazine ↔ Scrapbook | Yes | Yes | Yes | **PASS** |
| Scrapbook ↔ Gallery Wall | Yes | Yes | Yes | **PASS** |
| Editorial ↔ Wildflower | Yes | Yes | Yes | **PASS** |
| Luxury ↔ Gallery Wall | Yes | Yes | Yes | **PASS** |

### Card-level (condensed)

| Style | Identity / dominant composition | Strongest differentiator | Readable | Premium | Awkward? | PASS/FAIL |
|---|---|---|---|---|---|---|
| Editorial | Fashion essay / asym dominant+support | Unframed hierarchy | Y | Y | N | **PASS** |
| Magazine | Page cover hierarchy collage | Designed unframed page | Y | Y | N | **PASS** |
| Film | Contact-sheet equal cells | Sprockets + fused mats | Y | Y | N | **PASS** |
| Minimal | Sparse 1–2 + air | Empty-field sparse | Y | Y | N | **PASS** |
| Modern | Flush equal grid | Zero chrome equal grid | Y | Y | N | **PASS** |
| Luxury | Singular centered mat | Fine-art singular calm | Y | Y | N | **PASS** |
| Scrapbook | Polaroid soft layers | Tactile imperfect polaroid | Y | Y | N | **PASS** |
| Wildflower | Organic unequal windows | Soft-radius flow | Y | Y | N | **PASS** |
| Midnight | Wide band on dark field | Cinematic band field | Y | Y | N | **PASS** |
| Gallery Wall | Non-overlap salon mats | Spaced gallery-wall primitive | Y | Y | N | **PASS** |

### Live fidelity

Studio select → saved summary → Live Preview **Our Photos** retains Gallery Wall / Minimal / Luxury identity. Framing OK. Hero not in scope for Photo Style composition. Same `GalleryGrid` path.

### Photo content

≥3 distinct Emma & Jordan gallery photos in multi-image specimens (4 distinct URLs). Sparse/Midnight empty field intentional.

### Decision letter

**A**

*End of Phase B visual acceptance. Zero product mutations in this pass.*
