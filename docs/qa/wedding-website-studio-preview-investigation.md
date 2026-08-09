# Wedding Website Studio — Collection + Photo Style Preview Investigation

**Date:** 2026-08-09  
**Scope:** Investigation + design-mapping only. No code, DB, migration, or publishing-model changes.  
**Canonical content:** Emma & Jordan / Sweet Daisy Barn & Farm (existing Studio + published fixture used in prior wedding-website QA).  
**SoT rule:** Prefer actual renderer + catalog config → constrained preview viewport → representative couple content. Do not invent a second visual interpretation.

---

## Design principles (locked for this investigation)

| Dimension | Couple question | Preview job |
|---|---|---|
| **Collection** | “What does my whole website feel like?” | **Show me the website.** Composition, personality, type hierarchy, section composition, spacing, hero, story unfold. |
| **Photo Style** | “How will my photographs behave within it?” | **Show me how my photos will live inside it.** Framing, layering, spacing, crop/arrangement system — not one pretty photo crop. |

These must not feel like duplicate choices. Collection owns page shell / rhythm / section DNA. Photo Style owns gallery photograph presentation (`GalleryGrid` tokens only).

---

## Catalog SoT (verified — do not assume name lists)

### Collections (from `collections` seed + later migrations)

Active catalog is loaded by `GET /api/portal/website/catalog` from `collections` where `is_active = true`, ordered by `sort_order`.

| `key` | Display name | Notes |
|---|---|---|
| `classic` | Wildflower | Hardcoded DNA in `COLLECTIONS` + DB `layout_config` |
| `modern` | Midnight | Same |
| `garden` | Garden Party | Same |
| `minimal` | Linen | Same |
| `romance` | Rosé | Same |
| `coastal` | Coastal | Same; unique `sectionRoles` + hardcoded `heroAspectCap` |
| `champagne` | Champagne | Same |
| `velvet` | Velvet | Same |
| `estate` | European Estate | **DB-only** layout (not in hardcoded `COLLECTIONS`) |
| `rustic` | Rustic | **DB-only** layout |
| `industrial` | Industrial | **DB-only** layout; composition seeded; **not** called out in Studio descriptors / Phase 4A rhythm list |

**Suggested names checked:** Wildflower, Midnight, Champagne, Velvet, European Estate, Rustic, Garden Party, Linen, Rosé, Coastal — **all present**. Industrial is an 11th catalog row. There is **no** Collection named “Scrapbook” / “Magazine” / “Editorial” (those are Photo Styles).

### Photo Styles (from `photo_styles` + Phase 4B)

| `key` | Display name | Dominant renderer identity (after Phase 4B) |
|---|---|---|
| `editorial` | Editorial | Uniform grid, `hero-emphasis`, large scale, tight, no frame |
| `magazine` | Magazine | `arrangement: collage` (layered overlap) |
| `film` | Film | Uniform + white `border` + warm sepia filter |
| `minimal` | Minimal | Uniform + generous spacing + **circular** `photoRadius: 50%` |
| `modern` | Modern | Uniform equal squares, tight/normal, no frame |
| `luxury` | Luxury | `hero-emphasis` + white border + soft shadow + generous spacing |
| `scrapbook` | Scrapbook | `arrangement: scrapbook` + polaroid + scattered rotation |
| `wildflower` | Wildflower | Uniform + **alternating** scale/aspect + scattered rotation (organic, not Scrapbook path) |
| `midnight` | Midnight | Same structure as Editorial + dark cinematic filter |

**Suggested names checked:** Editorial, Magazine, Film, Minimal, Modern, Luxury, Scrapbook, Wildflower, Midnight — **all nine present**.

Primary data SoT files:

- `supabase/migrations/20261009000000_hosted_experience_phase1_catalog_seed.sql` (8 collections)
- `supabase/migrations/20261167000000_hosted_experience_four_dimensions_seed.sql` (layout_config + 3 collections + 7 photo styles)
- `supabase/migrations/20261173000000_wedding_website_visual_expression.sql` (composition recipe + photo arrangement tokens)
- `supabase/migrations/20261174000000_wedding_website_coastal_art_direction.sql` + `_pass2` (Coastal `sectionRoles`)
- `supabase/migrations/20261200000000_wedding_website_collection_rhythm.sql` (shared rhythm for 8 collections)
- `supabase/migrations/20261201000000_wedding_website_photo_style_differentiation.sql` (final 9 Photo Style tokens)

