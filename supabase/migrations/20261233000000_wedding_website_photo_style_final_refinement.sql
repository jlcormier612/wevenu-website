-- Wedding Website Studio — Final Photo Style visual refinement.
-- Data: retune presentation tokens so all 10 styles remain blind-ID distinct,
-- especially Editorial≠Luxury and Film≠Modern. Reuses GalleryGrid's existing
-- token vocabulary. Related GalleryGrid changes (separate code commit):
--   (1) contact-sheet fusion when border + tight + uniform (Film)
--   (2) hero-emphasis lead cell uses portrait 4/5 aspect (Luxury / Midnight)
-- No new tables, keys, or style renames.

-- Editorial — art-directed asymmetrical dominant + supporting crops,
-- edge-to-edge, unframed, tight. ≠ Luxury (which uses equal large
-- framed panels) and Midnight (same hero structure but immediately dark).
update photo_styles set
  name = 'Editorial',
  description = 'Asymmetrical dominant with supporting crops',
  sort_order = 0,
  tokens = '{
  "shadow": "none", "spacing": "tight", "rotation": "none", "frameStyle": "none",
  "imageScale": "large", "arrangement": "uniform",
  "photoFilter": "contrast(1.08) saturate(1.02)",
  "photoRadius": "0", "captionStyle": "minimal", "scalePattern": "hero-emphasis"
}'::jsonb
where key = 'editorial';

-- Magazine — layered collage with tilt (leave spatial; clarify copy).
update photo_styles set
  name = 'Magazine',
  description = 'Layered collage with editorial gloss',
  sort_order = 1,
  tokens = '{
  "shadow": "soft", "spacing": "tight", "rotation": "subtle", "frameStyle": "none",
  "imageScale": "normal", "arrangement": "collage",
  "photoFilter": "contrast(1.06) saturate(1.02)",
  "photoRadius": "0.25rem", "captionStyle": "minimal", "scalePattern": "uniform"
}'::jsonb
where key = 'magazine';

-- Film — equal contact sheet: white mats fuse (tight+border+uniform), warm grain.
-- Must differ from Modern's flush equal grid by continuous sheet geometry, not filter alone.
update photo_styles set
  name = 'Film',
  description = 'Contact-sheet prints with warm grain',
  sort_order = 2,
  tokens = '{
  "shadow": "none", "spacing": "tight", "rotation": "none", "frameStyle": "border",
  "imageScale": "normal", "arrangement": "uniform",
  "photoFilter": "sepia(0.28) saturate(0.78) contrast(0.92) brightness(1.05)",
  "photoRadius": "0", "captionStyle": "minimal", "scalePattern": "uniform"
}'::jsonb
where key = 'film';

-- Minimal — quiet circles with breathing room.
update photo_styles set
  name = 'Minimal',
  description = 'Quiet circular frames with calm space',
  sort_order = 3,
  tokens = '{
  "shadow": "none", "spacing": "generous", "rotation": "none", "frameStyle": "none",
  "imageScale": "normal", "arrangement": "uniform",
  "photoFilter": "saturate(0.88) brightness(1.04)",
  "photoRadius": "50%", "captionStyle": "none", "scalePattern": "uniform"
}'::jsonb
where key = 'minimal';

-- Modern — crisp equal geometric grid, flush, no mat/filter/rotation.
update photo_styles set
  name = 'Modern',
  description = 'Perfect equal grid, crisp and even',
  sort_order = 4,
  tokens = '{
  "shadow": "none", "spacing": "normal", "rotation": "none", "frameStyle": "none",
  "imageScale": "normal", "arrangement": "uniform",
  "photoFilter": "none",
  "photoRadius": "0", "captionStyle": "none", "scalePattern": "uniform"
}'::jsonb
where key = 'modern';

-- Luxury — immersive cinematic dominant + refined white mat + generous air.
-- Shares hero silhouette with Editorial/Midnight but mats + air + soft shadow
-- make it unmistakable (Editorial is edge-to-edge; Midnight is dark).
update photo_styles set
  name = 'Luxury',
  description = 'Immersive dominant moments, refined mats',
  sort_order = 5,
  tokens = '{
  "shadow": "soft", "spacing": "generous", "rotation": "none", "frameStyle": "border",
  "imageScale": "large", "arrangement": "uniform",
  "photoFilter": "contrast(1.02) saturate(0.94) brightness(1.02)",
  "photoRadius": "0", "captionStyle": "minimal", "scalePattern": "hero-emphasis"
}'::jsonb
where key = 'luxury';

-- Scrapbook — polaroid scatter (unchanged spatial identity).
update photo_styles set
  name = 'Scrapbook',
  description = 'Overlapping polaroids with soft scatter',
  sort_order = 6,
  tokens = '{
  "shadow": "soft", "spacing": "normal", "rotation": "scattered", "frameStyle": "polaroid",
  "imageScale": "normal", "arrangement": "scrapbook",
  "photoFilter": "saturate(1.08) brightness(1.04) contrast(0.98)",
  "photoRadius": "0.25rem", "captionStyle": "handwritten", "scalePattern": "uniform"
}'::jsonb
where key = 'scrapbook';

-- Wildflower — organic uneven with soft tilt (alternating + scattered).
update photo_styles set
  name = 'Wildflower',
  description = 'Organic uneven crops with soft tilt',
  sort_order = 7,
  tokens = '{
  "shadow": "soft", "spacing": "normal", "rotation": "scattered", "frameStyle": "none",
  "imageScale": "normal", "arrangement": "uniform",
  "photoFilter": "saturate(1.1) contrast(0.95) brightness(1.03) sepia(0.06)",
  "photoRadius": "0.85rem", "captionStyle": "none", "scalePattern": "alternating"
}'::jsonb
where key = 'wildflower';

-- Midnight — same cinematic dominant structure as Luxury, immediately dark.
update photo_styles set
  name = 'Midnight',
  description = 'Moody cinematic contrast',
  sort_order = 8,
  tokens = '{
  "shadow": "none", "spacing": "tight", "rotation": "none", "frameStyle": "none",
  "imageScale": "large", "arrangement": "uniform",
  "photoFilter": "brightness(0.68) contrast(1.32) saturate(0.65)",
  "photoRadius": "0", "captionStyle": "minimal", "scalePattern": "hero-emphasis"
}'::jsonb
where key = 'midnight';

-- Gallery Wall — upright framed collage salon (axis-aligned mats + lift).
update photo_styles set
  name = 'Gallery Wall',
  description = 'Curated, layered & collected',
  sort_order = 9,
  tokens = '{
  "shadow": "lifted", "spacing": "normal", "rotation": "none", "frameStyle": "border",
  "imageScale": "normal", "arrangement": "collage",
  "photoFilter": "contrast(1.04) saturate(0.96)",
  "photoRadius": "0", "captionStyle": "minimal", "scalePattern": "uniform"
}'::jsonb
where key = 'gallery_wall';
