-- Planned Event Space on an unbooked Lead.
-- This is pre-booking planning only. It does not create an Event, stamp
-- booked_at, or reserve the date. The real Event receives the space when
-- the relationship is Booked.

alter table public.leads
  add column if not exists planned_event_space_id uuid
    references public.venue_spaces (id) on delete set null;

comment on column public.leads.planned_event_space_id is
  'Venue planning choice for this inquiry before a real Event exists. Not occupancy.';

create index if not exists leads_planned_event_space
  on public.leads (planned_event_space_id)
  where planned_event_space_id is not null;
