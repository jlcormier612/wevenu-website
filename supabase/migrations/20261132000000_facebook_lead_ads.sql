-- ============================================================================
-- Facebook / Instagram Lead Ads Integration — Sprint 3, Item 3. Approved
-- as designed (docs/facebook-lead-ads-architecture.md), no changes,
-- except externalRef is now a canonical Lead Intake pipeline concept
-- (see lib/lead-intake/types.ts / pipeline.ts), not Facebook-specific.
--
-- Mirrors the QuickBooks integration's own patterns throughout: a
-- dedicated connection table (long-lived user token, Page-scoped token —
-- no rotating refresh token the way QBO has, so shaped differently from
-- quickbooks_connections but same spirit), a retry queue with the same
-- backoff/dead-letter shape, and an append-only log table.
-- ============================================================================

-- ---- 1. Connection ------------------------------------------------------------

create table public.facebook_connections (
  id                       uuid primary key default gen_random_uuid(),
  venue_id                 uuid not null unique references public.venues(id) on delete cascade,
  user_access_token        text not null,
  user_token_expires_at    timestamptz not null,
  page_id                  text,
  page_name                text,
  page_access_token        text,
  status                   text not null default 'needs_page_selection'
                             check (status in ('needs_page_selection', 'connected', 'disconnected', 'error')),
  last_health_check_at     timestamptz,
  last_health_check_ok     boolean,
  last_error               text,
  last_error_at            timestamptz,
  connected_at             timestamptz not null default now(),
  disconnected_at          timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger facebook_connections_updated_at
  before update on public.facebook_connections
  for each row execute function public.set_updated_at();

alter table public.facebook_connections enable row level security;

create policy facebook_connections_all on public.facebook_connections
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.facebook_connections to authenticated;
grant select, insert, update, delete on public.facebook_connections to service_role;

-- ---- 2. Connected Lead Forms ---------------------------------------------------
--
-- A venue may run several simultaneous ad campaigns on one Page and not
-- want every form feeding Wevenu — one row per form the venue has
-- explicitly enabled.

create table public.facebook_lead_forms (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues(id) on delete cascade,
  page_id     text not null,
  form_id     text not null,
  form_name   text,
  is_enabled  boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (venue_id, form_id)
);

alter table public.facebook_lead_forms enable row level security;

create policy facebook_lead_forms_all on public.facebook_lead_forms
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.facebook_lead_forms to authenticated;
grant select on public.facebook_lead_forms to service_role;

-- ---- 3. Retry queue -------------------------------------------------------------
--
-- leadgen_id is Meta's own stable, unique-per-lead identifier — used both
-- as this queue's own dedup key AND (per the approved architecture) as
-- lead_intake_attempts.external_ref, so a redelivered webhook can never
-- double-create a Lead at either layer.

create table public.facebook_lead_queue (
  id               uuid primary key default gen_random_uuid(),
  venue_id         uuid not null references public.venues(id) on delete cascade,
  leadgen_id       text not null,
  form_id          text not null,
  page_id          text not null,
  status           text not null default 'pending'
                     check (status in ('pending', 'processing', 'succeeded', 'failed_retrying', 'dead_letter')),
  attempt_count    integer not null default 0,
  max_attempts     integer not null default 8,
  next_attempt_at  timestamptz not null default now(),
  last_error       text,
  last_error_at    timestamptz,
  last_attempted_at timestamptz,
  created_at       timestamptz not null default now()
);

create unique index facebook_lead_queue_unresolved
  on public.facebook_lead_queue (venue_id, leadgen_id)
  where status in ('pending', 'processing', 'failed_retrying');

create index facebook_lead_queue_due
  on public.facebook_lead_queue (next_attempt_at)
  where status in ('pending', 'failed_retrying');

alter table public.facebook_lead_queue enable row level security;

create policy facebook_lead_queue_select on public.facebook_lead_queue for select
  using (venue_id = public.current_user_venue_id());

grant select on public.facebook_lead_queue to authenticated;
grant select, insert, update on public.facebook_lead_queue to service_role;

-- ---- 4. Audit log ---------------------------------------------------------------

create table public.facebook_lead_log (
  id             uuid primary key default gen_random_uuid(),
  venue_id       uuid not null references public.venues(id) on delete cascade,
  queue_id       uuid references public.facebook_lead_queue(id) on delete set null,
  leadgen_id     text not null,
  outcome        text not null check (outcome in ('succeeded', 'failed', 'dead_lettered')),
  attempt_number integer not null,
  lead_id        uuid,
  message        text,
  created_at     timestamptz not null default now()
);

create index facebook_lead_log_venue on public.facebook_lead_log (venue_id, created_at desc);

alter table public.facebook_lead_log enable row level security;

create policy facebook_lead_log_select on public.facebook_lead_log for select
  using (venue_id = public.current_user_venue_id());

grant select, insert on public.facebook_lead_log to authenticated;
grant select, insert on public.facebook_lead_log to service_role;

-- ---- 5. New lead_sources row ------------------------------------------------
--
-- Distinct from the pre-existing 'facebook' row (connection_type
-- 'manual_label', for a coordinator manually tagging a lead by hand) —
-- this is the real webhook-driven source.

insert into public.lead_sources (key, display_name, category, connection_type, is_external)
values ('facebook_lead_ads', 'Facebook Lead Ads', 'social', 'webhook', true)
on conflict (key) do nothing;

notify pgrst, 'reload schema';
