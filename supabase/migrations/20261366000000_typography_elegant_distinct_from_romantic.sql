-- Wedding Website Typography — make Elegant distinct from Romantic Serif.
--
-- Root cause: Elegant (key=elegant) was seeded with Cormorant for BOTH
-- heading and body, while Romantic Serif (key=romantic) uses Cormorant
-- Garamond italic headings — same type family, nearly identical at a glance.
--
-- Fix: re-point Elegant at EB Garamond (upright, refined) + Lato body —
-- fonts already used elsewhere in the typography catalog (Luxury / Classic).
-- Same row key/id so existing couple_websites.typography_style_id FK and
-- font_pairing='elegant' keep working; only the visual tokens change.

update public.typography_styles
set
  tokens = '{
    "fontUrl": "https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Lato:wght@300;400;600&display=swap",
    "bodyFont": "''Lato'', system-ui, sans-serif",
    "headingFont": "''EB Garamond'', Georgia, serif",
    "sampleLabel": "EB Garamond",
    "headingItalic": false
  }'::jsonb,
  updated_at = now()
where key = 'elegant';
