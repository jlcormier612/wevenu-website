-- Restore the 12 approved curated Color Stories for Wedding Website Studio.
--
-- Root cause: CURATED_COLOR_STORY_KEYS / Studio "Need a little inspiration?"
-- resolve rows by key from color_stories, but the INSERT that created those
-- 12 Coastal-scoped rows was never present in the applied migration chain.
-- Sandbox therefore showed only the 27 native/per-collection stories
-- (24 original + 3 from estate/rustic/industrial) — missing the curated set.
--
-- Values are the exact approved six-role palettes from the Hosted Experience
-- design audit / visual QA matrix. Do not redesign.
--
-- Also restores Black Tie to the approved light canvas (overrides the later
-- darken in 20261242000000 when that row exists).

insert into public.color_stories (collection_id, key, name, sort_order, tokens)
select c.id, v.key, v.name, v.sort_order, v.tokens::jsonb
from public.collections c
cross join (values
  ('coastal-blue', 'Coastal Blue', 100,
   '{"colorPrimary":"#5F8299","colorSecondary":"#A8BEC8","colorAccent":"#315B70","colorNeutral":"#E8E1D7","colorBackground":"#F7F5F0","colorText":"#263A43","bg":"#F7F5F0","surface":"#FFFFFF","text":"#263A43","textMuted":"#5F8299","border":"#E8E1D7","accent":"#315B70","heroGradient":"linear-gradient(160deg, #A8BEC8 0%, #5F8299 100%)","heroTextColor":"#FFFFFF","heroOverlayColor":"#263A43","heroOverlayOpacity":0.28,"dark":false}'),
  ('sage-garden', 'Sage Garden', 101,
   '{"colorPrimary":"#BFCBB7","colorSecondary":"#DCE2D5","colorAccent":"#91A287","colorNeutral":"#EEEAE1","colorBackground":"#FAF8F3","colorText":"#465044","bg":"#FAF8F3","surface":"#FFFFFF","text":"#465044","textMuted":"#91A287","border":"#EEEAE1","accent":"#91A287","heroGradient":"linear-gradient(160deg, #DCE2D5 0%, #BFCBB7 100%)","heroTextColor":"#FFFFFF","heroOverlayColor":"#465044","heroOverlayOpacity":0.22,"dark":false}'),
  ('dusty-rose', 'Dusty Rose', 102,
   '{"colorPrimary":"#E8CBCD","colorSecondary":"#F1DDDE","colorAccent":"#D8B3B7","colorNeutral":"#F5E9E7","colorBackground":"#FFFDFC","colorText":"#6A4D50","bg":"#FFFDFC","surface":"#FFFFFF","text":"#6A4D50","textMuted":"#D8B3B7","border":"#F5E9E7","accent":"#D8B3B7","heroGradient":"linear-gradient(160deg, #F1DDDE 0%, #E8CBCD 100%)","heroTextColor":"#FFFFFF","heroOverlayColor":"#6A4D50","heroOverlayOpacity":0.2,"dark":false}'),
  ('peach-bellini', 'Peach Bellini', 103,
   '{"colorPrimary":"#F4C7B3","colorSecondary":"#F9DCCB","colorAccent":"#EFAE92","colorNeutral":"#FBE9DE","colorBackground":"#FFFCF8","colorText":"#704F43","bg":"#FFFCF8","surface":"#FFFFFF","text":"#704F43","textMuted":"#EFAE92","border":"#FBE9DE","accent":"#EFAE92","heroGradient":"linear-gradient(160deg, #F9DCCB 0%, #F4C7B3 100%)","heroTextColor":"#FFFFFF","heroOverlayColor":"#704F43","heroOverlayOpacity":0.2,"dark":false}'),
  ('lavender-haze', 'Lavender Haze', 104,
   '{"colorPrimary":"#8B74A5","colorSecondary":"#B9A7CB","colorAccent":"#654D7C","colorNeutral":"#E7DEEC","colorBackground":"#FBF8FC","colorText":"#3D3447","bg":"#FBF8FC","surface":"#FFFFFF","text":"#3D3447","textMuted":"#8B74A5","border":"#E7DEEC","accent":"#654D7C","heroGradient":"linear-gradient(160deg, #B9A7CB 0%, #8B74A5 100%)","heroTextColor":"#FFFFFF","heroOverlayColor":"#3D3447","heroOverlayOpacity":0.28,"dark":false}'),
  ('champagne-curated', 'Champagne', 105,
   '{"colorPrimary":"#B8AD9F","colorSecondary":"#D4CCC1","colorAccent":"#948779","colorNeutral":"#E8E2DA","colorBackground":"#FCFAF7","colorText":"#4D4944","bg":"#FCFAF7","surface":"#FFFFFF","text":"#4D4944","textMuted":"#948779","border":"#E8E2DA","accent":"#948779","heroGradient":"linear-gradient(160deg, #D4CCC1 0%, #B8AD9F 100%)","heroTextColor":"#FFFFFF","heroOverlayColor":"#4D4944","heroOverlayOpacity":0.24,"dark":false}'),
  ('terracotta-curated', 'Terracotta', 106,
   '{"colorPrimary":"#B9684E","colorSecondary":"#D79A7E","colorAccent":"#8D4938","colorNeutral":"#E9D5C4","colorBackground":"#FBF6EF","colorText":"#4B352E","bg":"#FBF6EF","surface":"#FFFFFF","text":"#4B352E","textMuted":"#B9684E","border":"#E9D5C4","accent":"#8D4938","heroGradient":"linear-gradient(160deg, #D79A7E 0%, #B9684E 100%)","heroTextColor":"#FFFFFF","heroOverlayColor":"#4B352E","heroOverlayOpacity":0.28,"dark":false}'),
  ('french-blue', 'French Blue', 107,
   '{"colorPrimary":"#667FA5","colorSecondary":"#A9B8D0","colorAccent":"#405B83","colorNeutral":"#E2E5E8","colorBackground":"#FAFAF8","colorText":"#2D3748","bg":"#FAFAF8","surface":"#FFFFFF","text":"#2D3748","textMuted":"#667FA5","border":"#E2E5E8","accent":"#405B83","heroGradient":"linear-gradient(160deg, #A9B8D0 0%, #667FA5 100%)","heroTextColor":"#FFFFFF","heroOverlayColor":"#2D3748","heroOverlayOpacity":0.28,"dark":false}'),
  ('black-tie', 'Black Tie', 108,
   '{"colorPrimary":"#242321","colorSecondary":"#B7AA91","colorAccent":"#8A7352","colorNeutral":"#E5DED2","colorBackground":"#FAF8F3","colorText":"#1E1D1B","bg":"#FAF8F3","surface":"#FFFFFF","text":"#1E1D1B","textMuted":"#8A7352","border":"#E5DED2","accent":"#8A7352","heroGradient":"linear-gradient(160deg, #B7AA91 0%, #242321 100%)","heroTextColor":"#FFFFFF","heroOverlayColor":"#1E1D1B","heroOverlayOpacity":0.32,"dark":false}'),
  ('berry', 'Berry', 109,
   '{"colorPrimary":"#7A2A42","colorSecondary":"#B85073","colorAccent":"#4E1A2C","colorNeutral":"#E3C7CC","colorBackground":"#FBF4F3","colorText":"#341019","bg":"#FBF4F3","surface":"#FFFFFF","text":"#341019","textMuted":"#7A2A42","border":"#E3C7CC","accent":"#4E1A2C","heroGradient":"linear-gradient(160deg, #B85073 0%, #7A2A42 100%)","heroTextColor":"#FFFFFF","heroOverlayColor":"#341019","heroOverlayOpacity":0.3,"dark":false}'),
  ('golden-hour', 'Golden Hour', 110,
   '{"colorPrimary":"#C49345","colorSecondary":"#DFC58D","colorAccent":"#8E672C","colorNeutral":"#EEE1C7","colorBackground":"#FCF8EE","colorText":"#493D2D","bg":"#FCF8EE","surface":"#FFFFFF","text":"#493D2D","textMuted":"#C49345","border":"#EEE1C7","accent":"#8E672C","heroGradient":"linear-gradient(160deg, #DFC58D 0%, #C49345 100%)","heroTextColor":"#FFFFFF","heroOverlayColor":"#493D2D","heroOverlayOpacity":0.26,"dark":false}'),
  ('meadow', 'Meadow', 111,
   '{"colorPrimary":"#6F8F55","colorSecondary":"#A8B96F","colorAccent":"#D3AD4F","colorNeutral":"#EEE1B8","colorBackground":"#FBF8EC","colorText":"#30462F","bg":"#FBF8EC","surface":"#FFFFFF","text":"#30462F","textMuted":"#6F8F55","border":"#EEE1B8","accent":"#D3AD4F","heroGradient":"linear-gradient(160deg, #A8B96F 0%, #6F8F55 100%)","heroTextColor":"#FFFFFF","heroOverlayColor":"#30462F","heroOverlayOpacity":0.26,"dark":false}')
) as v(key, name, sort_order, tokens)
where c.key = 'coastal'
on conflict (collection_id, key) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order,
  tokens = excluded.tokens,
  updated_at = now();
