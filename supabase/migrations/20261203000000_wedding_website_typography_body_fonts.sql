-- Hosted Experience RC1, Part 1 — Typography certification.
-- Defect found: 4 of 8 styles (Luxury, Playful, Romantic Serif, Editorial)
-- had bodyFont hardcoded to "system-ui, sans-serif" with no webfont ever
-- requested in fontUrl — body text was rendering in a fallback font by
-- design, on every surface, for every couple who picked one of these 4.
-- Separately, Calligraphy and Elegant both used Lato for body — two
-- unrelated personalities sharing a body font with no documented reason.
-- Fixed by authoring a real, distinct, loaded body font for each — never
-- touching heading fonts (already correct) or the rendering pipeline.

-- Luxury (Bodoni Moda heading, unchanged) — Jost body: geometric,
-- fashion-catalog sans, distinct from every other pairing's body font.
update typography_styles set tokens = jsonb_set(
  jsonb_set(tokens, '{bodyFont}', '"''Jost'', system-ui, sans-serif"'),
  '{fontUrl}', '"https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,wght@0,400;0,600;0,700&family=Jost:wght@300;400;500&display=swap"'
) where key = 'luxury';

-- Calligraphy (Great Vibes heading, unchanged) — Cardo body, replacing
-- Lato (which Elegant already owns). A formal old-style serif reads as
-- "formal script invitation," distinct from Elegant's clean editorial sans.
update typography_styles set tokens = jsonb_set(
  jsonb_set(tokens, '{bodyFont}', '"''Cardo'', Georgia, serif"'),
  '{fontUrl}', '"https://fonts.googleapis.com/css2?family=Great+Vibes&family=Cardo:ital,wght@0,400;0,700;1,400&display=swap"'
) where key = 'calligraphy';

-- Playful (Fraunces heading, unchanged) — Karla body: warm, humanist,
-- friendly geometric sans.
update typography_styles set tokens = jsonb_set(
  jsonb_set(tokens, '{bodyFont}', '"''Karla'', system-ui, sans-serif"'),
  '{fontUrl}', '"https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Karla:wght@300;400;500&display=swap"'
) where key = 'playful';

-- Romantic Serif (Cormorant Garamond heading, unchanged) — EB Garamond
-- body: a classic old-style serif companion, both serif, reads as
-- "traditional wedding elegance" — distinct from Elegant's serif+sans
-- editorial mix.
update typography_styles set tokens = jsonb_set(
  jsonb_set(tokens, '{bodyFont}', '"''EB Garamond'', Georgia, serif"'),
  '{fontUrl}', '"https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap"'
) where key = 'romantic';

-- Editorial (DM Serif Display heading, unchanged) — Work Sans body: crisp
-- contemporary magazine-body sans.
update typography_styles set tokens = jsonb_set(
  jsonb_set(tokens, '{bodyFont}', '"''Work Sans'', system-ui, sans-serif"'),
  '{fontUrl}', '"https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Work+Sans:wght@300;400;500&display=swap"'
) where key = 'editorial';
