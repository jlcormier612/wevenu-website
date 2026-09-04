-- ============================================================================
-- Lifecycle Booking Truth — durable booking history distinct from financial
-- commitment (canonical_bookings) and payment-timing (events.booked_at).
--
-- Origins (never conflated):
--   pipeline — Book This Lead → sales_stage = booked
--   direct   — Direct Add (leadless client create)
--   import   — Migration Center explicit "Mark as already booked"
--
-- event_kind:
--   first_booked — original lifecycle booking (Reporting booking date)
--   rebooked     — later return to Booked; does not overwrite first date
--
-- No historical backfill — dates are only written when the venue action
-- (or explicit migration mark) occurs.
-- ============================================================================

-- ---- leads.first_booked_at (pipeline denormalized first date) ----------------

alter table public.leads
  add column if not exists first_booked_at timestamptz;

comment on column public.leads.first_booked_at is
  'First lifecycle Booked transition (pipeline). Never overwritten on rebook or Lost.';

-- ---- clients lifecycle stamp (direct / import; not sales_stage) -------------

alter table public.clients
  add column if not exists lifecycle_booked_at timestamptz;

alter table public.clients
  add column if not exists lifecycle_booking_origin text
    check (
      lifecycle_booking_origin is null
      or lifecycle_booking_origin in ('pipeline', 'direct', 'import')
    );

comment on column public.clients.lifecycle_booked_at is
  'First lifecycle booking date for this client (direct/import/pipeline link). Never overwritten.';
comment on column public.clients.lifecycle_booking_origin is
  'Origin of the first lifecycle booking: pipeline, direct, or import.';

-- ---- lifecycle_booking_events -----------------------------------------------

create table if not exists public.lifecycle_booking_events (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  origin text not null check (origin in ('pipeline', 'direct', 'import')),
  event_kind text not null check (event_kind in ('first_booked', 'rebooked')),
  occurred_at timestamptz not null,
  actor_user_id uuid,
  previous_sales_stage text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint lifecycle_booking_events_entity_chk check (
    lead_id is not null or client_id is not null
  )
);

create index if not exists lifecycle_booking_events_venue_occurred
  on public.lifecycle_booking_events (venue_id, occurred_at desc);

create index if not exists lifecycle_booking_events_venue_kind_occurred
  on public.lifecycle_booking_events (venue_id, event_kind, occurred_at desc);

create index if not exists lifecycle_booking_events_lead
  on public.lifecycle_booking_events (lead_id, occurred_at desc)
  where lead_id is not null;

create index if not exists lifecycle_booking_events_client
  on public.lifecycle_booking_events (client_id, occurred_at desc)
  where client_id is not null;

-- One first_booked per lead (pipeline).
create unique index if not exists lifecycle_booking_events_first_lead
  on public.lifecycle_booking_events (venue_id, lead_id)
  where event_kind = 'first_booked' and lead_id is not null;

-- One first_booked per leadless client (direct/import without lead).
create unique index if not exists lifecycle_booking_events_first_client_leadless
  on public.lifecycle_booking_events (venue_id, client_id)
  where event_kind = 'first_booked' and lead_id is null and client_id is not null;

comment on table public.lifecycle_booking_events is
  'Durable lifecycle Booking history. Distinct from canonical_bookings (financial) and events.booked_at (payment timing).';

alter table public.lifecycle_booking_events enable row level security;

drop policy if exists lifecycle_booking_events_venue on public.lifecycle_booking_events;
create policy lifecycle_booking_events_venue on public.lifecycle_booking_events
  for all
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.lifecycle_booking_events to authenticated;
grant select, insert, update, delete on public.lifecycle_booking_events to service_role;

-- ---- Richer sales_stage activity (previous stage in description) -----------

create or replace function public.log_lead_sales_stage_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.sales_stage is distinct from new.sales_stage then
    insert into public.lead_activities (venue_id, lead_id, type, title, description)
    values (
      new.venue_id,
      new.id,
      'sales_stage_changed',
      'Stage changed to ' || initcap(replace(new.sales_stage, '_', ' ')),
      case
        when old.sales_stage is null then null
        else 'Previous stage: ' || initcap(replace(old.sales_stage, '_', ' '))
      end
    );
  end if;
  return new;
end;
$$;

-- ---- Reporting helpers ------------------------------------------------------

create or replace function public.canonical_lifecycle_bookings_in_period(
  p_from date default null,
  p_to date default null
)
returns table (
  event_id uuid,
  venue_id uuid,
  lead_id uuid,
  client_id uuid,
  origin text,
  occurred_at timestamptz,
  actor_user_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.venue_id,
    e.lead_id,
    e.client_id,
    e.origin,
    e.occurred_at,
    e.actor_user_id
  from public.lifecycle_booking_events e
  where e.venue_id = public.current_user_venue_id()
    and e.event_kind = 'first_booked'
    and (p_from is null or e.occurred_at::date >= p_from)
    and (p_to is null or e.occurred_at::date <= p_to)
  order by e.occurred_at desc;
$$;

grant execute on function public.canonical_lifecycle_bookings_in_period(date, date) to authenticated;

-- Keep financial view; clarify comment — not Lifecycle Booking.
comment on view public.canonical_bookings is
  'Financially Committed (Reporting): Client with >=1 signed Contract AND a Payment Schedule whose lowest-sort_order line item is status=paid. booked_at = later of signed_at and that line paid_at. Distinct from lifecycle Bookings (lifecycle_booking_events).';

notify pgrst, 'reload schema';
