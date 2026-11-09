-- ============================================================================
-- Phase 3 — Automatic event-volume tier upgrades (pending upgrades + holds)
--
-- Durable intent for upgrade-only, renewal-timed, notice-gated plan changes.
-- Stripe Subscription Schedule references are stored when scheduling succeeds;
-- HTC never treats an API ack alone as proof the higher tier was billed.
--
-- NOT APPLIED until Phase 3 Sandbox activation approval.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Pending automatic tier upgrades (one active intent per subscription)
-- ---------------------------------------------------------------------------
create table if not exists public.saas_tier_upgrades (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  stripe_subscription_id text not null,
  stripe_customer_id text,
  current_plan_key text not null
    check (current_plan_key in ('starter', 'growing', 'professional')),
  required_plan_key text not null
    check (required_plan_key in ('starter', 'growing', 'professional')),
  peak_count integer not null check (peak_count >= 0),
  peak_year integer not null check (peak_year >= 2000),
  evaluation_as_of date not null,
  evaluated_at timestamptz not null default now(),
  status text not null default 'evaluated'
    check (status in (
      'evaluated',
      'pending_notice',
      'notice_sent',
      'scheduled',
      'applied',
      'superseded',
      'cancelled',
      'failed',
      'blocked_hold',
      'blocked_legacy',
      'blocked_review'
    )),
  notice_window_days integer not null default 7 check (notice_window_days >= 1),
  notice_due_at timestamptz,
  notice_sent_at timestamptz,
  notice_idempotency_key text,
  -- provider_accepted | simulated | failed | not_sent
  -- Only provider_accepted (Resend API accept + message id) satisfies billing apply.
  notice_delivery_status text
    check (
      notice_delivery_status is null
      or notice_delivery_status in (
        'not_sent', 'provider_accepted', 'simulated', 'failed'
      )
    ),
  notice_provider_message_id text,
  current_period_end_at timestamptz,
  current_period_start_at timestamptz,
  scheduled_effective_at timestamptz,
  skipped_imminent_renewal boolean not null default false,
  current_list_amount_cents integer not null check (current_list_amount_cents > 0),
  required_list_amount_cents integer not null check (required_list_amount_cents > 0),
  applied_offer_type text
    check (applied_offer_type is null or applied_offer_type in (
      'founding_pct', 'weven_pct', 'group_pct', 'founder_override'
    )),
  applied_percent_off integer
    check (applied_percent_off is null or (applied_percent_off >= 0 and applied_percent_off <= 100)),
  expected_recurring_amount_cents integer not null check (expected_recurring_amount_cents >= 0),
  current_stripe_price_id text,
  required_stripe_price_id text,
  stripe_coupon_id text,
  stripe_schedule_id text,
  stripe_schedule_phase_start_at timestamptz,
  evaluation_idempotency_key text not null,
  schedule_idempotency_key text,
  error_history jsonb not null default '[]'::jsonb,
  audit jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saas_tier_upgrades_upgrade_only
    check (
      (current_plan_key = 'starter' and required_plan_key in ('growing', 'professional'))
      or (current_plan_key = 'growing' and required_plan_key = 'professional')
      or (current_plan_key = required_plan_key)
    )
);

-- At most one non-terminal pending upgrade per subscription.
create unique index if not exists saas_tier_upgrades_active_subscription_uidx
  on public.saas_tier_upgrades (stripe_subscription_id)
  where status in (
    'evaluated', 'pending_notice', 'notice_sent', 'scheduled',
    'blocked_hold', 'blocked_legacy', 'blocked_review', 'failed'
  );

create unique index if not exists saas_tier_upgrades_eval_idempotency_uidx
  on public.saas_tier_upgrades (evaluation_idempotency_key);

create unique index if not exists saas_tier_upgrades_notice_idempotency_uidx
  on public.saas_tier_upgrades (notice_idempotency_key)
  where notice_idempotency_key is not null;

create index if not exists saas_tier_upgrades_venue_idx
  on public.saas_tier_upgrades (venue_id);

create index if not exists saas_tier_upgrades_status_idx
  on public.saas_tier_upgrades (status);

create index if not exists saas_tier_upgrades_effective_idx
  on public.saas_tier_upgrades (scheduled_effective_at)
  where scheduled_effective_at is not null;

comment on table public.saas_tier_upgrades is
  'Phase 3 automatic upgrade-only intents. Never auto-downgrade. Notice + eligible renewal required.';

-- ---------------------------------------------------------------------------
-- Founder upgrade holds / freezes (minimal Phase 3 exception path)
-- ---------------------------------------------------------------------------
create table if not exists public.saas_tier_upgrade_holds (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  stripe_subscription_id text,
  active boolean not null default true,
  reason text not null,
  placed_by text not null,
  placed_at timestamptz not null default now(),
  expires_at timestamptz,
  released_at timestamptz,
  released_by text,
  release_reason text,
  audit jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists saas_tier_upgrade_holds_active_venue_uidx
  on public.saas_tier_upgrade_holds (venue_id)
  where active = true;

create index if not exists saas_tier_upgrade_holds_subscription_idx
  on public.saas_tier_upgrade_holds (stripe_subscription_id)
  where stripe_subscription_id is not null;

comment on table public.saas_tier_upgrade_holds is
  'Founder freeze on automatic tier upgrades. Evaluation may still flag; Stripe must not reprice.';

-- ---------------------------------------------------------------------------
-- Optional venue-visible snapshot columns (read model; source of truth is upgrade row)
-- ---------------------------------------------------------------------------
alter table public.venues
  add column if not exists saas_plan_key text
    check (saas_plan_key is null or saas_plan_key in ('starter', 'growing', 'professional'));

alter table public.venues
  add column if not exists saas_tier_upgrade_hold boolean not null default false;

comment on column public.venues.saas_plan_key is
  'Cached HTC SaaS plan key for the venue subscription (Gather/Celebrate/Flourish).';

comment on column public.venues.saas_tier_upgrade_hold is
  'Denormalized: true when an active saas_tier_upgrade_holds row exists for the venue.';

-- ---------------------------------------------------------------------------
-- Service-role only (RLS on, no anon/authenticated table grants)
-- Venue users read upgrade status via app APIs that filter by membership.
-- ---------------------------------------------------------------------------
alter table public.saas_tier_upgrades enable row level security;
alter table public.saas_tier_upgrade_holds enable row level security;

revoke all on table public.saas_tier_upgrades from authenticated, anon;
revoke all on table public.saas_tier_upgrade_holds from authenticated, anon;

grant all on table public.saas_tier_upgrades to service_role;
grant all on table public.saas_tier_upgrade_holds to service_role;
