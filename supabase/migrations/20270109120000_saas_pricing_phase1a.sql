-- ============================================================================
-- Phase 1A/1B — SaaS pricing catalog, Checkout offers, earned grants, applied discounts
--
-- Soft Founding milestone (first ~100 paid venues): issuance is gated by the
-- count of earned founding grants. Already-issued Checkout offers are honored
-- even if the earned count reaches or exceeds 100 while the customer pays.
-- No founding_slots table. No hard capacity lock. No HTC reservation TTL.
--
-- offer_status 'failed' also covers Stripe Checkout Session create failures
-- after a local offer was issued (so the offer cannot later become earned).
--
-- NOT APPLIED until Phase 1B Sandbox activation approval.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Versioned standard pricing catalog (HTC source of truth for list amounts)
-- ---------------------------------------------------------------------------
create table if not exists public.saas_price_versions (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null
    check (plan_key in ('starter', 'growing', 'professional')),
  list_amount_cents integer not null check (list_amount_cents > 0),
  capacity_min integer not null default 0 check (capacity_min >= 0),
  capacity_max integer check (capacity_max is null or capacity_max >= capacity_min),
  stripe_price_id text,
  version_label text not null default 'v1',
  is_current boolean not null default false,
  effective_from timestamptz not null default now(),
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists saas_price_versions_one_current_per_plan
  on public.saas_price_versions (plan_key)
  where is_current = true and retired_at is null;

comment on table public.saas_price_versions is
  'HTC versioned SaaS list prices. Stripe Price IDs are linked; amounts are authoritative in HTC.';

-- Seed Phase 1 catalog rows (Stripe Price IDs filled in Phase 1B via env / ops).
insert into public.saas_price_versions (
  plan_key, list_amount_cents, capacity_min, capacity_max, version_label, is_current
)
select v.plan_key, v.list_amount_cents, v.capacity_min, v.capacity_max, 'v1', true
from (
  values
    ('starter'::text, 19900, 0, 25),
    ('growing'::text, 24900, 26, 75),
    ('professional'::text, 34900, 76, null::integer)
) as v(plan_key, list_amount_cents, capacity_min, capacity_max)
where not exists (
  select 1 from public.saas_price_versions s
  where s.plan_key = v.plan_key and s.is_current = true and s.retired_at is null
);

-- ---------------------------------------------------------------------------
-- Checkout-issued offers (durable; honored for the life of that Session)
-- ---------------------------------------------------------------------------
create table if not exists public.saas_checkout_offers (
  id uuid primary key default gen_random_uuid(),
  checkout_session_id text,
  offer_status text not null default 'issued'
    check (offer_status in (
      'issued',       -- attached (or about to attach) to a Checkout Session
      'paid',         -- qualifying payment observed
      'earned',       -- founding/weven grant persisted
      'expired',      -- Stripe session expired / abandoned (not earned)
      'failed',       -- payment failed
      'superseded'    -- replaced by a newer session for same purchase attempt
    )),
  plan_key text not null
    check (plan_key in ('starter', 'growing', 'professional')),
  list_amount_cents integer not null check (list_amount_cents > 0),
  stripe_price_id text not null,
  founding_issued boolean not null default false,
  founding_percent_off integer
    check (founding_percent_off is null or (founding_percent_off > 0 and founding_percent_off <= 100)),
  stripe_coupon_id text,
  pricing_version text not null default 'v1',
  relationship_id text,
  stripe_customer_id text,
  owner_email_normalized text,
  venue_name_normalized text,
  earned_founding_count_at_issue integer,
  metadata jsonb not null default '{}'::jsonb,
  issued_at timestamptz not null default now(),
  paid_at timestamptz,
  earned_at timestamptz,
  expired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists saas_checkout_offers_session_uidx
  on public.saas_checkout_offers (checkout_session_id)
  where checkout_session_id is not null;

create index if not exists saas_checkout_offers_relationship_idx
  on public.saas_checkout_offers (relationship_id)
  where relationship_id is not null;

create index if not exists saas_checkout_offers_status_idx
  on public.saas_checkout_offers (offer_status);

comment on table public.saas_checkout_offers is
  'Server-issued Checkout pricing decision. founding_issued is honored even after the soft 100 milestone.';

-- ---------------------------------------------------------------------------
-- Earned promotional eligibility (permanent grants; may coexist)
-- ---------------------------------------------------------------------------
create table if not exists public.saas_offer_grants (
  id uuid primary key default gen_random_uuid(),
  offer_type text not null
    check (offer_type in (
      'founding_pct',
      'weven_pct',
      'group_pct',
      'founder_override'
    )),
  status text not null default 'earned'
    check (status in ('earned', 'revoked_prospective')),
  percent_off integer
    check (percent_off is null or (percent_off > 0 and percent_off <= 100)),
  fixed_monthly_cents integer
    check (fixed_monthly_cents is null or fixed_monthly_cents >= 0),
  venue_id uuid references public.venues (id) on delete set null,
  relationship_id text,
  owner_user_id uuid,
  source_checkout_session_id text,
  source_offer_id uuid references public.saas_checkout_offers (id) on delete set null,
  source text not null default 'checkout'
    check (source in ('checkout', 'crm_review', 'founder', 'system')),
  earned_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoke_reason text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One earned founding grant per venue (once venue is known).
create unique index if not exists saas_offer_grants_founding_venue_uidx
  on public.saas_offer_grants (venue_id)
  where offer_type = 'founding_pct'
    and status = 'earned'
    and venue_id is not null;

-- Idempotent earn from a Checkout Session.
create unique index if not exists saas_offer_grants_founding_session_uidx
  on public.saas_offer_grants (source_checkout_session_id)
  where offer_type = 'founding_pct'
    and source_checkout_session_id is not null;

-- One earned weven grant per venue (Phase 2).
create unique index if not exists saas_offer_grants_weven_venue_uidx
  on public.saas_offer_grants (venue_id)
  where offer_type = 'weven_pct'
    and status = 'earned'
    and venue_id is not null;

create index if not exists saas_offer_grants_type_status_idx
  on public.saas_offer_grants (offer_type, status);

comment on table public.saas_offer_grants is
  'Permanent earned eligibility. Separate from the discount currently applied on Stripe.';

-- ---------------------------------------------------------------------------
-- Currently applied billing discount + audit history
-- ---------------------------------------------------------------------------
create table if not exists public.saas_offer_applications (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references public.venues (id) on delete set null,
  stripe_subscription_id text,
  applied_grant_id uuid references public.saas_offer_grants (id) on delete set null,
  offer_type text,
  percent_off integer,
  stripe_coupon_id text,
  list_amount_cents integer,
  expected_invoice_amount_cents integer,
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists saas_offer_applications_venue_idx
  on public.saas_offer_applications (venue_id, effective_from desc);

create index if not exists saas_offer_applications_subscription_idx
  on public.saas_offer_applications (stripe_subscription_id)
  where stripe_subscription_id is not null;

comment on table public.saas_offer_applications is
  'Append-only record of which earned grant was applied to Stripe billing at a point in time.';

-- ---------------------------------------------------------------------------
-- Former Weven claims (Phase 2 behavior; schema ready in Phase 1)
-- ---------------------------------------------------------------------------
create table if not exists public.weven_claims (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references public.venues (id) on delete set null,
  relationship_id text,
  checkout_session_id text,
  self_declared_at timestamptz not null default now(),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'verified', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by text,
  review_notes text,
  grant_id uuid references public.saas_offer_grants (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists weven_claims_venue_idx
  on public.weven_claims (venue_id)
  where venue_id is not null;

create index if not exists weven_claims_review_status_idx
  on public.weven_claims (review_status);

comment on table public.weven_claims is
  'Trust-first former-Weven self-declaration + founder review. Discount apply/revoke is Phase 2.';

-- ---------------------------------------------------------------------------
-- Service-role only (RLS on, no anon/authenticated grants)
-- Sandbox follow-up 20270109121000 also applies this for environments that
-- already ran the create-table section before this block existed.
-- ---------------------------------------------------------------------------
alter table public.saas_price_versions enable row level security;
alter table public.saas_checkout_offers enable row level security;
alter table public.saas_offer_grants enable row level security;
alter table public.saas_offer_applications enable row level security;
alter table public.weven_claims enable row level security;

revoke all on table public.saas_price_versions from authenticated, anon;
revoke all on table public.saas_checkout_offers from authenticated, anon;
revoke all on table public.saas_offer_grants from authenticated, anon;
revoke all on table public.saas_offer_applications from authenticated, anon;
revoke all on table public.weven_claims from authenticated, anon;

grant all on table public.saas_price_versions to service_role;
grant all on table public.saas_checkout_offers to service_role;
grant all on table public.saas_offer_grants to service_role;
grant all on table public.saas_offer_applications to service_role;
grant all on table public.weven_claims to service_role;
