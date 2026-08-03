-- Hosted Experience Platform — seed data for the four independent dimensions
-- (2026-07-24). Photo Style is entirely new (7 styles, Part 4's own examples).
-- Typography expands from 4 to 8 named pairings (Part 3's own examples).
-- Collections gain full layout_config (consolidating what used to live only
-- in components/wedding-website/wedding-website.tsx's hardcoded COLLECTIONS
-- object — that object stays in code as the resolver's fallback default, not
-- deleted; this backfill makes the 8 existing collections match it exactly,
-- so nothing visually changes for any existing site) plus 3 new collections
-- reached by combining the same closed vocabulary in new ways, per this
-- initiative's own stated goal: "hundreds of unique experiences... not
-- because there are hundreds of templates."

-- ── Photo Style (new 4th dimension) ───────────────────────────────────────────
insert into public.photo_styles (key, name, description, sort_order, tokens) values
  ('editorial', 'Editorial', 'Large full-width photography', 0,
   '{"photoFilter": "contrast(1.08) saturate(0.95)", "photoRadius": "0", "frameStyle": "none", "captionStyle": "minimal", "imageScale": "large"}'::jsonb),
  ('magazine', 'Magazine', 'Layered collage', 1,
   '{"photoFilter": "contrast(1.05)", "photoRadius": "0.25rem", "frameStyle": "none", "captionStyle": "minimal", "imageScale": "normal"}'::jsonb),
  ('film', 'Film', 'Warm tones, soft grain', 2,
   '{"photoFilter": "sepia(0.18) saturate(0.82) contrast(0.94) brightness(1.06)", "photoRadius": "0.25rem", "frameStyle": "border", "captionStyle": "minimal", "imageScale": "normal"}'::jsonb),
  ('minimal', 'Minimal', 'Lots of white space', 3,
   '{"photoFilter": "saturate(0.9) brightness(1.05)", "photoRadius": "0", "frameStyle": "none", "captionStyle": "none", "imageScale": "normal"}'::jsonb),
  ('modern', 'Modern', 'Clean edges', 4,
   '{"photoFilter": "contrast(1.1)", "photoRadius": "0", "frameStyle": "none", "captionStyle": "none", "imageScale": "normal"}'::jsonb),
  ('luxury', 'Luxury', 'Large hero imagery', 5,
   '{"photoFilter": "contrast(1.05) saturate(0.92) brightness(1.02)", "photoRadius": "0", "frameStyle": "none", "captionStyle": "minimal", "imageScale": "large"}'::jsonb),
  ('scrapbook', 'Scrapbook', 'Polaroid layouts, handwritten accents', 6,
   '{"photoFilter": "saturate(1.05) brightness(1.03)", "photoRadius": "0.25rem", "frameStyle": "polaroid", "captionStyle": "handwritten", "imageScale": "normal"}'::jsonb)
on conflict (key) do nothing;

-- ── Typography — expand from 4 to 8, same tokens shape as the existing 4 ─────
update public.typography_styles set name = 'Romantic Serif' where key = 'romantic';
update public.typography_styles set name = 'Modern Sans' where key = 'modern_sans';

insert into public.typography_styles (key, name, collection_id, tokens) values
  ('luxury', 'Luxury', null,
   '{"fontUrl": "https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap", "bodyFont": "''EB Garamond'', Georgia, serif", "headingFont": "''EB Garamond'', Georgia, serif", "sampleLabel": "EB Garamond", "headingItalic": false}'::jsonb),
  ('minimal', 'Minimal', null,
   '{"fontUrl": "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap", "bodyFont": "''Inter'', system-ui, sans-serif", "headingFont": "''Inter'', system-ui, sans-serif", "sampleLabel": "Inter", "headingItalic": false}'::jsonb),
  ('calligraphy', 'Calligraphy', null,
   '{"fontUrl": "https://fonts.googleapis.com/css2?family=Great+Vibes&family=Lato:wght@300;400&display=swap", "bodyFont": "''Lato'', system-ui, sans-serif", "headingFont": "''Great Vibes'', cursive", "sampleLabel": "Great Vibes", "headingItalic": false}'::jsonb),
  ('elegant', 'Elegant', null,
   '{"fontUrl": "https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;0,500;1,300;1,400&display=swap", "bodyFont": "''Cormorant'', Georgia, serif", "headingFont": "''Cormorant'', Georgia, serif", "sampleLabel": "Cormorant", "headingItalic": true}'::jsonb)
on conflict (key) do nothing;

-- ── Collections — layout_config backfill for the 8 existing (must match
--    COLLECTIONS in wedding-website.tsx exactly — this is a data mirror of
--    code that already exists, not new design) ────────────────────────────────
update public.collections set layout_config = '{
  "heroType": "full-bleed", "heroAlign": "center", "heroMinHeight": "65vh",
  "headerStyle": "romantic", "storyStyle": "prose", "divider": "botanical",
  "cardRadius": "1rem", "buttonRadius": "0.75rem",
  "galleryLayout": "grid", "rsvpPlacement": "inline", "animationStyle": "fade",
  "scrollBehavior": "normal", "sectionSpacing": "cozy"
}'::jsonb where key = 'classic';

update public.collections set layout_config = '{
  "heroType": "full-bleed", "heroAlign": "left", "heroMinHeight": "75vh",
  "headerStyle": "editorial", "storyStyle": "editorial", "divider": "rule",
  "cardRadius": "0.25rem", "buttonRadius": "0",
  "galleryLayout": "masonry", "rsvpPlacement": "banner", "animationStyle": "rise",
  "scrollBehavior": "normal", "sectionSpacing": "spacious"
}'::jsonb where key = 'modern';

