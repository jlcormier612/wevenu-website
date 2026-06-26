-- ============================================================================
-- Sprint 6 — Lead Relationship Depth
-- Adds the relationship-management fields every venue owner needs to work
-- a lead from first inquiry to booking: next action, follow-up date, last
-- contacted, tour scheduling, and a full activity timeline.
-- ============================================================================

-- Relationship fields on leads ------------------------------------------------
alter table public.leads
  add column next_action_text  text,
  add column next_action_due   date,
  add column follow_up_date    date,
  add column last_contacted_at date,
  add column tour_date         date,
  add column tour_time         time,
  add column tour_completed    boolean not null default false,
  add column tour_notes        text;

-- Partial index for dashboard queries: "whose follow-up is due soon?"
create index leads_venue_followup
  on public.leads (venue_id, follow_up_date)
  where follow_up_date is not null;

-- lead_activities -------------------------------------------------------------
-- Every significant relationship event (creation, status change, notes,
-- tasks, tour scheduling, etc.) is recorded here. The activity timeline on
-- the lead detail page reads from this table.
create table public.lead_activities (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,
  lead_id     uuid not null references public.leads  (id) on delete cascade,
  type        text not null,
  title       text not null,
  description text,
  created_at  timestamptz not null default now()
);

create index lead_activities_lead  on public.lead_activities (lead_id, created_at desc);
create index lead_activities_venue on public.lead_activities (venue_id);

alter table public.lead_activities enable row level security;

create policy lead_activities_all on public.lead_activities
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

grant select, insert, update, delete on public.lead_activities to authenticated;

-- Trigger: log lead creation --------------------------------------------------
-- SECURITY DEFINER so the insert into lead_activities bypasses the RLS
-- with-check (which relies on auth.uid() that may not be set in trigger context
-- when called from certain server paths). Read access is still RLS-scoped.
create or replace function public.log_lead_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.lead_activities (venue_id, lead_id, type, title, description, created_at)
  values (
    new.venue_id,
    new.id,
    'lead_created',
    'Inquiry received',
    case when new.source is not null
         then 'Source: ' || initcap(replace(new.source, '_', ' '))
         else null
    end,
    new.created_at
  );
  return new;
end;
$$;

create trigger leads_after_insert
  after insert on public.leads
  for each row execute function public.log_lead_created();

-- Trigger: log status changes -------------------------------------------------
create or replace function public.log_lead_status_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.lead_activities (venue_id, lead_id, type, title)
    values (
      new.venue_id,
      new.id,
      'status_changed',
      'Status changed to ' || initcap(replace(new.status, '_', ' '))
    );
  end if;
  return new;
end;
$$;

create trigger leads_after_status_update
  after update of status on public.leads
  for each row execute function public.log_lead_status_changed();

-- Backfill: retroactive activity records for leads created before Sprint 6 ----
insert into public.lead_activities (venue_id, lead_id, type, title, description, created_at)
select
  venue_id,
  id,
  'lead_created',
  'Inquiry received',
  case when source is not null
       then 'Source: ' || initcap(replace(source, '_', ' '))
       else null
  end,
  created_at
from public.leads;

notify pgrst, 'reload schema';
