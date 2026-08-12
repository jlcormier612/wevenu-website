-- Wedding Website Studio — append 2 handwriting typography choices
-- (Indie Flower, Shadows Into Light) after the existing 8 catalog styles.
-- Append-only: sort_order 8 and 9 so the Typography step shows them 9th/10th.
-- Pattern mirrors Calligraphy (script heading + distinct readable body).

insert into public.typography_styles (collection_id, key, name, sort_order, tokens) values
  (null, 'indie_flower', 'Casual', 8,
   '{"headingFont":"''Indie Flower'', cursive","bodyFont":"''Nunito'', system-ui, sans-serif","headingItalic":false,"fontUrl":"https://fonts.googleapis.com/css2?family=Indie+Flower&family=Nunito:wght@300;400;500;600&display=swap","sampleLabel":"Indie Flower"}'::jsonb),
  (null, 'shadows_into_light', 'Light Script', 9,
   '{"headingFont":"''Shadows Into Light'', cursive","bodyFont":"''Source Sans 3'', system-ui, sans-serif","headingItalic":false,"fontUrl":"https://fonts.googleapis.com/css2?family=Shadows+Into+Light&family=Source+Sans+3:wght@300;400;500;600&display=swap","sampleLabel":"Shadows Into Light"}'::jsonb)
on conflict (key) do nothing;

-- Legacy couple_websites.font_pairing CHECK must accept the new keys
-- (Studio/Editor still write fontPairing = typography_styles.key on save).
alter table public.couple_websites drop constraint couple_websites_font_pairing_check;
alter table public.couple_websites add constraint couple_websites_font_pairing_check
  check (font_pairing = any (array[
    'classic_serif','modern_sans','romantic','editorial',
    'luxury','minimal','calligraphy','elegant',
    'playful',
    'indie_flower','shadows_into_light'
  ]));