Runtime merge SoT: `resolveTheme()` in `components/wedding-website/wedding-website.tsx`.

---

## 1. Current Collection preview architecture

### Shared primitive path (correct SoT direction)

| Piece | Role |
|---|---|
| `buildPreviewSite()` (`lib/wedding-website/preview-site.ts`) | Candidate `PublicWebsite` from catalog row(s) |
| `resolveTheme()` | Merges Collection DNA + `layoutConfig` + Color/Typography/Photo tokens |
| `Hero` | Real opening moment |
| `createSectionRenderer().renderSection(key)` | Real section content |
| `ScaledThumbnail` | Render ~320px wide, CSS-scale into card (`collection-preview.tsx`) |
| `CollectionPreview` | Composition wrapper: Hero + optional `sectionKeys` |

Comment block in `collection-preview.tsx` already states the SoT law: previews must not decide hero/section/gallery/font/color themselves.

### Where Studio uses it

**Setup Wizard — Collection step** (`website-studio.tsx`):

```tsx
<CollectionPreview
  base={previewBase}
  collection={c}
  colorStory={currentColorStory}
  typography={currentTypography}
  sectionKeys={["story"]}
  width={226} height={283}
  heroFraction={0.45}
/>
```

- Card: aspect ~4/5, real renderer scaled into ~226×283.
- Intended stack: hero (~45% of natural height) → story section below.
- Content: couple cover / selected engagement photo + existing site content; gallery fallback is cover repeated ×3 for Photo Style only.

**Theme Studio — editor** (`website-editor.tsx`):

- Collapsed DimensionCard swatch: `CollectionPreview` at **80×56**, **no** `sectionKeys` (hero-only thumbnail).
- Expanded Collection grid: **gradient swatch only** (`collectionSwatch(c)`), **not** `CollectionPreview` — i.e. color blob, not website miniature.

### Preview base construction gaps (critical)

Wizard `previewBase` sets content + custom color columns, but:

1. Does **not** set `theme` / collection `key`. `resolveTheme()` falls back to `site.theme ?? "classic"`, so hardcoded `COLLECTIONS.classic` is always the DNA base; DB `layoutConfig` overlays on top. Estate/Rustic/Industrial have **no** hardcoded entry — they inherit Wildflower hardcode fields that `layout_config` does not redefine (e.g. Coastal’s `heroAspectCap` lives only in hardcode `COLLECTIONS.coastal`, not DB).
2. Passes **shared** `currentColorStory` / `currentTypography` to every card — correct for “locked other dimensions,” but increases visual convergence when those dominate the thumbnail.
3. Story section uses `editMode: false`. If `content.story.text` is empty, story render returns **`null`** → Collection card collapses to **hero-only** for first-time wizards (very common before Story step).
4. Does **not** pass `photoStyle` (correct: Collection preview should not perform Photo Style).

### Live Preview vs picker previews

Wizard Preview step + Studio Live Preview both mount the real `WeddingWebsite` component with a fully joined `livePreviewSite` — that path already shows truthful full-website differences. The **picker cards** are the weak link, not Live Preview.

---

## 2. Current Photo Style preview architecture

| Piece | Role |
|---|---|
| `PhotoStylePreview` | `buildPreviewSite({ collection, photoStyle })` → `GalleryGrid` inside `ScaledThumbnail` |
| Photos | Real gallery URLs, else cover photo repeated ×3, else empty muted block |
| Wizard card size | **226 × 80** |
| Editor expanded card | **170 × 64**; collapsed swatch **80 × 56** |

This is already on shared primitives (`GalleryGrid`) — **correct SoT**. Scrapbook/Magazine look strong because their arrangements produce unmistakable silhouettes even when heavily cropped. Uniform styles collapse toward “one photo crop” when:

- Viewport height is only ~64–80 px (scales a ~114–120 px natural height — barely one row).
- Preview photo set is often **three copies of the same cover** (no multi-image variety).
- Styles that differ mainly by scale pattern / spacing / filter need **multiple distinct photos + enough vertical room** to show hierarchy (Editorial/Luxury/Midnight `hero-emphasis`; Wildflower alternating spans; Minimal circles).

