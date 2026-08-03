-- Hosted Experience Platform — Four Independent Design Dimensions (2026-07-24)
--
-- The approved architecture spec (docs/hosted-experience-platform-architecture-spec.md
-- §1) resolved Collection/Color Story/Typography as "bundled-with-curated-choice" —
-- a Collection offers a small curated shortlist. This migration is an explicit,
-- deliberate amendment to that decision, not a reversal of the rest of the spec:
-- Color Story becomes a genuinely free custom picker (reusing the venue brand
-- color-picker technology), Typography was already architecturally independent
-- (typography_styles.collection_id has always been nullable) and now gets a
-- real independent picker in the UI, and Photo Style is added as a brand new,
-- fully independent fourth dimension. Collections themselves are narrowed to
-- pure layout/composition concerns — the vocabulary that's genuinely theirs.
--
-- Nothing here removes or replaces collections / typography_styles / color_stories
-- / couple_websites / experience_sections / experience_versions — every change is
-- additive columns/tables, matching this platform's own "reference, not embedded
-- copy" and "Copy at Commitment" principles already established for this feature.

-- ── Photo Style: brand new, fully independent 4th dimension ──────────────────
create table if not exists public.photo_styles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (char_length(trim(key)) > 0),
  name text not null,
  description text,
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  tokens jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger photo_styles_updated_at before update on public.photo_styles
  for each row execute function public.set_updated_at();

alter table public.photo_styles enable row level security;

-- Platform catalog data — same shape as collections_select/typography_styles_select:
-- readable by everyone (couples need it for the picker), writable only by Wevenu
-- internally (no venue/couple-facing "create a photo style" UI exists).
create policy "photo_styles_select" on public.photo_styles
  for select using (true);

grant select on public.photo_styles to anon, authenticated;

-- ── couple_websites: photo_style_id + 6 direct custom color columns ──────────
-- Direct hex columns, not a second catalog reference — Part 2's explicit
-- instruction is "stop limiting couples to preset palettes... reuse the exact
-- same color-picker technology already built for venues" (venues store direct
-- hex values on `venues`, not a palette-catalog FK). color_story_id is kept
-- exactly as-is (still a real, useful "quick-start preset" a couple can pick
-- from and then further customize) — when any of the 6 custom columns below
-- are set, they take precedence over the chosen color_story's tokens; when
-- none are set, an existing site's color_story_id (or legacy theme_palette)
-- keeps resolving exactly as it does today. This is additive-only.
alter table public.couple_websites
  add column if not exists photo_style_id uuid references public.photo_styles(id) on delete set null,
  add column if not exists color_primary text,
  add column if not exists color_secondary text,
  add column if not exists color_accent text,
  add column if not exists color_neutral text,
  add column if not exists color_background text,
  add column if not exists color_text text;

create index if not exists couple_websites_photo_style on public.couple_websites (photo_style_id);

-- ── collections: layout_config — the genuine layout vocabulary ───────────────
-- Everything Part 1 names: hero layout, gallery layout, image treatment*,
-- RSVP placement, animation style, scrolling behavior, section spacing.
-- (*photo treatment itself now lives on photo_styles, per Part 4's explicit
-- "Photo Style should be independent from Collection" — layout_config keeps
-- only how photos are LAID OUT/composed, e.g. gallery grid shape, not how
-- they're visually treated, e.g. filter/tone.)
alter table public.collections
  add column if not exists layout_config jsonb not null default '{}'::jsonb;
