-- ============================================================================
-- Phase 4 — Multi-venue organizations & group pricing (10%)
--
-- Explicit organization membership only (never inferred from email/Stripe/staff).
-- Group eligibility requires two or more active qualifying venue subscriptions.
-- Group discount is eligibility-based (not a lifetime grant independent of membership).
--
-- NOT APPLIED until Phase 4 Sandbox activation approval.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------
create table if not exists public.saas_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  review_status text not null default 'none'
    check (review_status in ('none', 'pending_review', 'approved', 'flagged')),
  review_notes text,
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists saas_organizations_status_idx
  on public.saas_organizations (status);

comment on table public.saas_organizations is
  'Phase 4 billing organization. Membership is explicit; never inferred from email or Stripe Customer.';

-- ---------------------------------------------------------------------------
-- Venue membership (exactly one active billing org per venue)
-- ---------------------------------------------------------------------------
create table if not exists public.saas_organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.saas_organizations(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'pending_activation', 'pending_review')),
  role text not null default 'member'
    check (role in ('member', 'primary')),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_by_user_id uuid,
  review_required boolean not null default false,
  review_reason text,
  audit jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saas_org_memberships_dates_chk
    check (effective_to is null or effective_to >= effective_from)
);

-- One active/pending billing membership per venue (no silent multi-org billing).
create unique index if not exists saas_org_memberships_active_venue_uidx
  on public.saas_organization_memberships (venue_id)
  where status in ('active', 'pending_activation', 'pending_review')
    and effective_to is null;

create index if not exists saas_org_memberships_org_idx
  on public.saas_organization_memberships (organization_id);

create index if not exists saas_org_memberships_status_idx
  on public.saas_organization_memberships (status);

comment on table public.saas_organization_memberships is
  'Explicit venue↔organization billing membership. Spaces within one venue never create extra memberships.';

-- ---------------------------------------------------------------------------
-- Organization administrators (billing authority ≠ operational venue access)
-- ---------------------------------------------------------------------------
create table if not exists public.saas_organization_admins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.saas_organizations(id) on delete cascade,
  user_id uuid,
  email_normalized text,
  status text not null default 'active'
    check (status in ('active', 'revoked')),
  can_manage_membership boolean not null default true,
  can_purchase_venues boolean not null default true,
  can_view_billing boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint saas_org_admins_identity_chk
    check (user_id is not null or email_normalized is not null)
);

create unique index if not exists saas_org_admins_org_user_uidx
  on public.saas_organization_admins (organization_id, user_id)
  where user_id is not null and status = 'active';

create unique index if not exists saas_org_admins_org_email_uidx
  on public.saas_organization_admins (organization_id, email_normalized)
  where email_normalized is not null and status = 'active';

comment on table public.saas_organization_admins is
  'Org billing admins. Does not grant cross-venue operational CRM access by itself.';

