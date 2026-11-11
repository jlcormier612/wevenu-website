-- Per-event setup progress for the booked Client Overview.
-- Records only the venue's decision (set up or skip) and whether the
-- setup strip is collapsed. Module records stay in their own tables.

create table public.event_setup_states (
  event_id      uuid primary key references public.events (id) on delete cascade,
  venue_id      uuid not null references public.venues (id) on delete cascade,
  collapsed_at  timestamptz,
  decisions     jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint event_setup_states_decisions_object check (jsonb_typeof(decisions) = 'object')
);

create index event_setup_states_venue on public.event_setup_states (venue_id);

create trigger event_setup_states_updated_at
  before update on public.event_setup_states
  for each row execute function public.set_updated_at();

alter table public.event_setup_states enable row level security;

create policy event_setup_states_all on public.event_setup_states
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.event_setup_states to authenticated;
grant select, insert, update, delete on public.event_setup_states to service_role;

comment on table public.event_setup_states is
  'Explicit per-event setup decisions. Not venue onboarding and not day-of vendor check-in.';

notify pgrst, 'reload schema';
