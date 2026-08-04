-- Coastal Premium Art-Direction Proof Pass 2 (2026-08-03)
--
-- Adds `treatment`/`pairWith` to Coastal's own sectionRoles (Step 13/6/9):
-- treatment documents which shared editorial primitive a section composes
-- from (dispatch itself lives in wedding-website.tsx); pairWith names the
-- one other section a section may compose into a shared passage with, only
-- when both sides are adjacent AND both currently have content (see
-- renderGroups in wedding-website.tsx — never a fixed index). Coastal only;
-- no other Collection's layout_config is touched.
--
-- Also corrects this dev fixture's contaminated imagery (Step 4/14, full
-- findings in the completion report):
--   - couple_websites.content.home.coverImageUrl and the matching
--     experience_sections row were pointing at a "Hello to Cheers" Wevenu
--     marketing graphic (baked-in ad copy), not a real couple photo. Nulled
--     out so the hero correctly falls back to the venue's real hero image
--     per the existing, already-approved fallback rule (couple cover always
--     wins when present; this fixture no longer has a legitimate one).
--   - content.gallery.photos held 6 solid-color placeholder PNGs
--     ("visual-pass-photoN.png") — explicitly disallowed as a "finished
--     state" by this pass. Emptied so the existing, correct 0-photo
--     behavior (no fake gallery) renders instead.
--   - content.home.subtitle held a stale, contradictory date string
--     ("October 16, 2026" vs. the real event date of October 17) — replaced
--     with a genuine atmospheric phrase.
--   - client_media rows for this client were all mislabeled marketing/venue
--     imagery under "engagement"/"photography" categories — deleted so
--     Studio's own "Import engagement photos" affordance no longer offers
--     them to a future test session.

update public.collections
set layout_config = layout_config || jsonb_build_object(
  'sectionRoles', jsonb_build_object(
    'hero',         jsonb_build_object('canvas', 'photographic', 'scale', 'feature',   'treatment', 'image-led-feature'),
    'story',        jsonb_build_object('canvas', 'light',        'scale', 'standard',  'treatment', 'editorial-opening'),
    'event',        jsonb_build_object('canvas', 'strong',       'scale', 'feature',   'treatment', 'split-feature'),
    'gallery',      jsonb_build_object('canvas', 'photographic', 'scale', 'feature',   'treatment', 'gallery-spread'),
    'schedule',     jsonb_build_object('canvas', 'soft',         'scale', 'standard',  'treatment', 'timeline'),
    'travel',       jsonb_build_object('canvas', 'light',        'scale', 'standard'),
    'dress_code',   jsonb_build_object('canvas', 'neutral',      'scale', 'interlude', 'treatment', 'paired-passage', 'pairWith', 'bridal_party'),
    'bridal_party', jsonb_build_object('canvas', 'light',        'scale', 'interlude', 'treatment', 'paired-passage', 'pairWith', 'dress_code'),
    'things_to_do', jsonb_build_object('canvas', 'soft',         'scale', 'interlude', 'treatment', 'compact-interlude'),
    'music',        jsonb_build_object('canvas', 'neutral',      'scale', 'interlude', 'treatment', 'compact-interlude'),
    'registry',     jsonb_build_object('canvas', 'neutral',      'scale', 'interlude', 'treatment', 'paired-passage', 'pairWith', 'faq'),
    'faq',          jsonb_build_object('canvas', 'neutral',      'scale', 'interlude', 'treatment', 'paired-passage', 'pairWith', 'registry'),
    'rsvp',         jsonb_build_object('canvas', 'strong',       'scale', 'feature',   'treatment', 'strong-closing')
  )
)
where key = 'coastal';
