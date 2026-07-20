-- ============================================================================
-- Hosted Experience Platform — Phase 2: Section Domain Model
--
-- docs/hosted-experience-platform-architecture-spec.md §3. Elevates a
-- section from an implicit key inside couple_websites.content jsonb (with
-- ownership/sync behavior hardcoded per-key in the renderer's switch
-- statement) into a first-class row — the change that makes "every section
-- belongs to exactly one ownership model" a database fact instead of a
-- convention.
--
-- owner/sync_mode are intentionally separate fields: owner is a section's
-- structural category (what KIND of thing it is); sync_mode is its current
-- behavioral state, which can vary per experience for sections capable of
-- being either (Schedule is the one example today — live when synced to
-- the Booking Timeline, manual when a couple opts out via the existing
-- schedule_sync toggle).
-- ============================================================================

create table public.experience_sections (
  id            uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.couple_websites(id) on delete cascade,
  section_key   text not null check (char_length(trim(section_key)) > 0),
  title         text not null,
  visibility    text not null default 'guest'
                  check (visibility in ('guest', 'password_required', 'hidden')),
  owner         text not null
                  check (owner in ('live_synced', 'guided', 'couple_authored', 'venue_managed')),
  sync_mode     text not null
                  check (sync_mode in ('live', 'one_time_copy', 'manual')),
  data_source   text,   -- e.g. "timeline_entries", "events" — only meaningful when sync_mode = 'live'
  last_synced_at timestamptz,   -- guided sections' "sourced on [date]" indicator
  display_rules jsonb not null default '{}'::jsonb,
  animation     text,   -- must reference one of the active Collection's motion presets (§9); not yet enforced in Phase 2, see report
  sort_order    smallint not null default 0,
  content       jsonb,  -- populated when owner != live_synced
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (experience_id, section_key)
);

create index experience_sections_experience on public.experience_sections (experience_id, sort_order);

create trigger experience_sections_updated_at
  before update on public.experience_sections
  for each row execute function public.set_updated_at();

-- RLS: same shape as couple_websites itself — venue owner reads for
-- dashboard/Luv context, couple writes exclusively via SECURITY DEFINER
-- RPCs (no direct INSERT/UPDATE/DELETE policy, matching the one
-- consistent write pattern this whole domain already uses correctly).
alter table public.experience_sections enable row level security;

create policy "venue owner reads experience sections"
  on public.experience_sections for select
  using (exists (
    select 1 from public.couple_websites w
    where w.id = experience_sections.experience_id
      and w.venue_id = public.current_user_venue_id()
  ));

grant select on public.experience_sections to authenticated;
