# Wedding Website — Shared Rendering Primitives

Hosted Experience Visual Release Specification v1.0, Phase 1 (2026-08-06).

Every selector, preview, picker, thumbnail, and Studio card exists only to
accurately represent the real public wedding website. This document
inventories the primitives that make that guarantee real: the same
functions/components that render `couplesite.com/w/[slug]` are the ones any
preview must call. There is no second, parallel implementation of hero
layout, section composition, gallery arrangement, font loading, or color
resolution anywhere else in the codebase — if one doesn't exist yet for a
given preview, that preview is not yet built on shared primitives (tracked
separately; see Phase 2).

All five primitives below live in
`components/wedding-website/wedding-website.tsx` (deliberately not moved to
a new file — Hero, Section, and Gallery each depend on ten-plus other
helpers already defined in that file, such as `SectionHeader`,
`FORMALITY_LABELS`, `CATEGORY_LABELS`, `scheduleDateParts`, and the
composition-primitives re-exports; moving only the top-level pieces out
would create a two-way import between this file and any new one, which Next
.js/webpack tolerates but which is a real footgun for fast-refresh and
future maintainers). Every export listed here is a plain named export from
that one file.

## Hero

**Responsibility.** Renders the page's opening moment: cover-photo vs.
gradient background selection, overlay/scrim opacity, contrast-safe text
color for photographic vs. flat heroes, and the three structurally distinct
hero layouts (Linen's photo-less invitation card, Velvet/Midnight's
left-aligned editorial hero, every other Collection's centered hero — itself
split between Coastal's `sectionRoles`-driven eyebrow/phrase/name/date
hierarchy and the classic eyebrow/name/subtitle/date stack).

**Inputs.** `{ site: PublicWebsite; tc: ThemeConfig; editMode?: boolean; onSectionClick?: (key: string) => void }`. Everything else (couple name, event
date/countdown, cover image resolution, overlay math) is derived internally
from `site` and `tc` — a caller only needs a real site object and an
already-resolved theme.

**Output.** A single JSX tree, no wrapping container (the caller supplies
page-level layout).

**Consumers today.** `WeddingWebsite` (the public page, Studio's Live
Preview, and the Setup Wizard's own Preview step — all three already share
this one instance of `WeddingWebsite`, so all three automatically render the
extracted `Hero` identically).

**Consumers planned (Phase 2).** The Collection Preview card's "top 40%"
hero region.

## Section

**Responsibility.** Renders any one content section (Story, Event Details,
Gallery, Schedule, Travel, Dress Code, Wedding Party, Things To Do, Music,
Registry, FAQ, RSVP) or a paired passage (Dress Code + Wedding Party, or
Registry + FAQ, when a Collection's `sectionRoles.pairWith` links them and
both currently have content) — including the section's own header
typography, canvas/background tinting, edit-mode overlay, and scroll-reveal
behavior.

**Inputs.** A context object, built once per render via the factory
`createSectionRenderer(ctx: SectionRenderContext)`:
```ts
type SectionRenderContext = {
  tc: ThemeConfig;
  content: NonNullable<PublicWebsite["content"]>;
  site: PublicWebsite;
  color: string;
  editMode: boolean;
  activeSection: string | null;
  onSectionClick?: (key: string) => void;
};
```
The factory returns `{ renderSection(key: string), renderSectionPair(keyA: string, keyB: string) }` — call `renderSection("story")` for any single
section, or `renderSectionPair("dress_code", "bridal_party")` for a linked
pair.

