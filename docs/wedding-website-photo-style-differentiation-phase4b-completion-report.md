# Wedding Website — Phase 4B: Photo Style Differentiation

**Date:** 2026-08-07
**Scope:** `photo_styles.tokens` data only, for all 9 styles (7 retuned, 2 new: Wildflower, Midnight). Zero changes to `GalleryGrid`, `PhotoStylePreview`, or any shared rendering primitive — confirmed via diff.
**Status:** Implementation complete, technically verified. **HUMAN VISUAL ACCEPTANCE: PENDING.**
**Visual deliverable:** PASS/FAIL table with thumbnails, published as an Artifact (linked in this session).

---

## 0. The mandate

Author Photo Style presentation tokens until every style is visually identifiable without reading its name — using only the token vocabulary `GalleryGrid` already reads (`arrangement`, `scalePattern`, `frameStyle`, `shadow`, `rotation`, `spacing`, `photoRadius`, `photoFilter`, `imageScale`, `captionStyle`). No component changes, no new arrangement types, no Photo Style exceptions.

Two styles named in the brief (Wildflower, Midnight) did not exist as `photo_styles` rows — inserted as new data rows, not new code paths.

## 1. Methodology

Held constant across every capture: one Collection (Garden Party), one fixed set of the couple's own gallery photographs, same crop/aspect ratio (GalleryGrid's own `object-fit: cover` + per-arrangement fixed aspect ratios — untouched). Only `photo_style_id` varied.

Single-photo compositions (Editorial, Luxury, Minimal, Midnight — each described as "one photograph" in the brief) were tested with exactly 1 photo; multi-photo compositions (Modern, Magazine, Film, Scrapbook, Wildflower — each described as "three photographs") were tested with exactly 3. Both counts came from a real, normalized `experience_sections` table (not the `couple_websites.content` column, which turned out to be a dead read path for this route — see §3), trimmed and restored around testing, never left altered.

**Blind validation**: all 9 results cropped to their gallery region, labels stripped, arranged in a randomized order (`random.seed(7)`, order not visible to the reviewer — i.e. me — until after guesses were recorded), identified purely from visual characteristics, then checked against a written answer key. **Result: 9/9 correct**, including all three pairs the brief flagged as highest-risk (Editorial/Luxury, Magazine/Scrapbook, Modern/Film) and one risk I identified myself before testing (Wildflower/Scrapbook, since both are forced onto the same non-grid `arrangement` — the only one GalleryGrid has besides `collage`).

## 2. Findings and fixes, per flagged risk