Photo Style preview also inherits Collection `galleryLayout` (grid / masonry / film-strip) via `resolveTheme` + collection layout — so Photo Style cards change subtly with the selected Collection. That’s truthful, but Studio must keep Collection vs Photo Style copy distinct so couples don’t feel “I already picked this.”

---

## 3. Actual renderer differences — every Collection

Resolution path: hardcoded `COLLECTIONS[theme]` (fallback) merged with DB `layoutConfig` (wins for overlapping keys) then Color / Typography / Photo Style overrides. Below is the **authored Collection identity** that the live website uses (layout from migrations + hardcode where noted). Photo Style tokens **override** Collection `photoFilter` / `photoRadius` on the published site when a style is chosen; Collection still owns `galleryLayout` shell for uniform arrangements.

### Shared rhythm note

Phase 4A authored the **same** `sectionRoles` canvas/scale/treatment pattern for: Champagne, Estate, Linen, Midnight, Rosé, Rustic, Velvet, Wildflower. Coastal keeps a **distinct** event canvas (`strong` vs shared `soft`) and slightly different travel/dress_code pairing weights. Garden Party is documented as the template for that shared pattern; **no migration in-repo currently `UPDATE`s `garden`’s `sectionRoles`** (Coastal + the eight keys above are migrated). Industrial was **not** included in Phase 4A. Rhythm alone therefore does **not** differentiate most Collections from each other — composition recipe + hero/story/header/divider/galleryLayout do.

### Per-Collection matrix

| Collection | Hero | Align / height | Header | Story | Divider | Gallery shell | Section composition recipe (salient) | Spacing / motion | Compact-preview truthful? |
|---|---|---|---|---|---|---|---|---|---|
| **Wildflower** (`classic`) | Full-bleed | Center / 65vh | romantic | prose → EditorialOpening when roles | botanical | grid | flowing, center, rule-both, divider, cozy | cozy + fade | Hero + botanical header + flowing story — yes if story text present |
| **Midnight** (`modern`) | Full-bleed | **Left** / 75vh | editorial | editorial → EditorialOpening | rule | **masonry** | editorial, wide, left, full-bleed, featuredItem first*, spacious | spacious + rise; RSVP banner | Left hero is strongest differentiator in card |
| **Garden Party** (`garden`) | Full-bleed | Center / 60vh | romantic | prose → EditorialOpening | **dots** | grid | flowing, center, **band alternate**, subtle asymmetry | cozy + fade | Bands/alternate need section canvas — weak at hero-only |
| **Linen** (`minimal`) | **Invitation** (type-on-paper when no photo); full-bleed when photo | Center / auto | minimal | **minimal** quiet body (never EditorialOpening) | none | grid | **quiet**, narrow, left, airy | spacious + none | Invitation-without-photo is unique; **with cover photo becomes full-bleed** — often looks like others |
| **Rosé** (`romance`) | Full-bleed | Center / 65vh | romantic | **quote** (pull-quote; preserved with roles) | ornament ♡ | masonry | flowing, rule-top, spacious | cozy + fade | Quote story is unique — **only if story text exists** |
| **Coastal** (`coastal`) | Full-bleed + **heroAspectCap 2/1** (hardcode only) | Center / 65vh→85vh | coastal | prose → EditorialOpening | deco ✦ | **film-strip** | editorial, wide, **alternating** align/edge, airy | spacious + rise + **snap** | Cap may miss if `theme` not `coastal`; film-strip needs gallery section |
| **Champagne** (`champagne`) | Full-bleed | Center / 65vh | **formal** | prose → EditorialOpening | deco | grid | **framed**, card shell, featured first, spacious | spacious + none | Card/framed shells need non-hero sections |
| **Velvet** (`velvet`) | Full-bleed | **Left** / 80vh | editorial | editorial → EditorialOpening | rule | film-strip | editorial, wide, tinted band, compact, full-bleed | spacious + rise + snap; RSVP banner | Left tall hero readable in card |
| **European Estate** (`estate`) | Full-bleed | Center / 70vh | formal | prose | ornament | grid | framed, card, band alternate, spacious | spacious + fade | Similar to Champagne in hero; framed differences deeper |
| **Rustic** (`rustic`) | Full-bleed | Center / 65vh | romantic | prose | botanical | **masonry** | flowing, left, position alternate, cozy | cozy + fade | Needs section body to show left/flowing |
| **Industrial** (`industrial`) | Full-bleed | Left / 75vh | editorial | **minimal** | rule | grid | editorial, wide, index separator, compact, full-bleed | **compact** + none; RSVP banner | Left hero + minimal story; less Studio product surface |

