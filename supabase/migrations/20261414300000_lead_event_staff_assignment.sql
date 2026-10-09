-- Sales assignment (lead) and event assignment (booked event) are separate.
-- Both point at this venue's venue_staff. Null means unassigned.
-- event_team remains the freeform roster and is not replaced by these columns.

alter table public.leads
  add column if not exists assigned_staff_id uuid references public.venue_staff (id) on delete set null;

alter table public.events
  add column if not exists assigned_staff_id uuid references public.venue_staff (id) on delete set null;

create index if not exists leads_assigned_staff
  on public.leads (assigned_staff_id)
  where assigned_staff_id is not null;

create index if not exists events_assigned_staff
  on public.events (assigned_staff_id)
  where assigned_staff_id is not null;

comment on column public.leads.assigned_staff_id is
  'Optional sales owner. Independent of events.assigned_staff_id.';

comment on column public.events.assigned_staff_id is
  'Operational owner for the booked event. May match the lead assignee or be a different venue staff member.';
