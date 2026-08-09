-- Wedding Website Studio — Final visual differentiation pass.
-- Data-only: retune Collection layout_config + Photo Style tokens for
-- blind-ID silhouettes. No new tables/keys/renames. Renderer composition
-- families are token-gated in GalleryGrid / Hero (code change).

-- ── Collections — sharpen failure-pair silhouettes ──────────────────────────
-- Wildflower: organic flowing center, botanical, cozy (already classic).
-- Midnight: left editorial dark — ensure spacious + masonry shell stays.
update public.collections set layout_config = layout_config || '{
  "heroAlign": "left", "heroMinHeight": "78vh", "headerStyle": "editorial",
  "storyStyle": "editorial", "divider": "rule", "galleryLayout": "masonry",
  "sectionSpacing": "spacious", "contentWidth": "wide", "itemAlign": "left",
  "edgeTreatment": "full-bleed", "density": "spacious"
}'::jsonb where key = 'modern';

-- Garden Party: soft bands + dots — light, celebratory, rounder.
update public.collections set layout_config = layout_config || '{
  "heroAlign": "center", "heroMinHeight": "58vh", "headerStyle": "romantic",
  "storyStyle": "prose", "divider": "dots", "sectionBand": "alternate",
  "asymmetry": "subtle", "density": "cozy", "cardRadius": "1.5rem"
}'::jsonb where key = 'garden';

-- Linen: invitation hero — quiet narrow airy (Hero now keeps suite with photo).
update public.collections set layout_config = layout_config || '{
  "heroType": "invitation", "heroAlign": "center", "heroMinHeight": "auto",
  "headerStyle": "minimal", "storyStyle": "minimal", "divider": "none",
  "contentWidth": "narrow", "density": "airy", "sectionComposition": "quiet",
  "itemAlign": "left", "sectionSpacing": "spacious"
}'::jsonb where key = 'minimal';

-- Champagne: formal framed letterpress — golden center (≠ Velvet left/dark).
update public.collections set layout_config = layout_config || '{
  "heroAlign": "center", "heroMinHeight": "68vh", "headerStyle": "formal",
  "storyStyle": "prose", "divider": "deco", "sectionComposition": "framed",
  "sectionFrame": "card", "featuredItem": "first", "density": "spacious",
  "galleryLayout": "grid"
}'::jsonb where key = 'champagne';

-- Velvet: tall left editorial candlelit (≠ Champagne).
update public.collections set layout_config = layout_config || '{
  "heroAlign": "left", "heroMinHeight": "82vh", "headerStyle": "editorial",
  "storyStyle": "editorial", "divider": "rule", "sectionBand": "tinted",
  "sectionComposition": "editorial", "edgeTreatment": "full-bleed",
  "density": "compact", "galleryLayout": "film-strip", "rsvpPlacement": "banner"
}'::jsonb where key = 'velvet';

-- European Estate: grand formal frame + ornament (≠ Rustic flowing/masonry).
update public.collections set layout_config = layout_config || '{
  "heroAlign": "center", "heroMinHeight": "72vh", "headerStyle": "formal",
  "storyStyle": "prose", "divider": "ornament", "sectionComposition": "framed",
  "sectionFrame": "card", "sectionBand": "alternate", "density": "spacious",
  "galleryLayout": "grid", "contentWidth": "standard", "itemAlign": "center"
}'::jsonb where key = 'estate';

-- Rustic: warm left-flowing masonry botanical (≠ Estate framed center,
-- ≠ Wildflower center grid).
update public.collections set layout_config = layout_config || '{
  "heroAlign": "center", "heroMinHeight": "60vh", "headerStyle": "romantic",
  "storyStyle": "prose", "divider": "botanical", "sectionComposition": "flowing",
  "itemAlign": "left", "alternate": "position", "galleryLayout": "masonry",
  "density": "cozy", "asymmetry": "subtle", "sectionFrame": "none",
  "sectionBand": "none", "contentWidth": "standard"
}'::jsonb where key = 'rustic';

-- Coastal: airy center aspect-aware — keep deco + film-strip + snap.
update public.collections set layout_config = layout_config || '{
  "heroAlign": "center", "heroMinHeight": "65vh", "headerStyle": "coastal",
  "storyStyle": "prose", "divider": "deco", "galleryLayout": "film-strip",
  "scrollBehavior": "snap", "sectionSpacing": "spacious", "density": "airy",
  "itemAlign": "alternating", "edgeTreatment": "alternating"
}'::jsonb where key = 'coastal';

