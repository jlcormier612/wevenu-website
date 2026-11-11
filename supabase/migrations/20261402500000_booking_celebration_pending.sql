-- One-shot flag for the Lead → Booked celebration.
-- Set only when bookClient stamps events.booked_at for the first time.
alter table public.events
  add column if not exists booking_celebration_pending boolean not null default false;

comment on column public.events.booking_celebration_pending is
  'True only after bookClient newly stamps booked_at. The celebration page clears it. Not a lifecycle status.';
