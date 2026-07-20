-- ============================================================================
-- Hosted Experience Platform — Phase 3: Publishing Model schema
--
-- docs/hosted-experience-platform-architecture-spec.md §5. Replaces the
-- two-state is_published boolean with a real state machine (draft /
-- preview / published / archived), and introduces experience_versions —
-- the mechanism that makes publishing a commitment rather than a save:
-- guests see a frozen snapshot taken at publish time, not live-editable
-- state, so a couple can keep working after publishing without their
-- guests seeing half-finished edits mid-change.
--
-- is_published is preserved as a GENERATED column (status = 'published')
-- rather than dropped outright — every existing reader (lib/luv/
-- observations.ts, app/api/portal/invite/route.ts) does a plain SELECT or
-- .eq('is_published', true) filter, both of which work identically
-- against a generated column, so nothing outside this migration needs to
-- change. Existing data is carried forward through `status` before the
-- column is rebuilt, not lost.
-- ============================================================================

alter table public.couple_websites
  add column status text not null default 'draft'
    check (status in ('draft', 'preview', 'published', 'archived'));

update public.couple_websites set status = case when is_published then 'published' else 'draft' end;

-- couple_website_stats (20260629120000_website_editor.sql) selects
-- is_published directly and blocks a plain DROP COLUMN. Confirmed dead —
-- zero application code references this view anywhere — but dropped and
-- recreated identically rather than deleted outright, since removing it
-- wasn't asked for; noted as a minor, incidental Engineering Cleanup
-- candidate in the Phase 3 report, same as other confirmed-dead objects
-- found elsewhere in this platform.
drop view if exists public.couple_website_stats;

alter table public.couple_websites drop column is_published;
alter table public.couple_websites
  add column is_published boolean generated always as (status = 'published') stored;

create view public.couple_website_stats as
 select venue_id, client_id, slug, is_published, updated_at, created_at,
    ((content ->> 'home') is not null) as has_home_content,
    ((content ->> 'story') is not null) as has_story,
    ((content ->> 'event') is not null) as has_event_details,
    ((content ->> 'travel') is not null) as has_travel,
    (((content -> 'registry') is not null) and (jsonb_array_length((content -> 'registry')) > 0)) as has_registry
   from public.couple_websites w;

alter table public.couple_websites
  add column preview_token uuid unique not null default gen_random_uuid(),
  add column scheduled_publish_at timestamptz,
  add column scheduled_expire_at timestamptz,
  add column current_version_id uuid;

create table public.experience_versions (
  id             uuid primary key default gen_random_uuid(),
  experience_id  uuid not null references public.couple_websites(id) on delete cascade,
  version_number integer not null,
  published_at   timestamptz not null default now(),
  snapshot       jsonb not null,
  created_at     timestamptz not null default now(),
  unique (experience_id, version_number)
);

create index experience_versions_experience on public.experience_versions (experience_id, version_number desc);

alter table public.couple_websites
  add constraint couple_websites_current_version_id_fkey
    foreign key (current_version_id) references public.experience_versions(id) on delete set null;

alter table public.experience_versions enable row level security;

create policy "venue owner reads experience versions"
  on public.experience_versions for select
  using (exists (
    select 1 from public.couple_websites w
    where w.id = experience_versions.experience_id
      and w.venue_id = public.current_user_venue_id()
  ));

grant select on public.experience_versions to authenticated;
