-- A cancelled booked relationship is not an active Booked Client.
-- sales_stage `cancelled` is the existing terminal state outside the seven
-- sales-pipeline columns. It is not Lost, and it is not a planning status.
-- events.booked_at is historical and is not cleared.

alter table public.leads
  drop constraint if exists leads_sales_stage_check;

alter table public.leads
  add constraint leads_sales_stage_check
  check (sales_stage in (
    'new_inquiry',
    'outreach_sent',
    'enrolled_in_sequence',
    'tour_scheduled',
    'proposal_sent',
    'booked',
    'lost',
    'cancelled'
  ));

update public.leads l
set sales_stage = 'cancelled',
    pipeline_stage_id = null
where l.sales_stage = 'booked'
  and exists (
    select 1
    from public.clients c
    join public.events e
      on e.client_id = c.id
     and e.venue_id = c.venue_id
    where c.lead_id = l.id
      and c.venue_id = l.venue_id
      and c.status = 'cancelled'
      and e.status = 'cancelled'
      and e.booked_at is not null
  );

notify pgrst, 'reload schema';