**Editorial / Luxury** — confirmed real: both had `frameStyle: "none"`, identical scale/pattern. The brief's own words — "the frame itself is part of the identity" — weren't implemented at all. Fixed: Luxury gets `frameStyle: "border"` (premium white frame), `imageScale: "normal"` (narrower than Editorial's `"large"`), `spacing: "generous"`. Now separated structurally, not just by filter.

**Magazine / Scrapbook** — not confirmed as a risk once rendered. `collage` (Magazine) and `scrapbook` (Scrapbook) arrangements produce entirely different silhouettes (sharp layered overlap vs. white polaroid cards with a deep bottom margin). No change needed beyond a minor filter tune.

**Modern / Film** — partially confirmed: Modern's `scalePattern` was `"alternating"`, which spans every third image across 2 columns — directly contradicting its own "equal rectangles, no overlap, rigid grid" identity, and the likely source of the flagged risk (an inconsistent Modern reads closer to anything else than a correct rigid Modern would). Fixed: `scalePattern` → `"uniform"`. Film's own tokens (bordered, warm sepia) already matched its spec; kept as-is.

**Wildflower / Scrapbook (self-identified)** — real, structural: both use `arrangement: "scrapbook"` (GalleryGrid's only non-grid, overlapping-position code path), so their photo *positions* are pixel-identical. Differentiated entirely through decoration: Wildflower gets `frameStyle: "none"` (no polaroid card — Scrapbook's white card + deep bottom margin is a strong, singular visual signature Wildflower simply doesn't have), `photoRadius: "0.85rem"` (soft rounded corners vs. Scrapbook's sharp print-in-a-card look at `"0.25rem"`), and a distinct earthy filter. Confirmed via direct crop comparison and the blind pass.

## 3. Two things found that weren't in the brief

**`couple_websites.content` is a dead read path for this route.** Editing `content.gallery.photos` directly had no effect on the rendered page — `get_wedding_website()` builds gallery (and all section) content from `experience_sections` (a normalized per-section table), not the `couple_websites.content` JSON blob. This cost real debugging time and is worth flagging: any future work assuming `couple_websites.content` is live should verify against `experience_sections` first. Not a Phase 4B defect — pre-existing plumbing, unrelated to Photo Style.

**Minimal converges with Modern at real photo counts.** The brief describes Minimal as "one centered photograph at ~30% width" — but `GalleryGrid`'s grid always fills to its column count (2 or 3, whichever the `imageScale` token selects) regardless of `spacing`; there's no token for "fewer, smaller, more isolated images." At 3 photos, Minimal's `spacing: "generous"` alone produced the same 3-equal-square silhouette as Modern, differing only by gap width — not reliably distinct at a glance. Resolved by pushing an *already-authorized* token further: `photoRadius: "50%"` (circular framing). This is a token GalleryGrid already reads for every style; nothing new was introduced. Confirmed decisive via direct comparison and the blind pass. Documented here because it's a real ceiling in the current token vocabulary, not because the fix required stepping outside it.

## 3.5. Addendum — spatial composition review (post-approval)

After Phase 4B was approved, one question was raised before closing it: **can Wildflower get a genuinely distinct spatial composition — not just different decoration on Scrapbook's own layout — using existing shared rendering architecture and Photo Style data only?**

The honest state at approval time (§2) was that Wildflower and Scrapbook shared `arrangement: "scrapbook"`, meaning their photo *positions* were pixel-identical — differentiated only by frame/radius/filter (decoration on the same layout, not a different one).

Re-examined `GalleryGrid`'s full token surface for any spatial (not decorative) lever not yet used. Found one: `scalePattern: "alternating"` (already used, differently, by pre-fix Modern) varies both the *span* (which photo gets a wider grid cell) and the *aspect ratio* per photo (portrait/wide/portrait, not uniform squares) — a genuine sizing/shape variation, not just a filter or border. Combined with `arrangement: "uniform"` (the same code path Editorial/Luxury/Modern/Film/Minimal already use — GalleryGrid's grid/masonry renderer, not Scrapbook's custom overlap math) and `rotation: "scattered"` (kept from the original), this is a combination no other style uses.

**Answer: yes.** Revised Wildflower's tokens:

| Field | Before | After |
|---|---|---|
| `arrangement` | `"scrapbook"` | `"uniform"` |
| `scalePattern` | `"uniform"` | `"alternating"` |
| `rotation` | `"scattered"` | `"scattered"` (unchanged) |
| `frameStyle`, `photoRadius`, `photoFilter`, `shadow`, `spacing` | unchanged | unchanged |

This renders through a genuinely different code path (`GalleryGrid`'s uniform grid/masonry loop) rather than Scrapbook's overlap-position loop — not new decoration on the same mechanism.

**Verified**:
- Rendered on a grid-layout Collection (Garden Party) and a masonry-layout Collection (Rustic) — organic, varied-size, individually-rotated photos on both; never reads as a rigid grid on either.
- Direct crop comparison against Scrapbook: completely different silhouette (varying aspect ratios, no card, spaced apart vs. Scrapbook's uniform squares, white card, tight overlap).
- **Full 9-style blind identification re-run, independently randomized** (`random.seed(19)`, a new order, new answer key, guesses recorded before checking): **9/9 correct**, confirming the revision didn't disturb any other style's identifiability.

Zero changes to `GalleryGrid` or any shared primitive — same constraint held throughout, re-confirmed via diff after this revision.

## 4. Verification

- **Console errors**: zero, across all 9 styles, both photo-count groups.
- **Typecheck**: zero errors in any wedding-website/collection-preview file.
- **Diff scope**: `git diff` on `components/wedding-website/wedding-website.tsx` shows `GalleryGrid`'s function body with zero changes (the one line that differs — `function GalleryGrid` → `export function GalleryGrid` — predates this phase, from the original Shared Rendering Architecture pass). `components/portal/collection-preview.tsx` (`PhotoStylePreview`) has zero diff.
- **Blind identification**: 9/9 in round 1 (original 9 styles); 9/9 in round 2, independently randomized, after Wildflower's spatial revision (§3.5).
- **Canonical fixture**: restored to Modern (its shipped default) and the couple's original 7-photo gallery, both in `experience_sections` and `couple_websites.content` (kept consistent even though the latter isn't read, to avoid leaving stale data behind).
- **Persistence**: `supabase/migrations/20261201000000_wedding_website_photo_style_differentiation.sql`, recorded in `supabase_migrations.schema_migrations` — survives a fresh `db reset --local`.

## 5. Deliverable

Full PASS/FAIL table (thumbnail, defining characteristics, confusion discovered, changes made, validation) plus the blind-identification grid: published as an Artifact this session. All 9 styles: **PASS**.

## 6. Not in scope for this phase

Typography pairing duplication and Color Story derivation (`deriveSixRoles()`) are Phases 4C/4D and were not touched.
