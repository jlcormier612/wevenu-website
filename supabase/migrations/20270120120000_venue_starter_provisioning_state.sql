-- Venue starter provisioning lifecycle state.
-- Distinguishes complete / incomplete / failed / running without a second seed system.
-- Deliberate deletion vs never-provisioned is inferred from status=complete vs not.

create table if not exists public.venue_starter_provisioning (
  venue_id uuid primary key references public.venues (id) on delete cascade,
  status text not null
    check (status in ('pending', 'running', 'complete', 'incomplete', 'failed')),
  seeded_steps text[] not null default '{}',
  failed_steps jsonb not null default '[]'::jsonb,
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.venue_starter_provisioning is
  'Idempotent HTC starter seed lifecycle per venue. complete = all seed steps succeeded; incomplete/failed allow safe retry without duplicating successful resources.';

create trigger venue_starter_provisioning_updated_at
  before update on public.venue_starter_provisioning
  for each row execute function public.set_updated_at();

alter table public.venue_starter_provisioning enable row level security;

create policy venue_starter_provisioning_select on public.venue_starter_provisioning
  for select
  using (venue_id = public.current_user_venue_id());

-- Writes go through service role / server actions using admin or elevated paths.
-- Authenticated owners may read their venue's status for Library/Setup guidance.
grant select on public.venue_starter_provisioning to authenticated;
grant select, insert, update, delete on public.venue_starter_provisioning to service_role;
