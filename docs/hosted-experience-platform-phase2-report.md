# Hosted Experience Platform — Phase 2 Implementation Report

Closes Phase 2 (Section Model) of `docs/hosted-experience-platform-architecture-spec.md`, including the RPC-to-catalog migration and Studio cutover the approval message folded into this phase's scope. Phases 3–6 remain specification only.

## What Shipped

| # | File | Delivers |
|---|---|---|
| 1 | `supabase/migrations/20261011000000_hosted_experience_phase2_section_table.sql` | `experience_sections` table — owner/sync_mode/visibility as real columns, not switch-statement logic |
| 2 | `supabase/migrations/20261012000000_hosted_experience_phase2_section_backfill.sql` | Backfills all 13 canonical sections for every pre-existing `couple_websites` row |
| 3 | `supabase/migrations/20261013000000_hosted_experience_phase2_update_my_website_fk.sql` | Adds `p_collection_id`/`p_color_story_id`/`p_typography_style_id`; auto-creates the canonical section set on every save (idempotent); keeps section content/sort_order/schedule sync_mode in sync with the fields that already write them |
| 4 | `supabase/migrations/20261014000000_hosted_experience_phase2_read_rpcs.sql` | `get_my_website`/`get_wedding_website` now derive `theme`/`themePalette`/`fontPairing` from the catalog when FK is set (falling back to legacy strings), and both return an ordered, visibility-filtered `sections` array |
| 5 | `app/api/portal/website/catalog/route.ts` | New route — the Studio's picker now fetches real catalog data instead of reading only hardcoded arrays |
| 6 | `app/api/portal/website/route.ts` | Forwards `collectionId`/`colorStoryId`/`typographyStyleId` to the RPC |
| 7 | `components/portal/website-editor.tsx` | Every Appearance-picker selection now resolves and sends the matching catalog id |
| 8 | `components/wedding-website/wedding-website.tsx` | Section ordering now prefers the RPC's `sections` array, with a safe fallback to the pre-Phase-2 logic |
| 9 | `lib/wedding-website/types.ts` | New types: `ExperienceSection`, `SectionOwner`/`SectionSyncMode`/`SectionVisibility`, `HostedExperienceCatalog` and its parts; `collectionId`/`colorStoryId`/`typographyStyleId`/`sections` added to `CoupleWebsite`/`PublicWebsite` |

## Design Decisions Made During Implementation

1. **The Studio sends catalog IDs *alongside* the legacy strings, not instead of them.** A pure cutover would stop sending `theme`/`themePalette`/`fontPairing` entirely once the catalog loads. Sending both is deliberately more conservative: if the catalog fetch fails for any reason, the legacy strings still carry the save through correctly, and since the read side already prefers the FK-derived value whenever it's present, there's no behavioral difference to a couple using it normally. This is a real migration of the *authoritative* path — the FK is what actually determines what renders once set — just with an extra safety net during the transition, which felt like the right trade for something the Stabilization pass proved can fail in ways that aren't obvious until tested live.
2. **The Studio's visual preview cards still use the local `THEME_LIBRARY`/`FONT_PAIRINGS` arrays for cosmetic values** (heading font shown in the mini preview, mood copy) rather than the fetched catalog, because collection-level typography/mood tokens were never added to the `collections` table in Phase 1 — only palette and typography *option* data was. Fetching the catalog is used purely to resolve IDs for what gets saved. Making the visual preview itself fully catalog-driven would require a `design_tokens` column on `collections` that doesn't exist yet — noted as real future work, not silently worked around.
3. **`venue_managed` was not assigned to any section in the live backfill**, even though the spec's own ownership table lists FAQ, Hotel Suggestions, and Directions as conceptually venue-owned. There is no venue-facing editing surface anywhere in the current product — confirmed by checking, not assumed — so labeling those sections `venue_managed` today would assert an access boundary that doesn't exist. They're classified `couple_authored`, matching what's actually true. This is now recorded in the spec itself (§3) as an explicit, honest finding, not a quiet deviation.
4. **`experience_sections` is kept in sync by `update_my_website`, not treated as a one-time backfill snapshot** — content-key writes, section reordering, and the schedule-sync toggle all now write through to the matching section row's `content`/`sort_order`/`sync_mode` in the same call that writes `couple_websites`. This avoids exactly the kind of two-sources-of-truth drift this whole platform initiative exists to close.

## Regression Self-Caught During Implementation

Same discipline as Phase 1, and it mattered again: `update_my_website`'s parameter list grew from 14 to 17 (adding the three catalog-id params). A `CREATE OR REPLACE` with a different signature creates a new overload rather than replacing the old one — the migration explicitly drops the prior 14-param signature in the same file, and a post-apply `pg_proc` count confirmed exactly one overload per function (`get_my_website`, `get_wedding_website`, `update_my_website`) before any live testing began. No overload ambiguity occurred this time, but the check was run as a matter of course, not skipped because Phase 1 already "proved" the pattern works.

## Live Validation

Real client, event, and portal-session tokens, real RPC calls with real parameter shapes throughout.

- **FK-only save, zero legacy strings sent**: created a site passing only `p_collection_id`/`p_color_story_id`/`p_typography_style_id` (Coastal / Navy / Classic Serif) — confirmed `get_my_website` correctly derived and returned `theme: "coastal"`, `themePalette: "Navy"`, `fontPairing: "classic_serif"`, none of which were ever sent as strings.
- **Section auto-creation**: confirmed all 13 canonical sections were created on first save, correctly ordered, with the exact owner/sync_mode mapping designed above (`schedule`/`rsvp` → `live_synced`; `home`/`story` → `guided`; everything else → `couple_authored`; `schedule.dataSource = "timeline_entries"` since `schedule_sync` defaulted true).
- **Public site parity**: published and confirmed `get_wedding_website` returns the same FK-derived theme/palette/font and the same ordered `sections` array as the Studio.
- **Section reordering**: sent a new `sectionOrder`, confirmed the public site's `sections` array reflects the new order (with `home` correctly staying fixed-first, matching the renderer's real, pre-existing behavior).
- **Schedule sync toggle → section sync_mode**: flipped `scheduleSync` to `false`, confirmed the `schedule` section's `syncMode` flipped from `live` to `manual` and `dataSource` cleared — proving `owner` (structural) and `sync_mode` (behavioral) are correctly decoupled as designed.
- **Legacy-row fallback, a second client**: saved a site using only the old string params (`theme`/`themePalette`/`fontPairing`, zero FK params) — confirmed `get_wedding_website` still correctly derives from the legacy columns via fallback, and that section auto-creation runs unconditionally regardless of which path was used.
- **Full lifecycle regression**: unpublish → republish → edit-after-publish re-run on the FK-based site; theme/palette/font and all section data survived intact, content merged correctly (not overwritten).
- **Cleanup verification**: deleting the `couple_websites` test rows correctly cascade-deleted their `experience_sections` rows (confirmed via a direct count — zero orphaned section rows left behind).
- `tsc --noEmit` clean throughout, aside from the same two pre-existing, unrelated stale `.next` entries noted in every prior report this session.

All test data — three test clients, one event, three portal sessions, three `couple_websites` rows (and their cascaded sections) — created through real paths and fully removed, verified at zero.

## Recommendation: Phase 2 Complete

Ready to proceed to Phase 3 (Publishing Model — Draft/Preview/Archived/Scheduled states, Version History) whenever you'd like.
