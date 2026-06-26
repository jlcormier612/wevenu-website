-- ============================================================================
-- Sprint 11 — Events Foundation
-- "Create the home where event planning will eventually live."
--
-- An Event is the operational unit: the specific occasion taking place at the
-- venue. It is distinct from the Client (the couple relationship) and the Lead
-- (pre-booking). Vendors, timelines, floor plans, and contracts will attach
-- to Events in future sprints.
-- ============================================================================

-- events ----------------------------------------------------------------------
create table public.events (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references public.venues  (id) on delete cascade,
  client_id       uuid          references public.clients (id) on delete set null,

  status          text not null default 'draft'
                    check (status in ('draft','confirmed','in_progress','complete','cancelled')),

  -- Identity
  name            text not null,
  event_type      text,

  -- The day
  event_date      date not null,
  start_time      time,
  end_time        time,
  setup_time      time,
  teardown_time   time,
  guest_count     integer check (guest_count is null or guest_count >= 0),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index events_venue      on public.events (venue_id);
create index events_venue_date on public.events (venue_id, event_date);
create index events_client     on public.events (client_id) where client_id is not null;

create trigger events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- event_notes -----------------------------------------------------------------
create table public.event_notes (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid not null references public.venues (id) on delete cascade,
  event_id   uuid not null references public.events (id) on delete cascade,
  body       text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index event_notes_event on public.event_notes (event_id);

create trigger event_notes_updated_at
  before update on public.event_notes
  for each row execute function public.set_updated_at();

-- event_team ------------------------------------------------------------------
-- Internal staff assigned to work this event (not vendors — those come later).
create table public.event_team (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid not null references public.venues (id) on delete cascade,
  event_id   uuid not null references public.events (id) on delete cascade,
  full_name  text not null,
  role       text,
  phone      text,
  created_at timestamptz not null default now()
);

create index event_team_event on public.event_team (event_id);

-- event_activities ------------------------------------------------------------
create table public.event_activities (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,
  event_id    uuid not null references public.events (id) on delete cascade,
  type        text not null,
  title       text not null,
  description text,
  created_at  timestamptz not null default now()
);

create index event_activities_event on public.event_activities (event_id, created_at desc);

-- RLS -------------------------------------------------------------------------
alter table public.events           enable row level security;
alter table public.event_notes      enable row level security;
alter table public.event_team       enable row level security;
alter table public.event_activities enable row level security;

create policy events_all on public.events
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

create policy event_notes_all on public.event_notes
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

create policy event_team_all on public.event_team
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

create policy event_activities_all on public.event_activities
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

grant select, insert, update, delete on public.events           to authenticated;
grant select, insert, update, delete on public.event_notes      to authenticated;
grant select, insert, update, delete on public.event_team       to authenticated;
grant select, insert, update, delete on public.event_activities to authenticated;

-- Triggers: auto-log event creation and status changes -----------------------
create or replace function public.log_event_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.event_activities (venue_id, event_id, type, title, description, created_at)
  values (
    new.venue_id, new.id, 'event_created', 'Event created',
    case when new.client_id is not null then 'Linked to client booking' else null end,
    new.created_at
  );
  return new;
end;
$$;

create trigger events_after_insert
  after insert on public.events
  for each row execute function public.log_event_created();

create or replace function public.log_event_status_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status is distinct from new.status then
    insert into public.event_activities (venue_id, event_id, type, title)
    values (
      new.venue_id, new.id, 'status_changed',
      'Status changed to ' || initcap(replace(new.status, '_', ' '))
    );
  end if;
  return new;
end;
$$;

create trigger events_after_status_update
  after update of status on public.events
  for each row execute function public.log_event_status_changed();

notify pgrst, 'reload schema';
