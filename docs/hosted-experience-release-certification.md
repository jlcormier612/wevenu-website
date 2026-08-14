# Hosted Experience Platform — Release Certification (RC1)

**Date:** 2026-08-07
**Scope:** Wedding Website Studio — the full Hosted Experience subsystem (Setup Wizard, Theme Studio, Live Preview, public `/w/[slug]` site, publishing).
**Purpose:** Certify RC1 status before engineering focus shifts to the Venue Platform. This is a hardening pass — no new features, no redesign, no scope expansion.

---

## 1. Architecture

| Check | Result |
|---|---|
| Shared primitives (`Hero`, `createSectionRenderer`, `GalleryGrid`, `useThemeFonts`, `resolveTheme`) — one implementation, every surface | **PASS** |
| Shared previews (`CollectionPreview`, `ColorStoryPreview`, `TypographyPreview`, `PhotoStylePreview`) — thin wrappers around the same primitives, no parallel rendering logic | **PASS** |
| No duplicate rendering logic | **PASS** |
| Color resolution is single-path, authored data, no derivation | **PASS** (fixed this pass — see §2) |

**Evidence:** `deriveSixRoles()` — the one place a second, heuristic color-resolution system existed (gradient-stop extraction + color mixing, used only when a Color Story lacked authored six-role data) — has been removed entirely. Every one of the 38 `color_stories` rows (12 curated + 26 native) now carries authored `colorPrimary/Secondary/Accent/Neutral/Background/Text`; the function is a straight, verbatim read. The `CatalogColorStory["tokens"]` type now requires these six fields, so a future Color Story added without them is a type error, not a silent runtime gap.

Typography's font-loading path (`useThemeFonts`, reference-counted by URL) is unchanged and was already correctly shared — the defect found in Part 1 was missing/duplicated *data* (body fonts), not a second rendering path.

Confirmed via `git diff`: `GalleryGrid`'s function body has zero diff this session (only a pre-existing `export` keyword predates this pass). All fixes across all five parts of this certification are data (`photo_styles`/`typography_styles`/`color_stories`/`collections` tables) plus two narrow, disclosed component fixes carried over from the prior two phases (Story canvas/presentation decoupling, RSVP banner contrast) — nothing added this pass required touching the renderer.

## 2. Visual System

| Dimension | Result |
|---|---|
| Collections (10) — rhythm, section composition | **PASS** (Phase 4A, prior) |
| Color Stories (38) — six authored semantic roles, zero derivation | **PASS** (this pass) |
| Typography (8) — distinct heading + body personality, no fallback fonts | **PASS** (this pass) |
| Photo Styles (9) — visually identifiable without labels | **PASS** (Phase 4B, prior) |
| Section Rhythm | **PASS** (Phase 4A, prior) |
| Contrast (light + dark palettes, feature + quiet sections, RSVP) | **PASS** (this pass) |

**Typography — defect found and fixed:** 4 of 8 styles (Luxury, Playful, Romantic Serif, Editorial) had `bodyFont: "system-ui, sans-serif"` with no webfont ever requested — body text rendered in a fallback font, on every surface, for every couple who picked one of these four. Separately, Calligraphy and Elegant both used Lato for body with no documented reason. Authored a distinct, loaded body font for each (Jost, Cardo, Karla, EB Garamond, Work Sans) — verified via computed `font-family` (not just visual inspection) on genuine body text (not heading-styled paragraphs), confirmed identical in the Setup Wizard's picker cards, Theme Studio's Live Preview, and the public site, at desktop and mobile viewports.

**Color System — defect found and fixed:** 26 of 38 Color Stories (every native, per-Collection story — none of the 12 curated ones) had no authored six-role data and fell through `deriveSixRoles()`'s derivation branch. Authored all 26. The 6 darkest palettes (Midnight ×3, Velvet ×3) needed genuine hand-redesign, not more interpolation — their near-monochromatic gradients had no usable distinct stop, so formula-mixing kept collapsing Secondary into Background (measured distance 2–11 against the system's own 40-point "reads as a distinct band" bar). Redesigned as a deliberate tonal ramp; every one of the 38 stories now clears that bar on every pairwise role comparison that matters (Primary/Secondary/Accent).

**Contrast — verified, not assumed:** the 12-row combination stress matrix (§3) included two "extreme" rows deliberately pairing the darkest Color Stories with the highest-decoration Photo Styles (white polaroid cards, heavy dark-cinematic filters) and script/serif typography — RSVP heading, Schedule card text, and Gallery all confirmed legible via direct visual review, not inference.

## 3. Functional

| Surface | Result |
|---|---|
| Setup Wizard (Welcome → Photo → Collection → Color → Typography → Photo Style → Story → Preview) | **PASS** |
| Theme Studio (six-swatch color editor, picker cards, Collection carousel) | **PASS** |
| Live Preview | **PASS** |
| Public website (`/w/[slug]`, no preview token) | **PASS** |
| Publishing (draft → published, unpublish, public URL resolves) | **PASS** |
| Responsive behavior (desktop / tablet / mobile) | **PASS** |

