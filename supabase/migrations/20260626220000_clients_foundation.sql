-- ============================================================================
-- Sprint 9 — Clients Foundation
-- "What happens after someone books?"
--
-- Clients are intentionally separate from leads — a booked couple represents
-- a different relationship phase, not a status change. The schema reflects
-- this: event timing replaces inquiry/pipeline fields, key dates replace tasks,
-- and the activity log captures the event planning journey.
-- ============================================================================

-- clients ---------------------------------------------------------------------
create table public.clients (
  id                  uuid primary key default gen_random_uuid(),
  venue_id            uuid not null references public.venues (id) on delete cascade,
  lead_id             uuid references public.leads  (id) on delete set null,

  -- Planning status (simpler than lead status — confirmed means confirmed)
  status              text not null default 'planning'
                        check (status in ('planning','confirmed','complete','cancelled')),

  -- Person 1 (primary contact)
  first_name          text not null,
  last_name           text not null,
  email               text,
  phone               text,

  -- Person 2 (partner / second contact)
  partner_first_name  text,
  partner_last_name   text,
  partner_email       text,

  -- Event details
  event_type          text,
  event_date          date,
  end_date            date,
  guest_count         integer check (guest_count is null or guest_count >= 0),

  -- Day-of timeline anchors (times as strings "HH:MM")
  ceremony_time       time,
  reception_time      time,

  -- Key pre-event date
  rehearsal_date      date,

  -- Internal operational notes (free-form, not visible to clients)
  internal_notes      text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index clients_venue          on public.clients (venue_id);
create index clients_venue_date     on public.clients (venue_id, event_date);
create index clients_venue_status   on public.clients (venue_id, status);
create index clients_lead           on public.clients (lead_id) where lead_id is not null;

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- client_notes ----------------------------------------------------------------
create table public.client_notes (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid not null references public.venues (id) on delete cascade,
  client_id  uuid not null references public.clients (id) on delete cascade,
  body       text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_notes_client on public.client_notes (client_id);

create trigger client_notes_set_updated_at
  before update on public.client_notes
  for each row execute function public.set_updated_at();

-- client_key_dates ------------------------------------------------------------
-- Venue-defined milestone dates: "Rehearsal", "Final guest count due", etc.
-- Flexible labels rather than hard-coded fields — venues vary widely.
create table public.client_key_dates (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid not null references public.venues (id) on delete cascade,
  client_id  uuid not null references public.clients (id) on delete cascade,
  label      text not null check (char_length(trim(label)) > 0),
  date       date not null,
  note       text,
  created_at timestamptz not null default now()
);

create index client_key_dates_client on public.client_key_dates (client_id, date);

-- client_activities -----------------------------------------------------------
create table public.client_activities (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,
  client_id   uuid not null references public.clients (id) on delete cascade,
  type        text not null,
  title       text not null,
  description text,
  created_at  timestamptz not null default now()
);

create index client_activities_client on public.client_activities (client_id, created_at desc);

-- RLS -------------------------------------------------------------------------
alter table public.clients           enable row level security;
alter table public.client_notes      enable row level security;
alter table public.client_key_dates  enable row level security;
alter table public.client_activities enable row level security;

create policy clients_all on public.clients
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

create policy client_notes_all on public.client_notes
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

create policy client_key_dates_all on public.client_key_dates
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

create policy client_activities_all on public.client_activities
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

grant select, insert, update, delete on public.clients           to authenticated;
grant select, insert, update, delete on public.client_notes      to authenticated;
grant select, insert, update, delete on public.client_key_dates  to authenticated;
grant select, insert, update, delete on public.client_activities to authenticated;

-- Triggers: auto-log client creation and status changes ----------------------
create or replace function public.log_client_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.client_activities (venue_id, client_id, type, title, description, created_at)
  values (
    new.venue_id, new.id, 'client_created', 'Client record created',
    case when new.lead_id is not null then 'Converted from lead inquiry' else null end,
    new.created_at
  );
  return new;
end;
$$;

create trigger clients_after_insert
  after insert on public.clients
  for each row execute function public.log_client_created();

create or replace function public.log_client_status_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.client_activities (venue_id, client_id, type, title)
    values (
      new.venue_id, new.id, 'status_changed',
      'Status changed to ' || initcap(new.status)
    );
  end if;
  return new;
end;
$$;

create trigger clients_after_status_update
  after update of status on public.clients
  for each row execute function public.log_client_status_changed();

notify pgrst, 'reload schema';
