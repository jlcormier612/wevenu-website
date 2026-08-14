-- Wedding Website Phase 4A — Collection Rhythm.
--
-- Eight Collections (Champagne, European Estate, Linen, Midnight, Rosé,
-- Rustic, Velvet, Wildflower) previously had no authored `sectionRoles`,
-- meaning every one of those websites rendered as a flat, unpaced page
-- regardless of Color Story. Only Coastal and Garden Party had rhythm.
--
-- This authors the same canvas/scale pattern Garden Party already ships
-- with (approved) onto the remaining eight, verbatim, so every Collection
-- now intentionally alternates Hero -> Quiet -> Standard -> Feature ->
-- Quiet -> Standard -> Feature -> Quiet -> RSVP. The exact sections a
-- Collection has may differ; the rhythm shape does not.
--
-- Merged via jsonb `||`, so every other existing layout_config field
-- (storyStyle, sectionFrame, divider, headerStyle, etc.) is preserved
-- untouched — this migration only adds/replaces the top-level
-- `sectionRoles` key.
update collections set layout_config = layout_config || '{
  "sectionRoles": {
    "hero": {"scale": "feature", "canvas": "photographic", "treatment": "image-led-feature"},
    "story": {"scale": "standard", "canvas": "light", "treatment": "editorial-opening"},
    "event": {"scale": "feature", "canvas": "soft", "treatment": "split-feature"},
    "gallery": {"scale": "feature", "canvas": "photographic", "treatment": "gallery-spread"},
    "schedule": {"scale": "standard", "canvas": "neutral", "treatment": "timeline"},
    "travel": {"scale": "standard", "canvas": "light"},
    "dress_code": {"scale": "interlude", "canvas": "neutral", "pairWith": "bridal_party", "treatment": "paired-passage"},
    "bridal_party": {"scale": "interlude", "canvas": "light", "pairWith": "dress_code", "treatment": "paired-passage"},
    "things_to_do": {"scale": "interlude", "canvas": "soft", "treatment": "compact-interlude"},
    "music": {"scale": "interlude", "canvas": "light", "treatment": "compact-interlude"},
    "registry": {"scale": "interlude", "canvas": "neutral", "pairWith": "faq", "treatment": "paired-passage"},
    "faq": {"scale": "interlude", "canvas": "neutral", "pairWith": "registry", "treatment": "paired-passage"},
    "rsvp": {"scale": "feature", "canvas": "strong", "treatment": "strong-closing"}
  }
}'::jsonb
where key in ('champagne', 'estate', 'minimal', 'modern', 'romance', 'rustic', 'velvet', 'classic');