**Output.** JSX for one section (or `null` if that section has no content
and isn't in edit mode), or a paired-passage JSX tree.

**Consumers today.** `WeddingWebsite`, which builds the context once from
its own resolved `tc`/`content`/`site`/`editMode`/etc. and calls
`renderSection`/`renderSectionPair` once per entry in the couple's own
section order.

**Consumers planned (Phase 2).** The Collection Preview card's "one
full-width section" and "two half-width sections" — a *different
arrangement* of the exact same `renderSection` output (a compact grid
instead of the public page's simple vertical stack), never different
section-rendering logic. Per the standing rule: different presentation
sizes are acceptable, different visual logic is not.

## Gallery

**Responsibility.** Lays out a Photo Gallery section's photos according to
the couple's Photo Style — the seven distinct treatments (Editorial's
uniform grid, Magazine's hand-tuned overlapping collage, Scrapbook's
rotated-print scatter, Film's horizontal strip, Minimal/Modern/Luxury's
scale-pattern variations on Collection's own `galleryLayout`) plus every
per-image Photo Style token (frame, rotation, shadow, spacing, radius,
filter, scale).

**Inputs.** `GalleryGrid({ photos: string[]; tc: ThemeConfig })`.

**Output.** JSX for the complete photo arrangement — no outer section
chrome (header, width constraint, background band) included; `Section`
supplies that.

**Consumers today.** `Section`'s `"gallery"` case, inside `WeddingWebsite`.

**Consumers planned (Phase 2).** The Photo Style preview (replacing
`PhotoStyleMiniPreview`'s entirely independent, hand-rolled per-style
geometry — currently a second implementation of the same seven treatments,
already caught drifting from the real one in at least one case).

## Typography rendering

**Responsibility.** Loads the couple's chosen Google Fonts pairing into
`document.head` before any text in those fonts needs to render.

**Inputs.** `useThemeFonts(fontUrl: string | null)` — call with `tc.fontUrl`
from a resolved theme.

**Output.** No return value; a side-effecting hook.

**Known constraint, not yet solved (flagged for Phase 2).** The hook keys
off one shared `<link data-wevenu-font>` element in `document.head`. That's
correct for exactly one on-screen instance (true of every consumer today)
but not yet safe for several simultaneous instances each wanting a
different font at once — e.g. four Collection Preview cards on screen
together. Phase 2 needs a per-instance key before that scenario is safe;
deliberately not solved in Phase 1, which is architecture-only.

**Consumers today.** `WeddingWebsite`.

**Consumers planned (Phase 2).** Every preview that renders real heading/
body text: Collection Preview, Typography preview.

## Color resolution

**Responsibility.** The single merge chain from a couple's saved `site` row
into a flat `ThemeConfig` — Collection defaults, then `layout_config`
override, then Color Story tokens (curated or custom, with the couple's own
Primary/Secondary/Accent/Neutral/Background/Text raw columns taking final
precedence), then Typography override, then Photo Style override. This is
the one place "what does this couple's site actually look like right now"
gets decided.

**Inputs.** `resolveTheme(site: PublicWebsite): ThemeConfig`.

**Output.** A complete `ThemeConfig` — every field every other primitive
above reads (`headingFont`, `heroGradient`, `sectionRoles`, `photoFilter`,
all six color roles, etc.).

**Consumers today.** `WeddingWebsite` (computed once, passed to `Hero` and
into the `Section` context), the password gate.

**Consumers planned (Phase 2).** Every preview — Collection, Color Story,
Typography, and Photo Style previews should all call `resolveTheme(site)`
for the couple's real current state rather than re-deriving colors/fonts by
hand (as `CollectionMiniPreview`/`CollectionHeroChip` currently do).

## What Phase 1 deliberately did not touch

Per the specification: no redesign, no new layouts, no fixing of individual
Collection/Color Story weaknesses. The four existing hand-rolled preview
components (`CollectionMiniPreview`, `CollectionHeroChip`,
`PhotoStyleMiniPreview`, the six-band Color Story swatch) are untouched and
still work exactly as before — confirmed by inspection, not by an accident
of scope: `components/portal/collection-preview.tsx` imports nothing from
`wedding-website.tsx`, only from `composition-primitives.tsx`, so nothing in
this phase could have reached it. Phase 2 is where those four get deleted
and rebuilt on the primitives documented above.

---

# Phase 2 — Every preview rebuilt on the primitives

Hosted Experience Visual Release Specification v1.0, Phase 2 (2026-08-07).

All four preview surfaces are now thin layout wrappers in
`components/portal/collection-preview.tsx`. None of them decide hero
layout, section composition, gallery arrangement, font loading, or color
resolution — every one of those decisions is delegated to the Phase 1
primitives. New supporting code: `lib/wedding-website/preview-site.ts`
(`buildPreviewSite`, turns a catalog row into the candidate `PublicWebsite`
the primitives expect) and a `ScaledThumbnail` helper (renders at a
page-realistic width, then shrinks the whole result with a CSS transform —
see below for why that was necessary).

## Duplication tables

### `CollectionMiniPreview` + `CollectionHeroChip` → `CollectionPreview`

| | |
|---|---|
| **Current duplication** | Hero layout (three archetypes: invitation/split/full-bleed), gradient formula, typography, overlay/scrim, spacing — hand-reimplemented independently in *two* components for the same job (compare vs. show-current) |
| **Replaced by** | `Hero` + `createSectionRenderer` + `resolveTheme` |
| **Result** | Zero duplicated rendering logic. Bug found in the process: `CollectionHeroChip`'s hand-rolled gradient formula omitted `resolveTheme`'s real middle color stop — the OLD preview was already visibly wrong versus the live site. Can't recur now; there's only one formula. |

### `PhotoStyleMiniPreview` → `PhotoStylePreview`

| | |
|---|---|
| **Current duplication** | A second, independent geometry system for the same seven treatments (`arrangement`/`scalePattern`/`frameStyle` axes) `GalleryGrid` already implements for the real Photo Gallery section — same conceptual axes, different pixel math |
| **Replaced by** | `GalleryGrid` |
| **Result** | Zero duplicated rendering logic. The "Modern" style's preview now legitimately shows one photo on row 1 (its `alternating` scale pattern pushes the next item to row 2) — the old preview faked a simpler, always-fully-populated 3-photo layout that never matched what a couple's real Gallery section would do. |

### Inline six-band bar (website-editor.tsx + website-studio.tsx) → `ColorStoryPreview`

| | |
|---|---|
| **Current duplication** | The same `deriveSixRoles(tokens).map(...)` JSX, hand-written in two files |
| **Replaced by** | `resolveTheme` (reads `tc.primary/secondary/accent/border/bg/text` — the same six values the real page resolves) |
| **Result** | Zero duplicated rendering logic. `deriveSixRoles` itself isn't a second color system — it's the one place a story's tokens become six roles, feeding `resolveTheme` the same raw-hex shape a real "apply this story" save already writes (see `preview-site.ts`'s doc comment). |

### Inline typography sample (website-editor.tsx ×2 + website-studio.tsx) → `TypographyPreview`

| | |
|---|---|
| **Current duplication** | The same "name in headingFont / tagline in bodyFont" JSX in three places, none of them guaranteeing the font was actually loaded (each relied on some *other* on-screen instance having already requested the same stylesheet) |
| **Replaced by** | `useThemeFonts` + real `tokens.headingFont`/`bodyFont` |
| **Result** | Zero duplicated rendering logic, and a real bug fixed: font loading is now guaranteed rather than incidental. Required upgrading `useThemeFonts` itself (still one function, now reference-counted by URL) so a grid of 8 cards each wanting a different font can all call it safely at once — the original singleton `data-wevenu-font` link would have had them overwrite each other. |

## A harder problem than expected: miniature scale

Wiring `Hero` into an 80×56px swatch initially rendered blank. Root causes,
in the order they were found and fixed:

1. `tc.heroMinHeight` is a `vh` value (viewport-relative) — inside a tiny
   swatch this asks for a hero 700px+ tall. Fixed by threading an explicit
   pixel override through `CollectionPreview`.
2. The wrapper needs `@container/wedding` (`container-type: inline-size`,
   for the primitives' own `cqw`/`@min-[Npx]/wedding:` sizing) — but inline-
   size containment leaves the container's own block size indefinite, so
   `height: 100%` on any descendant silently fails to resolve. The real
   public page sidesteps this with an absolute `minHeight: "100vh"` instead
   of a percentage; the miniature needed the pixel equivalent.
3. Even with both fixed, Hero's `rem`-based padding (`py-20` = 5rem top and
   bottom) and `clamp()` font-size floors (2.5–3rem minimums) don't shrink
   for a small container — they're sized for a realistic page width, where
   that padding reads as intentional. No CSS property tweak fixes this: the
   content is simply taller than the box. The standard technique for "a
   thumbnail of a fixed-size layout" is `ScaledThumbnail` — render at a
   width the layout actually expects (320px default), then shrink the whole
   result with a CSS `transform: scale()`. Padding, type, and spacing all
   shrink together, instead of being renegotiated piecemeal.

None of this changed how `Hero`/`Section`/`GalleryGrid` render — only how
a preview sizes the box it puts them in, which is exactly the "layout
only" boundary this phase was scoped to.

## Regression evidence

**Single-change-propagation test** (the phase's actual success bar — proof
there is one rendering system, not four that happen to agree today):
changed each dimension once via direct save, screenshotted Live Preview and
the Studio sidebar together, confirmed every surface that shows that
dimension updated and every surface that doesn't stayed untouched:

- **Typography** Elegant → Luxury: Live Preview's hero, the Typography
  swatch, *and* the Layout Collection swatch (which also renders Hero text
  in the couple's typography) all switched to Bodoni Moda in one screenshot
  — three surfaces, zero preview-specific code touched. Color Story and
  Photo Style swatches unchanged.
- **Collection** Garden Party → Velvet: Live Preview and the Collection
  swatch both switched to Velvet's left-aligned editorial hero. Typography
  stayed "Luxury" — confirms Collection changes never silently touch
  Typography.
- **Color Story** Meadow → Terracotta: swatch and resolved roles updated;
  Collection and Typography unchanged.
- **Photo Style** Modern → Scrapbook: swatch updated to real rotated-print
  layout; the other three unchanged.

All four runs: zero console/page errors.

**Public website pixel-identical**: re-ran the same 5-Collection ×
2-viewport byte-diff from Phase 1 against the *original* pre-refactor
baseline. 9 of 10 byte-identical; the 10th (Garden Party desktop) is the
same network-image-loading timing artifact identified and proven harmless
in Phase 1 (two fresh re-captures with a full image-decode wait are
byte-identical to each other and to the passing capture).

**Full visual sweep, zero errors**: Studio's 4 compact swatches, all 4
expanded picker grids (10 Collections / 12 curated Color Stories / 8
Typography / 7 Photo Styles), and all 8 Wizard steps — every one rebuilt on
the primitives, screenshotted, zero console/page errors in every run.

**Clean TypeScript** across the full repo throughout.

## Known, disclosed simplifications

- The compact 80×56px Collection swatch shows a genuinely cropped view of
  Hero's content (its extreme wide/short aspect ratio can't fit the full
  eyebrow/name/date stack without clipping at any natural width) — a real
  constraint of that aspect ratio, not an architecture gap. The Wizard's
  taller comparison-grid card has enough room and shows it in full.
- `ScaledThumbnail`'s target pixel dimensions are supplied by the caller
  (matching each context's actual CSS box: 80×56 swatch, 226×283 wizard
  card, etc.) rather than measured via `ResizeObserver` — accurate for
  today's fixed-size contexts; a genuinely fluid-width container would need
  the measured version.
- The 10-card Collection *comparison* grid's own small preview swatch
  (`collectionSwatch()`, a flat two-stop gradient) and the Color Story
  quick-start circles (`swatchGradient()`) were left as-is — decorative
  color chips, not hero reimplementations, and out of this phase's four
  named components.
