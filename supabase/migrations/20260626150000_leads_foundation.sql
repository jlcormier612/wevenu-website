-- ============================================================================
-- Sprint 5 — Leads Foundation
-- Manages the earliest stage of the customer lifecycle: a venue receives
-- an inquiry and tracks it through to booking or loss.
--
-- Three tables: leads (the record), lead_notes (internal notes), lead_tasks
-- (action items tied to a lead). All RLS-scoped to venue ownership.
-- ============================================================================

-- leads -----------------------------------------------------------------------
create table public.leads (
  id                   uuid primary key default gen_random_uuid(),
  venue_id             uuid not null references public.venues (id) on delete cascade,

  -- Lifecycle
  status               text not null default 'new'
                         check (status in ('new','contacted','qualified',
                                           'proposal_sent','won','lost','cancelled')),
  source               text,

  -- Primary contact
  first_name           text not null,
  last_name            text not null,
  email                text,
  phone                text,

  -- Partner contact (common for weddings / couples events)
  partner_first_name   text,
  partner_last_name    text,
  partner_email        text,

  -- Event inquiry
  event_type           text,
  event_date           date,
  end_date             date,
  guest_count          integer check (guest_count is null or guest_count >= 0),
  estimated_budget     numeric(12,2) check (estimated_budget is null or estimated_budget >= 0),
  inquiry_message      text,
  inquiry_date         date not null default current_date,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index leads_venue          on public.leads (venue_id);
create index leads_venue_status   on public.leads (venue_id, status);
create index leads_venue_evt_date on public.leads (venue_id, event_date);
create index leads_venue_inq_date on public.leads (venue_id, inquiry_date desc);

create trigger leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- lead_notes ------------------------------------------------------------------
create table public.lead_notes (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid not null references public.venues (id) on delete cascade,
  lead_id    uuid not null references public.leads  (id) on delete cascade,
  body       text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lead_notes_lead    on public.lead_notes (lead_id);
create index lead_notes_venue   on public.lead_notes (venue_id);

create trigger lead_notes_updated_at
  before update on public.lead_notes
  for each row execute function public.set_updated_at();

-- lead_tasks ------------------------------------------------------------------
create table public.lead_tasks (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references public.venues (id) on delete cascade,
  lead_id      uuid not null references public.leads  (id) on delete cascade,
  title        text not null check (char_length(trim(title)) > 0),
  due_date     date,
  completed    boolean not null default false,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

create index lead_tasks_lead     on public.lead_tasks (lead_id);
create index lead_tasks_venue    on public.lead_tasks (venue_id);
-- Useful for a future "open tasks across all leads" dashboard query.
create index lead_tasks_open     on public.lead_tasks (venue_id, due_date)
  where not completed;

-- Row Level Security ----------------------------------------------------------
alter table public.leads      enable row level security;
alter table public.lead_notes enable row level security;
alter table public.lead_tasks enable row level security;

-- All three tables: full access when the venue belongs to the current user.
create policy leads_all on public.leads
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

create policy lead_notes_all on public.lead_notes
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

create policy lead_tasks_all on public.lead_tasks
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

grant select, insert, update, delete on public.leads      to authenticated;
grant select, insert, update, delete on public.lead_notes to authenticated;
grant select, insert, update, delete on public.lead_tasks to authenticated;

notify pgrst, 'reload schema';