update public.collections set layout_config = '{
  "heroType": "full-bleed", "heroAlign": "center", "heroMinHeight": "60vh",
  "headerStyle": "romantic", "storyStyle": "prose", "divider": "dots",
  "cardRadius": "1.5rem", "buttonRadius": "99px",
  "galleryLayout": "grid", "rsvpPlacement": "inline", "animationStyle": "fade",
  "scrollBehavior": "normal", "sectionSpacing": "cozy"
}'::jsonb where key = 'garden';

update public.collections set layout_config = '{
  "heroType": "invitation", "heroAlign": "center", "heroMinHeight": "auto",
  "headerStyle": "minimal", "storyStyle": "minimal", "divider": "none",
  "cardRadius": "0.25rem", "buttonRadius": "0.25rem",
  "galleryLayout": "grid", "rsvpPlacement": "inline", "animationStyle": "none",
  "scrollBehavior": "normal", "sectionSpacing": "spacious"
}'::jsonb where key = 'minimal';

update public.collections set layout_config = '{
  "heroType": "full-bleed", "heroAlign": "center", "heroMinHeight": "65vh",
  "headerStyle": "romantic", "storyStyle": "quote", "divider": "ornament",
  "cardRadius": "1rem", "buttonRadius": "99px",
  "galleryLayout": "masonry", "rsvpPlacement": "inline", "animationStyle": "fade",
  "scrollBehavior": "normal", "sectionSpacing": "cozy"
}'::jsonb where key = 'romance';

update public.collections set layout_config = '{
  "heroType": "full-bleed", "heroAlign": "center", "heroMinHeight": "65vh",
  "headerStyle": "coastal", "storyStyle": "prose", "divider": "deco",
  "cardRadius": "0.75rem", "buttonRadius": "0.75rem",
  "galleryLayout": "film-strip", "rsvpPlacement": "banner", "animationStyle": "rise",
  "scrollBehavior": "snap", "sectionSpacing": "spacious"
}'::jsonb where key = 'coastal';

update public.collections set layout_config = '{
  "heroType": "full-bleed", "heroAlign": "center", "heroMinHeight": "65vh",
  "headerStyle": "formal", "storyStyle": "prose", "divider": "deco",
  "cardRadius": "0.25rem", "buttonRadius": "0.5rem",
  "galleryLayout": "grid", "rsvpPlacement": "inline", "animationStyle": "none",
  "scrollBehavior": "normal", "sectionSpacing": "spacious"
}'::jsonb where key = 'champagne';

update public.collections set layout_config = '{
  "heroType": "full-bleed", "heroAlign": "left", "heroMinHeight": "80vh",
  "headerStyle": "editorial", "storyStyle": "editorial", "divider": "rule",
  "cardRadius": "0.25rem", "buttonRadius": "0.375rem",
  "galleryLayout": "film-strip", "rsvpPlacement": "banner", "animationStyle": "rise",
  "scrollBehavior": "snap", "sectionSpacing": "spacious"
}'::jsonb where key = 'velvet';

