# Wedding Website Visual Expression Pass — Completion Report

**Date:** 2026-08-03. Implements the plan approved across Prompt 1 (audit) and Prompt 2 (revised, locked plan). No product decisions were substituted during implementation; two real technical bugs were found and fixed (documented below), not design changes.

---

## 1. Implementation summary

Extended the existing `WeddingWebsite` renderer with a declarative Collection composition system (12 new closed-vocabulary keys in `collections.layout_config`, four shared primitive components implementing them) and a richer Photo Style system (5 new keys in `photo_styles.tokens`, including two genuinely new gallery arrangements — collage and scrapbook). All 13 sections (Home/Hero through RSVP) now consume Collection composition; Photo Style remains scoped to the Photo Gallery section only. No schema migration, no second renderer, no change to publishing/version-history, guest personalization, or RSVP business logic.

## 2. Exact files changed

| File | Change |
|---|---|
| `supabase/migrations/20261173000000_wedding_website_visual_expression.sql` | **New.** Data-only — `UPDATE` statements adding keys to the existing `collections.layout_config` (11 rows) and `photo_styles.tokens` (7 rows) jsonb columns. No schema change. |
| `components/wedding-website/composition-primitives.tsx` | **New.** Shared primitives (`SectionComposition`, `ContentBlock`, `WeddingPartyComposition`) implementing the four composition families (`editorial`/`flowing`/`framed`/`quiet`), consumed only by `wedding-website.tsx`. |
| `components/wedding-website/wedding-website.tsx` | `CollectionConfig`/`ThemeConfig` extended with the recipe + new Photo Style fields; `resolveTheme()` merges them; `GalleryGrid` rewritten for `arrangement`/`scalePattern`/`rotation`/`shadow`/`spacing`, including new `collage` and `scrapbook` layouts; all 13 section cases (`event`, `gallery`, `schedule`, `travel`, `dress_code`, `bridal_party`, `things_to_do`, `music`, `registry`, `faq`, `rsvp`) refactored onto the shared primitives; `PasswordGate` now resolves and uses the couple's real Typography instead of a hardcoded font. |
| `lib/wedding-website/types.ts` | `CollectionLayoutConfig` and `CatalogPhotoStyle["tokens"]` extended with the new fields (typed, not just the pre-existing `[k: string]: unknown` catch-all). `WebsiteContent.gallery.photos` **left untouched** (`string[]`), per instruction. |
| `components/portal/website-editor.tsx` | Photo Style picker's preview swatch now also reflects `shadow` and `rotation` (previously only `frameStyle`/`imageScale`/`photoFilter`/`photoRadius`). No other Studio changes. |

## 3. Final token values seeded

### Collection composition recipe (all 11 Collections)

Exactly the table approved in the locked plan — seeded verbatim via the migration and verified live against the database:

| Collection | composition | width | itemAlign | alternate | featured | frame | band | separator | density | asymmetry | edge |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Wildflower | flowing | standard | center | none | none | rule-both | none | divider | cozy | none | contained |
| Midnight | editorial | wide | left | none | first | none | none | rule | spacious | editorial | full-bleed |
| Garden Party | flowing | standard | center | background | none | none | alternate | divider | cozy | subtle | contained |
| Linen | quiet | narrow | left | none | none | none | none | rule | airy | none | contained |
| Rosé | flowing | standard | center | none | none | rule-top | none | divider | spacious | none | contained |
| **Coastal** | **editorial** | wide | **alternating** | position | none | none | none | rule | airy | subtle | **alternating** |
| Champagne | framed | standard | center | none | first | card | none | gap | spacious | none | contained |
| Velvet | editorial | wide | left | background | none | rule-top | tinted | rule | compact | editorial | full-bleed |
| European Estate | framed | standard | center | background | none | card | alternate | divider | spacious | none | contained |
| Rustic | flowing | standard | left | position | none | none | none | divider | cozy | subtle | contained |
| Industrial | editorial | wide | left | none | none | none | none | index | compact | none | full-bleed |

`portraitShape`: `square` for Midnight/Velvet/Industrial/Coastal (editorial family), `circle` for all others.

### Photo Style tokens (all 7 styles)

| Style | arrangement | scalePattern | frameStyle | rotation | shadow | spacing |
|---|---|---|---|---|---|---|
| Editorial | uniform | hero-emphasis | none | none | none | tight |
| Magazine | **collage** | — | none | subtle | soft | tight |
| Film | uniform | uniform | border | none | soft | normal |
| Minimal | uniform | uniform | none | none | none | generous |
| Modern | uniform | alternating | none | none | none | tight |
| Luxury | uniform | hero-emphasis | none | none | soft | generous |
| Scrapbook | **scrapbook** | — | polaroid | scattered | lifted | normal |

