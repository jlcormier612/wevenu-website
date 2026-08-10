-- Midnight identity A+C + darkened Black Tie Color Story (2026-08-10).
--
-- 1) Black Tie curated story was ivory-canvas (#FAF8F3) while named for evening
--    formality — Live Preview with Midnight + Black Tie read as a light wedding
--    site. Darken the six roles + mood/heroGradient; champagne accents stay.
-- 2) Sync couple_websites still pointing at Black Tie with the old light hexes
--    so Emma/Jordan seed (and anyone else on that story) picks up the darken.
-- 3) Unify Midnight collection.description with the picker descriptor source
--    of truth (carousel was still on the old "Atmospheric indigo editorial…"
--    line).

-- ── 1. Darken curated Black Tie ──────────────────────────────────────────────
update public.color_stories
set tokens = tokens || jsonb_build_object(
  'colorPrimary', '#C4B59A',
  'colorSecondary', '#8A7352',
  'colorAccent', '#B7AA91',
  'colorNeutral', '#3A3632',
  'colorBackground', '#121110',
  'colorText', '#F0EBE3',
  'mood', 'Black, champagne & night ink',
  'heroGradient', 'linear-gradient(160deg, #0A0908 0%, #1A1816 45%, #2E2A24 100%)',
  -- Legacy chrome keys still read by Studio swatches / older surfaces.
  'bg', '#121110',
  'dark', true,
  'text', '#F0EBE3',
  'accent', '#B7AA91',
  'border', '#3A3632',
  'surface', '#1A1816',
  'heroTextColor', '#F0EBE3'
)
where key = 'black-tie';

-- ── 2. Re-sync couple sites on Black Tie that still hold the light canvas ────
update public.couple_websites w
set
  color_primary    = coalesce((cs.tokens->>'colorPrimary'), w.color_primary),
  color_secondary  = coalesce((cs.tokens->>'colorSecondary'), w.color_secondary),
  color_accent     = coalesce((cs.tokens->>'colorAccent'), w.color_accent),
  color_neutral    = coalesce((cs.tokens->>'colorNeutral'), w.color_neutral),
  color_background = coalesce((cs.tokens->>'colorBackground'), w.color_background),
  color_text       = coalesce((cs.tokens->>'colorText'), w.color_text),
  theme_palette    = coalesce(cs.name, w.theme_palette),
  updated_at       = now()
from public.color_stories cs
where w.color_story_id = cs.id
  and cs.key = 'black-tie'
  and (
    w.color_background is null
    or lower(w.color_background) in ('#faf8f3', '#faf8f4', '#fbf8f3', 'rgb(250, 248, 243)')
  );

-- ── 3. Unify Midnight catalog description with picker copy ───────────────────
update public.collections
set description = 'Cinematic night editorial — dark, dramatic, Vogue energy.'
where key = 'modern';