-- ---------------------------------------------------------------------------
-- Checkout reservations (atomic second-venue group qualification)
-- ---------------------------------------------------------------------------
create table if not exists public.saas_org_checkout_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.saas_organizations(id) on delete cascade,
  source_venue_id uuid references public.venues(id) on delete set null,
  checkout_offer_id uuid references public.saas_checkout_offers(id) on delete set null,
  stripe_checkout_session_id text,
  status text not null default 'reserved'
    check (status in (
      'reserved',    -- counts toward Checkout group eligibility only
      'fulfilled',   -- second venue paid + membership activated
      'released',    -- abandoned / expired / failed payment
      'superseded'
    )),
  counts_toward_eligibility boolean not null default true,
  plan_key text
    check (plan_key is null or plan_key in ('starter', 'growing', 'professional')),
  expires_at timestamptz,
  fulfilled_venue_id uuid references public.venues(id) on delete set null,
  fulfilled_at timestamptz,
  released_at timestamptz,
  release_reason text,
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists saas_org_checkout_reservations_session_uidx
  on public.saas_org_checkout_reservations (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists saas_org_checkout_reservations_org_status_idx
  on public.saas_org_checkout_reservations (organization_id, status);

comment on table public.saas_org_checkout_reservations is
  'Pending Add Another Venue Checkout. Reserved rows may unlock group 10% on the new Session without mutating venue-1 midcycle.';

-- ---------------------------------------------------------------------------
-- Eligibility snapshots (audit)
-- ---------------------------------------------------------------------------
create table if not exists public.saas_group_eligibility_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.saas_organizations(id) on delete cascade,
  qualifying_venue_count integer not null check (qualifying_venue_count >= 0),
  reserved_checkout_count integer not null default 0 check (reserved_checkout_count >= 0),
  group_eligible boolean not null,
  reason text not null,
  member_venue_ids uuid[] not null default '{}',
  evaluated_at timestamptz not null default now(),
  trigger_event text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists saas_group_eligibility_org_idx
  on public.saas_group_eligibility_snapshots (organization_id, evaluated_at desc);

-- ---------------------------------------------------------------------------
-- Prospective billing adjustments (Phase 3 schedule-safe)
-- ---------------------------------------------------------------------------
create table if not exists public.saas_group_billing_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.saas_organizations(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  stripe_subscription_id text,
  status text not null default 'pending'
    check (status in (
      'pending',
      'deferred_to_schedule', -- active HTC tier-upgrade schedule owns coupon timing
      'applied',
      'cancelled',
      'failed'
    )),
  desired_offer_type text
    check (desired_offer_type is null or desired_offer_type in (
      'founding_pct', 'weven_pct', 'group_pct', 'founder_override'
    )),
  desired_percent_off integer
    check (desired_percent_off is null or (desired_percent_off >= 0 and desired_percent_off <= 100)),
  desired_stripe_coupon_id text,
  previous_offer_type text,
  previous_stripe_coupon_id text,
  expected_recurring_amount_cents integer,
  related_tier_upgrade_id uuid,
  idempotency_key text not null,
  error_message text,
  applied_at timestamptz,
  audit jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists saas_group_billing_adjustments_idem_uidx
  on public.saas_group_billing_adjustments (idempotency_key);

create index if not exists saas_group_billing_adjustments_status_idx
  on public.saas_group_billing_adjustments (status);

create index if not exists saas_group_billing_adjustments_venue_idx
  on public.saas_group_billing_adjustments (venue_id);

comment on table public.saas_group_billing_adjustments is
  'Prospective group coupon add/remove. Never midcycle-prorates. Defers when an HTC Phase 3 schedule owns the subscription.';

-- ---------------------------------------------------------------------------
-- RLS — service role only for billing mutations; authenticated reads denied by default
-- ---------------------------------------------------------------------------
alter table public.saas_organizations enable row level security;
alter table public.saas_organization_memberships enable row level security;
alter table public.saas_organization_admins enable row level security;
alter table public.saas_org_checkout_reservations enable row level security;
alter table public.saas_group_eligibility_snapshots enable row level security;
alter table public.saas_group_billing_adjustments enable row level security;

revoke all on table public.saas_organizations from authenticated, anon;
revoke all on table public.saas_organization_memberships from authenticated, anon;
revoke all on table public.saas_organization_admins from authenticated, anon;
revoke all on table public.saas_org_checkout_reservations from authenticated, anon;
revoke all on table public.saas_group_eligibility_snapshots from authenticated, anon;
revoke all on table public.saas_group_billing_adjustments from authenticated, anon;

grant all on table public.saas_organizations to service_role;
grant all on table public.saas_organization_memberships to service_role;
grant all on table public.saas_organization_admins to service_role;
grant all on table public.saas_org_checkout_reservations to service_role;
grant all on table public.saas_group_eligibility_snapshots to service_role;
grant all on table public.saas_group_billing_adjustments to service_role;