\*Note from visual-expression report: `featuredItem` only visualizes in **framed** family today (Champagne/Estate benefit; Midnight’s `featuredItem: first` is incomplete).

### Differences that can truthfully show in a compact website miniature

**High signal (hero → short story):**

- Left vs center hero (Midnight, Velvet, Industrial)
- Linen invitation layout **when no cover** (fragile: couples usually have a photo by Collection step)
- Rosé pull-quote vs Linen minimal vs EditorialOpening prose (requires story copy)
- HeaderStyle ornaments via SectionHeader on story (editorial hairline + small-caps vs romantic heading vs minimal tick)
- Divider ornaments between hero and story when divider actually renders
- Densities / content width via EditorialOpening layout (narrow Linen vs wide Midnight)

**Medium signal (need second section or taller crop):**

- Section composition family (framed cards vs flowing lists vs quiet column vs editorial rows) — needs Event / Travel / Schedule fragment, not just story
- Gallery shell (`film-strip` vs grid vs masonry) — Collection-owned, but conflict risk with Photo Style step if previewed as photo focus
- Canvas bands (`sectionBand` / `SectionCanvas`) — need enough vertical rhythm

**Low / invisible in current cards:**

- Animation (`fade`/`rise`) — IntersectionObserver won’t meaningfully run in a static 283px card
- Scroll snap
- Paired passages (dress_code ↔ bridal_party)
- Full-page rhythm alternation across 12 sections
- Coastal `heroAspectCap` unless `theme` key is set on the candidate site
- RSVP banner vs inline placement

---

## 4. Actual renderer differences — every Photo Style

All paths go through `GalleryGrid` (`wedding-website.tsx`). Tokens from Phase 4B:

| Style | arrangement | scalePattern | frame | rotation | shadow | spacing | radius | filter (essence) | imageScale |
|---|---|---|---|---|---|---|---|---|---|
| Editorial | uniform | hero-emphasis | none | none | none | tight | 0 | contrast up | large |
| Luxury | uniform | hero-emphasis | **border** | none | soft | generous | 0 | mild polish | normal |
| Minimal | uniform | uniform | none | none | none | generous | **50%** | soft desat | normal |
| Modern | uniform | uniform | none | none | none | normal | 0 | crisp contrast | normal |
| Magazine | **collage** | — | none | subtle | soft | tight | 0.25rem | mild gloss | normal |
| Film | uniform | uniform | **border** | none | soft | normal | 0.25rem | **sepia/warm** | normal |
| Scrapbook | **scrapbook** | — | **polaroid** | scattered | soft | normal | 0.25rem | vivid | normal |
| Wildflower | uniform | **alternating** | none | **scattered** | soft | normal | 0.85rem | earthy sepia tint | normal |
| Midnight | uniform | hero-emphasis | none | none | none | tight | 0 | **dark cinematic** | large |

Collection interaction: for `arrangement: "uniform"`, Collection `galleryLayout` still chooses grid / masonry / film-strip structure; collage/scrapbook replace that loop entirely.

### Minimum visual example (for immediate understanding)

| Style | Minimum to “get it” |
|---|---|
| Magazine | ≥2 **distinct** photos in collage slot (overlap + mixed scale) |
| Scrapbook | ≥2–3 photos with polaroid margin + scatter rotation + overlap |
| Wildflower | ≥3 photos showing alternating aspect + independent tilt (not Scrapbook cards) |
| Editorial | ≥2 photos so photo[0] can `hero-emphasis` span |
| Luxury | Same as Editorial + visible white frame + airier gap |
| Midnight | Same structure as Editorial + obviously darker grade |
| Film | ≥2–3 bordered sepia equal frames |
| Modern | ≥3 equal sharp squares (rigid grid) |
| Minimal | ≥2–3 **circles** with air around them |

---

## 5. Which differences are currently visible in Studio

### Collection step (Wizard)