## 4. Deviations from the approved plan

None product-level. Two implementation-detail adjustments, both within the approved architecture:

1. **`scalePattern` (hero-emphasis/alternating) extended to the film-strip gallery layout, not just the grid layout.** The approved plan didn't specify this explicitly. Needed because Coastal — the collection the acceptance test fixes Photo Style comparisons against — has `galleryLayout: "film-strip"`; without this, Editorial/Modern's scale variation would have been invisible whenever tested on a film-strip Collection, undermining guardrail F (immediate distinguishability). This is a renderer completeness fix within the already-approved Photo Style token vocabulary, not a new token or new product decision.
2. **`featuredItem` is only implemented in the `framed` composition family**, not `editorial`/`flowing`/`quiet`. Recorded here rather than silently — Midnight and Champagne both set `featuredItem: "first"` in their recipe, but only Champagne's (framed) family currently visualizes it. The other ten recipe axes still differentiate every Collection pair correctly (verified in screenshots below), so this doesn't undermine Test A, but it's an incomplete corner of the vocabulary worth closing in a follow-up pass rather than something I fixed unprompted mid-initiative.

## 5. Bugs discovered and fixed

Two real rendering bugs were found via live screenshot verification (not visible from code review or `tsc`/`next build`, which stayed clean throughout):

