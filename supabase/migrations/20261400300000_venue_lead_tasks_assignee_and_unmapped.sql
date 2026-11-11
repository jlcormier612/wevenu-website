-- Venue one-off lead tasks: assignee for Task Center My Work / By Person.
-- Pipeline stages: allow unmapped reporting classification (neutral).

alter table public.lead_tasks
  add column if not exists assigned_to_staff_id uuid
    references public.venue_staff (id) on delete set null;

create index if not exists lead_tasks_assigned_to
  on public.lead_tasks (assigned_to_staff_id)
  where assigned_to_staff_id is not null;

-- Reporting classification may be unset when a venue stage does not map cleanly.
alter table public.pipeline_stages
  drop constraint if exists pipeline_stages_canonical_stage_check;

alter table public.pipeline_stages
  add constraint pipeline_stages_canonical_stage_check
  check (canonical_stage in (
    'inquiry', 'tour', 'proposal', 'decision', 'booked', 'lost', 'cancelled', 'unmapped'
  ));

notify pgrst, 'reload schema';
