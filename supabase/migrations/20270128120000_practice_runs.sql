-- Practice Run foundation (Easy Onboarding PM-01).
-- Durable, venue-scoped Practice Run identity with server-enforced linkage
-- on sample Lead / Client / Event rows. Does not alter operational records
-- unless they are explicitly created inside a Practice Run.
--
-- DO NOT APPLY to Sandbox or Production without explicit founder authorization.
-- Apply via the existing Apply Sandbox Migration workflow when authorized.

create table if not exists public.practice_runs (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'resetting', 'archived')),
  celebration_name text not null,
  sample_lead_id uuid,
  sample_client_id uuid,
  sample_event_id uuid,
  sample_relationship_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now()
);

comment on table public.practice_runs is
  'Venue-scoped Practice Run. One in_progress row per venue. Sample CRM rows link back via practice_run_id.';

create unique index if not exists practice_runs_one_active_per_venue
  on public.practice_runs (venue_id)
  where status = 'in_progress';

create index if not exists practice_runs_venue_updated_idx
  on public.practice_runs (venue_id, updated_at desc);

create trigger practice_runs_updated_at
  before update on public.practice_runs
  for each row execute function public.set_updated_at();

alter table public.leads
  add column if not exists practice_run_id uuid references public.practice_runs (id) on delete set null;

alter table public.clients
  add column if not exists practice_run_id uuid references public.practice_runs (id) on delete set null;

alter table public.events
  add column if not exists practice_run_id uuid references public.practice_runs (id) on delete set null;

comment on column public.leads.practice_run_id is
  'Non-null when this lead belongs to a Practice Run. Server-enforced practice context.';
comment on column public.clients.practice_run_id is
  'Non-null when this client belongs to a Practice Run. Server-enforced practice context.';
comment on column public.events.practice_run_id is
  'Non-null when this event belongs to a Practice Run. Excluded from occupancy/volume when draft without booked_at; future confirmed practice events must stay filtered from SaaS volume.';

create index if not exists leads_practice_run_id_idx
  on public.leads (practice_run_id)
  where practice_run_id is not null;

create index if not exists clients_practice_run_id_idx
  on public.clients (practice_run_id)
  where practice_run_id is not null;

create index if not exists events_practice_run_id_idx
  on public.events (practice_run_id)
  where practice_run_id is not null;

-- Soft FKs from practice_runs to sample rows (added after columns exist).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'practice_runs_sample_lead_id_fkey'
  ) then
    alter table public.practice_runs
      add constraint practice_runs_sample_lead_id_fkey
      foreign key (sample_lead_id) references public.leads (id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'practice_runs_sample_client_id_fkey'
  ) then
    alter table public.practice_runs
      add constraint practice_runs_sample_client_id_fkey
      foreign key (sample_client_id) references public.clients (id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'practice_runs_sample_event_id_fkey'
  ) then
    alter table public.practice_runs
      add constraint practice_runs_sample_event_id_fkey
      foreign key (sample_event_id) references public.events (id) on delete set null;
  end if;
end $$;

alter table public.practice_runs enable row level security;

drop policy if exists practice_runs_all on public.practice_runs;
create policy practice_runs_all on public.practice_runs
  for all
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.practice_runs to authenticated;
grant select, insert, update, delete on public.practice_runs to service_role;

-- Practice Events never occupy calendar while draft and without booked_at
-- (existing assert_event_availability rules). This helper documents the
-- server boundary for volume and reporting callers.
create or replace function public.is_practice_event(p_event_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.practice_run_id is not null
  );
$$;

comment on function public.is_practice_event(uuid) is
  'True when the event belongs to a Practice Run. Callers that count operational volume must exclude these rows.';
