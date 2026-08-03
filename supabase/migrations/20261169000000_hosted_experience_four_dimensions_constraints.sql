-- ============================================================================
-- Hosted Experience Platform — Four Dimensions: widen stale CHECK constraints
--
-- couple_websites.theme and .font_pairing still had their original CHECK
-- constraints from before this initiative — 8 collection keys, 4 typography
-- keys. Part 1 added 3 new collections (estate/rustic/industrial) and Part 3
-- added 4 new typography pairings (luxury/minimal/calligraphy/elegant), both
-- already live in the collections/typography_styles catalog tables and
-- already selectable in the Studio/Editor pickers — but a couple picking any
-- of the 7 new values would have hit a hard 22P02/23514 CHECK-violation
-- error on save, since these two legacy string columns (kept only as a
-- safety-net alongside collection_id/typography_style_id) were never
-- updated. Caught during Part 8 verification before any couple hit it.
-- ============================================================================

alter table public.couple_websites drop constraint couple_websites_theme_check;
alter table public.couple_websites add constraint couple_websites_theme_check
  check (theme = any (array['classic','modern','garden','minimal','romance','coastal','champagne','velvet','estate','rustic','industrial']));

alter table public.couple_websites drop constraint couple_websites_font_pairing_check;
alter table public.couple_websites add constraint couple_websites_font_pairing_check
  check (font_pairing = any (array['classic_serif','modern_sans','romantic','editorial','luxury','minimal','calligraphy','elegant']));
