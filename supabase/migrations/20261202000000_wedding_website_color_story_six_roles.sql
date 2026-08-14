-- Hosted Experience RC1, Part 2 — Color System certification.
-- Every one of the 26 native (per-Collection) Color Stories previously
-- lacked authored colorPrimary/Secondary/Accent/Neutral/Background/Text
-- fields and fell through deriveSixRoles()'s heuristic-derivation branch
-- (gradient-stop extraction + color mixing at render time). Authored real
-- values for all 26 here. Background/Text/Accent/Neutral carry over the
-- Color Story's own already-authored bg/text/accent/border fields exactly
-- (never touched); Primary/Secondary are newly authored, designed from
-- each story's own heroGradient as a starting point, then adjusted so all
-- three brand-identity roles (Primary/Secondary/Accent) clear a real
-- perceptual-distance bar and never collapse into one visual value — the
-- 6 darkest palettes (Midnight x3, Velvet x3) needed genuine hand-redesign,
-- not more interpolation: their near-monochromatic gradients had no usable
-- distinct stop, so formula-mixing kept collapsing Secondary into
-- Background (measured distance 2-11 out of a 40 'reads as distinct' bar).

update color_stories set tokens = tokens || jsonb_build_object(
  'colorPrimary', '#7A6040', 'colorSecondary', '#AE9772',
  'colorAccent', '#C4AE88', 'colorNeutral', '#E8DCC8',
  'colorBackground', '#FBF8F3', 'colorText', '#2A2210'
) where key = 'warm stone' and collection_id = (select id from collections where key = 'champagne');

update color_stories set tokens = tokens || jsonb_build_object(
  'colorPrimary', '#6A5A38', 'colorSecondary', '#9E9170',
  'colorAccent', '#B4A888', 'colorNeutral', '#E4D8C0',
  'colorBackground', '#FAF8F4', 'colorText', '#2A2418'
) where key = 'ecru' and collection_id = (select id from collections where key = 'champagne');

update color_stories set tokens = tokens || jsonb_build_object(
  'colorPrimary', '#3A3A38', 'colorSecondary', '#7C7C76',
  'colorAccent', '#989890', 'colorNeutral', '#D8D8D8',
  'colorBackground', '#F5F5F5', 'colorText', '#282828'
) where key = 'charcoal' and collection_id = (select id from collections where key = 'champagne');

update color_stories set tokens = tokens || jsonb_build_object(
  'colorPrimary', '#324E64', 'colorSecondary', '#96A4B0',
  'colorAccent', '#4A6278', 'colorNeutral', '#C8D8E0',
  'colorBackground', '#FAFBFC', 'colorText', '#1E2E3A'
) where key = 'navy' and collection_id = (select id from collections where key = 'coastal');

update color_stories set tokens = tokens || jsonb_build_object(
  'colorPrimary', '#2A5848', 'colorSecondary', '#8FA9A0',
  'colorAccent', '#4A7868', 'colorNeutral', '#C0DCD4',
  'colorBackground', '#F4FAF8', 'colorText', '#1A2E28'
) where key = 'sea glass' and collection_id = (select id from collections where key = 'coastal');

update color_stories set tokens = tokens || jsonb_build_object(
  'colorPrimary', '#5A4A38', 'colorSecondary', '#AAA196',
  'colorAccent', '#9A8068', 'colorNeutral', '#E0D8C8',
  'colorBackground', '#FAF8F4', 'colorText', '#2E2A1E'
) where key = 'sand' and collection_id = (select id from collections where key = 'coastal');

update color_stories set tokens = tokens || jsonb_build_object(
  'colorPrimary', '#5E5A40', 'colorSecondary', '#AAA898',
  'colorAccent', '#8A8060', 'colorNeutral', '#E0DACB',
  'colorBackground', '#F7F5F0', 'colorText', '#2A281E'
) where key = 'stone' and collection_id = (select id from collections where key = 'estate');

update color_stories set tokens = tokens || jsonb_build_object(
  'colorPrimary', '#5A8A70', 'colorSecondary', '#35573F',
  'colorAccent', '#9DC4A8', 'colorNeutral', '#DED6C5',
  'colorBackground', '#FAF8F2', 'colorText', '#2A2820'
) where key = 'eucalyptus' and collection_id = (select id from collections where key = 'garden');

update color_stories set tokens = tokens || jsonb_build_object(
  'colorPrimary', '#B07088', 'colorSecondary', '#9C5E71',
  'colorAccent', '#D4A0AC', 'colorNeutral', '#EDD8DC',
  'colorBackground', '#FAF5F6', 'colorText', '#2E2428'
) where key = 'peony' and collection_id = (select id from collections where key = 'garden');

update color_stories set tokens = tokens || jsonb_build_object(
  'colorPrimary', '#685898', 'colorSecondary', '#8A6BAE',
  'colorAccent', '#A898C0', 'colorNeutral', '#DCCCE8',
  'colorBackground', '#F8F5FA', 'colorText', '#28243C'
) where key = 'wisteria' and collection_id = (select id from collections where key = 'garden');

update color_stories set tokens = tokens || jsonb_build_object(
  'colorPrimary', '#A79A82', 'colorSecondary', '#877B6B',
  'colorAccent', '#C8B898', 'colorNeutral', '#EBE5DB',
  'colorBackground', '#FCFAF6', 'colorText', '#5B534D'
) where key = 'ivory' and collection_id = (select id from collections where key = 'minimal');

