-- Navigation attention: venue-seen acknowledgements for Leads + Tours badges.
-- Existing rows are backfilled so historical inventory does not flood badges.

alter table public.leads
  add column if not exists venue_seen_at timestamptz;

comment on column public.leads.venue_seen_at is
  'When venue staff first opened this lead. Null = unseen attention for the Leads nav badge.';

update public.leads
set venue_seen_at = coalesce(created_at, now())
where venue_seen_at is null;

alter table public.tour_appointments
  add column if not exists venue_seen_at timestamptz;

comment on column public.tour_appointments.venue_seen_at is
  'When venue staff acknowledged this tour on Tours. Null = unseen attention for the Tours nav badge.';

update public.tour_appointments
set venue_seen_at = coalesce(created_at, now())
where venue_seen_at is null;
