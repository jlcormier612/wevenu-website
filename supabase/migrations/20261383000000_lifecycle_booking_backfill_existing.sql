-- ============================================================================
-- Backfill first_booked for relationships already marked Booked before
-- lifecycle_booking_events was written on every Booked transition.
--
-- Rules:
-- - A Booking is a Booking. Do not invent a second-class type.
-- - Do not fabricate a date (not today, not created_at, not events.booked_at,
--   not financial commitment).
-- - occurred_at = leads.first_booked_at / clients.lifecycle_booked_at when
--   already known; otherwise NULL so period activity is not guessed.
-- - Cohort conversion can still see the first_booked event.
-- ============================================================================

insert into public.lifecycle_booking_events (
  venue_id,
  lead_id,
  client_id,
  origin,
  event_kind,
  occurred_at,
  acquisition_source,
  metadata
)
select
  l.venue_id,
  l.id,
  c.id,
  'pipeline',
  'first_booked',
  l.first_booked_at,
  l.acquisition_source,
  jsonb_build_object('backfill', 'pre_existing_booked')
from public.leads l
left join public.clients c
  on c.lead_id = l.id
 and c.venue_id = l.venue_id
where (
    l.sales_stage = 'booked'
    or l.first_booked_at is not null
    or exists (
      select 1
      from public.lead_activities la
      where la.lead_id = l.id
        and la.venue_id = l.venue_id
        and la.title = 'Status changed to Won'
    )
  )
  and not exists (
    select 1
    from public.lifecycle_booking_events e
    where e.venue_id = l.venue_id
      and e.lead_id = l.id
      and e.event_kind = 'first_booked'
  );

insert into public.lifecycle_booking_events (
  venue_id,
  lead_id,
  client_id,
  origin,
  event_kind,
  occurred_at,
  acquisition_source,
  metadata
)
select
  c.venue_id,
  null,
  c.id,
  coalesce(c.lifecycle_booking_origin, 'direct'),
  'first_booked',
  c.lifecycle_booked_at,
  null,
  jsonb_build_object('backfill', 'pre_existing_booked')
from public.clients c
where c.lead_id is null
  and (
    c.lifecycle_booked_at is not null
    or c.lifecycle_booking_origin is not null
  )
  and not exists (
    select 1
    from public.lifecycle_booking_events e
    where e.venue_id = c.venue_id
      and e.client_id = c.id
      and e.lead_id is null
      and e.event_kind = 'first_booked'
  );

notify pgrst, 'reload schema';
