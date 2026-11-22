-- ============================================================================
-- Batch 3.3 Stage 1 — Pre-purchase founder sales offers (CRM drafts)
--
-- Authoritative commercial proposals bound to a CRM relationship_id.
-- Stage 1: draft create / edit / preview / discard / revision history only.
-- No Stripe Checkout Sessions, coupons, Prices, or public redemption tokens.
-- Service-role only. History is append-friendly (revisions never erase).
-- ============================================================================

create table if not exists public.saas_sales_offers (
  id uuid primary key default gen_random_uuid(),
  relationship_id text not null,
  -- Optional product venue when known; never required for Stage 1 drafts.
  venue_id uuid references public.venues (id) on delete set null,

  status text not null default 'draft'
    check (status in (
      'draft',
      'sent',
      'viewed',
      'accepted',
      'expired',
      'revoked',
      'superseded',
      'discarded'
    )),

  internal_name text not null,
  internal_notes text,
  reason text,

  -- starter | growing | professional (Gather / Celebrate / Flourish)
  plan_key text not null
    check (plan_key in ('starter', 'growing', 'professional')),
  list_amount_cents integer not null check (list_amount_cents > 0),

  -- Exactly one pricing mode
  pricing_kind text not null
    check (pricing_kind in (
      'standard',
      'percent_off',
      'amount_off',
      'fixed_rate'
    )),
  percent_off integer
    check (percent_off is null or (percent_off >= 0 and percent_off <= 100)),
  amount_off_cents integer
    check (amount_off_cents is null or amount_off_cents >= 0),
  fixed_rate_cents integer
    check (fixed_rate_cents is null or fixed_rate_cents >= 0),

  -- Duration of negotiated recurring pricing (not offer link expiry)
  duration_mode text not null default 'ongoing'
    check (duration_mode in ('ongoing', 'billing_cycles')),
  duration_billing_cycles integer
    check (duration_billing_cycles is null or duration_billing_cycles > 0),

  -- After intro / when custom pricing ends
  after_intro_pricing text not null default 'standard_list'
    check (after_intro_pricing in ('standard_list', 'eligible_discount')),

  -- Percent-off tier upgrade policy
  percent_upgrade_policy text not null default 'follow'
    check (percent_upgrade_policy in ('follow', 'end')),

  -- Fixed-rate tier upgrade policy
  fixed_upgrade_policy text not null default 'keep'
    check (fixed_upgrade_policy in ('keep', 'end', 'replace')),
  -- Destination-tier replacement amounts (cents), e.g. {"growing": 22500, "professional": 30000}
  fixed_replacement_prices jsonb not null default '{}'::jsonb,
  fixed_upgrade_fallback text
    check (
      fixed_upgrade_fallback is null
      or fixed_upgrade_fallback in ('standard_list', 'eligible_discount')
    ),

  -- Amount-off: follow new list minus same dollar, or end on upgrade
  amount_upgrade_policy text not null default 'follow'
    check (amount_upgrade_policy in ('follow', 'end')),

  -- White Glove one-time (separate from recurring)
  white_glove_mode text not null default 'none'
    check (white_glove_mode in (
      'none',
      'standard_499',
      'weven_399',
      'custom',
      'waived'
    )),
  white_glove_amount_cents integer not null default 0
    check (white_glove_amount_cents >= 0),

  -- Offer validity (blocks Stage 2 accept; editable on drafts)
  expires_at timestamptz,

  -- Custom offer replaces ordinary promos at checkout (Stage 2)
  replaces_standard_promos boolean not null default true,

  -- Optimistic concurrency
  revision integer not null default 1 check (revision >= 1),

  -- Audit / actor
  created_by_user_id uuid,
  created_by_email text,
  updated_by_user_id uuid,
  updated_by_email text,

  -- Stage 2 placeholders (null in Stage 1)
  supersedes_offer_id uuid
    references public.saas_sales_offers (id) on delete set null,
  superseded_by_offer_id uuid
    references public.saas_sales_offers (id) on delete set null,
  checkout_session_id text,
  checkout_offer_id uuid,
  accepted_at timestamptz,
  sent_at timestamptz,
  viewed_at timestamptz,
  revoked_at timestamptz,
  discarded_at timestamptz,

  terms_hash text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint saas_sales_offers_pricing_kind_chk
    check (
      (pricing_kind = 'standard'
        and percent_off is null
        and amount_off_cents is null
        and fixed_rate_cents is null)
      or (pricing_kind = 'percent_off' and percent_off is not null)
      or (pricing_kind = 'amount_off' and amount_off_cents is not null)
      or (pricing_kind = 'fixed_rate' and fixed_rate_cents is not null)
    ),
  constraint saas_sales_offers_duration_chk
    check (
      (duration_mode = 'ongoing' and duration_billing_cycles is null)
      or (duration_mode = 'billing_cycles' and duration_billing_cycles is not null)
    ),
  constraint saas_sales_offers_fixed_replace_fallback_chk
    check (
      fixed_upgrade_policy <> 'replace'
      or fixed_upgrade_fallback is not null
      or jsonb_typeof(fixed_replacement_prices) = 'object'
    )
);

create index if not exists saas_sales_offers_relationship_idx
  on public.saas_sales_offers (relationship_id);

create index if not exists saas_sales_offers_status_idx
  on public.saas_sales_offers (status);

create index if not exists saas_sales_offers_relationship_active_idx
  on public.saas_sales_offers (relationship_id, updated_at desc)
  where status in ('draft', 'sent', 'viewed');

comment on table public.saas_sales_offers is
  'Batch 3.3 pre-purchase founder custom offers. Stage 1 drafts only; Stage 2 adds send/accept/checkout.';

-- Append-only revision snapshots (pricing + commercial terms)
create table if not exists public.saas_sales_offer_revisions (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null
    references public.saas_sales_offers (id) on delete cascade,
  revision integer not null check (revision >= 1),
  status text not null,
  snapshot jsonb not null,
  changed_by_user_id uuid,
  changed_by_email text,
  change_summary text,
  created_at timestamptz not null default now(),
  unique (offer_id, revision)
);

create index if not exists saas_sales_offer_revisions_offer_idx
  on public.saas_sales_offer_revisions (offer_id, revision desc);

comment on table public.saas_sales_offer_revisions is
  'Append-only history of saas_sales_offers commercial terms.';

alter table public.saas_sales_offers enable row level security;
alter table public.saas_sales_offer_revisions enable row level security;

revoke all on table public.saas_sales_offers from authenticated, anon;
revoke all on table public.saas_sales_offer_revisions from authenticated, anon;

grant all on table public.saas_sales_offers to service_role;
grant all on table public.saas_sales_offer_revisions to service_role;
