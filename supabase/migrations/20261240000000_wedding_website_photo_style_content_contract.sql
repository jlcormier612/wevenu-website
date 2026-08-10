-- Photo Style content contract: Minimal oval frames restored.
-- Does not change photo counts (renderer contract). Minimal identity = oval/circular
-- frames with sparse whitespace — not a reduced photo set.

update photo_styles set
  name = 'Minimal',
  description = 'Oval frames with quiet breathing room',
  tokens = '{
  "shadow": "none", "spacing": "generous", "rotation": "none", "frameStyle": "none",
  "imageScale": "normal", "arrangement": "sparse",
  "photoFilter": "saturate(0.88) brightness(1.04)",
  "photoRadius": "50%", "captionStyle": "none", "scalePattern": "uniform"
}'::jsonb
where key = 'minimal';