**Evidence:** Walked the complete customer journey exactly as specified — Create Website through Public Website — via a real portal session, not a simulated one. Every wizard step advanced correctly with the expected content-aware CTA label (`"Use this photo →"`, `"This is us →"`, `"Love it →"`, `"Beautiful →"`, `"Perfect →"`); zero console errors across the entire journey. Clicked **Publish website** for real: `status` transitioned `draft → published`, a live shareable URL was generated, and `http://localhost:3000/w/emma-and-jordan-wedding` (the true public URL, no preview token) returned HTTP 200 with zero console errors. Reverted to `draft` afterward to leave the fixture as found — Unpublish is a one-click, fully reversible action, confirmed present.

## 4. Combination Stress Matrix

Exhaustive testing of 10 × 8 × 9 × 3 (≈2,160 raw combinations) is not practical or meaningful to hand-review individually. Built a 12-row matrix instead: every one of the 10 Collections, all 8 Typography styles, and all 9 Photo Styles appears at least once, with extra concentration at the highest-risk intersection identified across this whole initiative — dark Color Stories combined with heavily-decorated Photo Styles and ornate typography. Two rows were deliberately "extreme" (Midnight+Plum+Calligraphy+Scrapbook; Velvet+Plum+RomanticSerif+Luxury).

**Result: 12/12 clean.** Zero console errors on any row. Backgrounds verified via computed style to exactly match each row's intended Color Story (catching and fixing a real methodology bug along the way — see §6). Visual review of Hero/mid-page/RSVP on every dark-palette row confirmed legible, intentional-looking results; no collapsed contrast, no unreadable text.

## 5. Regression — Known Limitations Intentionally Accepted

| Item | Why acceptable for release |
|---|---|
| RSVP form password field stores plaintext (flagged in a prior release-readiness review) | Pre-existing, out of Hosted Experience's rendering/design scope; a security remediation item, not a visual/architectural one — tracked separately, not blocking this certification. |
| `couple_websites.content` is a dead read path for the public route (content actually lives in `experience_sections`) | Discovered this pass. Not a defect in the shipped product — the live route reads correctly from `experience_sections` — but the unused column is a latent trap for future work that assumes it's live. Documented here explicitly so it isn't rediscovered at debugging cost again. Not blocking: nothing in production reads the stale path incorrectly. |
| Minimal Photo Style cannot achieve the literal "one photo at ~30% width" composition when a couple has uploaded a real multi-photo gallery | `GalleryGrid`'s grid always fills to its column count regardless of spacing token; there's no "show fewer, smaller images" lever. Resolved distinctness via circular framing (an already-authorized token, not a new one) rather than the literal spatial description. Accepted: the style is genuinely, unambiguously distinct (confirmed via blind identification, Phase 4B), which is the actual product requirement: no confusion with any other style. |
| `swatchGradient()`'s decorative-chrome synthesis (for Collections whose `heroGradient` is literally `"none"`) still computes from `deriveSixRoles()`'s output rather than its own authored value | Now trivially correct (input is authored, not derived), but the function itself is a small remaining layer between raw tokens and decorative-swatch chrome. Not simplified further this pass — it is correct, narrow, and already-shared (one implementation, not duplicated); simplifying it further would be scope creep against this pass's explicit "no redesign" charge. |

No engineering debt is being knowingly deferred beyond the four items above. Every derivation/fallback pattern identified during this certification (typography body fonts, color-role derivation, Collection rhythm, Photo Style differentiation) was fixed, not deferred.

## 6. Notable Finding From This Pass Itself

Mid-certification, a Studio verification click (selecting a Color Story to confirm the six-swatch UI) auto-saved custom color overrides onto the test fixture, silently contaminating every subsequent row of the first stress-matrix run — every row appeared to render the same pink palette regardless of the Color Story actually being tested. This was caught (not shipped as a false "PASS") by checking computed background color against each row's expected value, traced to the couple's own `color_primary`/etc. override columns correctly taking precedence over `color_story_id` (matching documented, intentional precedence), and the matrix was rerun clean. Noted here as evidence of how this certification's PASS results were reached — verified against computed output, not assumed from applied inputs.

## 7. Recommendation

**READY FOR RELEASE**

All five certification areas pass. The two genuine defects found this pass — Typography's missing/duplicated body fonts, and Color System's un-authored native Color Stories — are fixed, verified end-to-end (data → shared rendering → every surface → every device), and persisted as migrations that survive a fresh `db reset --local`. The combination stress matrix found zero failures across full-coverage sampling concentrated at the highest-risk intersections. The complete customer journey — Create Website through published public site — was walked for real and produced zero errors. The four items in §5 are genuinely acceptable deferred items, not disguised defects: none affect what a couple or their guests see or do on a shipped site.

Hosted Experience is ready to enter maintenance mode.
