-- ============================================================================
-- Sprint 14 — Vendor Management
-- "Who is involved in this event and when are they arriving?"
--
-- Two tables:
--   vendors                  — the venue's reusable vendor directory
--   event_vendor_assignments — per-event vendor details (arrival time, notes)
--
-- The directory approach means vendors are defined once and can appear in
-- many events. Each assignment stores event-specific operational data.
-- ============================================================================

-- vendors — the venue's directory -------------------------------------------
create table public.vendors (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references public.venues (id) on delete cascade,

  -- Identity
  name         text not null,
  category     text,

  -- Contact
  contact_name text,
  email        text,
  phone        text,
  website      text,

  -- Preferred designation (shown prominently in selects and directory)
  is_preferred boolean not null default false,

  -- Internal notes about this vendor
  notes        text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index vendors_venue      on public.vendors (venue_id);
-- Index used for "preferred first" selects
create index vendors_pref_name  on public.vendors (venue_id, is_preferred desc, name);

create trigger vendors_updated_at
  before update on public.vendors
  for each row execute function public.set_updated_at();

-- event_vendor_assignments — per-event vendor details -----------------------
create table public.event_vendor_assignments (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references public.venues (id) on delete cascade,
  event_id     uuid not null references public.events  (id) on delete cascade,
  vendor_id    uuid not null references public.vendors (id) on delete cascade,

  -- Event-specific operational details
  arrival_time time,
  notes        text,

  created_at   timestamptz not null default now()
);

-- A vendor can only be assigned once per event
create unique index eva_event_vendor on public.event_vendor_assignments (event_id, vendor_id);
create index eva_event  on public.event_vendor_assignments (event_id);
create index eva_vendor on public.event_vendor_assignments (vendor_id);

-- RLS -------------------------------------------------------------------------
alter table public.vendors                  enable row level security;
alter table public.event_vendor_assignments enable row level security;

create policy vendors_all on public.vendors
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

create policy eva_all on public.event_vendor_assignments
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

grant select, insert, update, delete on public.vendors                  to authenticated;
grant select, insert, update, delete on public.event_vendor_assignments to authenticated;

notify pgrst, 'reload schema';
