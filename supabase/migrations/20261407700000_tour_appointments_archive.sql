-- Tour list hygiene: soft-archive on tour_appointments.
--
-- Archive is orthogonal to lifecycle status (scheduled/confirmed/completed/
-- cancelled/no_show). Existing rows default to NOT archived so current
-- Upcoming/Past behavior is preserved. Reporting continues to count archived
-- tours — this flag is list hygiene only.

alter table public.tour_appointments
  add column if not exists is_archived boolean not null default false;

comment on column public.tour_appointments.is_archived is
  'List hygiene for the Tours workspace. Orthogonal to status. Does not remove the tour from reporting/history.';

create index if not exists tour_appointments_venue_archived
  on public.tour_appointments (venue_id, is_archived);
