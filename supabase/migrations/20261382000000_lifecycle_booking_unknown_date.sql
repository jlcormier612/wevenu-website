-- ============================================================================
-- Lifecycle Booking: unknown historical dates must not be fabricated.
--
-- A Booking without a trustworthy date still exists as a Booking, but it
-- must not be attributed to any reporting period. occurred_at becomes
-- nullable; period queries only count dated first_booked rows.
-- ============================================================================

alter table public.lifecycle_booking_events
  alter column occurred_at drop not null;

comment on column public.lifecycle_booking_events.occurred_at is
  'First lifecycle Booking date when known. NULL = booked, date unknown — never fabricate a period date.';

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
    and e.occurred_at is not null
    and (p_from is null or e.occurred_at::date >= p_from)
    and (p_to is null or e.occurred_at::date <= p_to)
  order by e.occurred_at desc;
$$;

grant execute on function public.canonical_lifecycle_bookings_in_period(date, date) to authenticated;

notify pgrst, 'reload schema';
