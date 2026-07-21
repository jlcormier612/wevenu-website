-- ============================================================================
-- QuickBooks Online Launch Integration — Phase A: schema.
--
-- Launch requirement, scoped deliberately: OAuth connection, Customer/
-- Invoice/Payment/Refund sync, connection health, retry/error queue,
-- disconnect/reconnect, sync status on records, idempotent operations.
-- Explicitly NOT in scope: chart-of-accounts mapping, tax engine, product
-- catalog sync, vendor/expense/bank/journal sync, full bidirectional
-- editing. One-directional only — Wevenu pushes to QBO, nothing reads back.
--
-- Every table below gets RLS AND the explicit GRANT in this same file —
-- this codebase's migration history has twice shipped RLS without the
-- matching grant, silently blocking a feature at the Postgres privilege
-- layer before RLS is ever evaluated (most recently caught in Sprint 2's
-- Vendor Certification Pass — vendor_inquiries/vendor_tasks were both
-- fully RLS-correct and completely unreachable for want of a GRANT).
-- ============================================================================

-- ── quickbooks_connections — one row per venue, OAuth + connection state ───
-- A dedicated table, not columns on venues: unlike Stripe Connect (which
-- only stores a connected account ID), QBO requires an access token
-- (~1hr expiry), a refresh token (~100 day expiry, rotates on every use),
-- and a realmId (QBO company ID) — all updated together on every refresh.
-- Isolating this from venues keeps credential churn away from a row with
-- unrelated read/write patterns (branding, hours, etc).

