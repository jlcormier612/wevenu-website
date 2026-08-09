-- Wedding Website Studio — Photo Style Composition Phase B.
-- Art-direction DNA: sparse Minimal + gallery-wall salon + beauty retunes.
-- Reuses GalleryGrid shared path (Studio / Live / published). No new styles.
-- Film + Modern left structurally unchanged.

-- Editorial — fashion-spread essay (dominant + quiet support + air)
update photo_styles set
  name = 'Editorial',
  description = 'Fashion-spread hierarchy with quiet support',
  tokens = '{
  "shadow": "none", "spacing": "tight", "rotation": "none", "frameStyle": "none",
  "imageScale": "large", "arrangement": "uniform",
  "photoFilter": "contrast(1.08) saturate(1.02)",
  "photoRadius": "0", "captionStyle": "minimal", "scalePattern": "hero-emphasis"
}'::jsonb
where key = 'editorial';

-- Magazine — designed page hierarchy (not scrapbook overlap slots)
update photo_styles set
  name = 'Magazine',
  description = 'Designed magazine page with cover hierarchy',
  tokens = '{
  "shadow": "soft", "spacing": "tight", "rotation": "none", "frameStyle": "none",
  "imageScale": "normal", "arrangement": "collage",
  "photoFilter": "contrast(1.06) saturate(1.02)",
  "photoRadius": "0.15rem", "captionStyle": "minimal", "scalePattern": "uniform"
}'::jsonb
where key = 'magazine';

-- Minimal — sparse 1–2 rectangles + extreme whitespace (no circles)
update photo_styles set
  name = 'Minimal',
  description = 'Sparse quiet frames with breathing room',
  tokens = '{
  "shadow": "none", "spacing": "generous", "rotation": "none", "frameStyle": "none",
  "imageScale": "normal", "arrangement": "sparse",
  "photoFilter": "saturate(0.88) brightness(1.04)",
  "photoRadius": "0", "captionStyle": "none", "scalePattern": "uniform"
}'::jsonb
where key = 'minimal';

-- Luxury — singular centered fine-art mat (±1 secondary)
update photo_styles set
  name = 'Luxury',
  description = 'Singular fine-art mat with calm presence',
  tokens = '{
  "shadow": "soft", "spacing": "generous", "rotation": "none", "frameStyle": "border",
  "imageScale": "large", "arrangement": "uniform",
  "photoFilter": "contrast(1.02) saturate(0.94) brightness(1.02)",
  "photoRadius": "0", "captionStyle": "minimal", "scalePattern": "hero-emphasis"
}'::jsonb
where key = 'luxury';

-- Scrapbook — elegant tactile page, restrained imperfect
update photo_styles set
  name = 'Scrapbook',
  description = 'Elegant memory page with soft layers',
  tokens = '{
  "shadow": "soft", "spacing": "normal", "rotation": "subtle", "frameStyle": "polaroid",
  "imageScale": "normal", "arrangement": "scrapbook",
  "photoFilter": "saturate(1.08) brightness(1.04) contrast(0.98)",
  "photoRadius": "0.25rem", "captionStyle": "handwritten", "scalePattern": "uniform"
}'::jsonb
where key = 'scrapbook';

-- Wildflower — organic rhythm via unequal windows (no tilt-as-identity)
update photo_styles set
  name = 'Wildflower',
  description = 'Organic unequal windows with soft flow',
  tokens = '{
  "shadow": "soft", "spacing": "normal", "rotation": "none", "frameStyle": "none",
  "imageScale": "normal", "arrangement": "uniform",
  "photoFilter": "saturate(1.1) contrast(0.95) brightness(1.03) sepia(0.06)",
  "photoRadius": "0.85rem", "captionStyle": "none", "scalePattern": "alternating"
}'::jsonb
where key = 'wildflower';

-- Midnight — cinematic wide band + dark field + 1–2 supports
update photo_styles set
  name = 'Midnight',
  description = 'Cinematic wide band on a dark field',
  tokens = '{
  "shadow": "none", "spacing": "tight", "rotation": "none", "frameStyle": "none",
  "imageScale": "large", "arrangement": "uniform",
  "photoFilter": "brightness(0.68) contrast(1.32) saturate(0.65)",
  "photoRadius": "0", "captionStyle": "minimal", "scalePattern": "hero-emphasis"
}'::jsonb
where key = 'midnight';

-- Gallery Wall — framed salon, non-overlap (≠ Magazine collage)
update photo_styles set
  name = 'Gallery Wall',
  description = 'Curated salon wall with deliberate spacing',
  tokens = '{
  "shadow": "lifted", "spacing": "normal", "rotation": "none", "frameStyle": "border",
  "imageScale": "normal", "arrangement": "gallery-wall",
  "photoFilter": "contrast(1.04) saturate(0.96)",
  "photoRadius": "0", "captionStyle": "minimal", "scalePattern": "uniform"
}'::jsonb
where key = 'gallery_wall';