| Visible now | Why |
|---|---|
| Cover photo identity | Shared `previewPhoto` |
| Rough color field | Shared Color Story / custom colors / collection-tied stories when selected |
| Left vs center hero | Midnight / Velvet / Industrial |
| Typography (if already chosen; else catalog default) | Shared `currentTypography` |
| Story treatment **only if story text already exists** | `sectionKeys={["story"]}` |
| Name + 3–5 word descriptor under card | `COLLECTION_DESCRIPTORS` |

### Collection picker (Theme Studio expanded)

| Visible now | Why |
|---|---|
| Mostly **swatch gradient + name** | Not a website miniature |

### Photo Style step

| Visible now | Why |
|---|---|
| Scrapbook polaroid scatter | Distinct `arrangement` |
| Magazine collage silhouette | Distinct `arrangement` |
| Strong filter differences when crop shows one face | Midnight vs Film sepia vs others |
| Sometimes circular Minimal | If radius visible at tiny height |

### Live Preview / Wizard Preview step

Full `WeddingWebsite` — all Collection + Photo Style differences that the real site supports are visible here.

---

## 6. Which important differences are currently invisible

### Collection

1. **Most cards read as the same hero card** when story text is empty (hero-only path).
2. **Composition family** (framed / flowing / quiet / editorial lists) — not exercised by hero+empty-story.
3. **Section rhythm / canvas bands** — height + single-section crop too small; shared `sectionRoles` also reduce inter-collection rhythm contrast.
4. **Gallery shell** (film-strip vs masonry vs grid) — Collection-owned but not shown on Collection cards (by design today).
5. **Header / divider vocabulary** — often clipped or absent without story/header paint.
6. **Linen’s invitation personality** — hidden once a cover photo exists (renderer switches to photographic full-bleed).
7. **Coastal aspect-cap behavior** — depends on `theme === "coastal"` hardcode path not wired in `buildPreviewSite`.
8. **Theme Studio Collection grid** — gradient cards erase renderer truth entirely.
9. **Hardcode vs DB merge asymmetry** for Estate/Rustic/Industrial (and Coastal-only hardcode keys) when `theme` isn’t set on the candidate.

### Photo Style

1. **Editorial / Luxury / Midnight** collapse toward “big photo crop” at 64–80px height, especially with identical repeated cover images (no second photo for `hero-emphasis`).
2. **Modern vs Film** need equal multi-cell grid + border/sepia — truncated viewport + identical photos hide structure.
3. **Wildflower** organic alternating spans need width + ≥3 distinct photos; otherwise reads as “crooked crop.”
4. **Minimal circles** may look like a single round crop, not a photo system, when only one face fills the card.
5. **captionStyle** is dormant globally (no caption content field) — never previewable.

---

## 7. Recommended preview composition — Collection

**Principle: Show me the website.**

### Composition (reuse renderer primitives only)

Use existing `CollectionPreview` + `ScaledThumbnail` + `Hero` + `createSectionRenderer`:

1. **Natural width ~320–360**; card height enough for ~2.5 “moments” (recommend taller than today: ~320–360 CSS px at phone column, or naturalHeight targeting hero ~40% + story ~35% + thin third band ~25%).
2. **Locked non-Collection dimensions** for fair compare: one representative Color Story (or neutral six-role set), one Typography, **no Photo Style tokens** (or a single uniform “control” style applied equally — never vary Photo Style across Collection cards).
3. **Content pack (Emma & Jordan / Sweet Daisy):**  
   - Home title “Emma & Jordan”, cover engagement photo, ceremony location “Sweet Daisy Barn & Farm”  
   - Story: short real paragraph (enough for quote / minimal / EditorialOpening to diverge)  
   - Optional third beat: **Event** (ceremony/reception) *or* a single **Schedule** row — existing sections only; shows framed vs flowing vs quiet shells without inventing new section types  
4. **Always set `theme: collection.key`** on the candidate site (via `buildPreviewSite` extension — design note only) so hardcode DNA + Coastal aspect cap resolve truthfully.
5. **If couple has no story yet**, inject the representative Emma & Jordan story **into the preview candidate only** (not persisted) so Story treatment is never blank — still the real renderer.

### Viewport framing

- Prefer top-aligned crop that always includes: **hero → transition → story opening**.
- Do **not** include Gallery in Collection cards (avoids duplicating Photo Style).
- Do **not** animate scroll-reveal in cards (or force `animationStyle: "none"` on preview candidates) so cards aren’t empty pending intersection.

### What not to invent

