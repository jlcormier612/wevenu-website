# Wedding Website — Phase 4A: Collection Rhythm

**Date:** 2026-08-07
**Scope:** All 10 Collections. Two defect corrections in the shared renderer (Story canvas/presentation coupling; RSVP banner contrast on dark Color Stories); one data-authoring pass (8 Collections' `sectionRoles`).
**Status:** Implementation complete, technically verified. **HUMAN VISUAL ACCEPTANCE: PENDING.**

---

## 0. The mandate

Per the Phase 3 design system audit, 8 of 10 Collections (Champagne, European Estate, Linen, Midnight, Rosé, Rustic, Velvet, Wildflower) had no authored `sectionRoles` — the field that drives the page's visual pacing (`SectionCanvas`'s Hero/Quiet/Standard/Feature weighting). Only Coastal and Garden Party had rhythm. Every other website rendered as a flat, unpaced page regardless of Color Story.

The mandate was narrow and explicit: author `sectionRoles` data for the remaining 8 Collections using the existing architecture. Do not change components. Do not touch `deriveSixRoles()`. Every Collection must alternate Hero → Quiet → Standard → Feature → Quiet → Standard → Feature → Quiet → RSVP; the exact sections may differ per Collection, the rhythm may not.

## 1. A defect found before authoring began

Before writing data, I traced what would actually happen to Linen and Rosé — the two Collections with a distinct `storyStyle` (`minimal` and `quote` respectively) — once they gained `sectionRoles`. The Story section's renderer branched on `tc.sectionRoles` truthiness *alone* to choose between the generic `EditorialOpening` primitive and the Collection's own `storyStyle`-driven treatment. Any Collection gaining `sectionRoles` for rhythm would silently lose its distinct story presentation — Linen's quiet paragraph and Rosé's pull-quote would both be replaced by the same generic eyebrow+heading/photo grid every other Collection uses.

