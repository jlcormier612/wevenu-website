-- Start booking file creates a Client workspace that is not Planning yet.
-- Planning remains the post-Booked handoff. 'booking' is the technical file.

alter table public.clients
  drop constraint if exists clients_status_check;

alter table public.clients
  add constraint clients_status_check
  check (status in ('booking', 'planning', 'confirmed', 'complete', 'cancelled'));