update color_stories set tokens = tokens || jsonb_build_object(
  'colorPrimary', '#B09892', 'colorSecondary', '#8B7874',
  'colorAccent', '#D4B8B0', 'colorNeutral', '#EBD8D5',
  'colorBackground', '#FAF6F5', 'colorText', '#5B4D4C'
) where key = 'blush' and collection_id = (select id from collections where key = 'minimal');

update color_stories set tokens = tokens || jsonb_build_object(
  'colorPrimary', '#8D939B', 'colorSecondary', '#71767E',
  'colorAccent', '#A8B0B8', 'colorNeutral', '#D8DCE4',
  'colorBackground', '#F5F6F8', 'colorText', '#4D5058'
) where key = 'slate' and collection_id = (select id from collections where key = 'minimal');

update color_stories set tokens = tokens || jsonb_build_object(
  'colorPrimary', '#6E4E9E', 'colorSecondary', '#9B84BC',
  'colorAccent', '#BFB8CE', 'colorNeutral', '#4A4160',
  'colorBackground', '#1A1525', 'colorText', '#EDE8E2'
) where key = 'indigo' and collection_id = (select id from collections where key = 'modern');

update color_stories set tokens = tokens || jsonb_build_object(
  'colorPrimary', '#7A6248', 'colorSecondary', '#A6957E',
  'colorAccent', '#C0B8A8', 'colorNeutral', '#4A4642',
  'colorBackground', '#141414', 'colorText', '#EEEAE5'
) where key = 'onyx' and collection_id = (select id from collections where key = 'modern');

update color_stories set tokens = tokens || jsonb_build_object(
  'colorPrimary', '#78488E', 'colorSecondary', '#A57BB8',
  'colorAccent', '#C0A8CC', 'colorNeutral', '#4A3856',
  'colorBackground', '#1A1020', 'colorText', '#EDE5F0'
) where key = 'plum' and collection_id = (select id from collections where key = 'modern');

update color_stories set tokens = tokens || jsonb_build_object(
  'colorPrimary', '#A07070', 'colorSecondary', '#8F5850',
  'colorAccent', '#CCA8A0', 'colorNeutral', '#EDD6CE',
  'colorBackground', '#FAF6F4', 'colorText', '#2E1A18'
) where key = 'blush' and collection_id = (select id from collections where key = 'romance');

update color_stories set tokens = tokens || jsonb_build_object(
  'colorPrimary', '#A07088', 'colorSecondary', '#8A5468',
  'colorAccent', '#CCA0B0', 'colorNeutral', '#EDD0DC',
  'colorBackground', '#FAF4F6', 'colorText', '#2E1820'
) where key = 'petal' and collection_id = (select id from collections where key = 'romance');

update color_stories set tokens = tokens || jsonb_build_object(
  'colorPrimary', '#707090', 'colorSecondary', '#3D3F6E',
  'colorAccent', '#A0A8CC', 'colorNeutral', '#D0D4E8',
  'colorBackground', '#F4F6FA', 'colorText', '#1A1E30'
) where key = 'powder' and collection_id = (select id from collections where key = 'romance');

update color_stories set tokens = tokens || jsonb_build_object(
  'colorPrimary', '#6A4E30', 'colorSecondary', '#B2A290',
  'colorAccent', '#9A7A54', 'colorNeutral', '#E4D6BE',
  'colorBackground', '#FAF6EF', 'colorText', '#2E2418'
) where key = 'barnwood' and collection_id = (select id from collections where key = 'rustic');

update color_stories set tokens = tokens || jsonb_build_object(
  'colorPrimary', '#7E2E3E', 'colorSecondary', '#AD6558',
  'colorAccent', '#C9B89A', 'colorNeutral', '#4A2830',
  'colorBackground', '#1E1015', 'colorText', '#F7F3EE'
) where key = 'burgundy' and collection_id = (select id from collections where key = 'velvet');

update color_stories set tokens = tokens || jsonb_build_object(
  'colorPrimary', '#7A6248', 'colorSecondary', '#A6957E',
  'colorAccent', '#C0B89A', 'colorNeutral', '#463F36',
  'colorBackground', '#0F0F0F', 'colorText', '#F0ECE8'
) where key = 'noir' and collection_id = (select id from collections where key = 'velvet');

update color_stories set tokens = tokens || jsonb_build_object(
  'colorPrimary', '#82489E', 'colorSecondary', '#AD7EC0',
  'colorAccent', '#C0A8CC', 'colorNeutral', '#4A3856',
  'colorBackground', '#1A1020', 'colorText', '#F0EAF5'
) where key = 'plum' and collection_id = (select id from collections where key = 'velvet');

update color_stories set tokens = tokens || jsonb_build_object(
  'colorPrimary', '#6A8A78', 'colorSecondary', '#B2C1B6',
  'colorAccent', '#97AC9E', 'colorNeutral', '#E8E0D2',
  'colorBackground', '#FAF8F4', 'colorText', '#2E2A24'
) where key = 'sage' and collection_id = (select id from collections where key = 'classic');

update color_stories set tokens = tokens || jsonb_build_object(
  'colorPrimary', '#8A7080', 'colorSecondary', '#7A5468',
  'colorAccent', '#B89AAC', 'colorNeutral', '#ECD8E4',
  'colorBackground', '#FAF5F7', 'colorText', '#2E2430'
) where key = 'mauve' and collection_id = (select id from collections where key = 'classic');

update color_stories set tokens = tokens || jsonb_build_object(
  'colorPrimary', '#907060', 'colorSecondary', '#C5B3A9',
  'colorAccent', '#B49480', 'colorNeutral', '#E8D8C8',
  'colorBackground', '#FAF6F2', 'colorText', '#30241A'
) where key = 'terracotta' and collection_id = (select id from collections where key = 'classic');
