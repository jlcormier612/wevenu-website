-- Wedding Website Studio — Photo Style catalog refinement + Gallery Wall.
-- Primarily data: retune presentation tokens / copy for clearer blind ID,
-- insert Gallery Wall. Reuses GalleryGrid's existing token vocabulary
-- (arrangement/scalePattern/frameStyle/shadow/rotation/spacing/photoRadius/
-- photoFilter/imageScale). One related GalleryGrid change (separate code
-- commit): collage ambient ±1.5° tilt now gates on rotation !== "none" so
-- Gallery Wall can be axis-aligned framed layering without inventing a new
-- arrangement type. Magazine keeps rotation "subtle" → unchanged tilt.

-- Editorial — asymmetrical dominant + supporting, crisp/no obvious filter,
-- intentional whitespace via large hero-emphasis (must differ from Luxury).
update photo_styles set
  name = 'Editorial',
  description = 'Asymmetrical dominant frame with supporting crops',
  sort_order = 0,
  tokens = '{
  "shadow": "none", "spacing": "normal", "rotation": "none", "frameStyle": "none",
  "imageScale": "large", "arrangement": "uniform",
  "photoFilter": "none",
  "photoRadius": "0", "captionStyle": "minimal", "scalePattern": "hero-emphasis"
}'::jsonb
where key = 'editorial';

-- Magazine — leave spatial treatment; refine photo-behavior copy only.
update photo_styles set
  name = 'Magazine',
  description = 'Layered collage with editorial gloss',
  sort_order = 1
where key = 'magazine';

-- Film — contact-sheet print: equal cells, visible borders, warm/soft sepia
-- (must differ from Modern's crisp unframed equal grid).
update photo_styles set
  name = 'Film',
  description = 'Contact-sheet borders with warm soft grain',
  sort_order = 2,
  tokens = '{
  "shadow": "soft", "spacing": "normal", "rotation": "none", "frameStyle": "border",
  "imageScale": "normal", "arrangement": "uniform",
  "photoFilter": "sepia(0.28) saturate(0.78) contrast(0.92) brightness(1.05)",
  "photoRadius": "0.15rem", "captionStyle": "minimal", "scalePattern": "uniform"
}'::jsonb
where key = 'film';

-- Minimal — leave spatial treatment (circular framing); refine copy.
update photo_styles set
  name = 'Minimal',
  description = 'Quiet circular frames with calm space',
  sort_order = 3
where key = 'minimal';

-- Modern — perfect equal grid, crisp, no filter/rotation
-- (geometry identical to Film's equal cells; Film carries borders + sepia).
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

-- Luxury — fewer/larger with generous air + elegant white frame
-- (must differ from Editorial: frame + spacing + soft shadow, not edge-to-edge).
update photo_styles set
  name = 'Luxury',
  description = 'Fewer larger frames with generous air',
  sort_order = 5,
  tokens = '{
  "shadow": "soft", "spacing": "generous", "rotation": "none", "frameStyle": "border",
  "imageScale": "large", "arrangement": "uniform",
  "photoFilter": "contrast(1.02) saturate(0.94) brightness(1.02)",
  "photoRadius": "0", "captionStyle": "minimal", "scalePattern": "hero-emphasis"
}'::jsonb
where key = 'luxury';

-- Scrapbook — leave polaroid treatment; refine photo-behavior copy.
update photo_styles set
  name = 'Scrapbook',
  description = 'Overlapping polaroids with soft scatter',
  sort_order = 6
where key = 'scrapbook';

-- Wildflower — leave organic alternating + scatter; refine copy.
update photo_styles set
  name = 'Wildflower',
  description = 'Organic uneven crops with soft tilt',
  sort_order = 7
where key = 'wildflower';

-- Midnight — leave cinematic treatment (do not remove); refine copy.
update photo_styles set
  name = 'Midnight',
  description = 'Moody cinematic contrast',
  sort_order = 8
where key = 'midnight';

-- Gallery Wall (new) — curated layered salon: Magazines collage geometry
-- with sophisticated white mats, axis-aligned (rotation none → no ambient
-- tilt), lifted depth. Not Scrapbook (no polaroid/scatter), not Magazine
-- (framed + upright + lifted), not Wildflower (layered collage path).
insert into photo_styles (key, name, description, sort_order, tokens)
values ('gallery_wall', 'Gallery Wall', 'Curated, layered & collected', 9, '{
  "shadow": "lifted", "spacing": "normal", "rotation": "none", "frameStyle": "border",
  "imageScale": "normal", "arrangement": "collage",
  "photoFilter": "contrast(1.04) saturate(0.96)",
  "photoRadius": "0", "captionStyle": "minimal", "scalePattern": "uniform"
}'::jsonb)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  tokens = excluded.tokens;
