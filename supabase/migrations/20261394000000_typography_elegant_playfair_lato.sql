-- Elegant typography — approved distinction from Romantic Serif.
--
-- KEEP Romantic Serif (key=romantic): Cormorant Garamond italic — untouched.
-- CHANGE ONLY Elegant (key=elegant):
--   Heading: Playfair Display italic
--   Body: Lato
--
-- Replaces the earlier EB Garamond + Lato pairing from
-- 20261366000000_typography_elegant_distinct_from_romantic.sql.

update public.typography_styles
set
  tokens = '{
    "fontUrl": "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Lato:wght@300;400;600&display=swap",
    "bodyFont": "''Lato'', system-ui, sans-serif",
    "headingFont": "''Playfair Display'', Georgia, serif",
    "sampleLabel": "Playfair Display",
    "headingItalic": true
  }'::jsonb,
  updated_at = now()
where key = 'elegant';
