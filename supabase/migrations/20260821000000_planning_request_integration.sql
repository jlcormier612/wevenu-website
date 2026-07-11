-- ============================================================================
-- Planning → Request Framework integration
--
-- A Planning Task may optionally reference one Request. Planning remains the
-- source of truth for tasks; Requests become the collaboration layer.
-- Additive only — no existing event_tasks column, status, or behavior
-- changes. Planning Templates (playbook_tasks) are untouched: a Request can
-- only be created once a Booking (event_task) exists, never from a template.
-- ============================================================================

alter table public.event_tasks
  add column request_id uuid references public.requests(id) on delete set null;

create index event_tasks_request on public.event_tasks (request_id) where request_id is not null;

notify pgrst, 'reload schema';