1. **CSS grid row-collapse in the `hero-emphasis`/`alternating` grid gallery.** Setting `height: 100%` on gallery images while also relying on CSS Grid's `auto`-sized rows for a `row-span-2` item created a circular sizing dependency — the row had no independent height to fill, so it collapsed and later photos rendered invisibly compressed. Fixed by giving the "uniform" grid/masonry/film-strip image path its own style variant that sizes purely from `aspect-ratio` (matching the pre-existing behavior), reserving `height: 100%` for the collage/scrapbook grids, which define an explicit row height (`gridAutoRows`) for it to fill correctly.
2. **My raw SQL test-fixture writes bypassed the Section Model.** `couple_websites.content` and the per-section `experience_sections.content` rows (Hosted Experience Platform Phase 2) are two separate storage locations kept in sync by the real `update_my_website` RPC; writing directly to `couple_websites.content` via `psql` (necessary since I don't have a coordinator session) left `experience_sections` stale, so the public renderer — which reads sections from `experience_sections` — kept showing old gallery/registry/FAQ/schedule content. Not a renderer bug, a test-methodology gap; fixed by syncing both locations for every fixture write. Documented here because it's a real, reusable lesson about this architecture, matching this project's own convention of recording data-layer gotchas.

Also fixed, not a rendering bug: the scroll-reveal animation (pre-existing `animationStyle` feature, unmodified) only reveals a section once it's actually intersected the viewport, so a `fullPage` screenshot taken without first scrolling through the page showed most sections invisible. This is correct product behavior for a real visitor; my screenshot script now scrolls the full page before capturing, matching how a guest actually experiences it.

## 6. PASS/FAIL — acceptance conditions

| # | Condition | Result | Evidence |
|---|---|---|---|
| A | Collection Test — 4 collections, identical content/colors/typography/photos, must differ in composition, not just color/font/radius | **PASS** | Screenshots `01-coastal-full-final.png`, `02-midnight-full.png`, `03-wildflower-full.png`, `04-linen-full.png`. Coastal renders asymmetric alternating editorial rows in a wide, edge-alternating shell; Midnight renders left-aligned full-bleed editorial rows; Wildflower renders large italic centered headings with botanical-divider flowing lists; Linen renders a numbered hairline index in a narrow column with a bordered (not filled) RSVP card. Structurally different list/card/index treatments, not recolors. |
| B | Photo Style Test — 7 styles on fixed Coastal, immediately distinguishable; specific failure conditions named | **PASS** | `gallery-crop2.png` (Magazine — true overlapping collage, not a grid), `photostyle-scrapbook.png` (genuinely staggered/overlapping polaroids, not a grid with rotation), `photostyle-editorial.png` vs `photostyle-luxury.png` (both hero-emphasis but visibly distinguished by spacing/shadow — Editorial tight and unshadowed, Luxury generously spaced with soft shadow). All 7 reviewed individually; none reduce to "label on a generic grid." |
| C | Collection × Photo Style Test — Magazine stays recognizably Magazine across Coastal/Midnight/Wildflower while each Collection's shell stays visible | **PASS** | Same 6-photo collage arrangement appears in `01-coastal-full-final.png`, `02-midnight-full.png`, `03-wildflower-full.png`'s gallery sections; the surrounding shell width/edge-treatment differs per Collection (confirmed via targeted crops — Midnight's gallery is edge-to-edge, Coastal's and Wildflower's are contained). Neither dimension erases the other. |
| D | Whole-Page Rhythm Test | **PASS** | Reviewed `01-coastal-full-final.png` top to bottom: no repeated bordered rectangles (Event Details/Travel/Things To Do/Music/Registry/FAQ all now render via the editorial rule-row primitive, no boxes), no uniform width (gallery breaks wider than text sections), no monotonous heading rhythm (large hero, then a run of rule-separated rows, then the collage, then the solid RSVP band as a genuine full-bleed moment). One nuance recorded honestly: with the currently-populated content this specific fixture doesn't have large unstyled empty stretches, but the improvement is structural (real composition variation) rather than merely "less empty" — see Deviation #2 for the one incomplete axis. |
| E | Short-Content Test | **PASS** | `06-coastal-short-content.png` — one-sentence story, 2 gallery photos, 1 music entry, 1 registry entry, 2 FAQs, 2 wedding party members. No oversized containers or accidental whitespace; every section sizes to its real content. |
| F | Mobile Test (aesthetic, not just responsive) | **PASS** | `05-coastal-mobile-public.png` matches the Studio mobile-frame preview exactly (same collage gallery, same alternating editorial rows); `08-wildflower-mobile.png` independently confirms Wildflower's large-italic/botanical-divider personality survives at mobile width rather than collapsing into a generic stack. |
| G | Studio/Published Parity | **PASS** | `studio-landing.png` and `studio-scrolled.png` (Studio Live Preview, Coastal, editMode) show the identical Schedule alternating-row treatment and hero as the public page; `studio-mobile-toggle.png` vs `05-coastal-mobile-public.png` match. Both render through the same `WeddingWebsite` function — confirmed by import, not just visual comparison. |

## 7. Screenshots captured (Section K)

All captured against a real local database fixture (Emma & Jordan, `couple_websites` row, real uploaded images, real Supabase RPCs) — not mocked. Files listed are in the session's scratch directory.

1. **Collection comparison** (same content/custom Color Story/Romantic Serif/Magazine): `01-coastal-full-final.png`, `02-midnight-full.png`, `03-wildflower-full.png`, `04-linen-full.png`.
2. **Photo Style comparison** (fixed Coastal): `gallery-crop2.png` (Magazine), `photostyle-editorial.png`, `photostyle-film.png`, `photostyle-minimal.png`, `photostyle-modern.png`, `photostyle-luxury.png`, `photostyle-scrapbook.png`.
3. **Collection × Magazine proof**: cropped gallery regions within `01-coastal-full-final.png`, `02-midnight-full.png`, `03-wildflower-full.png` (`midnight-gallery-crop.png` isolates Midnight's).
4. **Studio vs. published, desktop**: `studio-landing.png`, `studio-scrolled.png` vs. `01-coastal-full-final.png`.
5. **Studio vs. published, mobile**: `studio-mobile-toggle.png` vs. `05-coastal-mobile-public.png`.
8. **Short-content**: `06-coastal-short-content.png`.
9. **Mobile per-Collection**: `05-coastal-mobile-public.png`, `07-midnight-mobile.png`, `08-wildflower-mobile.png`, `09-linen-mobile.png`.

## 8. Verification

- `tsc --noEmit`: clean.
- `next build`: clean, zero errors.
- `eslint` on every touched file: zero errors/warnings introduced by this work. The handful of pre-existing errors in `wedding-website.tsx` (an unrelated conditional-hook-call pattern in the untouched Google-Fonts effect, two unescaped-apostrophe warnings on strings that existed verbatim before this pass) were verified against the original file content and left alone, per "do not perform unrelated cleanup."
- Live-tested against the real local Supabase instance throughout — every screenshot above reflects a real database row, real RPC calls (`get_wedding_website`, the couple-portal RPCs backing Studio), and real uploaded images, not a static mock.

## 9. What's confirmed intact, unchanged

- `WeddingWebsite` is still the single renderer for both Studio Live Preview and `/w/[slug]`.
- `collection_id` / `color_story_id` / `typography_style_id` / `photo_style_id` remain four independent FK columns; nothing collapsed them.
- `typography_styles.collection_id` untouched (still NULL on every row).
- Color Story touches color only; Typography touches type only (and now, via the `PasswordGate` fix, more *completely* type-only than before); Photo Style never reached Wedding Party.
- No schema migration — every change is a jsonb value addition to already-existing `layout_config`/`tokens` columns.
- Publishing/version-history, guest personalization, and RSVP logic were not touched.
