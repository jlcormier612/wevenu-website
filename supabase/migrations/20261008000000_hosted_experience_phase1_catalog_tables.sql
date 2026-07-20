-- ============================================================================
-- Hosted Experience Platform — Phase 1: Catalog Foundation
--
-- docs/hosted-experience-platform-architecture-spec.md §2/§3/§12 (Phase 1).
-- Introduces the platform catalog for Collections, Color Stories, and
-- Typography Styles — today these are hardcoded TypeScript objects
-- (COLLECTIONS/PALETTES in components/wedding-website/wedding-website.tsx,
-- a separately-duplicated THEMES array in components/portal/website-editor.tsx,
-- FONT_PAIRINGS also in website-editor.tsx), which is why the theme check
-- constraint on couple_websites had to be manually widened by hand (found
-- stale during Wedding Website Stabilization) and why the Studio's picker
-- and the public renderer maintain two independent copies of the same
-- collection/palette names and swatch colors.
--
-- These are platform catalog tables: readable by every venue/couple (both
-- the public site and the Studio need them), writable only by Wevenu
-- internally — no venue-facing "create a collection" UI exists in this
-- spec, consistent with "Collections are curated. Not assembled."
--
-- Scope note (see docs/hosted-experience-platform-architecture-spec.md
-- update, same date): color_stories are scoped per-collection (matches
-- today's real 3-palettes-per-collection shape). typography_styles are
-- NOT scoped per-collection in this phase — today's Font Pairing picker
-- genuinely offers all 4 pairings regardless of chosen collection, and
-- changing that now would be a real behavior change, not just a data-model
-- foundation. typography_styles.collection_id is nullable and left null
-- for the Phase 1 seed; per-collection typography curation is deferred to
-- a later phase, once this foundation is proven.
-- ============================================================================

create table public.collections (
  id                          uuid primary key default gen_random_uuid(),
  key                         text not null unique check (char_length(trim(key)) > 0),
  name                        text not null,
  description                 text,
  is_premium                  boolean not null default false,
  required_plan_tier          text,
  is_active                   boolean not null default true,
  sort_order                  smallint not null default 0,
  swatch_accent               text,   -- representative color for picker previews
  default_color_story_id      uuid,   -- FK added after color_stories exists, below
  default_typography_style_id uuid,   -- FK added after typography_styles exists, below
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create table public.color_stories (
  id            uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  key           text not null check (char_length(trim(key)) > 0),
  name          text not null,
  tokens        jsonb not null,  -- bg, surface, text, textMuted, border, accent,
                                  -- heroGradient, heroOverlayColor, heroOverlayOpacity,
                                  -- heroTextColor, dark
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (collection_id, key)
);

create table public.typography_styles (
  id            uuid primary key default gen_random_uuid(),
  collection_id uuid references public.collections(id) on delete cascade,  -- nullable: see scope note above
  key           text not null unique check (char_length(trim(key)) > 0),
  name          text not null,
  tokens        jsonb not null,  -- headingFont, bodyFont, headingItalic, fontUrl, sampleLabel
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.collections
  add constraint collections_default_color_story_id_fkey
    foreign key (default_color_story_id) references public.color_stories(id) on delete set null,
  add constraint collections_default_typography_style_id_fkey
    foreign key (default_typography_style_id) references public.typography_styles(id) on delete set null;

create index color_stories_collection on public.color_stories (collection_id, sort_order);
create index typography_styles_collection on public.typography_styles (collection_id, sort_order);

create trigger collections_updated_at
  before update on public.collections
  for each row execute function public.set_updated_at();
create trigger color_stories_updated_at
  before update on public.color_stories
  for each row execute function public.set_updated_at();
create trigger typography_styles_updated_at
  before update on public.typography_styles
  for each row execute function public.set_updated_at();

-- RLS: public catalog data, readable by anyone (public site + Studio both
-- need it, couple sessions are anon-role), writable by nobody at this
-- layer — no INSERT/UPDATE/DELETE policy exists on any of the three
-- tables, matching "no venue-facing collection authoring."
alter table public.collections enable row level security;
alter table public.color_stories enable row level security;
alter table public.typography_styles enable row level security;

create policy collections_select on public.collections for select using (true);
create policy color_stories_select on public.color_stories for select using (true);
create policy typography_styles_select on public.typography_styles for select using (true);

grant select on public.collections, public.color_stories, public.typography_styles to anon, authenticated;