-- Industrial: bold left compact minimal story + rhythm (was missing Phase 4A).
update public.collections set layout_config = layout_config || '{
  "heroAlign": "left", "heroMinHeight": "76vh", "headerStyle": "editorial",
  "storyStyle": "minimal", "divider": "rule", "sectionComposition": "editorial",
  "contentWidth": "wide", "itemAlign": "left", "itemSeparator": "index",
  "density": "compact", "edgeTreatment": "full-bleed", "galleryLayout": "grid",
  "sectionSpacing": "compact", "rsvpPlacement": "banner", "animationStyle": "none",
  "sectionRoles": {
    "hero": {"scale": "feature", "canvas": "photographic", "treatment": "image-led-feature"},
    "story": {"scale": "interlude", "canvas": "neutral", "treatment": "compact-interlude"},
    "event": {"scale": "feature", "canvas": "strong", "treatment": "split-feature"},
    "gallery": {"scale": "feature", "canvas": "photographic", "treatment": "gallery-spread"},
    "schedule": {"scale": "standard", "canvas": "neutral", "treatment": "timeline"},
    "travel": {"scale": "standard", "canvas": "light"},
    "dress_code": {"scale": "interlude", "canvas": "neutral", "pairWith": "bridal_party", "treatment": "paired-passage"},
    "bridal_party": {"scale": "interlude", "canvas": "light", "pairWith": "dress_code", "treatment": "paired-passage"},
    "things_to_do": {"scale": "interlude", "canvas": "soft", "treatment": "compact-interlude"},
    "music": {"scale": "interlude", "canvas": "light", "treatment": "compact-interlude"},
    "registry": {"scale": "interlude", "canvas": "neutral", "pairWith": "faq", "treatment": "paired-passage"},
    "faq": {"scale": "interlude", "canvas": "neutral", "pairWith": "registry", "treatment": "paired-passage"},
    "rsvp": {"scale": "feature", "canvas": "strong", "treatment": "strong-closing"}
  }
}'::jsonb where key = 'industrial';

-- Wildflower: keep botanical romantic flowing center — reaffirm vs Rustic.
update public.collections set layout_config = layout_config || '{
  "heroAlign": "center", "heroMinHeight": "65vh", "headerStyle": "romantic",
  "storyStyle": "prose", "divider": "botanical", "sectionComposition": "flowing",
  "itemAlign": "center", "galleryLayout": "grid", "sectionFrame": "rule-both",
  "density": "cozy", "alternate": "none", "sectionBand": "none"
}'::jsonb where key = 'classic';

-- Rosé: pull-quote romantic (reaffirm).
update public.collections set layout_config = layout_config || '{
  "heroAlign": "center", "heroMinHeight": "65vh", "headerStyle": "romantic",
  "storyStyle": "quote", "divider": "ornament", "density": "spacious",
  "sectionFrame": "rule-top", "galleryLayout": "masonry"
}'::jsonb where key = 'romance';

-- ── Photo Styles — copy + light token polish (composition mostly in GalleryGrid) ──
update photo_styles set
  description = 'Dominant portrait with overlapping grain support',
  tokens = tokens || '{"shadow": "none", "spacing": "tight", "rotation": "none", "frameStyle": "none", "imageScale": "large", "arrangement": "uniform", "scalePattern": "hero-emphasis", "photoRadius": "0"}'::jsonb
where key = 'editorial';

update photo_styles set
  description = 'Layered overlapping editorial collage',
  tokens = tokens || '{"shadow": "soft", "spacing": "tight", "rotation": "subtle", "frameStyle": "none", "arrangement": "collage"}'::jsonb
where key = 'magazine';

update photo_styles set
  description = 'Film-strip contact sheet with sprockets',
  tokens = tokens || '{"shadow": "none", "spacing": "tight", "rotation": "none", "frameStyle": "border", "arrangement": "uniform", "scalePattern": "uniform", "photoRadius": "0"}'::jsonb
where key = 'film';

update photo_styles set
  description = 'Asymmetric circles with calm air',
  tokens = tokens || '{"shadow": "none", "spacing": "generous", "rotation": "none", "frameStyle": "none", "photoRadius": "50%", "scalePattern": "uniform", "arrangement": "uniform"}'::jsonb
where key = 'minimal';

update photo_styles set
  description = 'Perfect equal grid, flush and even',
  tokens = tokens || '{"shadow": "none", "spacing": "normal", "rotation": "none", "frameStyle": "none", "photoFilter": "none", "photoRadius": "0", "scalePattern": "uniform", "arrangement": "uniform"}'::jsonb
where key = 'modern';

update photo_styles set
  description = 'Single immersive moment with refined mats',
  tokens = tokens || '{"shadow": "soft", "spacing": "generous", "rotation": "none", "frameStyle": "border", "imageScale": "large", "scalePattern": "hero-emphasis", "arrangement": "uniform", "photoRadius": "0"}'::jsonb
where key = 'luxury';

update photo_styles set
  description = 'Overlapping polaroids with soft scatter',
  tokens = tokens || '{"shadow": "soft", "rotation": "scattered", "frameStyle": "polaroid", "arrangement": "scrapbook"}'::jsonb
where key = 'scrapbook';

update photo_styles set
  description = 'Organic free-flowing photo cluster',
  tokens = tokens || '{"shadow": "soft", "spacing": "normal", "rotation": "scattered", "frameStyle": "none", "photoRadius": "0.85rem", "scalePattern": "alternating", "arrangement": "uniform"}'::jsonb
where key = 'wildflower';

update photo_styles set
  description = 'Wide cinematic band on black with square supports',
  tokens = tokens || '{"shadow": "none", "spacing": "tight", "rotation": "none", "frameStyle": "none", "imageScale": "large", "scalePattern": "hero-emphasis", "arrangement": "uniform", "photoRadius": "0", "photoFilter": "brightness(0.68) contrast(1.32) saturate(0.65)"}'::jsonb
where key = 'midnight';

update photo_styles set
  description = 'Framed salon wall, axis-aligned hangs',
  tokens = tokens || '{"shadow": "lifted", "spacing": "normal", "rotation": "none", "frameStyle": "border", "arrangement": "collage", "photoRadius": "0"}'::jsonb
where key = 'gallery_wall';