-- ── Collections — 3 new, combining the same closed vocabulary differently ────
insert into public.collections (key, name, description, sort_order, swatch_accent, layout_config) values
  ('estate', 'European Estate', 'Formal grounds, stone and ivy — a grand-house wedding', 8, '#8A8060',
   '{"heroType": "full-bleed", "heroAlign": "center", "heroMinHeight": "70vh",
     "headerStyle": "formal", "storyStyle": "prose", "divider": "ornament",
     "cardRadius": "0.125rem", "buttonRadius": "0.25rem",
     "galleryLayout": "grid", "rsvpPlacement": "inline", "animationStyle": "fade",
     "scrollBehavior": "normal", "sectionSpacing": "spacious"}'::jsonb),
  ('rustic', 'Rustic', 'Weathered wood, wildflowers, an open barn door', 9, '#9A7A54',
   '{"heroType": "full-bleed", "heroAlign": "center", "heroMinHeight": "65vh",
     "headerStyle": "romantic", "storyStyle": "prose", "divider": "botanical",
     "cardRadius": "0.5rem", "buttonRadius": "0.375rem",
     "galleryLayout": "masonry", "rsvpPlacement": "inline", "animationStyle": "fade",
     "scrollBehavior": "normal", "sectionSpacing": "cozy"}'::jsonb),
  ('industrial', 'Industrial', 'Exposed brick, black steel, warehouse light', 10, '#5A5A5A',
   '{"heroType": "full-bleed", "heroAlign": "left", "heroMinHeight": "75vh",
     "headerStyle": "editorial", "storyStyle": "minimal", "divider": "rule",
     "cardRadius": "0", "buttonRadius": "0",
     "galleryLayout": "grid", "rsvpPlacement": "banner", "animationStyle": "none",
     "scrollBehavior": "normal", "sectionSpacing": "compact"}'::jsonb)
on conflict (key) do nothing;

-- Give the 3 new collections a sensible default color story + typography +
-- photo style so picking one produces a genuinely finished-looking site
-- before a couple customizes anything further (matches the existing 8
-- collections' own default_color_story_id/default_typography_style_id
-- pattern already in the schema).
insert into public.color_stories (collection_id, key, name, sort_order, tokens)
select id, 'stone', 'Stone', 0,
  '{"bg": "#F7F5F0", "dark": false, "text": "#2A281E", "accent": "#8A8060", "border": "#E0DACB", "surface": "#FFFEFA", "textMuted": "#78715C", "heroGradient": "linear-gradient(160deg, #5E5A40 0%, #8A8060 50%, #C4BC9E 100%)", "heroTextColor": "#FFFFFF", "heroOverlayColor": "#1A1810", "heroOverlayOpacity": 0.3}'::jsonb
from public.collections where key = 'estate'
on conflict (collection_id, key) do nothing;

insert into public.color_stories (collection_id, key, name, sort_order, tokens)
select id, 'barnwood', 'Barnwood', 0,
  '{"bg": "#FAF6EF", "dark": false, "text": "#2E2418", "accent": "#9A7A54", "border": "#E4D6BE", "surface": "#FFFDF8", "textMuted": "#7A6650", "heroGradient": "linear-gradient(160deg, #6A4E30 0%, #9A7A54 50%, #C8AE84 100%)", "heroTextColor": "#FFF8EC", "heroOverlayColor": "#1E1408", "heroOverlayOpacity": 0.32}'::jsonb
from public.collections where key = 'rustic'
on conflict (collection_id, key) do nothing;

insert into public.color_stories (collection_id, key, name, sort_order, tokens)
select id, 'steel', 'Steel', 0,
  '{"bg": "#F4F4F4", "dark": false, "text": "#1E1E1E", "accent": "#5A5A5A", "border": "#D4D4D4", "surface": "#FAFAFA", "textMuted": "#6E6E6E", "heroGradient": "linear-gradient(160deg, #262626 0%, #4A4A4A 50%, #8A8A8A 100%)", "heroTextColor": "#FFFFFF", "heroOverlayColor": "#000000", "heroOverlayOpacity": 0.45}'::jsonb
from public.collections where key = 'industrial'
on conflict (collection_id, key) do nothing;

update public.collections c set default_color_story_id = cs.id
from public.color_stories cs
where cs.collection_id = c.id and c.key = 'estate' and cs.key = 'stone';
update public.collections c set default_color_story_id = cs.id
from public.color_stories cs
where cs.collection_id = c.id and c.key = 'rustic' and cs.key = 'barnwood';
update public.collections c set default_color_story_id = cs.id
from public.color_stories cs
where cs.collection_id = c.id and c.key = 'industrial' and cs.key = 'steel';

update public.collections set default_typography_style_id = (select id from public.typography_styles where key = 'elegant') where key = 'estate';
update public.collections set default_typography_style_id = (select id from public.typography_styles where key = 'romantic') where key = 'rustic';
update public.collections set default_typography_style_id = (select id from public.typography_styles where key = 'modern_sans') where key = 'industrial';
