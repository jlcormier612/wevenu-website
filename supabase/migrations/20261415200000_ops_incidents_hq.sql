-- Platform operations incidents for Hello to Cheers HQ.
-- Sandbox + Production schema-compatible; only HQ admins may read/manage.
-- Writes from the SNS→Lambda fanout use the service role (bypasses RLS).

create table if not exists public.ops_incidents (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null,
  source_service text not null,
  source_alarm text,
  source_event_id text,
  severity text not null
    check (severity in ('critical', 'high', 'warning', 'info')),
  status text not null default 'active'
    check (status in ('active', 'acknowledged', 'recovered', 'resolved')),
  title text not null,
  summary text not null default '',
  recommended_action text not null default '',
  diagnostic jsonb not null default '{}'::jsonb,
  first_detected_at timestamptz not null default now(),
  last_observed_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users (id) on delete set null,
  recovered_at timestamptz,
  resolved_at timestamptz,
  resolution_note text,
  last_email_notified_at timestamptz,
  last_email_outcome text,
  last_email_ref text,
  observation_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ops_incidents_dedupe_key_unique unique (dedupe_key)
);

create index if not exists ops_incidents_status_severity_idx
  on public.ops_incidents (status, severity, last_observed_at desc);

create index if not exists ops_incidents_service_idx
  on public.ops_incidents (source_service, last_observed_at desc);

create table if not exists public.ops_incident_events (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.ops_incidents (id) on delete cascade,
  event_type text not null
    check (event_type in (
      'detected',
      'observed',
      'escalated',
      'acknowledged',
      'recovered',
      'resolved',
      'email_attempt',
      'email_failed',
      'reminder'
    )),
  severity text,
  message text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ops_incident_events_incident_idx
  on public.ops_incident_events (incident_id, created_at desc);

create table if not exists public.ops_notification_attempts (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid references public.ops_incidents (id) on delete set null,
  channel text not null check (channel in ('email', 'in_product')),
  outcome text not null check (outcome in ('accepted', 'delivered', 'failed', 'skipped')),
  provider_ref text,
  error_safe text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  constraint ops_notification_attempts_idempotency unique (idempotency_key)
);

create index if not exists ops_notification_attempts_incident_idx
  on public.ops_notification_attempts (incident_id, created_at desc);

alter table public.ops_incidents enable row level security;
alter table public.ops_incident_events enable row level security;
alter table public.ops_notification_attempts enable row level security;

drop policy if exists "ops_incidents_hq_select" on public.ops_incidents;
create policy "ops_incidents_hq_select"
  on public.ops_incidents for select to authenticated
  using (public.is_hq_admin());

drop policy if exists "ops_incidents_hq_update" on public.ops_incidents;
create policy "ops_incidents_hq_update"
  on public.ops_incidents for update to authenticated
  using (public.is_hq_admin())
  with check (public.is_hq_admin());

drop policy if exists "ops_incident_events_hq_select" on public.ops_incident_events;
create policy "ops_incident_events_hq_select"
  on public.ops_incident_events for select to authenticated
  using (public.is_hq_admin());

drop policy if exists "ops_incident_events_hq_insert" on public.ops_incident_events;
create policy "ops_incident_events_hq_insert"
  on public.ops_incident_events for insert to authenticated
  with check (public.is_hq_admin());

drop policy if exists "ops_notification_attempts_hq_select" on public.ops_notification_attempts;
create policy "ops_notification_attempts_hq_select"
  on public.ops_notification_attempts for select to authenticated
  using (public.is_hq_admin());

-- RPC: acknowledge without resolving.
create or replace function public.acknowledge_ops_incident(p_incident_id uuid)
returns public.ops_incidents
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.ops_incidents;
begin
  if not public.is_hq_admin() then
    raise exception 'not authorized';
  end if;

  update public.ops_incidents
  set
    status = case
      when status in ('recovered', 'resolved') then status
      else 'acknowledged'
    end,
    acknowledged_at = coalesce(acknowledged_at, now()),
    acknowledged_by = auth.uid(),
    updated_at = now()
  where id = p_incident_id
  returning * into row;

  if row.id is null then
    raise exception 'incident not found';
  end if;

  insert into public.ops_incident_events (incident_id, event_type, severity, message, metadata)
  values (
    row.id,
    'acknowledged',
    row.severity,
    'Acknowledged by HQ admin (not resolved).',
    jsonb_build_object('by', auth.uid())
  );

  return row;
end;
$$;

revoke all on function public.acknowledge_ops_incident(uuid) from public;
grant execute on function public.acknowledge_ops_incident(uuid) to authenticated;

notify pgrst, 'reload schema';
