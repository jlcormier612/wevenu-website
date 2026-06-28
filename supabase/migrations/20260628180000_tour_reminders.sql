-- ============================================================================
-- Sprint 46: Tour Reminders
--
-- When a tour is booked, schedule a reminder for:
--   - Coordinator: 24 hours before (prepare for tour)
--   - Couple: 24 hours before (reminder of their appointment)
--
-- Extends task_reminders to support tour_appointment_id as an alternative
-- to event_task_id. The same delivery engine processes both.
-- ============================================================================

-- Allow task_reminders to reference either a task OR a tour appointment
alter table public.task_reminders
  alter column event_task_id drop not null,
  add column tour_appointment_id uuid references public.tour_appointments(id) on delete cascade;

-- At least one source must be set
alter table public.task_reminders
  add constraint task_reminders_source_check
    check (event_task_id is not null or tour_appointment_id is not null);

-- Index for tour reminder lookups
create index task_reminders_by_tour
  on public.task_reminders (tour_appointment_id, status)
  where tour_appointment_id is not null and status = 'pending';

notify pgrst, 'reload schema';