No second hero layout, no mock dividers outside `SectionDivider`, no fake “template screenshots.”

---

## 8. Recommended preview composition — Photo Style

**Principle: Show me how my photos will live inside it.**

### Composition

Keep `PhotoStylePreview` → `GalleryGrid` (already SoT). Change **viewport + photo set**, not geometry:

1. **Taller card** (recommend ≥140–160 CSS px at wizard column width, natural width ~320) so collage/scrapbook/alternating grids can show 2–3 cells, not a single facial crop.
2. **Multi-photo set (required):** prefer couple gallery (`content.gallery.photos`); if fewer than 3, fill from engagement media; only then repeat — but prefer **≥3 distinct URLs**. For Emma & Jordan QA, use the fixture’s real multi-photo gallery when present.
3. **Hold Collection constant** (already done via `currentCollection`) so gallery shell is stable while Photo Style varies.
4. **Background:** page `tc.bg` already shows — keep it; avoid decorative mats that aren’t in `GalleryGrid`.
5. Minimum per-style acceptance (QA): blind-identify Magazine / Scrapbook / Wildflower / Minimal circles / Editorial hero-emphasis without reading labels at the new size — same bar Phase 4B used on the published gallery.

### Do not

- Reintroduce a hand-rolled mini geometry (`PhotoStyleMiniPreview` was removed for drift reasons).
- Preview captions (`captionStyle` dormant).
- Show Wedding Party portraits as Photo Style (Photo Style does not own `portraitShape`).

---

## 9. Can existing renderer primitives be reused?

**Yes — and they already are.** This is not a greenfield preview system.

| Need | Existing primitive | Verdict |
|---|---|---|
| Website feel | `Hero` + `createSectionRenderer` + `ScaledThumbnail` | Reuse; fix candidate site + content + viewport |
| Photo system | `GalleryGrid` + `ScaledThumbnail` | Reuse; fix photo count + viewport height |
| Theme join | `buildPreviewSite` + `resolveTheme` | Reuse; extend `buildPreviewSite` to accept/set `theme: collection.key` |
| Full fidelity check | `WeddingWebsite` Live Preview | Keep as confirmation, not picker substitute |

**When reuse would not be practical:** only if a Collection difference requires a section the couple hasn’t enabled *and* representative content cannot be supplied as a preview-only candidate. Even then, stick to real section keys + Emma & Jordan copy rather than a new faux section component.

**Hardcode/DB theme gap:** Estate/Rustic/Industrial/Coastal-aspect-cap truthfulness depends on setting `theme` to the collection key (or moving those hardcode-only fields into `layout_config` — **data-model change; out of scope / must not do in this investigation’s follow-up unless separately approved**). Preview candidate `theme` key is the smaller, non-publishing fix.

---

## 10. Exact files / components that would need to change

*(Future implementation — not done here.)*

| File | Likely change |
|---|---|
| `components/portal/collection-preview.tsx` | Collection viewport defaults (`heroFraction`, height strategy, optional forced preview content props); Photo Style default dimensions; ensure fonts load for Collection grids if needed |
| `lib/wedding-website/preview-site.ts` | Set `theme` from `collection.key`; optional preview-only content merge helper for Emma & Jordan representative story/event |
| `components/portal/website-studio.tsx` | Collection step props (taller card, ensure story content in `previewBase`); Photo Style step taller preview + ≥3 distinct photos; descriptors for Industrial if product-visible |
| `components/portal/website-editor.tsx` | Replace Theme Studio Collection **gradient** buttons with `CollectionPreview` (parity with Wizard); Photo Style card heights / photo set |
| Possibly a tiny shared helper under `lib/wedding-website/` | `buildStudioPreviewContent()` for representative Emma & Jordan pack — **preview-only**, never write to DB |

---

## 11. Exact files / components that MUST NOT change

| Must not change | Why |
|---|---|
| Public `WeddingWebsite` guest rendering behavior for published sites | Guardrail |
| `GalleryGrid` arrangement math / collage patterns (unless a proven bug) | Photo Style SoT |
| `collections.layout_config` / `photo_styles.tokens` schema or authored product identities without a separate initiative | Guardrail: no data-model / publishing-model work |
| Publishing / version-history / RSVP business logic | Out of scope |
| Color Story / Typography dimensions’ pickers (except shared preview helpers if reused) | Not this problem |
| Reintroducing parallel mini-renderers | Violates shared primitives law (`docs/wedding-website-shared-primitives.md`) |
| Inventing new website sections solely for Studio cards | Brief forbids |
| Hardcoding brand-new Collection/Photo Style looks in CSS outside catalog tokens | Second interpretation |