This was flagged before implementing rather than worked around. The correction: canvas (background weight, from `sectionRoles`) and story presentation (from the Collection's own `storyStyle`) are orthogonal concerns that the old branch conflated. Fixed in `components/wedding-website/wedding-website.tsx`'s Story case — `storyStyle` is now checked first, unconditionally, for every Collection; `EditorialOpening` is only ever the `sectionRoles`-enabled *upgrade* for Collections whose story was already a generic paragraph (`prose`/`editorial`), never a replacement for a genuinely distinct treatment. `SectionCanvas`'s wrapping is unaffected either way — it always resolves from `sectionRoles.story` regardless of which presentation renders inside it.

Verified zero regression: byte-identical screenshots for Coastal, Garden Party, and Linen before and after this change (the three Collections then exercising either branch).

## 2. The authored data

`supabase/migrations/20261200000000_wedding_website_collection_rhythm.sql` — one `sectionRoles` object, applied verbatim (same canvas/scale per section key) to `champagne`, `estate`, `minimal`, `modern`, `romance`, `rustic`, `velvet`, `classic`. This is Garden Party's own already-shipped, already-approved `sectionRoles`, copied exactly — not a new pattern:

| Section | Scale | Canvas |
|---|---|---|
| Hero | feature | photographic |
| Story | standard | light |
| Event Details | feature | soft |
| Gallery | feature | photographic |
| Schedule | standard | neutral |
| Travel | standard | light |
| Dress Code ↔ Wedding Party (paired) | interlude | neutral / light |
| Things To Do | interlude | soft |
| Music | interlude | light |
| Registry ↔ FAQ (paired) | interlude | neutral / neutral |
| RSVP | feature | strong |

Merged via jsonb `||`, so no other existing `layout_config` field (`storyStyle`, `sectionFrame`, `divider`, `headerStyle`, `sectionComposition`, etc.) was touched — every Collection's existing personality is preserved, only its pacing changed. Applied to the local DB directly, then migrated properly (§5) so it survives a fresh `db reset --local`.

## 3. Visual verification

All 10 Collections reviewed against the canonical fixture (Emma & Jordan / Sweet Daisy Barn & Farm), each Collection's own genuinely distinct Color Story left in place where practical, full-page and section-level screenshots:

- **Champagne, Linen** — confirmed excellent: full alternating rhythm, all content visible. Linen's minimal story treatment (no header, quiet paragraph) correctly preserved.
- **Rosé** — pull-quote story treatment correctly preserved (proof the decoupling fix works); Event Details, Schedule, Gallery, Travel, Dress Code+Wedding Party, Registry+FAQ, RSVP all confirmed rendering correctly with real content on a second, independent verification pass (§4).
- **Midnight, European Estate, Rustic, Velvet, Wildflower** — spot-checked at three scroll depths each: Event Details+Gallery, Schedule+Travel+Dress Code/Wedding Party, Things To Do+Music+Registry/FAQ+RSVP. All render correctly with real content and correct rhythm. Zero console errors across all five (`page.on("pageerror"/"console")`, full page loads).

One pre-existing, unrelated observation: the canonical fixture's `content.travel` has `hotels: []` and empty `transportation.notes` — the shared `SectionComposition` primitive renders an empty decorative-bracketed container in that case. This is fixture content-completeness, not a `sectionRoles` defect — it reproduces identically on Garden Party today and is orthogonal to this phase's scope.

## 4. A false alarm, run to ground

The first full-page verification sweep (`page.screenshot({ fullPage: true })`) showed Rosé's Event Details, Schedule, Travel, Dress Code/Wedding Party, Things To Do, Music, and Registry/FAQ sections as empty, uniformly tinted rounded/full-bleed boxes with no visible text — while the same sections rendered correctly for Champagne and Linen in the identical sweep.

Root-caused rather than patched around: the underlying content was confirmed present in the database; direct DOM inspection (`getBoundingClientRect`, computed styles) at the reported coordinates showed correctly-styled, correctly-positioned, non-clipped elements — meaning the live page was not actually broken. Reproducing the same page state with a normal scroll-and-capture (rather than Playwright's `fullPage: true`, which internally resizes the page to its full document height in one shot) showed every section rendering perfectly. This page's Hero uses `100vh`-relative sizing, which recomputes dramatically under `fullPage`'s temporary resize-to-full-height — a Playwright capture artifact specific to very tall pages with viewport-relative hero sizing, not a product defect. Confirmed by re-scrolling to and capturing each flagged section individually: all render with full, correct content.

## 5. Persistence

The authored data was first applied directly (ad-hoc `psql`) during investigation, then formalized as `supabase/migrations/20261200000000_wedding_website_collection_rhythm.sql` and recorded in `supabase_migrations.schema_migrations`, matching how Coastal's and Garden Party's `sectionRoles` were shipped. A fresh `db reset --local` will replay this migration and reproduce the same state.

## 6. Combination matrix — a real defect found and fixed

Section 3's per-Collection sweep held one Color Story constant per Collection, which doesn't exercise `sectionRoles`'s "strong"/"soft" canvas math against a genuinely different palette shape. `color_stories` is scoped per-Collection in this schema (`color_stories.collection_id`), and Midnight and Velvet are the only two Collections whose own Color Stories (Indigo/Onyx/Plum; Burgundy/Noir/Plum) are dark-background palettes (`bg` in the `#0F–#1E` range) rather than the pale, cream-forward palettes every other Collection's stories use. Both had no `sectionRoles` before this phase, so this was the first time `sectionRoles.rsvp.canvas === "strong"` was ever rendered against a dark palette.

**Found:** RSVP's banner text was nearly invisible against Midnight/Velvet's own Color Stories — dark text (`#1a1a1a`) rendering on `tc.heroGradient`, itself a near-black gradient for these palettes. Root cause: the banner's text-contrast decision (`bannerFg`) was derived from `contrastText(tc.primary)`/`contrastText(tc.secondary)`, but the banner's actual background is `tc.heroGradient` — a different value that can diverge sharply from `primary`/`secondary` (Indigo's `primary`/`secondary` both resolve to its light `accent` token, `#BFB8CE`, while its `heroGradient` is `#120F1A → #2E2545`). Checking contrast against the wrong color picked dark text for a dark background.

**Fixed** in `wedding-website.tsx`'s RSVP case: `bannerFg` now reuses `tc.heroTextColor` directly — the Color Story's own curated, already-correct text color for exactly this gradient (the same field `Hero` already uses for its own gradient text). This removed the need for the ad hoc `contrastText()` re-derivation entirely.

**Verified**: Midnight × Indigo and Velvet × Noir both now show fully legible RSVP headings/copy. Garden Party × Meadow (the pre-existing "strong"-canvas RSVP user, unaffected by this phase's data changes) re-checked and confirmed byte-for-byte the same visual result as before the fix — this was a latent bug in the contrast logic itself, not something Phase 4A's authored data introduced, just something Phase 4A's authoring was the first to expose (no Collection had both `sectionRoles.rsvp.canvas === "strong"` and a dark Color Story available to it before).

**Also found, not a product bug**: the same sweep initially showed the *entire page* ignoring Midnight/Velvet's dark Color Story tokens (backgrounds staying pale regardless of selection). Traced to test-fixture contamination — the canonical fixture's `couple_websites` row still had legacy `color_primary`/`color_background`/etc. hex columns set from an earlier debugging session, which `resolveTheme()` correctly gives precedence over `color_story_id` (a couple's own direct customization is supposed to win). Cleared those columns on the fixture; not a code change.

## 7. Mobile verification

Spot-checked at 390×844 (iPhone-class viewport): Champagne, Midnight × Indigo, Rosé, Linen. Zero console errors on all four. `page.screenshot({ fullPage: true })` again produced the same capture artifact described in §4 (now more pronounced — this page is ~7.5× the mobile viewport's height) on the Story/Event region for Midnight; re-verified via scroll-and-capture and confirmed both Rosé's pull-quote and Midnight's eyebrow+heading+prose story treatment render correctly on mobile, each followed by correctly-rendering, fully-visible Event Details content.

## 8. Verification

- **Typecheck**: `npx tsc --noEmit -p .` — zero errors in `wedding-website.tsx` or `composition-primitives.tsx`. (Ten pre-existing, unrelated `TS5097` errors in `shared/email/_smoke.mts` and `shared/relationships/_smoke*.mts` — `.ts`-extension import errors in standalone smoke scripts outside this component tree, not touched by this phase.)
- **Console errors**: zero, across all 10 Collections, full page loads (`pageerror` + `console.error` listeners).
- **Regression**: zero, on the 3 Collections (Coastal, Garden Party, Linen) that already had `sectionRoles`/distinct `storyStyle` before this phase — byte-identical screenshots pre/post the decoupling fix.
- **Canonical fixture**: restored to Garden Party / Meadow / Elegant / Modern, `status: draft` (`couple_websites.id='100a430a-7fe3-4508-8ca1-ec4d524a9dd5'`), legacy color-override columns cleared.

## Addendum — Per-Collection Verification Summary (2026-08-07, post-approval)

Requested after initial approval: one table proving every Collection now participates in the rhythm system while keeping its own editorial identity. Each row is a fresh, direct check run for this addendum — each Collection with its own natural default Color Story (not just whichever story happened to be loaded during earlier passes) — not a restatement of §3/§6's earlier sampling.

**Methodology per row**: navigate to the canonical fixture with the Collection + its own first-listed Color Story set; confirm zero `pageerror`/`console.error`; scroll to and screenshot the Story section (confirming its heading/prose/quote presentation renders with real, positioned, non-empty text — not just present-in-DOM); scroll to and screenshot Event Details (confirming the canvas-driven rhythm band renders with real content). Desktop at 1440×900, mobile at 390×844, via scroll-and-capture (§4's `fullPage: true` artifact does not apply to this method).

| Collection | Rhythm Authored | Story Presentation Preserved | Mobile Verified | Desktop Verified |
|---|---|---|---|---|
| Coastal | PASS | PASS | PASS | PASS |
| Garden Party | PASS | PASS | PASS | PASS |
| Champagne | PASS | PASS | PASS | PASS |
| European Estate | PASS | PASS | PASS | PASS |
| Linen | PASS | PASS (minimal) | PASS | PASS |
| Midnight | PASS | PASS (editorial) | PASS | PASS |
| Rosé | PASS | PASS (quote) | PASS | PASS |
| Rustic | PASS | PASS | PASS | PASS |
| Velvet | PASS | PASS (editorial) | PASS | PASS |
| Wildflower | PASS | PASS | PASS | PASS |

Notes:
- "Rhythm Authored" for Coastal/Garden Party reflects pre-existing `sectionRoles` (unchanged by this phase); the other 8 reflect this phase's migration.
- Midnight and Velvet were checked against their own dark-background Color Stories (Indigo, Burgundy) specifically — the combination that exposed and then confirmed the fix for §6's RSVP contrast bug.
- Six Collections (Champagne, Coastal, European Estate, Garden Party, Rustic, Wildflower) share the `prose` story style, now rendered via the `sectionRoles`-enabled `EditorialOpening` upgrade (eyebrow + heading column beside prose column) — genuinely distinct from Linen's quiet single-paragraph, Rosé's centered pull-quote, and Midnight/Velvet's left-aligned measured-prose treatments, per §1's decoupling fix.

## 9. Not in scope for this phase

Photo Style differentiation (Luxury/Editorial), Typography pairing duplication, and Color Story derivation (`deriveSixRoles()`) are Phases 4B/4C/4D and were not touched — no component or Color Story data was modified beyond the two defect corrections in §1 and §6 (Story canvas/presentation decoupling; RSVP banner contrast), both narrow fixes to bugs this phase's own combination-matrix testing exposed, not a head start on 4D.
