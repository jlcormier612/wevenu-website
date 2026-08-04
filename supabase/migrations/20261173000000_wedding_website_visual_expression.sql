-- Wedding Website Visual Expression Pass (2026-08-03)
-- Data-only migration: adds new keys to the *existing* collections.layout_config
-- and photo_styles.tokens jsonb columns. No new columns, no new tables. Every
-- collection/photo-style row already exists; this only merges additional keys
-- into its existing jsonb value via `||`, preserving every key already there
-- (galleryLayout, rsvpPlacement, animationStyle, scrollBehavior, sectionSpacing,
-- heroType, heroAlign, heroMinHeight, headerStyle, storyStyle, divider,
-- cardRadius, buttonRadius; frameStyle, imageScale, photoFilter, photoRadius,
-- captionStyle).
--
-- Collection composition recipe (see docs/wedding-website-visual-expression-
-- completion-report.md for the full table this seeds).

update public.collections set layout_config = layout_config || '{
  "sectionComposition": "flowing", "contentWidth": "standard", "itemAlign": "center",
  "alternate": "none", "featuredItem": "none", "sectionFrame": "rule-both",
  "sectionBand": "none", "itemSeparator": "divider", "density": "cozy",
  "asymmetry": "none", "edgeTreatment": "contained", "portraitShape": "circle"
}'::jsonb where key = 'classic';

update public.collections set layout_config = layout_config || '{
  "sectionComposition": "editorial", "contentWidth": "wide", "itemAlign": "left",
  "alternate": "none", "featuredItem": "first", "sectionFrame": "none",
  "sectionBand": "none", "itemSeparator": "rule", "density": "spacious",
  "asymmetry": "editorial", "edgeTreatment": "full-bleed", "portraitShape": "square"
}'::jsonb where key = 'modern';

update public.collections set layout_config = layout_config || '{
  "sectionComposition": "flowing", "contentWidth": "standard", "itemAlign": "center",
  "alternate": "background", "featuredItem": "none", "sectionFrame": "none",
  "sectionBand": "alternate", "itemSeparator": "divider", "density": "cozy",
  "asymmetry": "subtle", "edgeTreatment": "contained", "portraitShape": "circle"
}'::jsonb where key = 'garden';

update public.collections set layout_config = layout_config || '{
  "sectionComposition": "quiet", "contentWidth": "narrow", "itemAlign": "left",
  "alternate": "none", "featuredItem": "none", "sectionFrame": "none",
  "sectionBand": "none", "itemSeparator": "rule", "density": "airy",
  "asymmetry": "none", "edgeTreatment": "contained", "portraitShape": "circle"
}'::jsonb where key = 'minimal';

update public.collections set layout_config = layout_config || '{
  "sectionComposition": "flowing", "contentWidth": "standard", "itemAlign": "center",
  "alternate": "none", "featuredItem": "none", "sectionFrame": "rule-top",
  "sectionBand": "none", "itemSeparator": "divider", "density": "spacious",
  "asymmetry": "none", "edgeTreatment": "contained", "portraitShape": "circle"
}'::jsonb where key = 'romance';

update public.collections set layout_config = layout_config || '{
  "sectionComposition": "editorial", "contentWidth": "wide", "itemAlign": "alternating",
  "alternate": "position", "featuredItem": "none", "sectionFrame": "none",
  "sectionBand": "none", "itemSeparator": "rule", "density": "airy",
  "asymmetry": "subtle", "edgeTreatment": "alternating", "portraitShape": "square"
}'::jsonb where key = 'coastal';

update public.collections set layout_config = layout_config || '{
  "sectionComposition": "framed", "contentWidth": "standard", "itemAlign": "center",
  "alternate": "none", "featuredItem": "first", "sectionFrame": "card",
  "sectionBand": "none", "itemSeparator": "gap", "density": "spacious",
  "asymmetry": "none", "edgeTreatment": "contained", "portraitShape": "circle"
}'::jsonb where key = 'champagne';

update public.collections set layout_config = layout_config || '{
  "sectionComposition": "editorial", "contentWidth": "wide", "itemAlign": "left",
  "alternate": "background", "featuredItem": "none", "sectionFrame": "rule-top",
  "sectionBand": "tinted", "itemSeparator": "rule", "density": "compact",
  "asymmetry": "editorial", "edgeTreatment": "full-bleed", "portraitShape": "square"
}'::jsonb where key = 'velvet';

update public.collections set layout_config = layout_config || '{
  "sectionComposition": "framed", "contentWidth": "standard", "itemAlign": "center",
  "alternate": "background", "featuredItem": "none", "sectionFrame": "card",
  "sectionBand": "alternate", "itemSeparator": "divider", "density": "spacious",
  "asymmetry": "none", "edgeTreatment": "contained", "portraitShape": "circle"
}'::jsonb where key = 'estate';

update public.collections set layout_config = layout_config || '{
  "sectionComposition": "flowing", "contentWidth": "standard", "itemAlign": "left",
  "alternate": "position", "featuredItem": "none", "sectionFrame": "none",
  "sectionBand": "none", "itemSeparator": "divider", "density": "cozy",
  "asymmetry": "subtle", "edgeTreatment": "contained", "portraitShape": "circle"
}'::jsonb where key = 'rustic';

update public.collections set layout_config = layout_config || '{
  "sectionComposition": "editorial", "contentWidth": "wide", "itemAlign": "left",
  "alternate": "none", "featuredItem": "none", "sectionFrame": "none",
  "sectionBand": "none", "itemSeparator": "index", "density": "compact",
  "asymmetry": "none", "edgeTreatment": "full-bleed", "portraitShape": "square"
}'::jsonb where key = 'industrial';

-- Photo Style token vocabulary extension — arrangement/scalePattern/rotation/
-- shadow/spacing added alongside the existing frameStyle/imageScale/
-- photoFilter/photoRadius/captionStyle (captionStyle stays present, unused —
-- dormant pending a future photo-caption capability, not deleted).

update public.photo_styles set tokens = tokens || '{
  "arrangement": "uniform", "scalePattern": "hero-emphasis",
  "rotation": "none", "shadow": "none", "spacing": "tight"
}'::jsonb where key = 'editorial';

update public.photo_styles set tokens = tokens || '{
  "arrangement": "collage", "scalePattern": "uniform",
  "rotation": "subtle", "shadow": "soft", "spacing": "tight"
}'::jsonb where key = 'magazine';

update public.photo_styles set tokens = tokens || '{
  "arrangement": "uniform", "scalePattern": "uniform",
  "rotation": "none", "shadow": "soft", "spacing": "normal"
}'::jsonb where key = 'film';

update public.photo_styles set tokens = tokens || '{
  "arrangement": "uniform", "scalePattern": "uniform",
  "rotation": "none", "shadow": "none", "spacing": "generous"
}'::jsonb where key = 'minimal';

update public.photo_styles set tokens = tokens || '{
  "arrangement": "uniform", "scalePattern": "alternating",
  "rotation": "none", "shadow": "none", "spacing": "tight"
}'::jsonb where key = 'modern';

update public.photo_styles set tokens = tokens || '{
  "arrangement": "uniform", "scalePattern": "hero-emphasis",
  "rotation": "none", "shadow": "soft", "spacing": "generous"
}'::jsonb where key = 'luxury';

update public.photo_styles set tokens = tokens || '{
  "arrangement": "scrapbook", "scalePattern": "uniform",
  "rotation": "scattered", "shadow": "lifted", "spacing": "normal"
}'::jsonb where key = 'scrapbook';
