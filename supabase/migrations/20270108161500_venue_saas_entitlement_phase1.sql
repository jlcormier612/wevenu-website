-- ============================================================================
-- Phase 1 — SaaS entitlement, retention placeholders, lifecycle notifications
--
-- Additive only. Does not delete data. Does not enable permanent deletion.
-- Authoritative Stripe period fields + HTC access/override/retention metadata.
-- ============================================================================

-- Stripe SaaS subscription mirror (SoT remains Stripe; these are synced facts)
alter table public.venues
  add column if not exists saas_stripe_subscription_id text;

alter table public.venues
  add column if not exists saas_subscription_status text;

alter table public.venues
  add column if not exists cancel_at_period_end boolean not null default false;

alter table public.venues
  add column if not exists current_period_end timestamptz;

-- HTC entitlement layer (distinct from Stripe billing status)
alter table public.venues
  add column if not exists entitlement_status text not null default 'active';

alter table public.venues
  drop constraint if exists venues_entitlement_status_check;

alter table public.venues
  add constraint venues_entitlement_status_check
  check (
    entitlement_status in (
      'active',
      'grace',
      'scheduled_end',
      'suspended',
      'retained',
      'deletion_eligible'
    )
  );

alter table public.venues
  add column if not exists access_loss_reason text;

alter table public.venues
  drop constraint if exists venues_access_loss_reason_check;

alter table public.venues
  add constraint venues_access_loss_reason_check
  check (
    access_loss_reason is null
    or access_loss_reason in ('voluntary_cancel', 'nonpayment', 'manual_security')
  );

-- Effective HTC access-end (may differ from current_period_end when overridden)
alter table public.venues
  add column if not exists access_ends_at timestamptz;

alter table public.venues
  add column if not exists access_ended_at timestamptz;

-- Retention placeholders (Phase 3 executor remains gated elsewhere)
alter table public.venues
  add column if not exists retention_started_at timestamptz;

alter table public.venues
  add column if not exists deletion_eligible_at timestamptz;

alter table public.venues
  add column if not exists retention_hold boolean not null default false;

alter table public.venues
  add column if not exists retention_hold_reason text;

alter table public.venues
  add column if not exists retention_hold_by text;

alter table public.venues
  add column if not exists retention_hold_at timestamptz;

-- Founder / admin access override (access only — never mutates Stripe)
alter table public.venues
  add column if not exists access_override_until timestamptz;

alter table public.venues
  add column if not exists access_override_reason text;

alter table public.venues
  add column if not exists access_override_by text;

alter table public.venues
  add column if not exists access_override_at timestamptz;

-- Pause ordinary billing-driven suspension (dunning day-21 / period end)
alter table public.venues
  add column if not exists pause_billing_suspend boolean not null default false;

-- Independent security/manual lock — payment success must not clear this
alter table public.venues
  add column if not exists manual_security_lock boolean not null default false;

alter table public.venues
  add column if not exists manual_security_lock_reason text;

alter table public.venues
  add column if not exists entitlement_synced_at timestamptz;

comment on column public.venues.saas_stripe_subscription_id is
  'Hello to Cheers SaaS Stripe Subscription id. Not Connect.';
comment on column public.venues.current_period_end is
  'Stripe current_period_end (UTC). Paid-through boundary while subscription active.';
comment on column public.venues.access_ends_at is
  'HTC effective access-end (UTC). Equals period end unless founder override extends it.';
comment on column public.venues.manual_security_lock is
  'Independent lock. Survives payment recovery and ordinary founder access overrides.';
comment on column public.venues.pause_billing_suspend is
  'When true, ordinary billing-driven suspension is deferred until cleared or override expires.';

create index if not exists venues_saas_stripe_subscription_id_idx
  on public.venues (saas_stripe_subscription_id)
  where saas_stripe_subscription_id is not null;

create index if not exists venues_access_ends_at_idx
  on public.venues (access_ends_at)
  where access_ends_at is not null and access_disabled = false;

create index if not exists venues_entitlement_status_idx
  on public.venues (entitlement_status);

-- Deduplicated notification intents (email delivery may fail; deadlines still enforce)
create table if not exists public.venue_lifecycle_notification_intents (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references public.venues (id) on delete set null,
  relationship_id text,
  checkpoint text not null,
  channel text not null default 'email',
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venue_lifecycle_notification_intents_status_check
    check (status in ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  constraint venue_lifecycle_notification_intents_channel_check
    check (channel in ('email', 'in_app', 'internal_alert'))
);

-- Expression unique index requires parenthesized expressions in PostgreSQL.
create unique index if not exists venue_lifecycle_notification_intents_dedupe
  on public.venue_lifecycle_notification_intents (
    (coalesce(venue_id::text, '')),
    (coalesce(relationship_id, '')),
    checkpoint,
    channel
  );

create index if not exists venue_lifecycle_notification_intents_pending_idx
  on public.venue_lifecycle_notification_intents (status, updated_at)
  where status in ('pending', 'failed');

alter table public.venue_lifecycle_notification_intents enable row level security;
revoke all on table public.venue_lifecycle_notification_intents from authenticated, anon;
grant select, insert, update on table public.venue_lifecycle_notification_intents to service_role;

-- Append-only lifecycle audit (founder overrides, entitlement applies)
create table if not exists public.venue_lifecycle_audit_events (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references public.venues (id) on delete set null,
  relationship_id text,
  event_type text not null,
  actor_id text,
  actor_label text,
  reason text,
  before_state jsonb,
  after_state jsonb,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists venue_lifecycle_audit_events_venue_idx
  on public.venue_lifecycle_audit_events (venue_id, created_at desc);

create index if not exists venue_lifecycle_audit_events_relationship_idx
  on public.venue_lifecycle_audit_events (relationship_id, created_at desc)
  where relationship_id is not null;

alter table public.venue_lifecycle_audit_events enable row level security;
revoke all on table public.venue_lifecycle_audit_events from authenticated, anon;
grant select, insert on table public.venue_lifecycle_audit_events to service_role;
