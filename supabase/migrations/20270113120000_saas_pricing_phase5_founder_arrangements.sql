-- ============================================================================
-- Phase 5 — Founder custom pricing arrangements
--
-- Venue-scoped commercial exceptions managed from Founder CRM.
-- HTC is authoritative for eligibility; Stripe executes billing.
-- Service-role only. History is append-friendly (revisions supersede, never erase).
--
-- NOT APPLIED until Phase 5 Sandbox activation approval.
-- ============================================================================

create table if not exists public.saas_founder_arrangements (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  stripe_subscription_id text not null,
  stripe_customer_id text,

  -- percent_off | amount_off | fixed_rate | rate_freeze | tier_freeze
  kind text not null
    check (kind in (
      'percent_off',
      'amount_off',
      'fixed_rate',
      'rate_freeze',
      'tier_freeze'
    )),

  percent_off integer
    check (percent_off is null or (percent_off >= 0 and percent_off <= 100)),
  amount_off_cents integer
    check (amount_off_cents is null or amount_off_cents >= 0),
  fixed_rate_cents integer
    check (fixed_rate_cents is null or fixed_rate_cents >= 0),
  -- Rate freeze: protected base list amount (cents) for the frozen plan.
  frozen_list_amount_cents integer
    check (frozen_list_amount_cents is null or frozen_list_amount_cents >= 0),

  -- Which plans this commercial term applies to.
  -- 'current' = only the plan at activation; 'all' = survives every tier change.
  plan_scope text not null default 'all'
    check (plan_scope in ('current', 'all', 'starter', 'growing', 'professional')),
  plan_key_at_create text
    check (
      plan_key_at_create is null
      or plan_key_at_create in ('starter', 'growing', 'professional')
    ),
  survives_tier_change boolean not null default true,
  prevents_tier_upgrade boolean not null default false,
  protects_base_rate boolean not null default false,

  effective_at timestamptz not null,
  expires_at timestamptz,
  duration_billing_cycles integer
    check (duration_billing_cycles is null or duration_billing_cycles > 0),
  cycles_consumed integer not null default 0
    check (cycles_consumed >= 0),

  status text not null default 'scheduled'
    check (status in (
      'scheduled',
      'active',
      'expired',
      'ended',
      'superseded',
      'failed',
      'cancelled'
    )),

  reason text not null,
  internal_notes text,
  customer_facing_label text,

  created_by_user_id uuid,
  created_by_email text,
  ended_by_email text,
  ended_at timestamptz,
  end_reason text,

  -- Stripe execution
  stripe_coupon_id text,
  stripe_price_id text,
  reconciliation_status text not null default 'pending'
    check (reconciliation_status in (
      'pending',
      'applied',
      'deferred_schedule',
      'failed',
      'not_applicable',
      'cleared'
    )),
  expected_recurring_amount_cents integer
    check (expected_recurring_amount_cents is null or expected_recurring_amount_cents >= 0),
  last_reconcile_error text,
  last_reconciled_at timestamptz,

  -- Replace / revise without destroying history
  supersedes_arrangement_id uuid
    references public.saas_founder_arrangements (id) on delete set null,
  superseded_by_arrangement_id uuid
    references public.saas_founder_arrangements (id) on delete set null,

  related_tier_hold_id uuid,
  idempotency_key text not null,
  audit jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint saas_founder_arr_dates_chk
    check (expires_at is null or expires_at > effective_at),
  constraint saas_founder_arr_kind_value_chk
    check (
      (kind = 'percent_off' and percent_off is not null)
      or (kind = 'amount_off' and amount_off_cents is not null)
      or (kind = 'fixed_rate' and fixed_rate_cents is not null)
      or (kind = 'rate_freeze' and frozen_list_amount_cents is not null)
      or (kind = 'tier_freeze' and prevents_tier_upgrade = true)
    )
);

create unique index if not exists saas_founder_arr_idempotency_uidx
  on public.saas_founder_arrangements (idempotency_key);

-- At most one active/scheduled financial arrangement per venue+kind that mutates price.
-- Tier freezes may coexist with a financial arrangement.
create unique index if not exists saas_founder_arr_active_financial_uidx
  on public.saas_founder_arrangements (venue_id, kind)
  where status in ('scheduled', 'active')
    and kind in ('percent_off', 'amount_off', 'fixed_rate', 'rate_freeze');

create unique index if not exists saas_founder_arr_active_tier_freeze_uidx
  on public.saas_founder_arrangements (venue_id)
  where status in ('scheduled', 'active')
    and kind = 'tier_freeze';

create index if not exists saas_founder_arr_venue_idx
  on public.saas_founder_arrangements (venue_id);

create index if not exists saas_founder_arr_subscription_idx
  on public.saas_founder_arrangements (stripe_subscription_id);

create index if not exists saas_founder_arr_status_idx
  on public.saas_founder_arrangements (status);

create index if not exists saas_founder_arr_effective_idx
  on public.saas_founder_arrangements (effective_at)
  where status in ('scheduled', 'active');

create index if not exists saas_founder_arr_expires_idx
  on public.saas_founder_arrangements (expires_at)
  where expires_at is not null and status in ('scheduled', 'active');

comment on table public.saas_founder_arrangements is
  'Phase 5 founder custom pricing. Venue-scoped; never inferred across an organization.';

alter table public.saas_founder_arrangements enable row level security;
revoke all on table public.saas_founder_arrangements from authenticated, anon;
grant all on table public.saas_founder_arrangements to service_role;
