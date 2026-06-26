-- ============================================================================
-- Sprint 3 — Venue Foundation
-- "Nothing in VenueOS exists until the venue exists."
--
-- Creates the core venue entity and its first dependents (business hours,
-- staff), plus an atomic RPC used by the Venue Setup wizard to persist
-- everything in a single transaction. Row Level Security scopes all access to
-- the owning user.
-- ============================================================================

-- Shared updated_at trigger ---------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- venues ----------------------------------------------------------------------
create table public.venues (
  id                       uuid primary key default gen_random_uuid(),
  owner_user_id            uuid not null references auth.users (id) on delete cascade,

  -- Identity & contact
  name                     text not null,
  business_name            text,
  email                    text,
  phone                    text,
  website                  text,
  address_line1            text,
  address_line2            text,
  city                     text,
  state_region             text,
  postal_code              text,
  country                  text,

  -- Profile
  venue_type               text,
  capacity                 integer check (capacity is null or capacity >= 0),
  timezone                 text not null default 'America/New_York',

  -- Brand (per-venue; distinct from the Wevenu product palette)
  logo_url                 text,
  primary_color            text not null default '#5D6F5D',
  secondary_color          text not null default '#4F5F4F',

  -- Basic settings
  currency                 text not null default 'USD',
  week_starts_on           smallint not null default 0 check (week_starts_on between 0 and 6),

  -- Payments (Stripe Connect — placeholder until live integration)
  stripe_account_id        text,
  stripe_charges_enabled   boolean not null default false,
  stripe_onboarding_status text not null default 'not_started'
                             check (stripe_onboarding_status in ('not_started', 'pending', 'connected')),

  -- Setup lifecycle
  setup_completed          boolean not null default false,
  setup_completed_at       timestamptz,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- Sprint 3 is a single-venue foundation: one venue per owner.
create unique index venues_owner_unique on public.venues (owner_user_id);

create trigger venues_set_updated_at
  before update on public.venues
  for each row execute function public.set_updated_at();

-- venue_business_hours --------------------------------------------------------
create table public.venue_business_hours (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0 = Sunday
  is_open     boolean not null default true,
  open_time   time,
  close_time  time,
  unique (venue_id, day_of_week)
);

create index venue_business_hours_venue on public.venue_business_hours (venue_id);

-- venue_staff -----------------------------------------------------------------
create table public.venue_staff (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid not null references public.venues (id) on delete cascade,
  user_id    uuid references auth.users (id) on delete set null,
  full_name  text not null,
  email      text,
  title      text,
  role       text not null default 'owner' check (role in ('owner', 'manager', 'staff')),
  is_owner   boolean not null default false,
  created_at timestamptz not null default now()
);

create index venue_staff_venue on public.venue_staff (venue_id);
-- At most one owner record per venue.
create unique index venue_staff_one_owner on public.venue_staff (venue_id) where is_owner;

-- Row Level Security ----------------------------------------------------------
alter table public.venues enable row level security;
alter table public.venue_business_hours enable row level security;
alter table public.venue_staff enable row level security;

-- venues: scoped to the owning user
create policy venues_select on public.venues
  for select using (owner_user_id = auth.uid());
create policy venues_insert on public.venues
  for insert with check (owner_user_id = auth.uid());
create policy venues_update on public.venues
  for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy venues_delete on public.venues
  for delete using (owner_user_id = auth.uid());

-- child tables: access granted when the user owns the parent venue
create policy venue_business_hours_all on public.venue_business_hours
  for all
  using (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

create policy venue_staff_all on public.venue_staff
  for all
  using (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

-- Grants for PostgREST roles (RLS still applies on top of these).
grant select, insert, update, delete on public.venues to authenticated;
grant select, insert, update, delete on public.venue_business_hours to authenticated;
grant select, insert, update, delete on public.venue_staff to authenticated;

-- Atomic setup ----------------------------------------------------------------
-- Persists the whole wizard payload in one transaction. SECURITY INVOKER so it
-- runs as the calling user and RLS is enforced. Business validation lives in the
-- application service layer (TypeScript); this function only persists.
create or replace function public.complete_venue_setup(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid  uuid := auth.uid();
  v_id uuid;
  hour jsonb;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.venues (
    owner_user_id, name, business_name, email, phone, website,
    address_line1, address_line2, city, state_region, postal_code, country,
    venue_type, capacity, timezone,
    logo_url, primary_color, secondary_color,
    currency, week_starts_on,
    stripe_onboarding_status,
    setup_completed, setup_completed_at
  ) values (
    uid,
    payload ->> 'name',
    nullif(payload ->> 'business_name', ''),
    nullif(payload ->> 'email', ''),
    nullif(payload ->> 'phone', ''),
    nullif(payload ->> 'website', ''),
    nullif(payload ->> 'address_line1', ''),
    nullif(payload ->> 'address_line2', ''),
    nullif(payload ->> 'city', ''),
    nullif(payload ->> 'state_region', ''),
    nullif(payload ->> 'postal_code', ''),
    nullif(payload ->> 'country', ''),
    nullif(payload ->> 'venue_type', ''),
    nullif(payload ->> 'capacity', '')::integer,
    coalesce(nullif(payload ->> 'timezone', ''), 'America/New_York'),
    nullif(payload ->> 'logo_url', ''),
    coalesce(nullif(payload ->> 'primary_color', ''), '#5D6F5D'),
    coalesce(nullif(payload ->> 'secondary_color', ''), '#4F5F4F'),
    coalesce(nullif(payload ->> 'currency', ''), 'USD'),
    coalesce((payload ->> 'week_starts_on')::smallint, 0),
    coalesce(nullif(payload ->> 'stripe_onboarding_status', ''), 'not_started'),
    true, now()
  )
  returning id into v_id;

  for hour in
    select * from jsonb_array_elements(coalesce(payload -> 'business_hours', '[]'::jsonb))
  loop
    insert into public.venue_business_hours (venue_id, day_of_week, is_open, open_time, close_time)
    values (
      v_id,
      (hour ->> 'day_of_week')::smallint,
      coalesce((hour ->> 'is_open')::boolean, true),
      nullif(hour ->> 'open_time', '')::time,
      nullif(hour ->> 'close_time', '')::time
    );
  end loop;

  insert into public.venue_staff (venue_id, user_id, full_name, email, title, role, is_owner)
  values (
    v_id,
    uid,
    payload -> 'owner' ->> 'full_name',
    nullif(payload -> 'owner' ->> 'email', ''),
    nullif(payload -> 'owner' ->> 'title', ''),
    'owner',
    true
  );

  return v_id;
end;
$$;

grant execute on function public.complete_venue_setup(jsonb) to authenticated;

notify pgrst, 'reload schema';
