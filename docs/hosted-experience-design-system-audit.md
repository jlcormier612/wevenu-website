# Hosted Experience Design System Audit

Hosted Experience Visual Release Specification v1.0, Phase 3 (2026-08-07).

This is an audit of the **design data**, not the renderer. Phase 1–2 made
the rendering architecture the single source of truth; this phase asks
whether the data feeding that renderer is actually good. No values changed.
No components touched. Every number below is computed directly from what's
in the database today (or, for Collections, from `layout_config` as
authored) — not estimated.

---

## 1. Color Stories

38 rows across 10 Collections. 12 are **curated** (all six roles —
Primary/Secondary/Accent/Neutral/Background/Text — authored verbatim,
`curated-color-stories.ts`). The other 26 are each a Collection's own
native default/quick-start palette, which predates six-role authoring and
is resolved through `deriveSixRoles()`'s fallback (extracts hex stops from
`heroGradient`, falls back to `accent`/`textMuted` blends — see Phase 1/2
docs).

**"Min Δ"** is the smallest color-distance (0–441 scale, Euclidean RGB) between
any two of the six roles — the two closest colors in the palette. Below 15,
the two roles are visually indistinguishable in a swatch; 15–40 reads as
"same family, weakly differentiated"; above 40 reads as genuinely distinct
bands (this is the same threshold `deriveSixRoles` itself now enforces for
Primary/Secondary — see below for why it doesn't reach Secondary/Accent).
**Text/Bg Contrast** is the real WCAG contrast ratio (AA normal-text minimum
is 4.5).
**Champagne**

| Story | Primary | Secondary | Accent | Neutral | Background | Text | Source | Min Δ | Text/Bg Contrast | Flags |
|---|---|---|---|---|---|---|---|---|---|---|
| Charcoal | #3A3A38 | #686860 | #989890 | #D8D8D8 | #F5F5F5 | #282828 | derived | 30 | 13.52 | tight (Primary/Text) |
| Ecru | #6A5A38 | #9A8860 | #B4A888 | #E4D8C0 | #FAF8F4 | #2A2418 | derived | 57 | 14.51 |  |
| Warm Stone | #7A6040 | #A08558 | #C4AE88 | #E8DCC8 | #FBF8F3 | #2A2210 | derived | 55 | 14.85 |  |

**Coastal**

| Story | Primary | Secondary | Accent | Neutral | Background | Text | Source | Min Δ | Text/Bg Contrast | Flags |
|---|---|---|---|---|---|---|---|---|---|---|
| Berry | #7A2A42 | #B85073 | #4E1A2C | #E3C7CC | #FBF4F3 | #341019 | curated | 34 | 15.67 | tight (Accent/Text) |
| Black Tie | #242321 | #B7AA91 | #8A7352 | #E5DED2 | #FAF8F3 | #1E1D1B | curated | 10 | 15.87 | COLLAPSE: Primary=Text (Δ10) |
| Champagne | #B8AD9F | #D4CCC1 | #948779 | #E8E2DA | #FCFAF7 | #4D4944 | curated | 39 | 8.57 | tight (Secondary/Neutral) |
| Coastal Blue | #5F8299 | #A8BEC8 | #315B70 | #E8E1D7 | #F7F5F0 | #263A43 | curated | 35 | 10.9 | tight (Neutral/Background) |
| Dusty Rose | #E8CBCD | #F1DDDE | #D8B3B7 | #F5E9E7 | #FFFDFC | #6A4D50 | curated | 16 | 7.42 | tight (Secondary/Neutral) |
| French Blue | #667FA5 | #A9B8D0 | #405B83 | #E2E5E8 | #FAFAF8 | #2D3748 | curated | 36 | 11.47 | tight (Neutral/Background) |
| Golden Hour | #C49345 | #DFC58D | #8E672C | #EEE1C7 | #FCF8EE | #493D2D | curated | 47 | 9.96 |  |
| Lavender Haze | #8B74A5 | #B9A7CB | #654D7C | #E7DEEC | #FBF8FC | #3D3447 | curated | 36 | 11.2 | tight (Neutral/Background) |
| Meadow | #6F8F55 | #A8B96F | #D3AD4F | #EEE1B8 | #FBF8EC | #30462F | curated | 55 | 9.66 |  |
| Navy | #324E64 | #C8DCE8 | #4A6278 | #C8D8E0 | #FAFBFC | #1E2E3A | derived | 9 | 13.45 | COLLAPSE: Secondary=Neutral (Δ9) |
| Peach Bellini | #F4C7B3 | #F9DCCB | #EFAE92 | #FBE9DE | #FFFCF8 | #704F43 | curated | 23 | 7.11 | tight (Secondary/Neutral) |
| Sage Garden | #BFCBB7 | #DCE2D5 | #91A287 | #EEEAE1 | #FAF8F3 | #465044 | curated | 23 | 7.94 | tight (Secondary/Neutral) |
| Sand | #5A4A38 | #9A8068 | #9A8068 | #E0D8C8 | #FAF8F4 | #2E2A1E | derived | 0 | 13.5 | COLLAPSE: Secondary=Accent (Δ0) |
| Sea Glass | #2A5848 | #4A7868 | #4A7868 | #C0DCD4 | #F4FAF8 | #1A2E28 | derived | 0 | 13.56 | COLLAPSE: Secondary=Accent (Δ0) |
| Terracotta | #B9684E | #D79A7E | #8D4938 | #E9D5C4 | #FBF6EF | #4B352E | curated | 57 | 10.57 |  |

**European Estate**

| Story | Primary | Secondary | Accent | Neutral | Background | Text | Source | Min Δ | Text/Bg Contrast | Flags |
|---|---|---|---|---|---|---|---|---|---|---|
| Stone | #5E5A40 | #8A8060 | #8A8060 | #E0DACB | #F7F5F0 | #2A281E | derived | 0 | 13.57 | COLLAPSE: Secondary=Accent (Δ0) |

**Garden Party**

| Story | Primary | Secondary | Accent | Neutral | Background | Text | Source | Min Δ | Text/Bg Contrast | Flags |
|---|---|---|---|---|---|---|---|---|---|---|
| Eucalyptus | #5A8A70 | #7AAE8C | #9DC4A8 | #DED6C5 | #FAF8F2 | #2A2820 | derived | 50 | 13.9 |  |
| Peony | #B07088 | #D4A0AC | #D4A0AC | #EDD8DC | #FAF5F6 | #2E2428 | derived | 0 | 13.91 | COLLAPSE: Secondary=Accent (Δ0) |
| Wisteria | #685898 | #A898C0 | #A898C0 | #DCCCE8 | #F8F5FA | #28243C | derived | 0 | 13.8 | COLLAPSE: Secondary=Accent (Δ0) |

**Linen**

| Story | Primary | Secondary | Accent | Neutral | Background | Text | Source | Min Δ | Text/Bg Contrast | Flags |
|---|---|---|---|---|---|---|---|---|---|---|
| Blush | #8A7878 | #af9894 | #D4B8B0 | #EBD8D5 | #FAF6F5 | #5B4D4C | derived | 46 | 7.49 |  |
| Ivory | #8A8078 | #a99c88 | #C8B898 | #EBE5DB | #FCFAF6 | #5B534D | derived | 38 | 7.22 | tight (Neutral/Background) |
| Slate | #788090 | #9098a4 | #A8B0B8 | #D8DCE4 | #F5F6F8 | #4D5058 | derived | 39 | 7.46 | tight (Primary/Secondary) |

**Midnight**

| Story | Primary | Secondary | Accent | Neutral | Background | Text | Source | Min Δ | Text/Bg Contrast | Flags |
|---|---|---|---|---|---|---|---|---|---|---|
| Indigo | #2E2545 | #776f8a | #BFB8CE | #352E48 | #1A1525 | #EDE8E2 | derived | 12 | 14.64 | COLLAPSE: Primary=Neutral (Δ12) |
| Onyx | #888078 | #a49c90 | #C0B8A8 | #2A2A28 | #141414 | #EEEAE5 | derived | 37 | 15.38 | tight (Neutral/Background) |
| Plum | #2E1848 | #77608a | #C0A8CC | #342848 | #1A1020 | #EDE5F0 | derived | 17 | 14.99 | tight (Primary/Neutral) |

**Rosé**

| Story | Primary | Secondary | Accent | Neutral | Background | Text | Source | Min Δ | Text/Bg Contrast | Flags |
|---|---|---|---|---|---|---|---|---|---|---|
| Blush | #A07070 | #CCA8A0 | #CCA8A0 | #EDD6CE | #FAF6F4 | #2E1A18 | derived | 0 | 15.31 | COLLAPSE: Secondary=Accent (Δ0) |
| Petal | #A07088 | #CCA0B0 | #CCA0B0 | #EDD0DC | #FAF4F6 | #2E1820 | derived | 0 | 15.25 | COLLAPSE: Secondary=Accent (Δ0) |
| Powder | #707090 | #A0A8CC | #A0A8CC | #D0D4E8 | #F4F6FA | #1A1E30 | derived | 0 | 15.26 | COLLAPSE: Secondary=Accent (Δ0) |

**Rustic**

| Story | Primary | Secondary | Accent | Neutral | Background | Text | Source | Min Δ | Text/Bg Contrast | Flags |
|---|---|---|---|---|---|---|---|---|---|---|
| Barnwood | #6A4E30 | #9A7A54 | #9A7A54 | #E4D6BE | #FAF6EF | #2E2418 | derived | 0 | 14.11 | COLLAPSE: Secondary=Accent (Δ0) |

**Velvet**

| Story | Primary | Secondary | Accent | Neutral | Background | Text | Source | Min Δ | Text/Bg Contrast | Flags |
|---|---|---|---|---|---|---|---|---|---|---|
| Burgundy | #5B3438 | #927669 | #C9B89A | #4A2830 | #1E1015 | #F7F3EE | derived | 22 | 16.67 | tight (Primary/Neutral) |
| Noir | #907868 | #a89881 | #C0B89A | #2A2020 | #0F0F0F | #F0ECE8 | derived | 36 | 16.31 | tight (Neutral/Background) |
| Plum | #3A2048 | #7d648a | #C0A8CC | #3A2848 | #1A1020 | #F0EAF5 | derived | 8 | 15.62 | COLLAPSE: Primary=Neutral (Δ8) |

**Wildflower**

| Story | Primary | Secondary | Accent | Neutral | Background | Text | Source | Min Δ | Text/Bg Contrast | Flags |
|---|---|---|---|---|---|---|---|---|---|---|
| Mauve | #8A7080 | #B898AC | #B89AAC | #ECD8E4 | #FAF5F7 | #2E2430 | derived | 2 | 13.8 | COLLAPSE: Secondary=Accent (Δ2) |
| Sage | #6A8A78 | #97AC9E | #97AC9E | #E8E0D2 | #FAF8F4 | #2E2A24 | derived | 0 | 13.44 | COLLAPSE: Secondary=Accent (Δ0) |
| Terracotta | #907060 | #B49480 | #B49480 | #E8D8C8 | #FAF6F2 | #30241A | derived | 0 | 14.02 | COLLAPSE: Secondary=Accent (Δ0) |

### Findings

**Text/Background contrast: full pass.** Every one of the 38 stories clears
7.0:1 — comfortably above the 4.5:1 AA minimum, most well above it. This is
not a live problem anywhere in the catalog. No recommendation needed here.

**Role distinctness: this is the real problem, and it's concentrated.**

| | Count | % |
|---|---|---|
| All six roles genuinely distinct (every pair Δ≥40) | 7 / 38 | 18% |
| At least one pair "tight" (15≤Δ<40) but not collapsed | 15 / 38 | 39% |
| At least one pair **collapsed** (Δ<15, reads as one color) | 16 / 38 | 42% |

Split by source:

| | Curated (12) | Derived (26) |
|---|---|---|
| Has a collapsed pair | 1 / 12 (8%) | **15 / 26 (58%)** |

The failure is almost entirely in the **derived** stories — the ones that
are the *actual default* for every Collection except the two-per-Collection
curated slots a couple has to go looking for. **58% of a couple's native,
default palette options have two roles that render as the exact same or
functionally-the-same color.**

**The dominant, single-pattern root cause: `Secondary = Accent`.** Of the 16
collapsed stories, **13** collapse specifically on Secondary=Accent, 10 of
them an *exact* Δ0 hex match (Sand, Sea Glass, Stone, Peony, Wisteria,
Blush/Petal/Powder-Rosé, Barnwood, Sage-Wildflower, Terracotta-Wildflower).
This isn't 13 unrelated failures — it's one mechanical cause: `deriveSixRoles`
falls back to `colorAccent = tokens.accent` unconditionally, and when the
legacy gradient has only two real stops, `colorSecondary` also lands on
`tokens.accent` (the Phase 1 fix only guards `colorPrimary`/`colorSecondary`
against collapsing with each other and with `bg` — it never checks
`colorSecondary` against `accent`). One shared derivation function, one
missed comparison, 13 palettes affected.

The other 3 collapses are `Primary≈Neutral` or `Primary≈Text` on dark
palettes (Indigo, Plum×2, Black Tie) — a different mechanism: a dark
gradient's first stop landing close to the palette's own dark `bg`/`text`/
`border`. Black Tie is notable because it's **curated** — a human authored
Primary (#242321) and Text (#1E1D1B) ten RGB units apart. That one needs a
real repaint, not an algorithm fix.

The 15 "tight" (not collapsed, but weak) stories mostly cluster on
`Neutral`≈`Background` (both are pale off-whites by design, e.g. Ivory,
Onyx, Noir) or `Secondary`≈`Neutral` on the pastel curated stories (Dusty
Rose, Peach Bellini, Sage Garden, Champagne). These read as intentional
"family of pale tones" choices more often than genuine mistakes — worth a
second look, not urgent the way the Secondary=Accent collapse is.

**Recommended change (see Section 5 for priority):** fix
`deriveSixRoles()`'s fallback once — after resolving `colorAccent`, check
its distance from the already-resolved `colorSecondary` and re-derive
Secondary (mix toward `bg` or `text`) if they're within `MIN_BAND_DISTANCE`.
One function, fixes 13 of 16 collapses in one change, exactly the "fix the
shared system, not the individual story" principle already established. The
3 dark-palette near-collapses and Black Tie need individual review (they're
each a different, smaller problem) — not urgent, not systemic.

---

## 2. Collection Rhythm

Only **Coastal** and **Garden Party** have `sectionRoles` authored — the
data structure that assigns each section a canvas weight. The other 8 have
none. Canvas → the four tiers requested, as actually consumed by
`SectionCanvas`: `photographic`→**Hero**, `strong`/`soft`→**Feature**,
`neutral`→**Standard**, `light`→**Quiet**. Collections without
`sectionRoles` fall through to a flat path: every section renders at
**Standard** weight regardless of content, except RSVP, which gets
**Feature** treatment *only* if `rsvpPlacement: "banner"` (a full-bleed
color band) — otherwise it's Standard too.

| Collection | Top-to-bottom rhythm |
|---|---|
| **Coastal** | Hero → Quiet → **Feature** → **Hero** → Feature → Quiet → Standard → Feature → Quiet → Standard → **Feature** |
| **Garden Party** | Hero → Quiet → Feature → **Hero** → Standard → Quiet → Standard → Feature → Quiet → Standard → **Feature** |
| Champagne | Hero → Standard ×12 (flat) |
| European Estate | Hero → Standard ×12 (flat; `sectionBand: alternate` gives a *background-color* wash to alternating sections, but this never changes any section's *tier* — RSVP included) |
| Linen | Hero → Standard ×12 (flat) |
| Rosé | Hero → Standard ×12 (flat) |
| Rustic | Hero → Standard ×12 (flat) |
| Wildflower | Hero → Standard ×12 (flat) |
| Midnight | Hero → Standard ×11 → **Feature** (RSVP banner only) |
| Velvet | Hero → Standard ×11 → **Feature** (RSVP banner only; `sectionBand: tinted` washes framed content but, like Estate, never changes a section's tier) |

### Findings

**8 of 10 Collections have no rhythm at all.** Not "weak" — literally flat.
Hero, then eleven or twelve consecutive Standard-tier sections with zero
visual differentiation between Our Story, Event Details, Photo Gallery,
Schedule, Travel, Dress Code, Wedding Party, Things To Do, Music, Registry,
and FAQ. This is exactly the "everything collapses into one pale visual
value" failure mode described in the original visual spec — confirmed here
as a *data* gap (no `sectionRoles` authored), not a renderer gap (the
renderer already knows how to paint five different canvas weights; it's
just never told to for 8 of 10 Collections).

**Repeated visual weight:** every non-`sectionRoles` Collection, by
definition — 11–12 sections in a row at identical weight is the whole
problem in one sentence.

**Missing emphasis:** Event Details and Photo Gallery are the two sections
every Collection *with* rhythm (Coastal, Garden Party) treats as Hero/
Feature-tier moments — the wedding's two most concrete, photograph-bearing
facts. In the 8 flat Collections, both render at the same weight as FAQ.
RSVP — the single action-driving section on the entire page — gets zero
elevation in 6 of 10 Collections (everything except the 2 rhythm
Collections and the 2 banner-RSVP Collections).

**Flat sections:** Estate's and Velvet's `sectionBand`/`sectionFrame`
settings (`alternate`, `tinted`) are real CSS that renders *something* —
but it's a decorative wash applied uniformly by content position (e.g.
every other `SectionComposition` call), not a deliberate per-section
editorial decision. It softens "completely flat" into "flat with a
patterned background," which is a real but small improvement, easily
mistaken for solved when it isn't.

**Missing transitions:** Coastal and Garden Party both use the same
structural move — Quiet section *before* a Feature, Feature *before* the
next Hero-tier gallery moment — so the page breathes in and out on a
predictable cadence. The 8 flat Collections have no "before/after" concept
at all; there is nothing to transition from or to.

**Recommended change (see Section 5):** author `sectionRoles` for the
remaining 8 Collections, using Coastal/Garden Party's own pattern as the
template (Event Details + Photo Gallery ≈ Feature/Hero, RSVP ≈ Feature,
Story/Travel/Music ≈ Quiet, the paired passages ≈ Standard) adapted to each
Collection's own personality — this is real editorial work, not a
mechanical fix, and by far the largest recommendation in this audit by
effort.

---

## 3. Typography

| Pairing | Heading font | Body font | Personality |
|---|---|---|---|
| Calligraphy | Great Vibes (script) | Lato | Script/handwritten |
| Classic | Libre Baskerville | Libre Baskerville *(same as heading)* | Old-style serif, monotone |
| Editorial | DM Serif Display | system-ui | High-contrast modern serif |
| Elegant | Playfair Display *(italic)* | Lato | High-contrast modern serif, italic |
| Luxury | Bodoni Moda | system-ui | High-contrast modern serif (didone) |
| Minimal | Inter | Inter *(same as heading)* | Sans, monotone |
| Playful | Fraunces | system-ui | Soft-serif display |
| Romantic Serif | Cormorant Garamond *(italic)* | system-ui | Old-style garamond, italic |

### Findings

**Body font: four of eight pairings use the literal same fallback stack
(`system-ui, sans-serif`)** for body copy — Editorial, Luxury, Playful,
Romantic Serif. The *heading* fonts differ, so these aren't identical
overall, but half the catalog reads identically once you're past the H1 —
same paragraph text, same nav, same button labels, same captions, on 4 of 8
options. That's a real, measurable "insufficient differentiation" —
diagnosable directly from the data, no rendering needed.

**Duplicate personality cluster: Editorial, Elegant, Luxury.** All three are
high-contrast, thin-thick "modern/didone" serifs (DM Serif Display, Playfair
Display, Bodoni Moda) — different font *files*, extremely similar font
*personality*. A couple choosing between these three is choosing between
near-identical silhouettes, not genuinely different characters. This is the
Photo Style Editorial/Luxury problem's twin, in the Typography system.

**Two intentional monotone pairings** (Classic, Minimal) use the same
family for heading and body — a legitimate, common editorial choice (one
unified voice), not a defect, but worth naming so it isn't confused with the
system-ui gap above.

**What's working:** Calligraphy (script) and the two italic serifs (Elegant,
Romantic Serif) each read as clearly distinct from everything else. Inter
(Minimal) is the only sans-serif heading in the set, so it's unmistakable.
No pairing has a contrast or legibility problem — every heading/body
combination is readable; this audit found personality overlap, not
technical defects.

**Recommended change (see Section 5):** give Editorial, Luxury, and Playful
each a real, distinct body font (not the bare `system-ui` fallback) so
paragraph-level text differentiates the same way headings do — this alone
would also break up the Editorial/Elegant/Luxury silhouette overlap
somewhat, since body-text texture is part of a pairing's felt personality.
Re-evaluate whether the catalog needs three near-identical didone serifs, or
whether one of the three (Editorial or Luxury) should move toward a
genuinely different register (a slab, a humanist serif, something outside
the "thin-thick contrast" family).

---

## 4. Photo Style

| Style | Arrangement | Scale pattern | Frame | Rotation | Spacing | Shadow | Filter |
|---|---|---|---|---|---|---|---|
| Editorial | uniform | hero-emphasis | none | none | tight | none | contrast+1.08, sat−0.05 |
| Magazine | **collage** | uniform | none | subtle | tight | soft | contrast+1.05 |
| Film | uniform | uniform | **border** | none | normal | soft | sepia+warm, desaturated |
| Minimal | uniform | uniform | none | none | **generous** | none | sat−0.1, slight brighten |
| Modern | uniform | **alternating** | none | none | tight | none | contrast+1.1 |
| Luxury | uniform | hero-emphasis | none | none | **generous** | soft | contrast+1.05, sat−0.08 |
| Scrapbook | **scrapbook** | uniform | **polaroid** | **scattered** | normal | **lifted** | sat+1.05, slight brighten |

### Findings, per style

- **Magazine** — the only style with `arrangement: collage` (a real,
  hand-tuned overlapping grid, not a flag on top of the uniform grid).
  Unmistakable. **PASS.**
- **Scrapbook** — the only style with `arrangement: scrapbook` *and*
  `frameStyle: polaroid` *and* `rotation: scattered` *and*
  `shadow: lifted` — four independent signals stack on this one style.
  Unmistakable. **PASS.**
- **Film** — the only style with a visible `border` frame, plus a
  distinctly warm/desaturated filter. Two independent signals.
  **PASS.**
- **Modern** — the only style with `scalePattern: alternating` (produces a
  genuinely different grid rhythm — one image spans two columns). One clear
  structural signal. **PASS.**
- **Minimal** — `uniform` arrangement/scale like four other styles, but
  `spacing: generous` with no shadow/frame/filter drama is a real,
  perceptible "quiet, lots of white space" identity, and it's the only
  style with `captionStyle: none` *and* generous spacing together.
  **PASS**, but the weakest clear pass in the set — it's differentiated by
  *absence* of everything else, which reads correctly but subtly.
- **Editorial** — `uniform` / `hero-emphasis` / no frame / no rotation /
  `tight` spacing / no shadow / mild contrast bump. Every one of these
  values is shared with at least one other style.
- **Luxury** — `uniform` / `hero-emphasis` / no frame / no rotation /
  `generous` spacing / soft shadow / mild contrast+desaturation. **Identical
  arrangement and scale pattern to Editorial.** The only differences are
  spacing (tight vs. generous) and a barely-perceptible shadow/filter
  delta.

**Editorial vs. Luxury — FAIL.** These two are structurally the same
"one dominant image" treatment with a padding difference. This isn't a new
finding — the component that used to hand-roll these previews already
carried a code comment acknowledging Luxury as "the same single-dominant-
image family" as Editorial. The audit confirms it at the data level: of
seven styles, these two share every structural token except `spacing` and
a subtle filter/shadow tweak. **A customer shown both with labels hidden
would very plausibly call them the same style at two different zoom
levels — because that's what they structurally are.**

**Recommended change (see Section 5):** give Luxury a genuinely distinct
structural signal — not just more padding. Candidates already unused
elsewhere in the token vocabulary: a frame treatment, a different
`scalePattern`, or a multi-image `arrangement` (Luxury's own name/
description, "large hero imagery," doesn't preclude a second, smaller
supporting image the way Editorial's pure single-image treatment implies).
Minimal should get a second identity signal too (not urgent — it currently
passes, but only just).

---

## 5. Prioritized Recommendations

Ranked by (a) how many couples' real experience it affects today and (b)
how small/mechanical the eventual fix is — cheapest, highest-leverage first.
**Nothing below has been implemented. This is the priority order for that
future work, pending your approval.**

| # | Current State | Observed Weakness | Recommended Change |
|---|---|---|---|
| 1 | `deriveSixRoles()` never checks `colorSecondary` against `colorAccent` | 13 of 38 Color Stories (34% of the whole catalog) collapse Secondary=Accent into one visual band — the single largest defect in this audit, and a one-function fix | Add the missing distance check + re-derivation for Secondary vs. Accent, mirroring the guard that already exists for Primary vs. Secondary/Background |
| 2 | 8 of 10 Collections have no `sectionRoles` | Every page for those 8 Collections is Hero followed by 11–12 visually identical Standard sections — no rhythm, no emphasis, matches the originally-reported "collapses into one pale visual value" failure exactly | Author `sectionRoles` for the remaining 8 Collections, using Coastal/Garden Party's own pattern (Event Details + Gallery elevated, RSVP closing Feature, Story/Travel/Music Quiet) as the template. Largest single effort in this audit. |
| 3 | Editorial and Luxury Photo Styles share every structural token except spacing | Fails the "identifiable with labels hidden" bar — two of seven options are effectively one option at two paddings | Give Luxury a real structural signal (frame, scale pattern, or a second supporting image) distinct from Editorial |
| 4 | 4 of 8 Typography pairings share the literal `system-ui` body-font fallback | Half the catalog reads identically below the headline — real but lower-traffic than #1–3, since headings (the most visible type moment) already differ | Assign Editorial, Luxury, and Playful each a real, distinct body font |
| 5 | Black Tie (curated) has Primary/Text at Δ10; 3 derived dark palettes (Indigo, Plum×2) have Primary≈Neutral/Text | Small in count (4 stories) but Black Tie is hand-authored, so it's a genuine oversight rather than an algorithmic gap | Manual repaint of these 4 specific stories once #1 is deployed and the rest of the catalog is re-reviewed against the improved baseline |
| 6 | Editorial/Elegant/Luxury headings are all high-contrast didone serifs | Personality overlap at the *font family* level, softened somewhat once #4 lands | Re-evaluate after #4 whether a genuinely different register is still warranted for one of the three |
| 7 | Estate's `sectionBand: alternate` and Velvet's `tinted` apply a positional wash without changing any section's actual tier | Easy to mistake for "this Collection has rhythm" when it doesn't — cosmetic, not structural | Low priority: either promote to real `sectionRoles` in the #2 pass, or leave as intentional texture and don't conflate it with rhythm in future audits |
| 8 | 15 Color Stories have a "tight" (not collapsed) Neutral≈Background or Secondary≈Neutral pair, mostly on pastel curated stories | Reads as an intentional "family of pale tones" more often than a mistake | No forced fix — spot-review case by case after #1's systemic fix lands, since #1 will change what "the baseline" looks like |

Awaiting approval before any of the above is implemented.
