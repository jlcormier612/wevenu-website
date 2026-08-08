-- Phase 4B — Photo Style presentation-token authoring.
-- Data only: no GalleryGrid/shared-primitive changes. Every style below
-- reuses GalleryGrid's existing token vocabulary (arrangement/scalePattern/
-- frameStyle/shadow/rotation/spacing/photoRadius/photoFilter/imageScale).

-- Editorial — single dominant, edge-to-edge, undecorated, confident.
update photo_styles set tokens = '{
  "shadow": "none", "spacing": "tight", "rotation": "none", "frameStyle": "none",
  "imageScale": "large", "arrangement": "uniform",
  "photoFilter": "contrast(1.1) saturate(1.02)",
  "photoRadius": "0", "captionStyle": "minimal", "scalePattern": "hero-emphasis"
}'::jsonb where key = 'editorial';

-- Luxury — dominant but elevated: premium white frame is the identity,
-- narrower scale + generous spacing + soft shadow separate it structurally
-- from Editorial, not just tonally.
update photo_styles set tokens = '{
  "shadow": "soft", "spacing": "generous", "rotation": "none", "frameStyle": "border",
  "imageScale": "normal", "arrangement": "uniform",
  "photoFilter": "contrast(1.03) saturate(0.94) brightness(1.03)",
  "photoRadius": "0", "captionStyle": "minimal", "scalePattern": "hero-emphasis"
}'::jsonb where key = 'luxury';

-- Minimal — small, centered, quiet. Validation finding: with 3+ photos
-- (any real gallery), GalleryGrid's grid always fills to 3 columns
-- regardless of spacing token, so "generous" spacing alone converged
-- visually with Modern's equal-square grid (same silhouette, only a gap-
-- width difference, not obviously different at a glance). photoRadius:
-- "50%" (circular framing) resolved this decisively — an already-
-- authorized token pushed further, not a new mechanism — and reads as
-- "intentional restraint" distinctly from Modern's rigid squares.
update photo_styles set tokens = '{
  "shadow": "none", "spacing": "generous", "rotation": "none", "frameStyle": "none",
  "imageScale": "normal", "arrangement": "uniform",
  "photoFilter": "saturate(0.88) brightness(1.04)",
  "photoRadius": "50%", "captionStyle": "none", "scalePattern": "uniform"
}'::jsonb where key = 'minimal';

-- Modern — rigid, equal grid. Was "alternating" scalePattern, which spans
-- every 3rd image across 2 columns — directly contradicting "equal
-- rectangles, no overlap." Fixed to "uniform" (equal size, no span).
update photo_styles set tokens = '{
  "shadow": "none", "spacing": "normal", "rotation": "none", "frameStyle": "none",
  "imageScale": "normal", "arrangement": "uniform",
  "photoFilter": "contrast(1.12) saturate(0.98)",
  "photoRadius": "0", "captionStyle": "none", "scalePattern": "uniform"
}'::jsonb where key = 'modern';

-- Magazine — layered collage, varying scale, editorial gloss.
update photo_styles set tokens = '{
  "shadow": "soft", "spacing": "tight", "rotation": "subtle", "frameStyle": "none",
  "imageScale": "normal", "arrangement": "collage",
  "photoFilter": "contrast(1.06) saturate(1.02)",
  "photoRadius": "0.25rem", "captionStyle": "minimal", "scalePattern": "uniform"
}'::jsonb where key = 'magazine';

-- Film — equal photos, identical (white) borders, warm sepia tone.
update photo_styles set tokens = '{
  "shadow": "soft", "spacing": "normal", "rotation": "none", "frameStyle": "border",
  "imageScale": "normal", "arrangement": "uniform",
  "photoFilter": "sepia(0.22) saturate(0.8) contrast(0.94) brightness(1.06)",
  "photoRadius": "0.25rem", "captionStyle": "minimal", "scalePattern": "uniform"
}'::jsonb where key = 'film';

-- Scrapbook — overlapping polaroid prints, visible rotation, soft shadow
-- (spec says "soft shadows" explicitly — was "lifted").
update photo_styles set tokens = '{
  "shadow": "soft", "spacing": "normal", "rotation": "scattered", "frameStyle": "polaroid",
  "imageScale": "normal", "arrangement": "scrapbook",
  "photoFilter": "saturate(1.08) brightness(1.04) contrast(0.98)",
  "photoRadius": "0.25rem", "captionStyle": "handwritten", "scalePattern": "uniform"
}'::jsonb where key = 'scrapbook';

-- Wildflower (new) — organic, uneven, "never grid-based." Revision
-- (2026-08-07, post-approval spatial-composition review): the first pass
-- reused "scrapbook" arrangement's own overlap/offset positions (the only
-- non-grid layout GalleryGrid has), differentiated from Scrapbook only by
-- decoration (no polaroid card). That passed blind identification, but was
-- spatially identical to Scrapbook underneath. Asked and answered: yes, a
-- genuinely distinct spatial composition IS achievable data-only —
-- "uniform" arrangement (the same code path Modern/Editorial/etc. use) +
-- scalePattern "alternating" (varies each photo's span AND aspect ratio —
-- portrait/wide/portrait, not uniform squares) + rotation "scattered"
-- (each photo independently tilted) is a combination no other style uses.
-- It renders through GalleryGrid's grid/masonry code, not scrapbook's
-- custom overlap math — a different code path, not new decoration on the
-- same one. Verified organic (never reads as a rigid grid) on both a
-- grid-layout Collection (Garden Party) and a masonry-layout Collection
-- (Rustic); re-verified against the full 9-style blind identification
-- pass (still 9/9, this style included) and directly against Scrapbook.
insert into photo_styles (key, name, description, sort_order, tokens)
values ('wildflower', 'Wildflower', 'Organic, uneven placement', 7, '{
  "shadow": "soft", "spacing": "normal", "rotation": "scattered", "frameStyle": "none",
  "imageScale": "normal", "arrangement": "uniform",
  "photoFilter": "saturate(1.1) contrast(0.95) brightness(1.03) sepia(0.06)",
  "photoRadius": "0.85rem", "captionStyle": "none", "scalePattern": "alternating"
}'::jsonb)
on conflict (key) do update set tokens = excluded.tokens, description = excluded.description, sort_order = excluded.sort_order;

-- Midnight (new) — one dominant image, dark cinematic filter, otherwise
-- Editorial's own restrained structure (no frame/shadow/rotation) — tone
-- alone, deliberately, is what must separate it: "immediately darker than
-- every other style."
insert into photo_styles (key, name, description, sort_order, tokens)
values ('midnight', 'Midnight', 'Moody, cinematic contrast', 8, '{
  "shadow": "none", "spacing": "tight", "rotation": "none", "frameStyle": "none",
  "imageScale": "large", "arrangement": "uniform",
  "photoFilter": "brightness(0.7) contrast(1.28) saturate(0.7)",
  "photoRadius": "0", "captionStyle": "minimal", "scalePattern": "hero-emphasis"
}'::jsonb)
on conflict (key) do update set tokens = excluded.tokens, description = excluded.description, sort_order = excluded.sort_order;
