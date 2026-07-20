# Hosted Experience Platform — Phase 1 Implementation Report

Closes Phase 1 (Catalog Foundation) of `docs/hosted-experience-platform-architecture-spec.md`. Phases 2–6 remain specification only.

## What Shipped

| # | File | Delivers |
|---|---|---|
| 1 | `supabase/migrations/20261008000000_hosted_experience_phase1_catalog_tables.sql` | `collections`, `color_stories`, `typography_styles` tables — public read-only catalog, no venue/couple write path (by design) |
| 2 | `supabase/migrations/20261009000000_hosted_experience_phase1_catalog_seed.sql` | Seeds all 8 collections, 24 color stories, 4 typography styles, copied exactly from the current hardcoded TS values |
| 3 | `supabase/migrations/20261010000000_hosted_experience_phase1_couple_websites_fk.sql` | Adds `collection_id`/`color_story_id`/`typography_style_id` to `couple_websites`, alongside the existing string columns; backfill logic for pre-existing rows |
| — | `components/wedding-website/wedding-website.tsx` | `TYPOGRAPHY_STYLES` lookup + `resolveTheme()` now accepts and applies a font pairing — the deferred rendering gap from the Stabilization pass is closed |

## Scope Refinement Made During Implementation

Two real decisions surfaced while implementing that weren't fully resolved by the spec as written — both now reflected back into `docs/hosted-experience-platform-architecture-spec.md`, per the standing instruction to keep the spec canonical:

1. **Typography Styles are not curated per-Collection in this phase.** The spec's own design decision (§1) calls for Color Stories and Typography Styles both being curated subsets of each Collection. Color Stories already work that way today (3 palettes per collection) and the catalog reflects that (`color_stories.collection_id` is a required FK). Typography Styles do not — today's actual Font Pairing picker offers all 4 pairings regardless of which Collection is selected. Narrowing that now would have been a real, user-visible behavior change bundled into what was scoped as a non-disruptive foundational step, so `typography_styles.collection_id` was made nullable and left null for all 4 seeded rows — global for now, structurally ready to be scoped later without a schema change.

2. **The RPCs and Studio UI were not cut over to the new FK columns.** The spec describes Phase 1 as adding the FK columns "alongside" the string columns "during a transition window," which is exactly what shipped — but implementing it made clear that *closing the Font Pairing bug* and *building the catalog foundation* both fit inside Phase 1 without also requiring the larger, higher-risk step of rewiring `get_my_website`/`update_my_website`/`get_wedding_website` and the Studio's picker to read/write the new columns. That cutover is now explicit Phase 2 scope (alongside the already-planned Section Model work) rather than something Phase 1 silently deferred.

## Live Validation

Real client, event, and portal-session token created through real app paths; every RPC called with the exact parameter shapes the real route handlers use.

- **Catalog integrity**: 8 collections / 24 color stories / 4 typography styles confirmed seeded, every collection has a resolved `default_color_story_id`.
- **Font Pairing rendering, the core deliverable**: created a site with `theme: "modern"` (whose own default typography is DM Sans) and `font_pairing: "romantic"` (Cormorant Garamond, italic) — an intentionally strong mismatch to make the override unambiguous. Confirmed the public RPC returns `fontPairing: "romantic"` correctly, and `resolveTheme()`'s merge order (`{...collection, ...palette, ...typographyOverride}`) means the override reliably wins over the collection default.
- **Backfill logic**: rather than relying on there being pre-existing rows in this (already-cleared) local environment, a row was inserted directly with only the old string columns set (`theme`/`theme_palette`/`font_pairing`, no FK values — simulating a genuine pre-Phase-1 row), then the migration's exact backfill statements were re-run against it. All three FK columns resolved correctly: `theme='velvet'` → `collection.key='velvet'`, `theme_palette='Noir'` → `color_story.name='Noir'` within that collection, `font_pairing='editorial'` → `typography_style.key='editorial'`.
- **No regression to the just-stabilized lifecycle**: create → save → refresh → publish → verify public → edit-after-publish → unpublish → republish re-run end to end on the new test site; all fields, including the new font pairing, survived the full cycle intact. `is_published=false` correctly returns `{"error":"not_found"}` on the public RPC, exactly as before this phase's changes.
- **New rows created after the FK columns were added correctly have null `collection_id`/`color_story_id`/`typography_style_id`** — expected and by design, since nothing writes them yet outside the backfill; the string-column path remains fully authoritative and unaffected.
- `tsc --noEmit` clean throughout (aside from the same two pre-existing, unrelated stale `.next` type-validator entries present since before this work began).

All test data — two test clients, one event, one portal session, two `couple_websites` rows, two relationship records — created through real paths and fully removed. Final check confirms zero leftover test rows and the seeded catalog itself (the actual deliverable) intact and untouched.

## Recommendation: Phase 1 Complete

Ready to proceed to Phase 2 (Section Model) whenever you'd like, which per the scope refinement above now also carries the RPC/Studio cutover onto the new catalog columns as part of its own scope.
