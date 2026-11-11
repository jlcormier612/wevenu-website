-- ============================================================================
-- Phase 6 — Refer a Venue (referral submissions, attribution, rewards)
--
-- HTC is authoritative for eligibility; Stripe executes a one-time
-- subscription-scoped credit (negative invoice item). Service-role only.
-- Workflow status is informational; reward eligibility is durable and separate.
--
-- NOT APPLIED until Phase 6 Sandbox migration approval after local readiness.
-- ============================================================================

create table if not exists public.saas_venue_referrals (
  id uuid primary key default gen_random_uuid(),

  referring_venue_id uuid not null references public.venues (id) on delete cascade,
  referring_organization_id uuid references public.saas_organizations (id) on delete set null,
  submitted_by_user_id uuid,
  submitted_by_email text,

  referred_venue_name text not null,
  referred_city text not null,
  referred_state text not null,
  referred_website text not null,
  referred_website_domain text not null,
  referred_contact_email text not null,
  referred_contact_name text not null,
  referred_contact_role text,
  notes text,

  -- Workflow / CRM status (informational — not the sole reward gate)
  status text not null default 'submitted'
    check (status in (
      'submitted',
      'under_review',
      'contacted',
      'interested',
      'converted',
      'qualification_pending',
      'reward_eligible',
      'reward_issued',
      'closed_not_eligible',
      'closed_duplicate',
      'closed_declined'
    )),

  assigned_owner_email text,
  linked_relationship_id text,
  linked_venue_id uuid references public.venues (id) on delete set null,

  -- Durable gates (independent of mutable workflow status)
  is_self_referral boolean not null default false,
  is_same_organization boolean not null default false,
  is_existing_paying_customer boolean not null default false,
  is_duplicate_claim boolean not null default false,
  blocked_reason text,

  program_policy_version text not null,
  qualification_days integer not null
    check (qualification_days > 0),

  audit jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saas_venue_referrals_referrer_idx
  on public.saas_venue_referrals (referring_venue_id, created_at desc);

create index if not exists saas_venue_referrals_status_idx
  on public.saas_venue_referrals (status);

create index if not exists saas_venue_referrals_domain_idx
  on public.saas_venue_referrals (referred_website_domain);

create index if not exists saas_venue_referrals_email_idx
  on public.saas_venue_referrals (lower(referred_contact_email));

create index if not exists saas_venue_referrals_linked_venue_idx
  on public.saas_venue_referrals (linked_venue_id)
  where linked_venue_id is not null;

comment on table public.saas_venue_referrals is
  'Phase 6 Refer a Venue submissions. Prospect contact is founder-only; no automated outreach.';

alter table public.saas_venue_referrals enable row level security;
revoke all on table public.saas_venue_referrals from authenticated, anon;
grant all on table public.saas_venue_referrals to service_role;

-- ---------------------------------------------------------------------------
-- Attribution evidence (durable linkage; earliest valid wins subject to review)
-- ---------------------------------------------------------------------------

create table if not exists public.saas_referral_attributions (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.saas_venue_referrals (id) on delete cascade,
  referred_venue_id uuid not null references public.venues (id) on delete cascade,
  referred_stripe_subscription_id text,
  referred_stripe_customer_id text,

  match_method text not null
    check (match_method in (
      'website_domain',
      'business_identity',
      'founder_confirmed',
      'enrollment_association'
    )),
  match_evidence jsonb not null default '{}'::jsonb,
  confirmed_by_email text,
  confirmed_at timestamptz,

  -- Conversion facts
  converted_at timestamptz,
  first_paid_invoice_id text,
  first_paid_invoice_at timestamptz,
  qualification_starts_at timestamptz,
  qualification_ends_at timestamptz,

  status text not null default 'proposed'
    check (status in (
      'proposed',
      'confirmed',
      'rejected',
      'superseded'
    )),

  rejection_reason text,
  idempotency_key text not null,
  audit jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists saas_referral_attr_idempotency_uidx
  on public.saas_referral_attributions (idempotency_key);

-- One confirmed attribution per referred venue (one reward path).
create unique index if not exists saas_referral_attr_confirmed_venue_uidx
  on public.saas_referral_attributions (referred_venue_id)
  where status = 'confirmed';

create unique index if not exists saas_referral_attr_confirmed_referral_uidx
  on public.saas_referral_attributions (referral_id)
  where status = 'confirmed';

create index if not exists saas_referral_attr_referral_idx
  on public.saas_referral_attributions (referral_id);

create index if not exists saas_referral_attr_qual_idx
  on public.saas_referral_attributions (qualification_ends_at)
  where status = 'confirmed'
    and first_paid_invoice_at is not null;

comment on table public.saas_referral_attributions is
  'Phase 6 referral→venue attribution. Confirmed rows gate conversion/qualification.';

alter table public.saas_referral_attributions enable row level security;
revoke all on table public.saas_referral_attributions from authenticated, anon;
grant all on table public.saas_referral_attributions to service_role;

-- ---------------------------------------------------------------------------
-- Rewards (valuation snapshot + Stripe credit lifecycle)
-- ---------------------------------------------------------------------------

create table if not exists public.saas_referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.saas_venue_referrals (id) on delete cascade,
  attribution_id uuid not null references public.saas_referral_attributions (id) on delete cascade,

  referring_venue_id uuid not null references public.venues (id) on delete cascade,
  referring_stripe_subscription_id text not null,
  referring_stripe_customer_id text not null,
  referred_venue_id uuid not null references public.venues (id) on delete cascade,

  qualifying_invoice_id text,
  eligibility_at timestamptz,

  -- Immutable valuation snapshot (referrer's discounted recurring SaaS amount)
  reward_amount_cents integer not null check (reward_amount_cents > 0),
  currency text not null default 'usd',
  valuation_at timestamptz not null,
  valuation_plan_key text,
  valuation_list_amount_cents integer,
  valuation_source text,
  valuation_snapshot jsonb not null default '{}'::jsonb,

  status text not null default 'pending_qualification'
    check (status in (
      'pending_qualification',
      'eligible',
      'approved',
      'issuing',
      'issued',
      'applied',
      'failed',
      'reversed',
      'voided'
    )),

  approved_by_email text,
  approved_at timestamptz,
  approval_notes text,
  rejected_by_email text,
  rejected_at timestamptz,
  rejection_reason text,

  -- Stripe subscription-scoped negative invoice item (not customer balance)
  stripe_invoice_item_id text,
  stripe_credit_idempotency_key text,
  issued_at timestamptz,
  applied_invoice_id text,
  applied_at timestamptz,

  last_error text,
  retry_count integer not null default 0 check (retry_count >= 0),
  audit jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists saas_referral_rewards_referral_uidx
  on public.saas_referral_rewards (referral_id);

create unique index if not exists saas_referral_rewards_attr_uidx
  on public.saas_referral_rewards (attribution_id);

create unique index if not exists saas_referral_rewards_issue_idem_uidx
  on public.saas_referral_rewards (stripe_credit_idempotency_key)
  where stripe_credit_idempotency_key is not null;

create index if not exists saas_referral_rewards_status_idx
  on public.saas_referral_rewards (status);

create index if not exists saas_referral_rewards_referrer_idx
  on public.saas_referral_rewards (referring_venue_id);

create index if not exists saas_referral_rewards_issue_idx
  on public.saas_referral_rewards (status, updated_at)
  where status in ('eligible', 'approved', 'issuing', 'issued', 'failed');

comment on table public.saas_referral_rewards is
  'Phase 6 one-time thank-you credits. Amount is an immutable snapshot of referrer recurring SaaS value.';

alter table public.saas_referral_rewards enable row level security;
revoke all on table public.saas_referral_rewards from authenticated, anon;
grant all on table public.saas_referral_rewards to service_role;

-- ---------------------------------------------------------------------------
-- Founder activity / notes (never exposed to venues)
-- ---------------------------------------------------------------------------

create table if not exists public.saas_referral_activity (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.saas_venue_referrals (id) on delete cascade,
  actor_email text not null,
  kind text not null
    check (kind in (
      'note',
      'status_change',
      'assignment',
      'attribution',
      'qualification',
      'reward',
      'exception'
    )),
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists saas_referral_activity_referral_idx
  on public.saas_referral_activity (referral_id, created_at desc);

comment on table public.saas_referral_activity is
  'Phase 6 founder-only referral follow-up notes and decisions.';

alter table public.saas_referral_activity enable row level security;
revoke all on table public.saas_referral_activity from authenticated, anon;
grant all on table public.saas_referral_activity to service_role;
