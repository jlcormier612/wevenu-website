-- Wedding Website Studio — Collection Composition Phase B.
-- Structural DNA only: composition recipe tokens on layout_config.
-- No Color Story retunes, no Photo Style / Industrial activation, no
-- Linen / Rosé / Velvet composition changes (Velvet remains Midnight baseline).

-- Midnight: panoramic cinematic hero + light paper story chamber
update public.collections set layout_config = layout_config || '{
  "heroType": "full-bleed",
  "heroAlign": "left",
  "heroMinHeight": "42vh",
  "heroAspectCap": "2.2 / 1",
  "heroMaxHeight": "58vh",
  "headerStyle": "editorial",
  "storyStyle": "editorial",
  "divider": "rule",
  "sectionComposition": "editorial",
  "contentWidth": "wide",
  "itemAlign": "left",
  "edgeTreatment": "full-bleed",
  "density": "spacious",
  "galleryLayout": "masonry",
  "sectionSpacing": "spacious",
  "sectionRoles": {
    "hero": {"scale": "feature", "canvas": "photographic", "treatment": "image-led-feature"},
    "story": {"scale": "feature", "canvas": "paper", "treatment": "editorial-opening"},
    "event": {"scale": "feature", "canvas": "soft", "treatment": "split-feature"},
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
}'::jsonb where key = 'modern';

-- Coastal: preserve wide hero tokens + offset editorial Story (EditorialOpening)
update public.collections set layout_config = layout_config || '{
  "heroType": "full-bleed",
  "heroAlign": "center",
  "heroMinHeight": "65vh",
  "heroAspectCap": "2 / 1",
  "heroMaxHeight": "85vh",
  "headerStyle": "coastal",
  "storyStyle": "prose",
  "divider": "deco",
  "galleryLayout": "film-strip",
  "scrollBehavior": "snap",
  "sectionSpacing": "spacious",
  "density": "airy",
  "itemAlign": "alternating",
  "edgeTreatment": "alternating",
  "sectionComposition": "editorial"
}'::jsonb where key = 'coastal';
update public.collections
set layout_config = jsonb_set(
  layout_config,
  '{sectionRoles,story}',
  '{"scale":"standard","canvas":"light","treatment":"editorial-opening"}'::jsonb,
  true
)
where key = 'coastal';

-- European Estate: architectural inset hero + unmasked formal Story (no EditorialOpening)
update public.collections set layout_config = layout_config || '{
  "heroType": "inset",
  "heroAlign": "center",
  "heroMinHeight": "68vh",
  "heroInsetPadding": "1.75rem",
  "heroInsetRadius": "0.125rem",
  "heroInsetBorderWidth": "1px",
  "heroInsetOffsetX": "0",
  "heroInsetOffsetY": "0",
  "headerStyle": "formal",
  "storyStyle": "prose",
  "divider": "ornament",
  "sectionComposition": "framed",
  "sectionFrame": "rule-both",
  "sectionBand": "alternate",
  "density": "spacious",
  "galleryLayout": "grid",
  "contentWidth": "standard",
  "itemAlign": "center",
  "asymmetry": "none"
}'::jsonb where key = 'estate';
update public.collections
set layout_config = jsonb_set(
  layout_config,
  '{sectionRoles,story}',
  '{"scale":"standard","canvas":"light","treatment":"formal-opening"}'::jsonb,
  true
)
where key = 'estate';

-- Rustic: tactile inset/mat (same inset primitive, irregular params) + left Story
update public.collections set layout_config = layout_config || '{
  "heroType": "inset",
  "heroAlign": "left",
  "heroMinHeight": "58vh",
  "heroInsetPadding": "0.85rem 0.85rem 1.45rem 0.85rem",
  "heroInsetRadius": "0.4rem",
  "heroInsetBorderWidth": "0px",
  "heroInsetOffsetX": "-0.65rem",
  "heroInsetOffsetY": "0.45rem",
  "headerStyle": "romantic",
  "storyStyle": "prose",
  "divider": "botanical",
  "sectionComposition": "flowing",
  "itemAlign": "left",
  "alternate": "position",
  "galleryLayout": "masonry",
  "density": "cozy",
  "asymmetry": "subtle",
  "sectionFrame": "none",
  "sectionBand": "none",
  "contentWidth": "standard"
}'::jsonb where key = 'rustic';
update public.collections
set layout_config = jsonb_set(
  layout_config,
  '{sectionRoles,story}',
  '{"scale":"standard","canvas":"light","treatment":"flowing-opening"}'::jsonb,
  true
)
where key = 'rustic';

-- Champagne: formal framed symmetry + ✦ — do NOT use EditorialOpening
update public.collections set layout_config = layout_config || '{
  "heroType": "full-bleed",
  "heroAlign": "center",
  "heroMinHeight": "68vh",
  "headerStyle": "formal",
  "storyStyle": "prose",
  "divider": "deco",
  "sectionComposition": "framed",
  "sectionFrame": "card",
  "featuredItem": "first",
  "density": "spacious",
  "galleryLayout": "grid",
  "itemAlign": "center",
  "asymmetry": "none"
}'::jsonb where key = 'champagne';
update public.collections
set layout_config = jsonb_set(
  layout_config,
  '{sectionRoles,story}',
  '{"scale":"standard","canvas":"light","treatment":"formal-framed"}'::jsonb,
  true
)
where key = 'champagne';

-- Wildflower: offset type + organic/asymmetric Story (≠ Garden Party)
update public.collections set layout_config = layout_config || '{
  "heroType": "full-bleed",
  "heroAlign": "offset",
  "heroMinHeight": "65vh",
  "headerStyle": "romantic",
  "storyStyle": "prose",
  "divider": "botanical",
  "sectionComposition": "flowing",
  "itemAlign": "left",
  "galleryLayout": "grid",
  "sectionFrame": "rule-both",
  "density": "cozy",
  "alternate": "none",
  "sectionBand": "none",
  "asymmetry": "editorial"
}'::jsonb where key = 'classic';
update public.collections
set layout_config = jsonb_set(
  layout_config,
  '{sectionRoles,story}',
  '{"scale":"standard","canvas":"light","treatment":"romantic-opening"}'::jsonb,
  true
)
where key = 'classic';

-- Garden Party: immersive breathing center hero + airy conversational Story
update public.collections set layout_config = layout_config || '{
  "heroType": "full-bleed",
  "heroAlign": "center",
  "heroMinHeight": "72vh",
  "headerStyle": "romantic",
  "storyStyle": "prose",
  "divider": "dots",
  "sectionBand": "alternate",
  "asymmetry": "none",
  "density": "airy",
  "itemAlign": "center",
  "sectionComposition": "flowing",
  "sectionSpacing": "spacious",
  "cardRadius": "1.5rem"
}'::jsonb where key = 'garden';
update public.collections
set layout_config = jsonb_set(
  layout_config,
  '{sectionRoles,story}',
  '{"scale":"standard","canvas":"light","treatment":"conversational-opening"}'::jsonb,
  true
)
where key = 'garden';