create table public.quickbooks_connections (
  id                        uuid primary key default gen_random_uuid(),
  venue_id                  uuid not null unique references public.venues (id) on delete cascade,

  realm_id                  text not null,
  access_token              text not null,
  access_token_expires_at   timestamptz not null,
  refresh_token             text not null,
  refresh_token_expires_at  timestamptz not null,

  environment               text not null default 'sandbox'
                              check (environment in ('sandbox', 'production')),

  status                    text not null default 'connected'
                              check (status in ('connected', 'disconnected', 'error')),
  last_health_check_at      timestamptz,
  last_health_check_ok      boolean,
  last_error                text,
  last_error_at             timestamptz,

  -- The "Wevenu Services" placeholder QBO Item's id (see items.ts) — cached
  -- here since it's connection-level state, not per-invoice.
  default_item_quickbooks_id text,

  company_name              text,   -- captured from CompanyInfo at connect time, for display only

  connected_at              timestamptz not null default now(),
  disconnected_at           timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index quickbooks_connections_venue on public.quickbooks_connections (venue_id);

create trigger quickbooks_connections_updated_at
  before update on public.quickbooks_connections
  for each row execute function public.set_updated_at();

alter table public.quickbooks_connections enable row level security;
create policy quickbooks_connections_all on public.quickbooks_connections
  for all using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.quickbooks_connections to authenticated;
grant select, insert, update, delete on public.quickbooks_connections to service_role;

-- ── quickbooks_sync_queue — the retry-capable outbound queue ───────────────
-- Deliberately NOT mirroring automation_executions/scheduled_messages'
-- try-once-and-give-up pattern (neither has a retry_count/next_attempt_at
-- column anywhere) — this is the one thing this feature must get right
-- that those two systems don't.

create table public.quickbooks_sync_queue (
  id                uuid primary key default gen_random_uuid(),
  venue_id          uuid not null references public.venues (id) on delete cascade,

  entity_type       text not null check (entity_type in ('customer', 'invoice', 'payment', 'refund')),
  entity_id         uuid not null,
  operation         text not null default 'upsert' check (operation in ('upsert')),

  status            text not null default 'pending'
                       check (status in ('pending', 'processing', 'succeeded', 'failed_retrying', 'dead_letter')),

  attempt_count     integer not null default 0,
  max_attempts      integer not null default 8,
  next_attempt_at   timestamptz not null default now(),

  last_error        text,
  last_error_at     timestamptz,
  last_attempted_at timestamptz,

  -- Idempotency at the queue level: re-enqueueing the exact same pending
  -- state is a no-op; a legitimate edit after a prior resolved sync still
  -- gets a fresh row (the partial unique index below only covers
  -- unresolved statuses, so a succeeded/dead_letter row never blocks a
  -- brand-new push for the same entity).
  payload_hash      text not null,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index quickbooks_sync_queue_dedupe
  on public.quickbooks_sync_queue (venue_id, entity_type, entity_id, operation)
  where status in ('pending', 'processing', 'failed_retrying');

create index quickbooks_sync_queue_due
  on public.quickbooks_sync_queue (next_attempt_at)
  where status in ('pending', 'failed_retrying');

create trigger quickbooks_sync_queue_updated_at
  before update on public.quickbooks_sync_queue
  for each row execute function public.set_updated_at();

alter table public.quickbooks_sync_queue enable row level security;
create policy quickbooks_sync_queue_all on public.quickbooks_sync_queue
  for all using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.quickbooks_sync_queue to authenticated;
grant select, insert, update, delete on public.quickbooks_sync_queue to service_role;

-- ── quickbooks_sync_log — append-only audit trail ───────────────────────────
-- Mirrors invoice_activities/payment_activities' shape exactly. What a
-- coordinator reads for "why did this fail three times" — separate from
-- the queue row, which only ever holds current state.

create table public.quickbooks_sync_log (
  id             uuid primary key default gen_random_uuid(),
  venue_id       uuid not null references public.venues (id) on delete cascade,
  queue_id       uuid references public.quickbooks_sync_queue (id) on delete set null,

  entity_type    text not null,
  entity_id      uuid not null,
  outcome        text not null check (outcome in ('succeeded', 'failed', 'dead_lettered')),
  attempt_number integer not null,
  quickbooks_id  text,
  message        text,
  created_at     timestamptz not null default now()
);

create index quickbooks_sync_log_venue  on public.quickbooks_sync_log (venue_id, created_at desc);
create index quickbooks_sync_log_entity on public.quickbooks_sync_log (entity_type, entity_id, created_at desc);

alter table public.quickbooks_sync_log enable row level security;
create policy quickbooks_sync_log_all on public.quickbooks_sync_log
  for all using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert on public.quickbooks_sync_log to authenticated;
grant select, insert on public.quickbooks_sync_log to service_role;

-- ── Sync-status columns on existing tables ──────────────────────────────────
-- Mirrors conversation_messages.provider_id/status exactly: nullable text
-- id + partial index, populated only once a real push succeeds.
--
-- quickbooks_sync_status is deliberately simpler than conversation_
-- messages' ranked 6-state lifecycle (shouldAdvanceStatus()) — there's no
-- multi-stage delivery pipeline here, just push-once-confirm-or-fail. A
-- queue row moving to failed_retrying must NOT flip this to 'failed' —
-- only a dead_letter outcome does, so a coordinator never sees a scary
-- "failed" badge on something one retry away from succeeding.

alter table public.clients
  add column quickbooks_customer_id  text,
  add column quickbooks_sync_status  text not null default 'not_synced'
    check (quickbooks_sync_status in ('not_synced', 'pending', 'synced', 'failed')),
  add column quickbooks_synced_at    timestamptz;

create unique index clients_quickbooks_customer_id
  on public.clients (venue_id, quickbooks_customer_id) where quickbooks_customer_id is not null;

alter table public.invoices
  add column quickbooks_invoice_id   text,
  add column quickbooks_sync_status  text not null default 'not_synced'
    check (quickbooks_sync_status in ('not_synced', 'pending', 'synced', 'failed')),
  add column quickbooks_synced_at    timestamptz;

create unique index invoices_quickbooks_invoice_id
  on public.invoices (venue_id, quickbooks_invoice_id) where quickbooks_invoice_id is not null;

-- payment_line_items carries BOTH a payment id and a refund id on the same
-- row — refunds aren't a separate domain entity in this schema (the table
-- already carries refunded_amount/refunded_at/refund_reason directly, per
-- TR-M3), so a refund is a state transition on the same row, not a new table.
alter table public.payment_line_items
  add column quickbooks_payment_id   text,
  add column quickbooks_refund_id    text,
  add column quickbooks_sync_status  text not null default 'not_synced'
    check (quickbooks_sync_status in ('not_synced', 'pending', 'synced', 'failed')),
  add column quickbooks_synced_at    timestamptz;

create unique index payment_line_items_quickbooks_payment_id
  on public.payment_line_items (venue_id, quickbooks_payment_id) where quickbooks_payment_id is not null;
create unique index payment_line_items_quickbooks_refund_id
  on public.payment_line_items (venue_id, quickbooks_refund_id) where quickbooks_refund_id is not null;

notify pgrst, 'reload schema';
