-- ============================================================================
-- Sprint 20 — Availability & Inventory Management Foundation
-- "The system should help venues avoid scheduling conflicts while remaining
--  flexible enough to support different operating models."
--
-- Four new tables:
--   venue_spaces           — named event spaces (Ballroom, Garden, Barn…)
--   venue_capacity_rules   — per-venue operating limits (one row per venue)
--   date_holds             — soft reservations linked to leads
--   calendar_blocks        — administrative closures / blocks
--
-- Plus: space_id FK added to events (additive, nullable, non-breaking).
-- ============================================================================

-- venue_spaces ----------------------------------------------------------------
-- Named spaces within the venue. A venue with one space gets one row;
-- multi-space venues get one per space. Capacity here is the ceiling for
-- that specific space (may be less than venues.capacity).
create table public.venue_spaces (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,
  name        text not null,         -- "Main Hall", "Garden Terrace", "Barn"
  description text,
  capacity    integer check (capacity is null or capacity >= 0),
  is_active   boolean not null default true,
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index venue_spaces_venue on public.venue_spaces (venue_id, sort_order);

create trigger venue_spaces_updated_at
  before update on public.venue_spaces
  for each row execute function public.set_updated_at();

-- venue_capacity_rules --------------------------------------------------------
-- One row per venue (enforced by unique constraint).
-- Controls how many simultaneous events/tours the venue can handle and
-- the minimum gap between events.
create table public.venue_capacity_rules (
  id                      uuid primary key default gen_random_uuid(),
  venue_id                uuid not null references public.venues (id) on delete cascade unique,
  max_simultaneous_events integer not null default 1 check (max_simultaneous_events >= 1),
  max_simultaneous_tours  integer not null default 1 check (max_simultaneous_tours >= 1),
  min_turnaround_hours    numeric(4, 1) not null default 0 check (min_turnaround_hours >= 0),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger venue_capacity_rules_updated_at
  before update on public.venue_capacity_rules
  for each row execute function public.set_updated_at();

-- date_holds ------------------------------------------------------------------
-- Soft reservations that block a date for a lead without creating a full
-- booking. Support for First Right of Refusal patterns.
-- Status flow: active → converted (became an event) OR released (cancelled)
--              OR expired (expires_at passed).
create table public.date_holds (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid not null references public.venues (id) on delete cascade,
  lead_id    uuid references public.leads   (id) on delete set null,
  space_id   uuid references public.venue_spaces (id) on delete set null,

  title      text not null,
  hold_date  date not null,
  start_time time,
  end_time   time,

  status     text not null default 'active'
               check (status in ('active', 'converted', 'released', 'expired')),
  expires_at timestamptz,
  notes      text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index date_holds_venue      on public.date_holds (venue_id);
create index date_holds_date       on public.date_holds (venue_id, hold_date) where status = 'active';
create index date_holds_lead       on public.date_holds (lead_id) where lead_id is not null;

create trigger date_holds_updated_at
  before update on public.date_holds
  for each row execute function public.set_updated_at();

-- calendar_blocks -------------------------------------------------------------
-- Administrative closures: maintenance windows, private events, holidays,
-- staff training days, etc. Multi-day blocks use start_date → end_date.
create table public.calendar_blocks (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid not null references public.venues (id) on delete cascade,

  title      text not null,
  reason     text not null default 'other'
               check (reason in ('maintenance', 'private_event', 'holiday',
                                 'staff_training', 'other')),
  start_date date not null,
  end_date   date not null,     -- same as start_date for single-day blocks
  is_all_day boolean not null default true,
  start_time time,
  end_time   time,
  notes      text,

  created_at timestamptz not null default now()
);

create index calendar_blocks_venue on public.calendar_blocks (venue_id, start_date, end_date);

-- Add space_id to events (nullable — existing events unaffected) ---------------
alter table public.events
  add column space_id uuid references public.venue_spaces (id) on delete set null;

create index events_space on public.events (space_id) where space_id is not null;

-- RLS -------------------------------------------------------------------------
alter table public.venue_spaces          enable row level security;
alter table public.venue_capacity_rules  enable row level security;
alter table public.date_holds            enable row level security;
alter table public.calendar_blocks       enable row level security;

create policy venue_spaces_all on public.venue_spaces
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

create policy venue_capacity_rules_all on public.venue_capacity_rules
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

create policy date_holds_all on public.date_holds
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

create policy calendar_blocks_all on public.calendar_blocks
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

grant select, insert, update, delete on public.venue_spaces         to authenticated;
grant select, insert, update, delete on public.venue_capacity_rules to authenticated;
grant select, insert, update, delete on public.date_holds           to authenticated;
grant select, insert, update, delete on public.calendar_blocks      to authenticated;

notify pgrst, 'reload schema';
