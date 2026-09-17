-- ============================================================================
-- Tour Protection — additive appointment association.
--
-- Existing tour_appointments has no payment columns and must not gain any.
-- protection_request_id is association-only: which protection request (if any)
-- produced this appointment. Reschedule keeps the same row.
-- ============================================================================

alter table public.tour_appointments
  add column if not exists protection_request_id uuid
    references public.tour_protection_requests(id) on delete set null;

comment on column public.tour_appointments.protection_request_id is
  'Optional association to the tour_protection_requests row that authorized this appointment. Not a payment column.';

create unique index tour_appointments_protection_request_id
  on public.tour_appointments (protection_request_id)
  where protection_request_id is not null;

notify pgrst, 'reload schema';
