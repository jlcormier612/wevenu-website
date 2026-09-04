-- ============================================================================
-- Payment timing — canonical booking commitment date on Events.
--
-- "At booking" payment timing is not the same as "0 days before the event."
-- event_date = celebration day. created_at = when the row was inserted in HTC.
-- booked_at = when the booking commitment was made (deposit / Book This Lead).
-- No silent backfill from created_at — only stamp from real booking moments.
-- ============================================================================

alter table public.events
  add column if not exists booked_at date;

comment on column public.events.booked_at is
  'Calendar date the booking commitment was made. Used for at-booking / after-booking payment timing. Distinct from event_date and created_at.';
