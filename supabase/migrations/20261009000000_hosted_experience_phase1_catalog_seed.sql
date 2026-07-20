-- ============================================================================
-- Hosted Experience Platform — Phase 1: Catalog Seed
--
-- Faithful data migration of the current hardcoded COLLECTIONS/PALETTES
-- (components/wedding-website/wedding-website.tsx) into the new catalog
-- tables — values copied exactly, not redesigned. FONT_PAIRINGS
-- (components/portal/website-editor.tsx) seeded as typography_styles with
-- collection_id left null (see prior migration's scope note).
--
-- keys use the existing string values already stored in couple_websites
-- (theme = collection key; theme_palette = palette display name, matched
-- case-insensitively by resolveTheme() today) so the next migration's
-- backfill can join on them directly.
-- ============================================================================

-- ── Collections (8, matching COLLECTIONS in wedding-website.tsx) ────────────
insert into public.collections (key, name, description, sort_order, swatch_accent) values
  ('classic',   'Wildflower',    'English garden party — Playfair Display, pressed botanical elements.', 0, '#97AC9E'),
  ('modern',    'Midnight',      'Atmospheric indigo editorial — DM Sans, Vogue energy.',                 1, '#BFB8CE'),
  ('garden',    'Garden Party',  'English countryside charm — Georgia, Rifle Paper Co. inspired.',        2, '#9DC4A8'),
  ('minimal',   'Linen',         'Luxury stationery — letterpress, deckled edges, timeless black & white.', 3, '#C8B898'),
  ('romance',   'Rosé',          'Garden rose watercolor — Cormorant Garamond italic, ribbon frames.',    4, '#CCA8A0'),
  ('coastal',   'Coastal',       'Nantucket — Plus Jakarta Sans, clean airy photography.',                5, '#4A6278'),
  ('champagne', 'Champagne',     'Crane & Co. letterpress — Playfair Display, formal portrait tone.',     6, '#C4AE88'),
  ('velvet',    'Velvet',        'Met Gala black-tie — Cormorant Garamond, candlelit drama, warm sepia.', 7, '#C9B89A');

-- ── Color Stories — 3 per collection, exact PALETTES values ─────────────────
insert into public.color_stories (collection_id, key, name, sort_order, tokens)
select c.id, v.key, v.name, v.sort_order, v.tokens::jsonb
from public.collections c
join (values
  -- classic (Wildflower)
  ('classic', 'sage', 'Sage', 0, '{"bg":"#FAF8F4","surface":"#FFFFFF","text":"#2E2A24","textMuted":"#7A7268","border":"#E8E0D2","accent":"#97AC9E","heroGradient":"linear-gradient(160deg, #6A8A78 0%, #97AC9E 50%, #C8D5C8 100%)","heroOverlayColor":"#2A3A2A","heroOverlayOpacity":0.3,"heroTextColor":"#FFFFFF","dark":false}'),
  ('classic', 'mauve', 'Mauve', 1, '{"bg":"#FAF5F7","surface":"#FFFFFF","text":"#2E2430","textMuted":"#7A6875","border":"#ECD8E4","accent":"#B89AAC","heroGradient":"linear-gradient(160deg, #8A7080 0%, #B898AC 50%, #DCC8D4 100%)","heroOverlayColor":"#2A1028","heroOverlayOpacity":0.3,"heroTextColor":"#FFF6FA","dark":false}'),
  ('classic', 'terracotta', 'Terracotta', 2, '{"bg":"#FAF6F2","surface":"#FFFFFF","text":"#30241A","textMuted":"#7A6858","border":"#E8D8C8","accent":"#B49480","heroGradient":"linear-gradient(160deg, #907060 0%, #B49480 50%, #D4B8A0 100%)","heroOverlayColor":"#2A1808","heroOverlayOpacity":0.3,"heroTextColor":"#FFF6EE","dark":false}'),
  -- modern (Midnight)
  ('modern', 'indigo', 'Indigo', 0, '{"bg":"#1A1525","surface":"#231E30","text":"#EDE8E2","textMuted":"#8A8598","border":"#352E48","accent":"#BFB8CE","heroGradient":"linear-gradient(160deg, #120F1A 0%, #1E1828 40%, #2E2545 100%)","heroOverlayColor":"#000000","heroOverlayOpacity":0.5,"heroTextColor":"#EDE8E2","dark":true}'),
  ('modern', 'onyx', 'Onyx', 1, '{"bg":"#141414","surface":"#1E1E1E","text":"#EEEAE5","textMuted":"#888078","border":"#2A2A28","accent":"#C0B8A8","heroGradient":"linear-gradient(160deg, #0A0A0A 0%, #181818 50%, #252520 100%)","heroOverlayColor":"#000000","heroOverlayOpacity":0.6,"heroTextColor":"#EEEAE5","dark":true}'),
  ('modern', 'plum', 'Plum', 2, '{"bg":"#1A1020","surface":"#221830","text":"#EDE5F0","textMuted":"#8A80A0","border":"#342848","accent":"#C0A8CC","heroGradient":"linear-gradient(160deg, #120818 0%, #1E1030 40%, #2E1848 100%)","heroOverlayColor":"#080010","heroOverlayOpacity":0.5,"heroTextColor":"#EDE5F0","dark":true}'),
  -- garden (Garden Party)
  ('garden', 'eucalyptus', 'Eucalyptus', 0, '{"bg":"#FAF8F2","surface":"#FFFEF9","text":"#2A2820","textMuted":"#706A58","border":"#DED6C5","accent":"#9DC4A8","heroGradient":"linear-gradient(160deg, #5A8A70 0%, #7AAE8C 50%, #B0CEBC 100%)","heroOverlayColor":"#1A2010","heroOverlayOpacity":0.2,"heroTextColor":"#FFFFFF","dark":false}'),
  ('garden', 'peony', 'Peony', 1, '{"bg":"#FAF5F6","surface":"#FFFAFA","text":"#2E2428","textMuted":"#7A6068","border":"#EDD8DC","accent":"#D4A0AC","heroGradient":"linear-gradient(160deg, #B07088 0%, #D4A0AC 50%, #EECCD4 100%)","heroOverlayColor":"#2A0818","heroOverlayOpacity":0.2,"heroTextColor":"#FFF2F5","dark":false}'),
  ('garden', 'wisteria', 'Wisteria', 2, '{"bg":"#F8F5FA","surface":"#FDF9FF","text":"#28243C","textMuted":"#6860A0","border":"#DCCCE8","accent":"#A898C0","heroGradient":"linear-gradient(160deg, #685898 0%, #A898C0 50%, #CCC0D8 100%)","heroOverlayColor":"#180828","heroOverlayOpacity":0.25,"heroTextColor":"#F8F3FF","dark":false}'),
  -- minimal (Linen)
  ('minimal', 'ivory', 'Ivory', 0, '{"bg":"#FCFAF6","surface":"#FEFDF9","text":"#5B534D","textMuted":"#8A8078","border":"#EBE5DB","accent":"#C8B898","heroGradient":"none","heroOverlayColor":"#1A1818","heroOverlayOpacity":0,"heroTextColor":"#FFFFFF","dark":false}'),
  ('minimal', 'blush', 'Blush', 1, '{"bg":"#FAF6F5","surface":"#FEFAFA","text":"#5B4D4C","textMuted":"#8A7878","border":"#EBD8D5","accent":"#D4B8B0","heroGradient":"none","heroOverlayColor":"#1A1010","heroOverlayOpacity":0,"heroTextColor":"#FFFFFF","dark":false}'),
  ('minimal', 'slate', 'Slate', 2, '{"bg":"#F5F6F8","surface":"#FAFBFC","text":"#4D5058","textMuted":"#788090","border":"#D8DCE4","accent":"#A8B0B8","heroGradient":"none","heroOverlayColor":"#101418","heroOverlayOpacity":0,"heroTextColor":"#FFFFFF","dark":false}'),
  -- romance (Rosé)
  ('romance', 'blush', 'Blush', 0, '{"bg":"#FAF6F4","surface":"#FFFFFE","text":"#2E1A18","textMuted":"#7A5855","border":"#EDD6CE","accent":"#CCA8A0","heroGradient":"linear-gradient(160deg, #A07070 0%, #CCA8A0 50%, #EDD6CE 100%)","heroOverlayColor":"#3A1010","heroOverlayOpacity":0.25,"heroTextColor":"#FFF8F5","dark":false}'),
  ('romance', 'petal', 'Petal', 1, '{"bg":"#FAF4F6","surface":"#FEFAFC","text":"#2E1820","textMuted":"#7A5868","border":"#EDD0DC","accent":"#CCA0B0","heroGradient":"linear-gradient(160deg, #A07088 0%, #CCA0B0 50%, #EDD0DC 100%)","heroOverlayColor":"#3A0818","heroOverlayOpacity":0.25,"heroTextColor":"#FFF5F8","dark":false}'),
  ('romance', 'powder', 'Powder', 2, '{"bg":"#F4F6FA","surface":"#F9FAFD","text":"#1A1E30","textMuted":"#606888","border":"#D0D4E8","accent":"#A0A8CC","heroGradient":"linear-gradient(160deg, #707090 0%, #A0A8CC 50%, #D0D4E8 100%)","heroOverlayColor":"#080A18","heroOverlayOpacity":0.3,"heroTextColor":"#F5F7FF","dark":false}'),
  -- coastal
  ('coastal', 'navy', 'Navy', 0, '{"bg":"#FAFBFC","surface":"#FFFFFF","text":"#1E2E3A","textMuted":"#4A6275","border":"#C8D8E0","accent":"#4A6278","heroGradient":"linear-gradient(160deg, #324E64 0%, #4A6278 50%, #C8DCE8 100%)","heroOverlayColor":"#0A1A28","heroOverlayOpacity":0.4,"heroTextColor":"#FFFFFF","dark":false}'),
  ('coastal', 'sea glass', 'Sea Glass', 1, '{"bg":"#F4FAF8","surface":"#FAFFFE","text":"#1A2E28","textMuted":"#4A7060","border":"#C0DCD4","accent":"#4A7868","heroGradient":"linear-gradient(160deg, #2A5848 0%, #4A7868 50%, #A0C8BC 100%)","heroOverlayColor":"#081A14","heroOverlayOpacity":0.35,"heroTextColor":"#F0FDF8","dark":false}'),
  ('coastal', 'sand', 'Sand', 2, '{"bg":"#FAF8F4","surface":"#FFFDF9","text":"#2E2A1E","textMuted":"#7A7060","border":"#E0D8C8","accent":"#9A8068","heroGradient":"linear-gradient(160deg, #5A4A38 0%, #9A8068 60%, #C0AE98 100%)","heroOverlayColor":"#1A1008","heroOverlayOpacity":0.35,"heroTextColor":"#FFF8F0","dark":false}'),
  -- champagne
  ('champagne', 'warm stone', 'Warm Stone', 0, '{"bg":"#FBF8F3","surface":"#FFFEF9","text":"#2A2210","textMuted":"#6A5838","border":"#E8DCC8","accent":"#C4AE88","heroGradient":"linear-gradient(160deg, #7A6040 0%, #A08558 60%, #C4AE88 100%)","heroOverlayColor":"#1A0A00","heroOverlayOpacity":0.3,"heroTextColor":"#FFF9E8","dark":false}'),
  ('champagne', 'ecru', 'Ecru', 1, '{"bg":"#FAF8F4","surface":"#FEFCF8","text":"#2A2418","textMuted":"#6A5E40","border":"#E4D8C0","accent":"#B4A888","heroGradient":"linear-gradient(160deg, #6A5A38 0%, #9A8860 60%, #B8A880 100%)","heroOverlayColor":"#100800","heroOverlayOpacity":0.3,"heroTextColor":"#FFFAEF","dark":false}'),
  ('champagne', 'charcoal', 'Charcoal', 2, '{"bg":"#F5F5F5","surface":"#FAFAFA","text":"#282828","textMuted":"#686868","border":"#D8D8D8","accent":"#989890","heroGradient":"linear-gradient(160deg, #3A3A38 0%, #686860 60%, #989890 100%)","heroOverlayColor":"#101010","heroOverlayOpacity":0.35,"heroTextColor":"#F8F8F5","dark":false}'),
  -- velvet
  ('velvet', 'burgundy', 'Burgundy', 0, '{"bg":"#1E1015","surface":"#2A1520","text":"#F7F3EE","textMuted":"#9A8870","border":"#4A2830","accent":"#C9B89A","heroGradient":"linear-gradient(160deg, #1E1015 0%, #3A1820 60%, #5B3438 100%)","heroOverlayColor":"#0A0008","heroOverlayOpacity":0.5,"heroTextColor":"#F7F3EE","dark":true}'),
  ('velvet', 'noir', 'Noir', 1, '{"bg":"#0F0F0F","surface":"#1A1A1A","text":"#F0ECE8","textMuted":"#907868","border":"#2A2020","accent":"#C0B89A","heroGradient":"linear-gradient(160deg, #0A0A0A 0%, #1A1818 50%, #2A2020 100%)","heroOverlayColor":"#000000","heroOverlayOpacity":0.6,"heroTextColor":"#F0ECE8","dark":true}'),
  ('velvet', 'plum', 'Plum', 2, '{"bg":"#1A1020","surface":"#241830","text":"#F0EAF5","textMuted":"#9880A8","border":"#3A2848","accent":"#C0A8CC","heroGradient":"linear-gradient(160deg, #140A18 0%, #28183A 50%, #3A2048 100%)","heroOverlayColor":"#080010","heroOverlayOpacity":0.5,"heroTextColor":"#F0EAF5","dark":true}')
) as v(collection_key, key, name, sort_order, tokens) on v.collection_key = c.key;

-- ── Typography Styles — 4 global pairings, exact FONT_PAIRINGS values ───────
insert into public.typography_styles (collection_id, key, name, sort_order, tokens) values
  (null, 'classic_serif', 'Classic', 0, '{"headingFont":"''Playfair Display'', Georgia, serif","bodyFont":"''Lato'', system-ui, sans-serif","headingItalic":false,"fontUrl":"https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Lato:wght@300;400;600&display=swap","sampleLabel":"Playfair Display"}'::jsonb),
  (null, 'modern_sans', 'Modern', 1, '{"headingFont":"''DM Sans'', system-ui, sans-serif","bodyFont":"''DM Sans'', system-ui, sans-serif","headingItalic":false,"fontUrl":"https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700&display=swap","sampleLabel":"Clean & Contemporary"}'::jsonb),
  (null, 'romantic', 'Romantic', 2, '{"headingFont":"''Cormorant Garamond'', Georgia, serif","bodyFont":"system-ui, sans-serif","headingItalic":true,"fontUrl":"https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&display=swap","sampleLabel":"Cormorant Garamond"}'::jsonb),
  (null, 'editorial', 'Editorial', 3, '{"headingFont":"''DM Serif Display'', Georgia, serif","bodyFont":"system-ui, sans-serif","headingItalic":false,"fontUrl":"https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&display=swap","sampleLabel":"DM Serif Display"}'::jsonb);

-- ── Default color story / typography style per collection ───────────────────
update public.collections c
set default_color_story_id = (
  select id from public.color_stories cs where cs.collection_id = c.id order by cs.sort_order limit 1
);
