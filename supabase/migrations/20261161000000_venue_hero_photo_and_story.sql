-- Program 4, Initiative D, Phase 2/3/6 (2026-07-23) — the couple dashboard
-- hero and the Venue Guide both need a venue-owned hero photograph and a
-- short "our story" blurb. Neither existed anywhere in the schema before
-- this (confirmed: venues had only logo_url). Explicit user decision
-- 2026-07-23: add these as venue-level fields, reusing the exact same
-- upload widget pattern already used for the logo, rather than either
-- fabricating a second photo source or leaving Phase 2 unbuildable.

alter table public.venues
  add column if not exists hero_image_url text,
  add column if not exists story text;
