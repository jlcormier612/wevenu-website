-- Venue Setup Profiles.
-- A profile is the venue's normal operating decision for an event type.
-- New events snapshot that decision. Later profile edits do not rewrite
-- events that already inherited it. Event overrides live on the event.

create table public.venue_setup_profiles (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references public.venues (id) on delete cascade,
  name          text not null,
  decisions     jsonb not null default '{}'::jsonb,
  template_refs jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint venue_setup_profiles_name_nonempty check (char_length(btrim(name)) > 0),
  constraint venue_setup_profiles_decisions_object check (jsonb_typeof(decisions) = 'object'),
  constraint venue_setup_profiles_refs_object check (jsonb_typeof(template_refs) = 'object')
);

create index venue_setup_profiles_venue on public.venue_setup_profiles (venue_id);

create trigger venue_setup_profiles_updated_at
  before update on public.venue_setup_profiles
  for each row execute function public.set_updated_at();

alter table public.venue_setup_profiles enable row level security;

create policy venue_setup_profiles_all on public.venue_setup_profiles
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.venue_setup_profiles to authenticated;
grant select, insert, update, delete on public.venue_setup_profiles to service_role;

comment on table public.venue_setup_profiles is
  'Reusable venue operating setup. Not a commercial package. Assigned to event types; snapshotted onto new events.';

create table public.venue_setup_profile_assignments (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,
  profile_id  uuid not null references public.venue_setup_profiles (id) on delete cascade,
  -- null = venue default when no event-type assignment matches
  event_type  text,
  created_at  timestamptz not null default now()
);

create unique index venue_setup_profile_assignments_one
  on public.venue_setup_profile_assignments (venue_id, event_type) nulls not distinct;

create index venue_setup_profile_assignments_profile
  on public.venue_setup_profile_assignments (profile_id);

alter table public.venue_setup_profile_assignments enable row level security;

create policy venue_setup_profile_assignments_all on public.venue_setup_profile_assignments
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.venue_setup_profile_assignments to authenticated;
grant select, insert, update, delete on public.venue_setup_profile_assignments to service_role;

alter table public.event_setup_states
  add column uses_profile boolean not null default false,
  add column profile_id uuid references public.venue_setup_profiles (id) on delete set null,
  add column profile_name text,
  add column inherited_decisions jsonb not null default '{}'::jsonb,
  add column overrides jsonb not null default '{}'::jsonb;

alter table public.event_setup_states
  add constraint event_setup_states_inherited_object check (jsonb_typeof(inherited_decisions) = 'object'),
  add constraint event_setup_states_overrides_object check (jsonb_typeof(overrides) = 'object');

comment on column public.event_setup_states.inherited_decisions is
  'Snapshot of the profile at assignment. Profile edits do not update this.';
comment on column public.event_setup_states.overrides is
  'Event-only decisions. Never written by a profile edit.';

notify pgrst, 'reload schema';