Safe to leave untouched unless separately approved: `composition-primitives.tsx` behavior, Coastal-only art direction, Phase 4A/4B migrations.

---

## 12. Regression risks

| Risk | Mitigation |
|---|---|
| Preview-only injected story/event bleeds into save payloads | Keep representative content inside preview candidate builders only; never pass into `onSaveSection` / design patch |
| Setting `theme` on preview candidates changes Color Story nesting assumptions | Theme is layout DNA key; colors still from six-role columns / colorStory tokens |
| Taller Collection cards break 2-column Wizard density | Adjust grid gap / allow vertical scroll (already scrollable) |
| Photo Style previews get slow with many images | Cap preview photos at 3–4 URLs |
| IntersectionObserver + `animationStyle` leaves thumbnails blank | Force revealed / `animationStyle: "none"` in preview candidates |
| Theme Studio swap from gradient → real preview increases layout shift | Match Wizard card proportions deliberately |
| Collection cards accidentally include Gallery | Couples confuse Collection with Photo Style |
| Live Preview / published pixel drift | Continue mounting real `WeddingWebsite` only for full preview; keep pickers as constrained shared-primitive viewports |

---

## 13. Recommended implementation sequence

1. **Prove content baseline** — Emma & Jordan / Sweet Daisy: ensure Studio QA has cover + ≥3 gallery photos + story text (fixture hygiene; no schema change).
2. **Fix Collection candidate fidelity** — `buildPreviewSite` sets `theme: collection.key`; preview-only story (and optional event) always present; disable scroll-reveal in thumbnails.
3. **Resize Collection Wizard card** — keep Hero + Story; raise height / tune `heroFraction` until left-hero / quote / quiet / EditorialOpening are blind-identifiable for ≥ Midnight, Velvet, Rosé, Linen, Wildflower.
4. **Parity Theme Studio Collection grid** — replace gradient swatches with the same `CollectionPreview` composition (not Live Preview iframe).
5. **Resize Photo Style cards + enforce ≥3 distinct photos** — validate Phase 4B blind-ID still holds *inside Studio cards*, not only on the published gallery.
6. **Copy audit** — Collection copy stays “whole website feel”; Photo Style copy stays “how photos are framed/layered/spaced”; remove language that overlaps (“photo layouts” on Collection if it implies Photo Style).
7. **QA matrix** — Collection × fixed Photo Style control; Photo Style × fixed Collection (Garden Party or Coastal); mobile + desktop Wizard; Theme Studio; confirm Live Preview unchanged for published slug behavior.
8. **Only then** consider data work (e.g. Industrial rhythm, Garden Party `sectionRoles` migration hygiene, moving `heroAspectCap` into `layout_config`) as a **separate** approved initiative — not required to make truthful miniatures if step 2 sets `theme`.

---

## Architecture map (current)

```text
Catalog (DB)
  collections.layout_config ──┐
  photo_styles.tokens ────────┤
  color_stories / typography ─┤
                              ▼
                   buildPreviewSite()
                              ▼
                      resolveTheme()
                     /     |      \
                  Hero  Sections  GalleryGrid
                     \     |      /
                   ScaledThumbnail
                    /            \
         CollectionPreview   PhotoStylePreview
              │                    │
     Wizard Collection step   Wizard Photo Style step
     (Theme Studio: weak)     (Theme Studio: short crop)
                              │
                    WeddingWebsite (Live Preview) ← already truthful
```

---

## Bottom line

Studio already adopted the right architecture (shared `Hero` / sections / `GalleryGrid`). The product failure is **preview framing and candidate content**, not missing Collection/Photo Style capabilities in the renderer. Collection cards often show one shared photographic hero; Photo Style cards often show one shared crop — while Scrapbook/Magazine escape that trap because their arrangements survive aggressive cropping. Raising truthful multi-moment Collection miniatures and multi-photo Photo Style systems — still entirely on existing primitives — closes the gap without redesigning the published website renderer or changing catalog/publishing models.

**Report path:** `docs/qa/wedding-website-studio-preview-investigation.md`
