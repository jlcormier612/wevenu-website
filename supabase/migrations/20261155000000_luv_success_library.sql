-- Luv's Success Library (Hospitality Success Platform §4, 2026-07-22) —
-- genuine greenfield, confirmed live (no existing table, no existing
-- pattern to extend). Platform-wide content Wevenu HQ authors — every
-- venue reads the same published articles, not venue-scoped data — the
-- opposite direction from Venue Guide (/guide, a venue's own couple-facing
-- content), which stays completely untouched (§4.3).
--
-- DB-backed, editable without a deploy (decided 2026-07-22): a real, if
-- lightweight, first CMS-shaped surface in this codebase. Organized by
-- business goal, fixed 5-part content shape per the plan's §4.1.
create table public.success_library_articles (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique,
  title                 text not null,
  -- Free text, not an enum — a non-engineering staff member adding a new
  -- goal category should never need a schema migration to do it.
  goal_category         text not null,
  why_it_matters        text not null,
  when_to_use           text not null,
  best_practices        text not null,
  common_mistakes       text not null,
  -- [{ "label": "Create a package", "href": "/packages/new" }, ...] — a
  -- real deep link into the actual feature, per §4.1's own requirement
  -- ("the last one a real deep link... not a generic mention").
  related_features      jsonb not null default '[]'::jsonb,
  -- Guided Setup gap keys (lib/dashboard/gap-copy.ts's GAP_COPY keys) this
  -- article is relevant to — the concrete mechanism behind §4.2's "Getting
  -- Started steps can link to the relevant article."
  linked_gap_keys       text[] not null default '{}',
  status                text not null default 'draft' check (status in ('draft', 'published')),
  -- Lightweight version tracking (an incrementing counter + updated_at),
  -- not a full diff/rollback history table — scoped down from the plan's
  -- "version history" phrase to what a first authoring pass actually needs.
  version               integer not null default 1,
  created_by            uuid references auth.users(id) on delete set null,
  updated_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index success_library_articles_category on public.success_library_articles (goal_category) where status = 'published';
create index success_library_articles_gap_keys on public.success_library_articles using gin (linked_gap_keys) where status = 'published';

create trigger success_library_articles_updated_at
  before update on public.success_library_articles
  for each row execute function public.set_updated_at();

alter table public.success_library_articles enable row level security;

-- Every authenticated venue user reads published articles — platform-wide
-- content, not gated by venue_id (this table has none). Drafts are
-- HQ-only, so a half-written article never leaks to a venue mid-edit.
create policy success_library_select_published on public.success_library_articles
  for select to authenticated
  using (status = 'published');

-- HQ staff manage everything, drafts included — same is_hq_admin() gate
-- every other HQ-write surface in this codebase already uses.
create policy success_library_hq_all on public.success_library_articles
  for all to authenticated
  using (is_hq_admin())
  with check (is_hq_admin());

grant select on public.success_library_articles to authenticated;
grant insert, update, delete on public.success_library_articles to authenticated;

notify pgrst, 'reload schema';
